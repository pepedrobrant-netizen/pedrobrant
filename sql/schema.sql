-- Cronograma de Onboarding — schema Supabase
--
-- Como rodar: cole este arquivo inteiro no SQL Editor do painel do Supabase
-- (Project > SQL Editor > New query) e execute uma vez, no projeto novo/vazio.
--
-- Modelo de dados: cada cliente é UMA linha na tabela `clients`, com as 8 fases e
-- tarefas guardadas como JSON na coluna `fases` — o mesmo formato que já era usado no
-- localStorage, só trocando de lugar. Isso mantém a lógica de progresso/pilares do
-- app.js quase idêntica, só troca a camada de leitura/gravação.
--
-- Modelo de acesso:
--   - Time (login com e-mail/senha via Supabase Auth) tem acesso total de leitura e
--     escrita em `clients` e `crm`.
--   - O link público do cliente (sem login) só enxerga os dados do PRÓPRIO cliente,
--     e só para LEITURA — nunca escreve, nunca lista outros clientes, nunca vê `crm`.
--     Isso é feito através da função `get_client_by_slug`, não por acesso direto à
--     tabela (ver comentário na função, mais abaixo).

create table if not exists clients (
  slug text primary key,
  nome text not null,
  empresa text not null default '',
  inicial text not null default '',
  id_conta text not null default '',
  responsavel_cliente text not null,
  criado_por text not null,
  data_inicio date,
  foto text,
  fases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm (
  slug text primary key references clients (slug) on delete cascade,
  id_cliente text not null default '',
  telefone_principal text not null default '',
  email_cliente text not null default '',
  endereco text not null default '',
  aniversario date,
  evento_participa boolean not null default false,
  evento_qual text not null default '',
  contrato_assinado boolean not null default false,
  brinde_enviado boolean not null default false,
  meta_faturamento text not null default '',
  equipe jsonb not null default '[]'::jsonb,
  acoes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Mantém updated_at em dia sozinho a cada UPDATE, sem depender do app.js lembrar de
-- setar isso manualmente.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

drop trigger if exists trg_crm_updated_at on crm;
create trigger trg_crm_updated_at
  before update on crm
  for each row execute function set_updated_at();

alter table clients enable row level security;
alter table crm enable row level security;

-- ---------- Time (autenticado via Supabase Auth) ----------
-- Acesso total: qualquer pessoa do time logada pode ler/criar/editar/excluir
-- qualquer cliente e qualquer registro de CRM. Não há hoje o conceito de "só o
-- responsável edita o próprio cliente" no app — mantém paridade com o
-- comportamento atual (qualquer pessoa do time via perfil já podia editar
-- qualquer cliente).

create policy "team_select_clients" on clients
  for select to authenticated using (true);
create policy "team_insert_clients" on clients
  for insert to authenticated with check (true);
create policy "team_update_clients" on clients
  for update to authenticated using (true) with check (true);
create policy "team_delete_clients" on clients
  for delete to authenticated using (true);

create policy "team_select_crm" on crm
  for select to authenticated using (true);
create policy "team_insert_crm" on crm
  for insert to authenticated with check (true);
create policy "team_update_crm" on crm
  for update to authenticated using (true) with check (true);
create policy "team_delete_crm" on crm
  for delete to authenticated using (true);

-- ---------- Link público do cliente (sem login, papel "anon") ----------
-- De propósito, NÃO existe nenhuma policy de SELECT para "anon" na tabela
-- `clients` — isso significa que, por padrão, o RLS bloqueia qualquer leitura
-- direta da tabela por quem não está logado. Se anon tivesse uma policy do tipo
-- "using (true)", daria pra listar TODOS os clientes de uma vez usando a chave
-- pública (que fica visível no código do site) — basta uma chamada
-- "select * from clients" sem filtro. Não tem como restringir isso só com RLS,
-- porque RLS filtra LINHAS, não o formato da consulta.
--
-- A solução é expor a leitura só através desta função, que exige o slug exato
-- como parâmetro e nunca devolve mais de uma linha. Ela é "security definer",
-- ou seja, roda com o dono da função (que ignora RLS), mas só devolve o que o
-- parâmetro pedir — então dá pra abrir o EXECUTE dela pra "anon" sem abrir a
-- tabela inteira. O cliente nunca consegue enumerar os outros.
create or replace function get_client_by_slug(p_slug text)
returns table (
  slug text,
  nome text,
  empresa text,
  inicial text,
  id_conta text,
  responsavel_cliente text,
  criado_por text,
  data_inicio date,
  foto text,
  fases jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select c.slug, c.nome, c.empresa, c.inicial, c.id_conta, c.responsavel_cliente,
         c.criado_por, c.data_inicio, c.foto, c.fases
  from clients c
  where c.slug = p_slug;
$$;

revoke all on function get_client_by_slug(text) from public;
grant execute on function get_client_by_slug(text) to anon, authenticated;

-- `crm` não tem nenhuma policy para "anon" nem função equivalente — dados de CRM
-- nunca ficam acessíveis pelo link público, em nenhuma hipótese.
