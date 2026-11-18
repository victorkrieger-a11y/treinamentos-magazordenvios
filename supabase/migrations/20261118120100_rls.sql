-- =============================================================================
-- Row Level Security
-- Regra geral:
--   * Supervisor: acesso de leitura a todos os dados administrativos.
--   * Guardião: somente os colaboradores vinculados a ele (vínculo ativo).
--   * Colaborador: somente os próprios dados.
--   * Escritas sensíveis (avaliações, tentativas, respostas, notas, vínculos,
--     perguntas) acontecem SOMENTE por funções SECURITY DEFINER que validam
--     permissões e regras de negócio. Não existem políticas de INSERT/UPDATE/
--     DELETE diretas para esses dados.
--   * O gabarito (question_options, quiz_questions.snapshot) nunca é legível
--     por colaboradores — eles recebem o conteúdo pelas funções de tentativa,
--     sem a alternativa correta, e o gabarito só após a conclusão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER para evitar recursão nas políticas)
-- -----------------------------------------------------------------------------
create or replace function private.current_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function private.is_supervisor()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role() = 'supervisor', false)
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role() in ('supervisor', 'guardian'), false)
$$;

create or replace function private.is_guardian_of(p_collaborator uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaborator_assignments ca
    where ca.collaborator_id = p_collaborator
      and ca.guardian_id = auth.uid()
      and ca.unassigned_at is null
  ) and coalesce(private.current_role() = 'guardian', false)
$$;

-- Pode visualizar dados de desempenho do colaborador informado?
create or replace function private.can_view_collaborator(p_collaborator uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_supervisor()
      or private.is_guardian_of(p_collaborator)
      or (p_collaborator = auth.uid() and private.current_role() is not null)
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- -----------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.collaborator_assignments enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_assignments enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Anônimos não acessam nada.
revoke all on all tables in schema public from anon;
-- Usuários autenticados: apenas leitura direta (escritas via funções).
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- Políticas de leitura
-- -----------------------------------------------------------------------------
create policy "settings: usuários ativos leem" on public.app_settings
  for select to authenticated using (private.current_role() is not null);

create policy "profiles: próprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: supervisor vê todos" on public.profiles
  for select to authenticated using (private.is_supervisor());
create policy "profiles: guardião vê sua equipe" on public.profiles
  for select to authenticated using (private.is_guardian_of(id));
-- Nomes de supervisores e guardiões (ex.: "responsável pelo envio") são
-- visíveis para qualquer usuário ativo. Dados de colaboradores, não.
create policy "profiles: equipe de gestão visível" on public.profiles
  for select to authenticated
  using (role in ('supervisor', 'guardian') and private.current_role() is not null);

create policy "assignments: supervisor" on public.collaborator_assignments
  for select to authenticated using (private.is_supervisor());
create policy "assignments: guardião" on public.collaborator_assignments
  for select to authenticated using (guardian_id = auth.uid() and private.current_role() = 'guardian');
create policy "assignments: colaborador" on public.collaborator_assignments
  for select to authenticated using (collaborator_id = auth.uid() and private.current_role() is not null);

create policy "categories: usuários ativos" on public.categories
  for select to authenticated using (private.current_role() is not null);

-- Banco de perguntas e gabarito: somente supervisor e guardião.
create policy "questions: gestão" on public.questions
  for select to authenticated using (private.is_staff());
create policy "question_options: gestão" on public.question_options
  for select to authenticated using (private.is_staff());

create policy "quizzes: supervisor" on public.quizzes
  for select to authenticated using (private.is_supervisor());
create policy "quizzes: guardião (criadas por ele ou da equipe)" on public.quizzes
  for select to authenticated using (
    private.current_role() = 'guardian' and (
      created_by = auth.uid()
      or exists (select 1 from public.quiz_assignments qa
                 where qa.quiz_id = quizzes.id and private.is_guardian_of(qa.collaborator_id))
    )
  );
create policy "quizzes: colaborador (atribuídas e liberadas)" on public.quizzes
  for select to authenticated using (
    exists (select 1 from public.quiz_assignments qa
            where qa.quiz_id = quizzes.id
              and qa.collaborator_id = auth.uid()
              and qa.assigned_at <= now())
    and private.current_role() = 'collaborator'
  );

-- quiz_questions contém o gabarito no snapshot: somente gestão.
create policy "quiz_questions: supervisor" on public.quiz_questions
  for select to authenticated using (private.is_supervisor());
create policy "quiz_questions: guardião" on public.quiz_questions
  for select to authenticated using (
    private.current_role() = 'guardian' and exists (
      select 1 from public.quizzes q where q.id = quiz_questions.quiz_id
    )
  );

create policy "quiz_assignments: visibilidade" on public.quiz_assignments
  for select to authenticated using (
    private.is_supervisor()
    or private.is_guardian_of(collaborator_id)
    or (private.current_role() = 'guardian' and assigned_by = auth.uid())
    or (collaborator_id = auth.uid() and assigned_at <= now() and private.current_role() is not null)
  );

create policy "quiz_attempts: visibilidade" on public.quiz_attempts
  for select to authenticated using (private.can_view_collaborator(collaborator_id));

-- attempt_answers não contém o gabarito (somente is_correct após a correção).
create policy "attempt_answers: visibilidade" on public.attempt_answers
  for select to authenticated using (
    exists (select 1 from public.quiz_attempts t
            where t.id = attempt_answers.attempt_id
              and private.can_view_collaborator(t.collaborator_id))
  );

create policy "notifications: próprias" on public.notifications
  for select to authenticated using (user_id = auth.uid() and visible_at <= now());

create policy "audit_logs: supervisor" on public.audit_logs
  for select to authenticated using (private.is_supervisor());
create policy "audit_logs: guardião (sua equipe)" on public.audit_logs
  for select to authenticated using (
    private.current_role() = 'guardian'
    and (user_id = auth.uid() or (subject_user_id is not null and private.is_guardian_of(subject_user_id)))
  );
create policy "audit_logs: colaborador (próprios eventos)" on public.audit_logs
  for select to authenticated using (
    private.current_role() = 'collaborator' and subject_user_id = auth.uid()
  );
