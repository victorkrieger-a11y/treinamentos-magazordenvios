-- =============================================================================
-- Treinamentos Magazord Envios — Schema principal
-- Tabelas, tipos, relacionamentos, índices e restrições de integridade.
-- RLS e funções de negócio ficam nas migrações seguintes.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema interno (não exposto pela API REST) para funções auxiliares.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('supervisor', 'guardian', 'collaborator');
create type public.user_status as enum ('invited', 'active', 'inactive');
create type public.question_difficulty as enum ('facil', 'media', 'dificil');
create type public.quiz_mode as enum ('standard', 'custom');
create type public.quiz_status as enum ('active', 'cancelled');
create type public.assignment_status as enum ('pending', 'in_progress', 'completed', 'expired', 'cancelled');
create type public.attempt_status as enum ('in_progress', 'completed', 'abandoned');

-- -----------------------------------------------------------------------------
-- Configurações globais (linha única)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  passing_score numeric(5,2) not null default 80 check (passing_score between 0 and 100),
  attention_score numeric(5,2) not null default 70 check (attention_score between 0 and 100),
  min_answers_for_diagnosis integer not null default 2 check (min_answers_for_diagnosis between 1 and 50),
  default_max_attempts integer not null default 1 check (default_max_attempts between 1 and 10),
  default_due_days integer not null default 7 check (default_due_days between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.app_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users). Criados exclusivamente pelo servidor
-- (service_role) no fluxo de provisionamento — não há cadastro público.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 3 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.user_role not null,
  status public.user_status not null default 'invited',
  job_title text check (job_title is null or char_length(job_title) <= 120),
  started_at date,
  last_access_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_status_idx on public.profiles (role, status);

-- -----------------------------------------------------------------------------
-- Vínculo colaborador ↔ guardião (com histórico).
-- Vínculo ativo = unassigned_at is null. Um colaborador tem no máximo um
-- guardião ativo por vez.
-- -----------------------------------------------------------------------------
create table public.collaborator_assignments (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.profiles (id) on delete restrict,
  guardian_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  check (collaborator_id <> guardian_id),
  check (unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index collaborator_assignments_active_key
  on public.collaborator_assignments (collaborator_id) where unassigned_at is null;
create index collaborator_assignments_guardian_idx
  on public.collaborator_assignments (guardian_id) where unassigned_at is null;

-- -----------------------------------------------------------------------------
-- Banco de perguntas
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  category_id uuid not null references public.categories (id),
  topic text not null check (char_length(btrim(topic)) between 2 and 120),
  statement text not null check (char_length(btrim(statement)) between 10 and 2000),
  difficulty public.question_difficulty not null,
  explanation text not null check (char_length(btrim(explanation)) between 10 and 4000),
  study_tip text check (study_tip is null or char_length(study_tip) <= 500),
  in_standard_set boolean not null default false,
  is_active boolean not null default true,
  version integer not null default 1,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_category_idx on public.questions (category_id) where is_active;

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  option_label char(1) not null check (option_label in ('A', 'B', 'C', 'D')),
  option_text text not null check (char_length(btrim(option_text)) between 1 and 1000),
  is_correct boolean not null default false,
  explanation text check (explanation is null or char_length(explanation) <= 2000),
  unique (question_id, option_label)
);
-- No máximo uma alternativa correta por questão (exatamente uma é garantida
-- pela função save_question e pelo trigger de validação abaixo).
create unique index question_options_one_correct
  on public.question_options (question_id) where is_correct;

-- -----------------------------------------------------------------------------
-- Avaliações
-- -----------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  description text check (description is null or char_length(description) <= 2000),
  quiz_mode public.quiz_mode not null,
  selection jsonb not null default '{}'::jsonb,
  passing_score numeric(5,2) not null check (passing_score between 0 and 100),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  available_from timestamptz not null default now(),
  deadline timestamptz,
  show_feedback boolean not null default true,
  allow_incomplete boolean not null default true,
  question_count integer not null check (question_count between 1 and 200),
  status public.quiz_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (deadline is null or deadline > available_from)
);
create index quizzes_created_by_idx on public.quizzes (created_by);

-- Snapshot imutável do conteúdo aplicado (enunciado, alternativas, gabarito,
-- explicações). Edições no banco de perguntas não alteram avaliações já
-- criadas — o histórico permanece íntegro.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  question_version integer not null,
  question_order integer not null check (question_order > 0),
  points numeric(6,2) not null default 1 check (points > 0),
  snapshot jsonb not null,
  unique (quiz_id, question_id),
  unique (quiz_id, question_order)
);

