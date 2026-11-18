# Treinamentos Magazord Envios

Plataforma interna para capacitação, avaliação e acompanhamento do desempenho da equipe de suporte do Magazord Envios.

São três perfis:

- **Supervisor**: gestão geral, colaboradores, guardiões, banco de perguntas, avaliações, relatórios e configurações.
- **Guardião**: acompanha a própria equipe, envia avaliações e analisa resultados.
- **Colaborador**: responde às avaliações e acompanha o próprio desempenho.

---

## Sumário

1. [Stack](#stack)
2. [Arquitetura](#arquitetura)
3. [Segurança](#segurança)
4. [Executar localmente](#executar-localmente)
5. [Variáveis de ambiente](#variáveis-de-ambiente)
6. [Banco de dados: migrações e seed](#banco-de-dados-migrações-e-seed)
7. [Criar o primeiro supervisor](#criar-o-primeiro-supervisor)
8. [Primeiros passos na plataforma](#primeiros-passos-na-plataforma)
9. [Configurar o Supabase em produção](#configurar-o-supabase-em-produção)
10. [Publicar na Vercel](#publicar-na-vercel)
11. [Testes](#testes)
12. [Decisões técnicas](#decisões-técnicas)
13. [Estrutura de pastas](#estrutura-de-pastas)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilização / UI | Tailwind CSS 4, shadcn/ui (Radix), Lucide React |
| Gráficos / Tabelas | Recharts, TanStack Table |
| Formulários / Validação | React Hook Form + Zod (o mesmo schema é usado no cliente e no servidor) |
| Backend | Server Actions + Route Handlers + funções PostgreSQL (RPC) |
| Banco / Auth | Supabase (PostgreSQL 17, Auth, RLS) |
| Testes | Vitest (unitários e de integração com o banco) e Playwright (E2E) |
| Hospedagem | Vercel + GitHub |

## Arquitetura

```
Navegador ──► Next.js (Vercel)
               ├─ Middleware: valida a sessão (Supabase Auth) e protege rotas
               ├─ Server Components: leem dados com a sessão do usuário (o RLS se aplica)
               ├─ Server Actions: validam com Zod e chamam funções do banco
               └─ Route Handler: exportação CSV
                         │
                         ▼
               Supabase PostgreSQL
               ├─ RLS em todas as tabelas
               ├─ Funções SECURITY DEFINER com as regras de negócio
               │   (criação/envio, randomização, gravação de respostas, correção,
               │    tentativas, prazos, vínculos, versionamento de questões, logs)
               └─ Supabase Auth (convites, senha, recuperação)
```

**Fluxo da avaliação**

1. `create_quiz` cria a avaliação e grava um **snapshot imutável** de cada questão (enunciado, alternativas, gabarito e explicações). Em seguida cria as atribuições e as notificações.
2. `start_attempt` embaralha as questões e as alternativas **por tentativa** e grava a ordem apresentada em `attempt_answers`.
3. `get_attempt` entrega o conteúdo **sem gabarito**.
4. `save_answer` persiste cada resposta assim que ela é marcada. Recarregar a página não perde o progresso.
5. `finalize_attempt` faz a correção e o cálculo da nota dentro de uma transação, com bloqueio de linha. É idempotente: uma submissão duplicada não gera uma segunda nota.
6. `get_attempt_review` libera o gabarito **somente após a conclusão**, e só quando a avaliação permite.

Nota = acertos ÷ questões × 100, com duas casas decimais.

| Nota | Classificação |
|---|---|
| 90 a 100 | Excelente |
| 80 a 89,99 | Aprovado |
| 70 a 79,99 | Em desenvolvimento |
| 0 a 69,99 | Precisa de reforço |

A meta de aprovação padrão é 80 e pode ser alterada em **Configurações**.

## Segurança

- **Não há cadastro público**: `enable_signup = false`. As contas são criadas só pelo supervisor (convite por e-mail) ou pelo script do primeiro supervisor.
- **RLS em todas as tabelas.** Usuários autenticados têm apenas `SELECT` direto. Todas as escritas passam por funções que validam o perfil e as regras.
  - Colaborador: só os próprios dados. Não lê `questions`, `question_options` nem `quiz_questions`, que contêm o gabarito.
  - Guardião: só os colaboradores com vínculo ativo com ele.
  - Supervisor: todos os dados administrativos.
- **Gabarito protegido**: nunca é enviado ao navegador antes da conclusão. Isso é verificado em teste.
- **Nota oficial calculada só no banco.** Tentativas e respostas concluídas são imutáveis (triggers), inclusive para a `service_role`.
- **`service_role` só no servidor** (`src/lib/supabase/admin.ts`, com `server-only`). É usada apenas para convidar, bloquear e desbloquear contas no Auth, depois de validar que quem pede é supervisor.
- **Usuário desativado**: é bloqueado no Supabase Auth (`ban_duration`) e perde acesso imediato pelo RLS. O histórico é preservado.
- **Logs administrativos** (`audit_logs`) aceitam só inclusão: não podem ser alterados nem excluídos.
- Entradas sanitizadas (Zod remove caracteres de controle), CSV protegido contra injeção de fórmulas e cabeçalhos HTTP de segurança configurados.

## Executar localmente

Pré-requisitos: Node 22+, Docker e [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start          # sobe Postgres, Auth e Mailpit locais; aplica as migrações
cp .env.example .env.local
# preencha .env.local com os valores exibidos por `supabase status`
#   API URL          → NEXT_PUBLIC_SUPABASE_URL
#   anon key         → NEXT_PUBLIC_SUPABASE_ANON_KEY
#   service_role key → SUPABASE_SERVICE_ROLE_KEY
npm run create-supervisor -- --email voce@magazord.com.br --name "Seu Nome" --password-prompt
npm run dev             # http://localhost:3000
```

Os e-mails locais (convites e recuperação de senha) aparecem no Mailpit: <http://127.0.0.1:54324>.

Usuários de demonstração (**somente local**): `DEV_SEED_PASSWORD='SuaSenha123' npm run dev:seed-users` cria 1 supervisor, 2 guardiões e 4 colaboradores com e-mails `@teste.local`. O script se recusa a rodar contra qualquer URL que não seja `localhost`.

## Variáveis de ambiente

| Variável | Onde é usada | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente e servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente e servidor | chave pública (anon/publishable); o acesso é protegido por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | nunca use o prefixo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | servidor | URL pública, usada nos links de convite e recuperação |

Veja `.env.example`. O `.env.local` está no `.gitignore`.

## Banco de dados: migrações e seed

As migrações ficam em `supabase/migrations/`:

| Arquivo | Conteúdo |
|---|---|
| `…_schema.sql` | tabelas, tipos, chaves estrangeiras, índices e restrições (respostas e atribuições únicas, uma tentativa aberta por vez, resultados imutáveis) |
| `…_rls.sql` | funções de permissão e políticas RLS |
| `…_functions.sql` | regras de negócio (RPC) |
| `…_seed_question_bank.sql` | **seed oficial**: 9 categorias e as 30 questões do treinamento (idempotente) |
| `…_analytics.sql` | view `official_attempts` e itens de reforço |

O seed das questões é uma **migração**, para que chegue também à produção pelo `supabase db push`. O `supabase/seed.sql` não cria usuários nem senhas.

Comandos úteis:

```bash
supabase db reset       # recria o banco local do zero (migrações + seed)
npm run db:types        # regenera src/types/database.ts
supabase migration new nome-da-migracao
```

## Criar o primeiro supervisor

Não existem senhas padrão. Use uma das opções:

```bash
# Produção: envia convite por e-mail (a pessoa define a própria senha)
npm run create-supervisor -- --email nome@magazord.com.br --name "Nome Completo"

# Local / sem e-mail configurado: digita a senha no terminal (não fica no histórico)
npm run create-supervisor -- --email nome@magazord.com.br --name "Nome Completo" --password-prompt
```

O script lê `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`. Para produção, aponte esses valores para o projeto remoto ao rodar o script.

Os supervisores seguintes podem ser criados pela interface, em **Configurações → Novo supervisor**.

## Primeiros passos na plataforma

1. **Entrar** como supervisor em `/login`.
2. **Cadastrar guardiões**: menu **Guardiões → Novo guardião**. Um convite é enviado por e-mail.
3. **Cadastrar colaboradores**: menu **Colaboradores → Novo colaborador**. Informe nome, e-mail corporativo, guardião responsável (opcional), cargo e data de entrada. O colaborador recebe o convite, clica no link e define a senha (primeiro acesso).
4. **Vincular ou desvincular**: no perfil do colaborador (campo *Guardião*) ou na página do guardião (*Vincular* / *Desvincular*).
5. **Enviar o primeiro quiz**: **Avaliações → Nova avaliação**.
   - Nome e descrição.
   - Modo **Padrão** (as 30 questões oficiais) ou **Personalizada** (quantidade por categoria ou seleção manual).
   - Colaboradores: um, vários ou todos.
   - Envio imediato ou agendado, prazo, tentativas, meta e exibição do gabarito.
   - **Enviar avaliação**. O colaborador recebe uma notificação na plataforma.
6. **Acompanhar** pelo painel geral (indicadores, gráficos, ranking administrativo, "Atenção necessária", atividade recente), pelo perfil de cada colaborador (evolução, desempenho por categoria, pontos de melhoria, histórico) e em **Relatórios** (filtros, CSV e impressão/PDF).

## Configurar o Supabase em produção

1. Crie (ou use) o projeto no Supabase e faça login na CLI:
   ```bash
   supabase login
   supabase link --project-ref <ref-do-projeto>
   ```
2. Aplique as migrações (estrutura, RLS, funções e as 30 questões):
   ```bash
   supabase db push
   ```
3. Configure o Auth (**Authentication → Settings**), ou envie o `supabase/config.toml` com `supabase config push`:
   - **Desativar cadastro público** (*Allow new users to sign up* = desligado).
   - **Site URL** = URL de produção (ex.: `https://treinamentos.magazord.com.br`).
   - **Redirect URLs**: inclua `https://SEU-DOMINIO/**`.
   - **Templates de e-mail** (*Invite user* e *Reset password*): use o conteúdo de `supabase/templates/invite.html` e `recovery.html`. O link precisa apontar para `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite|recovery&next=/definir-senha`.
   - **SMTP próprio** (*Project Settings → Auth → SMTP*). O SMTP padrão do Supabase tem limite baixo de envios.
4. Crie o primeiro supervisor (seção anterior).

### Links de convite e recuperação

Os e-mails apontam para `/auth/callback`, que aceita os três formatos de link do Supabase:

- `#access_token` (template padrão);
- `?code=` (PKCE);
- `?token_hash=` (templates próprios de `supabase/templates/`).

No plano gratuito sem SMTP próprio, o Supabase não permite trocar os templates e só envia e-mails para membros da organização, com limite baixo por hora. Configure um SMTP antes de convidar a equipe.

### Rodar contra o Supabase de produção (teste)

Crie `.env.remote.local` (fora do git) com as variáveis do projeto remoto e rode:

```bash
npm run build:remote && npm run start:remote   # build separado em .next-remote
```

Não rode `npm run test:e2e` enquanto esse servidor estiver ativo na porta 3000: o Playwright reutilizaria o servidor de produção.

## Publicar na Vercel

1. Envie o repositório ao GitHub.
2. Na Vercel: **Add New → Project → Import** do repositório. O framework Next.js é detectado automaticamente.
3. Em **Environment Variables** (Production e Preview), cadastre as quatro variáveis da tabela acima. `SUPABASE_SERVICE_ROLE_KEY` deve ser só para o servidor, que é o padrão da Vercel para variáveis sem `NEXT_PUBLIC_`.
4. Faça o deploy. Depois, atualize o **Site URL** e as **Redirect URLs** no Supabase com o domínio da Vercel ou o domínio personalizado.
5. **Domínio personalizado** (futuro): *Project → Settings → Domains*. Depois atualize `NEXT_PUBLIC_SITE_URL` e as URLs do Supabase.

Verificação de saúde: `GET /api/health`.

## Testes

| Comando | O que cobre | Requer |
|---|---|---|
| `npm test` | **Unitários (Vitest)**: pontuação (30/27/24/21/15/0 acertos → 100/90/80/70/50/0), classificação, médias, evolução, desempenho por categoria, diagnóstico e recomendações, alertas, KPIs, ranking, datas pt-BR, validações | nada |
| `npm run test:integration` | **Banco real (Vitest + Supabase local)**: RLS dos 3 perfis, bloqueio de escrita direta, gabarito ausente no payload, randomização, persistência, correção, submissão concorrente/duplicada, limite de tentativas, imutabilidade, snapshot/versionamento, avaliação por categoria, cancelamento, prazo/expiração, envio agendado | `supabase start` |
| `npm run test:e2e` | **Playwright**: login válido/inválido, logout, rotas protegidas, cadastro público bloqueado, recuperação de senha, convite → primeiro acesso (via Mailpit), permissões por perfil, cadastro, vínculo, edição e desativação, envio de avaliação (supervisor e guardião), quiz completo com recarga sem perda, finalização, nota, gabarito, histórico, relatórios/CSV, responsividade no celular | `supabase start` + `npm run build` |

Os testes de integração e E2E criam usuários `@teste.local` com uma **senha aleatória a cada execução**, sempre no Supabase local.

O CI (`.github/workflows/ci.yml`) roda lint, verificação de tipos, testes unitários e build, e depois os testes de integração e E2E com Supabase local.

## Decisões técnicas

- **Regras críticas em funções PostgreSQL** (chamadas pelas Server Actions). A finalização precisa de transação e bloqueio de linha para impedir nota duplicada. O PostgREST/supabase-js não oferece transações multi-instrução, e a função no banco garante atomicidade e que a nota nunca venha do navegador. As Server Actions continuam validando a entrada (Zod) e a sessão.
- **Snapshot por avaliação** (`quiz_questions.snapshot`) em vez de cópia de tabelas versionadas. Cada edição de questão incrementa `questions.version`, e o snapshot registra a versão aplicada. Avaliações concluídas nunca mudam.
- **Sem tabela `guardians` separada.** O perfil Guardião vem de `profiles.role`, e `collaborator_assignments` guarda o vínculo com histórico (`unassigned_at`). Um trigger garante que só colaborador ↔ guardião sejam vinculados.
- **`attempt_answers` guarda a ordem apresentada** (posição da questão e ordem das alternativas) e a resposta.
- **Resultado oficial = melhor tentativa** de cada atribuição (view `official_attempts`), quando a avaliação permite mais de uma. Avaliações canceladas não entram nos cálculos.
- **Prazos**: a função `expire_overdue` roda de forma preguiçosa ao carregar painéis e listas. Tentativas abertas com prazo vencido são corrigidas com as respostas já salvas; atribuições sem início ficam *Expiradas*. Não depende de cron externo.
- **Categorias**: as 30 questões foram agrupadas nas 9 categorias de desempenho pedidas (Atendimento e organização, Rastreamento, Ocorrências, Entrega e interceptação, Prazos, Ressarcimento, Faturamento, Comunicação, Tomada de decisão). A categoria original de cada questão fica no campo `topic` e aparece nos diagnósticos (ex.: "Acareação e prazos").
- **Orientação de estudo (`study_tip`)**: cada questão oficial recebeu uma frase de reforço derivada da explicação oficial, exibida quando a questão é errada. Pode ser editada no banco de perguntas.
- **TanStack Table v8** (versão estável) fixada em vez da v9.
- **Notificações** são internas (tabela `notifications`), com `visible_at` para envios agendados. A arquitetura está pronta para e-mail: basta um worker ou Edge Function lendo a mesma tabela.
- **PDF**: o relatório tem layout de impressão (*Imprimir / PDF* usa "Salvar como PDF" do navegador). Uma exportação PDF no servidor pode ser feita depois sobre o mesmo `buildReport`.

### Identidade visual

- Paleta oficial do manual aplicada como tokens (`src/app/globals.css`, prefixo `mz-`), seguindo a lógica 60/30/10.
- **Fontes**: Axiforma não está disponível nos arquivos do projeto, então foi usada **Montserrat** (substituta indicada) com **Blinker** como fonte complementar, ambas via `next/font`. Para usar Axiforma, adicione os arquivos `.woff2` e troque a fonte em `src/app/layout.tsx` (`next/font/local`).
- **Logotipo**: o arquivo oficial não estava no repositório. `public/brand/simbolo.svg` (e `src/app/icon.svg`) é um **símbolo provisório**. Substitua-o pelo símbolo oficial do *Manual de Identidade Visual Magazord 2026* mantendo o mesmo nome de arquivo.

## Estrutura de pastas

```
src/
  app/
    (auth)/            login, recuperar-senha, definir-senha (primeiro acesso)
    (app)/             área autenticada (layout com sidebar e menu responsivo)
      painel/          dashboard por perfil
      colaboradores/   lista + perfil individual
      guardioes/       lista + equipe
      avaliacoes/      lista, nova, detalhe
      perguntas/       banco de perguntas (lista, nova, edição)
      relatorios/  configuracoes/  atividades/  notificacoes/
      minhas-avaliacoes/  quiz/[attemptId]  resultado/[attemptId]  historico/  meu-desempenho/
    api/               relatorios/csv, health
    auth/confirm/      confirmação de convite e recuperação (token_hash)
  components/          ui (shadcn), layout, dashboard, charts, quiz, forms, tables, common
  lib/
    auth/              sessão e perfis
    data/              consultas ao banco (server-only)
    domain/            regras puras: pontuação, análises, formatação, status, períodos
    supabase/          clientes (browser, server, admin) e middleware
    validation/        schemas Zod
  server/              Server Actions e tratamento de erros
  types/database.ts    tipos gerados do banco
supabase/              config.toml, migrations/, templates/ de e-mail
scripts/               create-supervisor, dev-seed-users
tests/                 integration/ (Vitest + banco), e2e/ (Playwright)
```
