-- =====================================================
-- RLS POLICIES OTIMIZADAS - ROTA MESTRE
-- =====================================================
-- Data: 2025-10-19
-- Objetivo: Políticas RLS simplificadas e mais eficientes
-- =====================================================

-- =====================================================
-- 1. REMOVER TODAS AS POLITICAS EXISTENTES
-- =====================================================

-- Remover politicas da tabela unidades
drop policy if exists "Gestores podem visualizar sua unidade" on unidades;
drop policy if exists "Motoristas podem visualizar sua unidade" on unidades;
drop policy if exists "Gestores veem apenas dados da sua unidade" on unidades;
drop policy if exists "Motoristas veem apenas dados da sua unidade" on unidades;

-- Remover politicas da tabela usuarios
drop policy if exists "Usuarios podem visualizar seu proprio registro" on usuarios;
drop policy if exists "Gestores podem visualizar usuarios da mesma unidade" on usuarios;
drop policy if exists "Gestores podem inserir motoristas na mesma unidade" on usuarios;
drop policy if exists "Gestores podem atualizar motoristas da mesma unidade" on usuarios;
drop policy if exists "Usuarios podem atualizar seu proprio registro" on usuarios;
drop policy if exists "Gestores veem apenas motoristas da sua unidade" on usuarios;
drop policy if exists "Motoristas veem seu proprio registro" on usuarios;
drop policy if exists "Gestores gerenciam motoristas da sua unidade" on usuarios;

-- Remover politicas da tabela rotas
drop policy if exists "Gestores podem visualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem visualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem inserir rotas em sua unidade" on rotas;
drop policy if exists "Gestores podem atualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem atualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem deletar rotas de sua unidade" on rotas;
drop policy if exists "Gestores gerenciam rotas da sua unidade" on rotas;
drop policy if exists "Motoristas veem e atualizam suas rotas" on rotas;
drop policy if exists "Motoristas veem apenas suas rotas" on rotas;
drop policy if exists "Motoristas atualizam apenas suas rotas" on rotas;

-- Remover politicas da tabela paradas
drop policy if exists "Gestores podem visualizar paradas de sua unidade" on paradas;
drop policy if exists "Motoristas podem visualizar paradas de suas rotas" on paradas;
drop policy if exists "Gestores podem inserir paradas em sua unidade" on paradas;
drop policy if exists "Gestores podem atualizar paradas de sua unidade" on paradas;
drop policy if exists "Motoristas podem atualizar paradas de suas rotas" on paradas;
drop policy if exists "Gestores podem deletar paradas de sua unidade" on paradas;
drop policy if exists "Gestores gerenciam paradas das rotas da sua unidade" on paradas;
drop policy if exists "Motoristas veem e atualizam paradas de suas rotas" on paradas;
drop policy if exists "Motoristas veem apenas suas paradas" on paradas;
drop policy if exists "Motoristas atualizam apenas suas paradas" on paradas;

-- Remover politicas da tabela logs
drop policy if exists "Gestores podem visualizar logs de sua unidade" on logs;
drop policy if exists "Motoristas podem visualizar seus proprios logs" on logs;
drop policy if exists "Usuarios podem inserir logs" on logs;
drop policy if exists "Gestores veem logs da sua unidade" on logs;
drop policy if exists "Motoristas veem seus logs" on logs;
drop policy if exists "Todos podem inserir logs" on logs;
drop policy if exists "Usuários inserem logs das próprias ações" on logs;
drop policy if exists "Somente Service Role pode ver todos os logs" on logs;

-- =====================================================
-- 2. GARANTIR QUE RLS ESTA HABILITADO
-- =====================================================

alter table unidades enable row level security;
alter table usuarios enable row level security;
alter table rotas enable row level security;
alter table paradas enable row level security;
alter table logs enable row level security;

-- =====================================================
-- 3. GARANTIR PERMISSÕES PARA SERVICE ROLE
-- =====================================================

grant all privileges on all tables in schema public to service_role;

-- =====================================================
-- 4. POLITICAS OTIMIZADAS - UNIDADES
-- =====================================================

-- Gestores veem apenas dados da sua unidade
create policy "Gestores veem apenas dados da sua unidade"
on unidades for select
using (
  auth.uid() in (
    select id from usuarios
    where unidade_id = unidades.id
      and papel = 'gestor'
  )
);

-- Motoristas veem apenas dados da sua unidade
create policy "Motoristas veem apenas dados da sua unidade"
on unidades for select
using (
  auth.uid() in (
    select id from usuarios
    where unidade_id = unidades.id
      and papel = 'motorista'
  )
);

-- =====================================================
-- 5. POLITICAS OTIMIZADAS - USUARIOS
-- =====================================================

-- Motoristas veem seu proprio registro
create policy "Motoristas veem seu proprio registro"
on usuarios for select
using (
  auth.uid() = id
  and papel = 'motorista'
);

-- Gestores veem todos usuarios da sua unidade
create policy "Gestores veem apenas motoristas da sua unidade"
on usuarios for select
using (
  auth.uid() in (
    select id from usuarios u
    where u.unidade_id = usuarios.unidade_id
      and u.papel = 'gestor'
  )
);

-- Gestores gerenciam motoristas da sua unidade (insert, update)
create policy "Gestores gerenciam motoristas da sua unidade"
on usuarios for all
using (
  auth.uid() in (
    select id from usuarios u
    where u.unidade_id = usuarios.unidade_id
      and u.papel = 'gestor'
  )
  and usuarios.papel = 'motorista'
)
with check (
  auth.uid() in (
    select id from usuarios u
    where u.unidade_id = usuarios.unidade_id
      and u.papel = 'gestor'
  )
  and usuarios.papel = 'motorista'
);

