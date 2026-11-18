-- =============================================================================
-- Apoio às análises de desempenho
-- =============================================================================

-- Tentativa oficial de cada atribuição: a melhor nota entre as tentativas
-- concluídas (empate → a mais recente). Atribuições canceladas são excluídas.
-- security_invoker = true → as políticas RLS do usuário são aplicadas.
create view public.official_attempts with (security_invoker = true) as
select distinct on (t.assignment_id)
       t.*,
       a.quiz_id
  from public.quiz_attempts t
  join public.quiz_assignments a on a.id = t.assignment_id
 where t.status = 'completed'
   and a.status <> 'cancelled'
 order by t.assignment_id, t.score desc, t.completed_at desc;

grant select on public.official_attempts to authenticated;

-- Itens de reforço: questões erradas nas tentativas oficiais, com o tópico e a
-- orientação de estudo do conteúdo aplicado (snapshot). Para o próprio
-- colaborador, enunciado e orientação só aparecem quando o gabarito da
-- avaliação foi liberado.
create or replace function public.get_reinforcement_items(p_collaborator uuid)
returns table (question_id uuid, topic text, category_id uuid, statement text, study_tip text, wrong integer, total integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_self boolean := (p_collaborator = auth.uid());
begin
  if not private.can_view_collaborator(p_collaborator) then
    perform private.raise_forbidden();
  end if;
  return query
  select aa.question_id,
         max(aa.topic),
         (array_agg(aa.category_id))[1],
         case when not v_self or bool_or(q.show_feedback) then max(qq.snapshot ->> 'statement') end,
         case when not v_self or bool_or(q.show_feedback) then max(qq.snapshot ->> 'study_tip') end,
         (count(*) filter (where not aa.is_correct))::int,
         count(*)::int
    from public.attempt_answers aa
    join public.quiz_attempts t on t.id = aa.attempt_id
    join public.quiz_assignments a on a.id = t.assignment_id
    join public.quizzes q on q.id = a.quiz_id
    join public.quiz_questions qq on qq.id = aa.quiz_question_id
   where t.collaborator_id = p_collaborator
     and t.id in (select o.id from public.official_attempts o where o.collaborator_id = p_collaborator)
   group by aa.question_id
  having count(*) filter (where not aa.is_correct) > 0
   order by 6 desc;
end $$;

revoke execute on function public.get_reinforcement_items(uuid) from public, anon;
grant execute on function public.get_reinforcement_items(uuid) to authenticated;