create table public.quiz_assignments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  collaborator_id uuid not null references public.profiles (id),
  assigned_by uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status public.assignment_status not null default 'pending',
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (quiz_id, collaborator_id)
);
create index quiz_assignments_collaborator_idx on public.quiz_assignments (collaborator_id, status);
create index quiz_assignments_status_idx on public.quiz_assignments (status, due_at);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.quiz_assignments (id) on delete cascade,
  collaborator_id uuid not null references public.profiles (id),
  attempt_number integer not null check (attempt_number between 1 and 10),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric(5,2) check (score between 0 and 100),
  correct_answers integer check (correct_answers >= 0),
  incorrect_answers integer check (incorrect_answers >= 0),
  unanswered integer check (unanswered >= 0),
  total_questions integer not null check (total_questions > 0),
  duration_seconds integer check (duration_seconds >= 0),
  status public.attempt_status not null default 'in_progress',
  finalized_reason text check (finalized_reason in ('submitted', 'deadline')),
  unique (assignment_id, attempt_number),
  check (status <> 'completed' or (score is not null and completed_at is not null))
);
-- Apenas uma tentativa em andamento por atribuição.
create unique index quiz_attempts_one_open
  on public.quiz_attempts (assignment_id) where status = 'in_progress';
create index quiz_attempts_collaborator_idx on public.quiz_attempts (collaborator_id, status, completed_at desc);

-- Uma linha por questão apresentada na tentativa: guarda a ordem efetiva da
-- questão (position) e das alternativas (option_order) e a resposta marcada.
create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  quiz_question_id uuid not null references public.quiz_questions (id),
  question_id uuid not null references public.questions (id),
  category_id uuid not null references public.categories (id),
  topic text not null,
  position integer not null check (position > 0),
  option_order uuid[] not null,
  selected_option_id uuid,
  is_correct boolean,
  answered_at timestamptz,
  unique (attempt_id, quiz_question_id),
  unique (attempt_id, position)
);
create index attempt_answers_question_idx on public.attempt_answers (question_id);

-- -----------------------------------------------------------------------------
-- Notificações internas e logs administrativos
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('quiz_assigned', 'quiz_completed', 'quiz_cancelled', 'quiz_reminder', 'system')),
  link text,
  entity_id uuid,
  visible_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, visible_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  subject_user_id uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_subject_idx on public.audit_logs (subject_user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Integridade
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger questions_touch before update on public.questions
  for each row execute function private.touch_updated_at();

-- Vínculo só entre colaborador e guardião.
create or replace function private.check_collaborator_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.collaborator_id and role = 'collaborator') then
    raise exception 'O usuário vinculado precisa ter o perfil Colaborador.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = new.guardian_id and role = 'guardian') then
    raise exception 'O responsável precisa ter o perfil Guardião.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger collaborator_assignments_check before insert or update on public.collaborator_assignments
  for each row execute function private.check_collaborator_assignment();

-- Resultados concluídos são imutáveis.
create or replace function private.protect_completed_attempt()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'completed' then
    raise exception 'Tentativas concluídas não podem ser alteradas.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger quiz_attempts_protect before update on public.quiz_attempts
  for each row execute function private.protect_completed_attempt();

create or replace function private.protect_completed_answers()
returns trigger language plpgsql set search_path = '' as $$
declare v_status public.attempt_status;
begin
  select status into v_status from public.quiz_attempts where id = old.attempt_id;
  -- Permite apenas a gravação da correção (is_correct) durante a finalização,
  -- que acontece enquanto a tentativa ainda está "in_progress".
  if v_status = 'completed' then
    raise exception 'Respostas de tentativas concluídas não podem ser alteradas.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger attempt_answers_protect before update or delete on public.attempt_answers
  for each row execute function private.protect_completed_answers();

-- Snapshots aplicados não mudam.
create or replace function private.protect_quiz_question_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'O conteúdo aplicado em uma avaliação não pode ser alterado.' using errcode = 'P0001';
end $$;
create trigger quiz_questions_immutable before update on public.quiz_questions
  for each row execute function private.protect_quiz_question_snapshot();

-- Logs são somente inserção.
create or replace function private.audit_logs_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Logs administrativos não podem ser alterados ou excluídos.' using errcode = 'P0001';
end $$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.audit_logs_append_only();