-- =====================================================
-- 6. POLITICAS OTIMIZADAS - ROTAS
-- =====================================================

-- Gestores gerenciam todas rotas da sua unidade (select, insert, update, delete)
create policy "Gestores gerenciam rotas da sua unidade"
on rotas for all
using (
  auth.uid() in (
    select id from usuarios
    where unidade_id = rotas.unidade_id
      and papel = 'gestor'
  )
)
with check (
  auth.uid() in (
    select id from usuarios
    where unidade_id = rotas.unidade_id
      and papel = 'gestor'
  )
);

-- Motoristas veem apenas suas rotas
create policy "Motoristas veem apenas suas rotas"
on rotas for select
using (auth.uid() = motorista_id);

-- Motoristas atualizam apenas suas rotas
create policy "Motoristas atualizam apenas suas rotas"
on rotas for update
using (auth.uid() = motorista_id);

-- =====================================================
-- 7. POLITICAS OTIMIZADAS - PARADAS
-- =====================================================

-- Gestores gerenciam todas paradas das rotas da sua unidade
create policy "Gestores gerenciam paradas das rotas da sua unidade"
on paradas for all
using (
  auth.uid() in (
    select id from usuarios
    where unidade_id = (
      select unidade_id from rotas
      where rotas.id = paradas.rota_id
    )
    and papel = 'gestor'
  )
);

-- Motoristas veem apenas suas paradas
create policy "Motoristas veem apenas suas paradas"
on paradas for select
using (
  auth.uid() = (
    select motorista_id from rotas
    where rotas.id = paradas.rota_id
  )
);

-- Motoristas atualizam apenas suas paradas
create policy "Motoristas atualizam apenas suas paradas"
on paradas for update
using (
  auth.uid() = (
    select motorista_id from rotas
    where rotas.id = paradas.rota_id
  )
);

-- =====================================================
-- 8. POLITICAS OTIMIZADAS - LOGS
-- =====================================================

-- Gestores veem logs da sua unidade
create policy "Gestores veem logs da sua unidade"
on logs for select
using (
  auth.uid() in (
    select id from usuarios
    where papel = 'gestor'
      and (
        -- Logs proprios
        id = logs.usuario_id
        -- Ou logs de rotas da unidade
        or unidade_id in (
          select unidade_id from rotas
          where rotas.id = logs.rota_id
        )
      )
  )
);

-- Motoristas veem apenas seus logs
create policy "Motoristas veem seus logs"
on logs for select
using (auth.uid() = usuario_id);

-- Usuários inserem logs das próprias ações
create policy "Usuários inserem logs das próprias ações"
on logs for insert
with check (auth.uid() = usuario_id);

-- Service Role pode ver todos os logs (para auditoria/admin)
create policy "Somente Service Role pode ver todos os logs"
on logs for select
to service_role
using (true);

-- =====================================================
-- 9. FUNCOES AUXILIARES (manter existentes)
-- =====================================================

-- Funcao para obter o papel do usuario atual
create or replace function get_user_role()
returns text
language sql
security definer
stable
as $$
  select papel from usuarios where id = auth.uid();
$$;

-- Funcao para obter a unidade do usuario atual
create or replace function get_user_unidade()
returns uuid
language sql
security definer
stable
as $$
  select unidade_id from usuarios where id = auth.uid();
$$;

-- =====================================================
-- 10. COMENTARIOS E DOCUMENTACAO
-- =====================================================

comment on policy "Gestores veem apenas dados da sua unidade" on unidades is
  'Gestores tem acesso de leitura apenas a sua unidade';

comment on policy "Motoristas veem apenas dados da sua unidade" on unidades is
  'Motoristas tem acesso de leitura apenas a sua unidade';

comment on policy "Motoristas veem seu proprio registro" on usuarios is
  'Motoristas podem visualizar apenas seu próprio registro';

comment on policy "Gestores veem apenas motoristas da sua unidade" on usuarios is
  'Gestores podem visualizar todos motoristas da sua unidade';

comment on policy "Gestores gerenciam motoristas da sua unidade" on usuarios is
  'Gestores podem criar e gerenciar motoristas da mesma unidade';

comment on policy "Gestores gerenciam rotas da sua unidade" on rotas is
  'Gestores podem criar, ver, atualizar e deletar rotas de sua unidade';

comment on policy "Motoristas veem apenas suas rotas" on rotas is
  'Motoristas podem visualizar apenas as rotas onde são motoristas';

comment on policy "Motoristas atualizam apenas suas rotas" on rotas is
  'Motoristas podem atualizar apenas as rotas onde são motoristas';

comment on policy "Gestores gerenciam paradas das rotas da sua unidade" on paradas is
  'Gestores podem gerenciar todas paradas de rotas de sua unidade';

comment on policy "Motoristas veem apenas suas paradas" on paradas is
  'Motoristas podem visualizar apenas paradas das suas rotas';

comment on policy "Motoristas atualizam apenas suas paradas" on paradas is
  'Motoristas podem atualizar apenas paradas das suas rotas';

comment on policy "Gestores veem logs da sua unidade" on logs is
  'Gestores podem visualizar logs da sua unidade e logs próprios';

comment on policy "Motoristas veem seus logs" on logs is
  'Motoristas podem visualizar apenas seus próprios logs';

comment on policy "Usuários inserem logs das próprias ações" on logs is
  'Todos usuarios podem registrar logs de suas acoes (auditoria)';

comment on policy "Somente Service Role pode ver todos os logs" on logs is
  'Service Role tem acesso completo aos logs para auditoria e administração';

-- =====================================================
-- FIM - POLITICAS RLS OTIMIZADAS APLICADAS
-- =====================================================
