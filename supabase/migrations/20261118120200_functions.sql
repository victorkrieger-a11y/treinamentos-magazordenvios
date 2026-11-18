-- =============================================================================
-- Funções de negócio (RPC)
-- Todas são SECURITY DEFINER com search_path vazio, validam o perfil do
-- usuário autenticado (auth.uid()) e executam em uma única transação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares internas
-- -----------------------------------------------------------------------------
create or replace function private.raise_forbidden()
returns void language plpgsql as $$
begin
  raise exception 'Você não tem permissão para executar esta ação.' using errcode = '42501';
end $$;

create or replace function private.log_event(
  p_user uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_subject uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (user_id, action, entity_type, entity_id, subject_user_id, metadata)
  values (p_user, p_action, p_entity_type, p_entity_id, p_subject, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Snapshot completo da questão (inclui gabarito). Uso interno.
create or replace function private.question_snapshot(p_question_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id,
    'code', q.code,
    'statement', q.statement,
    'category_id', q.category_id,
    'category_name', c.name,
    'topic', q.topic,
    'difficulty', q.difficulty,
    'explanation', q.explanation,
    'study_tip', q.study_tip,
    'version', q.version,
    'options', (
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.option_label, 'text', o.option_text,
        'is_correct', o.is_correct, 'explanation', o.explanation
      ) order by o.option_label)
      from public.question_options o where o.question_id = q.id
    )
  )
  from public.questions q
  join public.categories c on c.id = q.category_id
  where q.id = p_question_id
$$;

-- Correção oficial de uma tentativa. Idempotente: se já estiver concluída,
-- apenas retorna. Chamada com a linha da tentativa já bloqueada.
create or replace function private.grade_attempt(p_attempt_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_assignment public.quiz_assignments%rowtype;
  v_total int;
  v_correct int;
  v_unanswered int;
  v_points_total numeric;
  v_points_correct numeric;
  v_end timestamptz;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  if not found or v_attempt.status <> 'in_progress' then
    return;
  end if;
  select * into v_assignment from public.quiz_assignments where id = v_attempt.assignment_id for update;

  update public.attempt_answers a
     set is_correct = coalesce((
           select (o ->> 'is_correct')::boolean
           from public.quiz_questions qq,
                jsonb_array_elements(qq.snapshot -> 'options') o
           where qq.id = a.quiz_question_id
             and (o ->> 'id')::uuid = a.selected_option_id
         ), false)
   where a.attempt_id = p_attempt_id;

  select count(*),
         count(*) filter (where a.is_correct),
         count(*) filter (where a.selected_option_id is null),
         coalesce(sum(qq.points), 0),
         coalesce(sum(qq.points) filter (where a.is_correct), 0)
    into v_total, v_correct, v_unanswered, v_points_total, v_points_correct
    from public.attempt_answers a
    join public.quiz_questions qq on qq.id = a.quiz_question_id
   where a.attempt_id = p_attempt_id;

  v_end := now();
  if p_reason = 'deadline' and v_assignment.due_at is not null and v_assignment.due_at < v_end then
    v_end := greatest(v_assignment.due_at, v_attempt.started_at);
  end if;

  update public.quiz_attempts
     set status = 'completed',
         completed_at = v_end,
         total_questions = v_total,
         correct_answers = v_correct,
         incorrect_answers = v_total - v_correct,
         unanswered = v_unanswered,
         score = case when v_points_total = 0 then 0
                      else round(v_points_correct * 100.0 / v_points_total, 2) end,
         duration_seconds = greatest(0, floor(extract(epoch from (v_end - v_attempt.started_at)))::int),
         finalized_reason = p_reason
   where id = p_attempt_id;

  update public.quiz_assignments
     set status = 'completed',
         completed_at = coalesce(completed_at, v_end)
   where id = v_attempt.assignment_id;

  perform private.log_event(
    case when p_reason = 'submitted' then v_attempt.collaborator_id else null end,
    'attempt_completed', 'quiz_attempt', p_attempt_id, v_attempt.collaborator_id,
    jsonb_build_object(
      'quiz_id', v_assignment.quiz_id,
      'score', case when v_points_total = 0 then 0 else round(v_points_correct * 100.0 / v_points_total, 2) end,
      'reason', p_reason
    )
  );

  insert into public.notifications (user_id, title, message, type, link, entity_id)
  select v_assignment.assigned_by,
         'Avaliação concluída',
         p.full_name || ' concluiu a avaliação "' || q.title || '".',
         'quiz_completed',
         '/resultado/' || p_attempt_id,
         p_attempt_id
    from public.profiles p, public.quizzes q
   where p.id = v_attempt.collaborator_id and q.id = v_assignment.quiz_id;
end $$;

-- -----------------------------------------------------------------------------
-- Sessão
-- -----------------------------------------------------------------------------
-- Registra o último acesso e ativa contas convidadas no primeiro login.
create or replace function public.touch_last_access()
returns public.user_status language plpgsql security definer set search_path = '' as $$
declare v_status public.user_status;
begin
  update public.profiles
     set last_access_at = now(),
         status = case when status = 'invited' then 'active'::public.user_status else status end
   where id = auth.uid()
  returning status into v_status;
  return v_status;
end $$;

-- -----------------------------------------------------------------------------
-- Provisionamento (somente service_role — chamado pelo servidor Next.js
-- depois de validar que o solicitante é supervisor)
-- -----------------------------------------------------------------------------
create or replace function public.provision_profile(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_actor uuid := nullif(p ->> 'actor_id', '')::uuid;
  v_role public.user_role := (p ->> 'role')::public.user_role;
  v_guardian uuid := nullif(p ->> 'guardian_id', '')::uuid;
begin
  insert into public.profiles (id, full_name, email, role, status, job_title, started_at, created_by)
  values (
    v_id,
    btrim(p ->> 'full_name'),
    lower(btrim(p ->> 'email')),
    v_role,
    coalesce((p ->> 'status')::public.user_status, 'invited'),
    nullif(btrim(coalesce(p ->> 'job_title', '')), ''),
    nullif(p ->> 'started_at', '')::date,
    v_actor
  );

  perform private.log_event(v_actor, 'user_created', 'profile', v_id, v_id,
    jsonb_build_object('role', v_role, 'full_name', btrim(p ->> 'full_name')));

  if v_guardian is not null then
    if v_role <> 'collaborator' then
      raise exception 'Somente colaboradores podem ser vinculados a um guardião.' using errcode = 'P0001';
    end if;
    insert into public.collaborator_assignments (collaborator_id, guardian_id, assigned_by)
    values (v_id, v_guardian, v_actor);
    perform private.log_event(v_actor, 'guardian_linked', 'profile', v_id, v_id,
      jsonb_build_object('guardian_id', v_guardian));
  end if;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Gestão de usuários (supervisor)
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_profile(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.profiles%rowtype;
  v_new_status public.user_status;
begin
  if not private.is_supervisor() then perform private.raise_forbidden(); end if;
  select * into v_old from public.profiles where id = p_id for update;
  if not found then raise exception 'Usuário não encontrado.' using errcode = 'P0002'; end if;

  v_new_status := coalesce((p ->> 'status')::public.user_status, v_old.status);
  if p_id = auth.uid() and v_new_status = 'inactive' then
    raise exception 'Você não pode desativar a própria conta.' using errcode = 'P0001';
  end if;
  if v_old.role = 'supervisor' and v_new_status = 'inactive' and (
    select count(*) from public.profiles where role = 'supervisor' and status = 'active' and id <> p_id
  ) = 0 then
    raise exception 'A plataforma precisa de pelo menos um supervisor ativo.' using errcode = 'P0001';
  end if;
  -- Contas convidadas só se tornam ativas no primeiro acesso.
  if v_old.status = 'invited' and v_new_status = 'active' then
    v_new_status := 'invited';
  end if;

  update public.profiles set
    full_name = coalesce(nullif(btrim(p ->> 'full_name'), ''), full_name),
    job_title = case when p ? 'job_title' then nullif(btrim(coalesce(p ->> 'job_title', '')), '') else job_title end,
    started_at = case when p ? 'started_at' then nullif(p ->> 'started_at', '')::date else started_at end,
    status = v_new_status
  where id = p_id;

  perform private.log_event(auth.uid(),
    case when v_new_status = 'inactive' and v_old.status <> 'inactive' then 'user_deactivated'
         when v_new_status <> 'inactive' and v_old.status = 'inactive' then 'user_reactivated'
         else 'user_updated' end,
    'profile', p_id, p_id, p - 'status' || jsonb_build_object('status', v_new_status));

  -- Guardião desativado: libera os colaboradores vinculados.
  if v_old.role = 'guardian' and v_new_status = 'inactive' then
    update public.collaborator_assignments set unassigned_at = now()
     where guardian_id = p_id and unassigned_at is null;
  end if;
end $$;

-- Vincula (ou desvincula, com p_guardian nulo) um colaborador a um guardião.
create or replace function public.assign_guardian(p_collaborator uuid, p_guardian uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current uuid;
begin
  if not private.is_supervisor() then perform private.raise_forbidden(); end if;

  select guardian_id into v_current from public.collaborator_assignments
   where collaborator_id = p_collaborator and unassigned_at is null for update;

  if v_current is not distinct from p_guardian then return; end if;

  if p_guardian is not null and not exists (
    select 1 from public.profiles where id = p_guardian and role = 'guardian' and status <> 'inactive'
  ) then
    raise exception 'Guardião inválido ou inativo.' using errcode = 'P0001';
  end if;

  update public.collaborator_assignments set unassigned_at = now()
   where collaborator_id = p_collaborator and unassigned_at is null;

  if v_current is not null then
    perform private.log_event(auth.uid(), 'guardian_unlinked', 'profile', p_collaborator, p_collaborator,
      jsonb_build_object('guardian_id', v_current));
  end if;

  if p_guardian is not null then
    insert into public.collaborator_assignments (collaborator_id, guardian_id, assigned_by)
    values (p_collaborator, p_guardian, auth.uid());
    perform private.log_event(auth.uid(), 'guardian_linked', 'profile', p_collaborator, p_collaborator,
      jsonb_build_object('guardian_id', p_guardian));
  end if;
end $$;

create or replace function public.update_settings(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_supervisor() then perform private.raise_forbidden(); end if;
  update public.app_settings set
    passing_score = coalesce((p ->> 'passing_score')::numeric, passing_score),
    attention_score = coalesce((p ->> 'attention_score')::numeric, attention_score),
    min_answers_for_diagnosis = coalesce((p ->> 'min_answers_for_diagnosis')::int, min_answers_for_diagnosis),
    default_max_attempts = coalesce((p ->> 'default_max_attempts')::int, default_max_attempts),
    default_due_days = coalesce((p ->> 'default_due_days')::int, default_due_days),
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;
  perform private.log_event(auth.uid(), 'settings_updated', 'app_settings', null, null, p);
end $$;

-- -----------------------------------------------------------------------------
-- Banco de perguntas (supervisor)
-- p: { id?, category_id, topic, statement, difficulty, explanation, study_tip,
--      in_standard_set, is_active, options: [{label, text, is_correct, explanation}] x4 }
-- Cada edição incrementa a versão. Avaliações já criadas usam snapshots e não
-- são afetadas.
-- -----------------------------------------------------------------------------
create or replace function public.save_question(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_opts jsonb := p -> 'options';
  v_correct int;
  v_labels text[];
  v_opt jsonb;
begin
  if not private.is_supervisor() then perform private.raise_forbidden(); end if;

  if v_opts is null or jsonb_typeof(v_opts) <> 'array' or jsonb_array_length(v_opts) <> 4 then
    raise exception 'A questão precisa ter exatamente quatro alternativas.' using errcode = 'P0001';
  end if;
  select count(*) filter (where (o ->> 'is_correct')::boolean),
         array_agg(o ->> 'label' order by o ->> 'label')
    into v_correct, v_labels
    from jsonb_array_elements(v_opts) o;
  if v_correct <> 1 then
    raise exception 'A questão precisa ter exatamente uma alternativa correta.' using errcode = 'P0001';
  end if;
  if v_labels <> array['A','B','C','D'] then
    raise exception 'As alternativas devem ser identificadas como A, B, C e D.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.questions (category_id, topic, statement, difficulty, explanation, study_tip,
                                  in_standard_set, is_active, created_by, updated_by)
    values ((p ->> 'category_id')::uuid, btrim(p ->> 'topic'), btrim(p ->> 'statement'),
            (p ->> 'difficulty')::public.question_difficulty, btrim(p ->> 'explanation'),
            nullif(btrim(coalesce(p ->> 'study_tip', '')), ''),
            coalesce((p ->> 'in_standard_set')::boolean, false),
            coalesce((p ->> 'is_active')::boolean, true), auth.uid(), auth.uid())
    returning id into v_id;
    for v_opt in select * from jsonb_array_elements(v_opts) loop
      insert into public.question_options (question_id, option_label, option_text, is_correct, explanation)
      values (v_id, v_opt ->> 'label', btrim(v_opt ->> 'text'), (v_opt ->> 'is_correct')::boolean,
              nullif(btrim(coalesce(v_opt ->> 'explanation', '')), ''));
    end loop;
    perform private.log_event(auth.uid(), 'question_created', 'question', v_id, null, '{}'::jsonb);
  else
    update public.questions set
      category_id = (p ->> 'category_id')::uuid,
      topic = btrim(p ->> 'topic'),
      statement = btrim(p ->> 'statement'),
      difficulty = (p ->> 'difficulty')::public.question_difficulty,
      explanation = btrim(p ->> 'explanation'),
      study_tip = nullif(btrim(coalesce(p ->> 'study_tip', '')), ''),
      in_standard_set = coalesce((p ->> 'in_standard_set')::boolean, in_standard_set),
      is_active = coalesce((p ->> 'is_active')::boolean, is_active),
      version = version + 1,
      updated_by = auth.uid()
    where id = v_id;
    if not found then raise exception 'Questão não encontrada.' using errcode = 'P0002'; end if;
    -- Primeiro remove a marcação de correta para não violar o índice único.
    update public.question_options set is_correct = false where question_id = v_id;
    for v_opt in select * from jsonb_array_elements(v_opts) loop
      update public.question_options
         set option_text = btrim(v_opt ->> 'text'),
             is_correct = (v_opt ->> 'is_correct')::boolean,
             explanation = nullif(btrim(coalesce(v_opt ->> 'explanation', '')), '')
       where question_id = v_id and option_label = v_opt ->> 'label';
    end loop;
    perform private.log_event(auth.uid(), 'question_updated', 'question', v_id, null,
      jsonb_build_object('version', (select version from public.questions where id = v_id)));
  end if;
  return v_id;
end $$;

create or replace function public.set_question_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_supervisor() then perform private.raise_forbidden(); end if;
  update public.questions set is_active = p_active, updated_by = auth.uid() where id = p_id;
  if not found then raise exception 'Questão não encontrada.' using errcode = 'P0002'; end if;
  perform private.log_event(auth.uid(), case when p_active then 'question_activated' else 'question_deactivated' end,
    'question', p_id, null, '{}'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- Criação e envio de avaliações (supervisor ou guardião)
-- -----------------------------------------------------------------------------
create or replace function public.create_quiz(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := private.current_role();
  v_uid uuid := auth.uid();
  v_quiz_id uuid;
  v_mode public.quiz_mode := (p ->> 'mode')::public.quiz_mode;
  v_selection jsonb := coalesce(p -> 'selection', '{}'::jsonb);
  v_collaborators uuid[];
  v_questions uuid[] := '{}';
  v_item jsonb;
  v_ids uuid[];
  v_available timestamptz := coalesce(nullif(p ->> 'available_from', '')::timestamptz, now());
  v_deadline timestamptz := nullif(p ->> 'deadline', '')::timestamptz;
  v_passing numeric;
  v_title text := btrim(p ->> 'title');
  v_sender text;
  v_invalid int;
begin
  if v_role is null or v_role not in ('supervisor', 'guardian') then
    perform private.raise_forbidden();
  end if;

  select coalesce(nullif(p ->> 'passing_score', '')::numeric, s.passing_score)
    into v_passing from public.app_settings s where s.id = 1;

  -- Colaboradores
  select coalesce(array_agg(distinct x::uuid), '{}') into v_collaborators
    from jsonb_array_elements_text(coalesce(p -> 'collaborator_ids', '[]'::jsonb)) x;
  if cardinality(v_collaborators) = 0 then
    raise exception 'Selecione pelo menos um colaborador.' using errcode = 'P0001';
  end if;

  select count(*) into v_invalid from unnest(v_collaborators) c(id)
   where not exists (select 1 from public.profiles pr
                     where pr.id = c.id and pr.role = 'collaborator' and pr.status <> 'inactive');
  if v_invalid > 0 then
    raise exception 'Há colaboradores inválidos ou inativos na seleção.' using errcode = 'P0001';
  end if;

  if v_role = 'guardian' then
    select count(*) into v_invalid from unnest(v_collaborators) c(id)
     where not private.is_guardian_of(c.id);
    if v_invalid > 0 then
      raise exception 'Guardiões só podem enviar avaliações para colaboradores da própria equipe.' using errcode = '42501';
    end if;
  end if;

  if v_deadline is not null and v_deadline <= greatest(v_available, now()) then
    raise exception 'O prazo de conclusão precisa ser posterior à data de envio.' using errcode = 'P0001';
  end if;

  -- Perguntas
  if v_mode = 'standard' then
    select coalesce(array_agg(id order by code nulls last, created_at), '{}') into v_questions
      from public.questions where is_active and in_standard_set;
  elsif v_selection ->> 'type' = 'manual' then
    select coalesce(array_agg(q.id order by ord), '{}') into v_questions
      from jsonb_array_elements_text(coalesce(v_selection -> 'question_ids', '[]'::jsonb)) with ordinality s(qid, ord)
      join public.questions q on q.id = s.qid::uuid and q.is_active;
    if cardinality(v_questions) <> jsonb_array_length(coalesce(v_selection -> 'question_ids', '[]'::jsonb)) then
      raise exception 'Algumas questões selecionadas não estão disponíveis.' using errcode = 'P0001';
    end if;
  elsif v_selection ->> 'type' = 'categories' then
    for v_item in select * from jsonb_array_elements(coalesce(v_selection -> 'items', '[]'::jsonb)) loop
      if coalesce((v_item ->> 'count')::int, 0) <= 0 then continue; end if;
      select array_agg(id) into v_ids from (
        select id from public.questions
         where is_active and category_id = (v_item ->> 'category_id')::uuid
           and id <> all (v_questions)
         order by random()
         limit (v_item ->> 'count')::int
      ) s;
      if coalesce(cardinality(v_ids), 0) < (v_item ->> 'count')::int then
        raise exception 'Não há questões ativas suficientes em uma das categorias selecionadas.' using errcode = 'P0001';
      end if;
      v_questions := v_questions || v_ids;
    end loop;
  else
    raise exception 'Seleção de questões inválida.' using errcode = 'P0001';
  end if;

  if cardinality(v_questions) = 0 then
    raise exception 'A avaliação precisa ter pelo menos uma questão.' using errcode = 'P0001';
  end if;

  insert into public.quizzes (title, description, quiz_mode, selection, passing_score, max_attempts,
                              available_from, deadline, show_feedback, allow_incomplete,
                              question_count, created_by)
  values (v_title, nullif(btrim(coalesce(p ->> 'description', '')), ''), v_mode, v_selection, v_passing,
          coalesce(nullif(p ->> 'max_attempts', '')::int, 1), v_available, v_deadline,
          coalesce((p ->> 'show_feedback')::boolean, true),
          coalesce((p ->> 'allow_incomplete')::boolean, true),
          cardinality(v_questions), v_uid)
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, question_id, question_version, question_order, snapshot)
  select v_quiz_id, q.id, q.version, s.ord, private.question_snapshot(q.id)
    from unnest(v_questions) with ordinality s(qid, ord)
    join public.questions q on q.id = s.qid;

  insert into public.quiz_assignments (quiz_id, collaborator_id, assigned_by, assigned_at, due_at)
  select v_quiz_id, c.id, v_uid, v_available, v_deadline from unnest(v_collaborators) c(id);

  select full_name into v_sender from public.profiles where id = v_uid;

  insert into public.notifications (user_id, title, message, type, link, entity_id, visible_at)
  select qa.collaborator_id,
         'Nova avaliação: ' || v_title,
         'Enviada por ' || v_sender ||
           case when v_deadline is not null
                then '. Prazo: ' || to_char(v_deadline at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || '.'
                else '. Sem prazo definido.' end,
         'quiz_assigned', '/minhas-avaliacoes/' || qa.id, qa.id, v_available
    from public.quiz_assignments qa where qa.quiz_id = v_quiz_id;

  perform private.log_event(v_uid, 'quiz_created', 'quiz', v_quiz_id, null,
    jsonb_build_object('title', v_title, 'questions', cardinality(v_questions),
                       'collaborators', cardinality(v_collaborators), 'mode', v_mode));
  insert into public.audit_logs (user_id, action, entity_type, entity_id, subject_user_id, metadata)
  select v_uid, 'quiz_assigned', 'quiz_assignment', qa.id, qa.collaborator_id,
         jsonb_build_object('quiz_id', v_quiz_id, 'title', v_title)
    from public.quiz_assignments qa where qa.quiz_id = v_quiz_id;

  return v_quiz_id;
end $$;

-- Pode gerenciar (cancelar) a atribuição?
create or replace function private.can_manage_assignment(p_assignment public.quiz_assignments)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_supervisor()
      or (private.current_role() = 'guardian'
          and (p_assignment.assigned_by = auth.uid() or private.is_guardian_of(p_assignment.collaborator_id)))
$$;

create or replace function public.cancel_assignment(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_a public.quiz_assignments%rowtype;
begin
  select * into v_a from public.quiz_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Atribuição não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_manage_assignment(v_a) then perform private.raise_forbidden(); end if;
  if v_a.status in ('completed', 'cancelled') then
    raise exception 'Avaliações concluídas ou já canceladas não podem ser canceladas.' using errcode = 'P0001';
  end if;

  update public.quiz_attempts set status = 'abandoned'
   where assignment_id = p_assignment_id and status = 'in_progress';
  update public.quiz_assignments set status = 'cancelled', cancelled_at = now() where id = p_assignment_id;

  insert into public.notifications (user_id, title, message, type, entity_id)
  select v_a.collaborator_id, 'Avaliação cancelada', 'A avaliação "' || q.title || '" foi cancelada.',
         'quiz_cancelled', p_assignment_id
    from public.quizzes q where q.id = v_a.quiz_id;
  perform private.log_event(auth.uid(), 'assignment_cancelled', 'quiz_assignment', p_assignment_id,
    v_a.collaborator_id, jsonb_build_object('quiz_id', v_a.quiz_id));
end $$;

create or replace function public.cancel_quiz(p_quiz_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_q public.quizzes%rowtype;
  v_a record;
  v_count int := 0;
begin
  select * into v_q from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'Avaliação não encontrada.' using errcode = 'P0002'; end if;
  if not (private.is_supervisor() or (private.current_role() = 'guardian' and v_q.created_by = auth.uid())) then
    perform private.raise_forbidden();
  end if;
  for v_a in select id from public.quiz_assignments
              where quiz_id = p_quiz_id and status in ('pending', 'in_progress', 'expired') loop
    perform public.cancel_assignment(v_a.id);
    v_count := v_count + 1;
  end loop;
  update public.quizzes set status = 'cancelled', cancelled_at = now() where id = p_quiz_id;
  perform private.log_event(auth.uid(), 'quiz_cancelled', 'quiz', p_quiz_id, null,
    jsonb_build_object('cancelled_assignments', v_count));
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Prazos: finaliza tentativas abertas e marca atribuições expiradas.
-- Executada de forma preguiçosa pelo servidor ao carregar painéis.
-- -----------------------------------------------------------------------------
create or replace function public.expire_overdue()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_attempt record;
  v_count int := 0;
begin
  for v_attempt in
    select t.id from public.quiz_attempts t
      join public.quiz_assignments a on a.id = t.assignment_id
     where t.status = 'in_progress' and a.due_at is not null and a.due_at < now()
  loop
    perform private.grade_attempt(v_attempt.id, 'deadline');
    v_count := v_count + 1;
  end loop;

  with expired as (
    update public.quiz_assignments a set status = 'expired'
     where a.status in ('pending', 'in_progress') and a.due_at is not null and a.due_at < now()
    returning a.id, a.collaborator_id, a.quiz_id
  )
  insert into public.audit_logs (user_id, action, entity_type, entity_id, subject_user_id, metadata)
  select null, 'assignment_expired', 'quiz_assignment', e.id, e.collaborator_id,
         jsonb_build_object('quiz_id', e.quiz_id)
    from expired e;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Execução da avaliação (colaborador)
-- -----------------------------------------------------------------------------
create or replace function public.start_attempt(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_a public.quiz_assignments%rowtype;
  v_q public.quizzes%rowtype;
  v_open uuid;
  v_done int;
  v_attempt uuid;
  v_total int;
begin
  if private.current_role() is distinct from 'collaborator' then perform private.raise_forbidden(); end if;

  select * into v_a from public.quiz_assignments where id = p_assignment_id for update;
  if not found or v_a.collaborator_id <> auth.uid() then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0002';
  end if;
  select * into v_q from public.quizzes where id = v_a.quiz_id;

  if v_a.status = 'cancelled' or v_q.status = 'cancelled' then
    raise exception 'Esta avaliação foi cancelada.' using errcode = 'P0001';
  end if;
  if v_a.assigned_at > now() then
    raise exception 'Esta avaliação ainda não está disponível.' using errcode = 'P0001';
  end if;

  select id into v_open from public.quiz_attempts
   where assignment_id = p_assignment_id and status = 'in_progress';
  if v_open is not null then
    return v_open; -- retoma a tentativa em andamento
  end if;

  if v_a.due_at is not null and v_a.due_at < now() then
    if v_a.status in ('pending', 'in_progress') then
      update public.quiz_assignments set status = 'expired' where id = p_assignment_id;
    end if;
    raise exception 'O prazo desta avaliação foi encerrado.' using errcode = 'P0001';
  end if;

  select count(*) into v_done from public.quiz_attempts
   where assignment_id = p_assignment_id and status = 'completed';
  if v_done >= v_q.max_attempts then
    raise exception 'Você já utilizou todas as tentativas permitidas para esta avaliação.' using errcode = 'P0001';
  end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = v_q.id;

  insert into public.quiz_attempts (assignment_id, collaborator_id, attempt_number, total_questions)
  values (p_assignment_id, auth.uid(),
          (select coalesce(max(attempt_number), 0) + 1 from public.quiz_attempts where assignment_id = p_assignment_id),
          v_total)
  returning id into v_attempt;

  -- Randomização: ordem das questões e das alternativas, gravadas por tentativa.
  insert into public.attempt_answers (attempt_id, quiz_question_id, question_id, category_id, topic, position, option_order)
  select v_attempt, qq.id, qq.question_id, (qq.snapshot ->> 'category_id')::uuid, qq.snapshot ->> 'topic',
         row_number() over (order by random()),
         array(select (o ->> 'id')::uuid from jsonb_array_elements(qq.snapshot -> 'options') o order by random())
    from public.quiz_questions qq
   where qq.quiz_id = v_q.id;

  if v_a.status = 'pending' then
    update public.quiz_assignments set status = 'in_progress' where id = p_assignment_id;
  end if;

  perform private.log_event(auth.uid(), 'attempt_started', 'quiz_attempt', v_attempt, auth.uid(),
    jsonb_build_object('quiz_id', v_q.id, 'title', v_q.title));
  return v_attempt;
end $$;

-- Conteúdo da tentativa SEM gabarito.
create or replace function public.get_attempt(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_t public.quiz_attempts%rowtype;
  v_result jsonb;
begin
  select * into v_t from public.quiz_attempts where id = p_attempt_id;
  if not found or v_t.collaborator_id <> auth.uid() or private.current_role() is distinct from 'collaborator' then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'attempt_id', v_t.id,
    'assignment_id', v_t.assignment_id,
    'status', v_t.status,
    'attempt_number', v_t.attempt_number,
    'started_at', v_t.started_at,
    'quiz', jsonb_build_object('title', q.title, 'description', q.description,
                               'allow_incomplete', q.allow_incomplete, 'max_attempts', q.max_attempts),
    'due_at', a.due_at,
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'answer_id', aa.id,
        'position', aa.position,
        'statement', qq.snapshot ->> 'statement',
        'category', qq.snapshot ->> 'category_name',
        'selected_option_id', aa.selected_option_id,
        'options', (
          select jsonb_agg(jsonb_build_object(
            'id', o.oid,
            'label', chr(64 + o.ord::int),
            'text', (select x ->> 'text' from jsonb_array_elements(qq.snapshot -> 'options') x
                     where (x ->> 'id')::uuid = o.oid)
          ) order by o.ord)
          from unnest(aa.option_order) with ordinality o(oid, ord)
        )
      ) order by aa.position)
      from public.attempt_answers aa
      join public.quiz_questions qq on qq.id = aa.quiz_question_id
      where aa.attempt_id = v_t.id
    )
  ) into v_result
  from public.quiz_assignments a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = v_t.assignment_id;

  return v_result;
end $$;

create or replace function public.save_answer(p_attempt_id uuid, p_answer_id uuid, p_option_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_t public.quiz_attempts%rowtype;
  v_due timestamptz;
  v_now timestamptz := now();
begin
  select * into v_t from public.quiz_attempts where id = p_attempt_id for update;
  if not found or v_t.collaborator_id <> auth.uid() or private.current_role() is distinct from 'collaborator' then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;
  if v_t.status <> 'in_progress' then
    raise exception 'Esta tentativa já foi finalizada.' using errcode = 'P0001';
  end if;
  select due_at into v_due from public.quiz_assignments where id = v_t.assignment_id;
  if v_due is not null and v_due < v_now then
    raise exception 'O prazo desta avaliação foi encerrado.' using errcode = 'P0001';
  end if;

  update public.attempt_answers
     set selected_option_id = p_option_id, answered_at = v_now
   where id = p_answer_id and attempt_id = p_attempt_id
     and (p_option_id is null or p_option_id = any (option_order));
  if not found then
    raise exception 'Resposta inválida.' using errcode = 'P0001';
  end if;
  return v_now;
end $$;

create or replace function public.finalize_attempt(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_t public.quiz_attempts%rowtype;
  v_allow boolean;
  v_missing int;
begin
  -- Bloqueio da linha: submissões concorrentes/duplicadas são serializadas.
  select * into v_t from public.quiz_attempts where id = p_attempt_id for update;
  if not found or v_t.collaborator_id <> auth.uid() or private.current_role() is distinct from 'collaborator' then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;

  if v_t.status = 'in_progress' then
    select q.allow_incomplete into v_allow
      from public.quiz_assignments a join public.quizzes q on q.id = a.quiz_id
     where a.id = v_t.assignment_id;
    select count(*) into v_missing from public.attempt_answers
     where attempt_id = p_attempt_id and selected_option_id is null;
    if not v_allow and v_missing > 0 then
      raise exception 'Responda todas as questões antes de finalizar (% pendente(s)).', v_missing using errcode = 'P0001';
    end if;
    perform private.grade_attempt(p_attempt_id, 'submitted');
  elsif v_t.status = 'abandoned' then
    raise exception 'Esta tentativa foi cancelada.' using errcode = 'P0001';
  end if;
  -- Já concluída: retorna o mesmo resultado (nenhuma nota duplicada).

  select * into v_t from public.quiz_attempts where id = p_attempt_id;
  return jsonb_build_object('attempt_id', v_t.id, 'score', v_t.score,
                            'correct_answers', v_t.correct_answers, 'total_questions', v_t.total_questions);
end $$;

-- Revisão completa com gabarito — somente após a conclusão.
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_t public.quiz_attempts%rowtype;
  v_show boolean;
begin
  select * into v_t from public.quiz_attempts where id = p_attempt_id;
  if not found or not private.can_view_collaborator(v_t.collaborator_id) then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;
  if v_t.status <> 'completed' then
    raise exception 'O gabarito fica disponível somente após a conclusão da avaliação.' using errcode = 'P0001';
  end if;
  select q.show_feedback into v_show
    from public.quiz_assignments a join public.quizzes q on q.id = a.quiz_id where a.id = v_t.assignment_id;
  if v_t.collaborator_id = auth.uid() and not v_show then
    raise exception 'O gabarito desta avaliação não foi liberado.' using errcode = '42501';
  end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'position', aa.position,
      'statement', qq.snapshot ->> 'statement',
      'category', qq.snapshot ->> 'category_name',
      'topic', qq.snapshot ->> 'topic',
      'difficulty', qq.snapshot ->> 'difficulty',
      'explanation', qq.snapshot ->> 'explanation',
      'study_tip', qq.snapshot ->> 'study_tip',
      'is_correct', aa.is_correct,
      'selected_option_id', aa.selected_option_id,
      'options', (
        select jsonb_agg(jsonb_build_object(
          'id', o.oid,
          'label', chr(64 + o.ord::int),
          'text', x ->> 'text',
          'is_correct', (x ->> 'is_correct')::boolean,
          'explanation', x ->> 'explanation'
        ) order by o.ord)
        from unnest(aa.option_order) with ordinality o(oid, ord)
        join lateral jsonb_array_elements(qq.snapshot -> 'options') x on (x ->> 'id')::uuid = o.oid
      )
    ) order by aa.position)
    from public.attempt_answers aa
    join public.quiz_questions qq on qq.id = aa.quiz_question_id
    where aa.attempt_id = p_attempt_id
  );
end $$;

-- -----------------------------------------------------------------------------
-- Notificações
-- -----------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and visible_at <= now()
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.touch_last_access(),
  public.admin_update_profile(uuid, jsonb),
  public.assign_guardian(uuid, uuid),
  public.update_settings(jsonb),
  public.save_question(jsonb),
  public.set_question_active(uuid, boolean),
  public.create_quiz(jsonb),
  public.cancel_assignment(uuid),
  public.cancel_quiz(uuid),
  public.expire_overdue(),
  public.start_attempt(uuid),
  public.get_attempt(uuid),
  public.save_answer(uuid, uuid, uuid),
  public.finalize_attempt(uuid),
  public.get_attempt_review(uuid),
  public.mark_notifications_read(uuid[])
to authenticated;
revoke execute on function public.provision_profile(jsonb) from authenticated;
grant execute on function public.provision_profile(jsonb) to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Funções criadas no futuro não ficam executáveis por padrão para anon.
alter default privileges in schema public revoke execute on functions from public, anon;
