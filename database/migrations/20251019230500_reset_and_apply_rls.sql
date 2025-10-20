-- =====================================================
-- RESET E REAPLICACAO DE RLS POLICIES - ROTA MESTRE
-- =====================================================
-- Data: 2025-10-19
-- Objetivo: Remover politicas antigas e reaplicar do zero
-- =====================================================

-- =====================================================
-- 1. REMOVER TODAS AS POLITICAS EXISTENTES
-- =====================================================

-- Remover politicas da tabela unidades
drop policy if exists "Gestores podem visualizar sua unidade" on unidades;
drop policy if exists "Motoristas podem visualizar sua unidade" on unidades;

-- Remover politicas da tabela usuarios
drop policy if exists "Usuarios podem visualizar seu proprio registro" on usuarios;
drop policy if exists "Gestores podem visualizar usuarios da mesma unidade" on usuarios;
drop policy if exists "Gestores podem inserir motoristas na mesma unidade" on usuarios;
drop policy if exists "Gestores podem atualizar motoristas da mesma unidade" on usuarios;
drop policy if exists "Usuarios podem atualizar seu proprio registro" on usuarios;

-- Remover politicas da tabela rotas
drop policy if exists "Gestores podem visualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem visualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem inserir rotas em sua unidade" on rotas;
drop policy if exists "Gestores podem atualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem atualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem deletar rotas de sua unidade" on rotas;

-- Remover politicas da tabela paradas
drop policy if exists "Gestores podem visualizar paradas de sua unidade" on paradas;
drop policy if exists "Motoristas podem visualizar paradas de suas rotas" on paradas;
drop policy if exists "Gestores podem inserir paradas em sua unidade" on paradas;
drop policy if exists "Gestores podem atualizar paradas de sua unidade" on paradas;
drop policy if exists "Motoristas podem atualizar paradas de suas rotas" on paradas;
drop policy if exists "Gestores podem deletar paradas de sua unidade" on paradas;

-- Remover politicas da tabela logs
drop policy if exists "Gestores podem visualizar logs de sua unidade" on logs;
drop policy if exists "Motoristas podem visualizar seus proprios logs" on logs;
drop policy if exists "Usuarios podem inserir logs" on logs;

-- =====================================================
-- 2. ATIVAR RLS EM TODAS AS TABELAS
-- =====================================================

alter table unidades enable row level security;
alter table usuarios enable row level security;
alter table rotas enable row level security;
alter table paradas enable row level security;
alter table logs enable row level security;

-- =====================================================
-- 3. POLITICAS PARA TABELA: unidades
-- =====================================================

-- Gestores podem ver apenas sua propria unidade
create policy "Gestores podem visualizar sua unidade"
  on unidades for select
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.unidade_id = unidades.id
        and usuarios.papel = 'gestor'
    )
  );

-- Motoristas podem ver apenas sua propria unidade
create policy "Motoristas podem visualizar sua unidade"
  on unidades for select
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.unidade_id = unidades.id
        and usuarios.papel = 'motorista'
    )
  );

-- =====================================================
-- 4. POLITICAS PARA TABELA: usuarios
-- =====================================================

-- Usuario pode ver seu proprio registro
create policy "Usuarios podem visualizar seu proprio registro"
  on usuarios for select
  using (auth.uid() = id);

-- Gestores podem ver outros usuarios da mesma unidade
create policy "Gestores podem visualizar usuarios da mesma unidade"
  on usuarios for select
  using (
    exists (
      select 1 from usuarios as u
      where u.id = auth.uid()
        and u.papel = 'gestor'
        and u.unidade_id = usuarios.unidade_id
    )
  );

-- Gestores podem inserir novos motoristas na mesma unidade
create policy "Gestores podem inserir motoristas na mesma unidade"
  on usuarios for insert
  with check (
    exists (
      select 1 from usuarios as u
      where u.id = auth.uid()
        and u.papel = 'gestor'
        and u.unidade_id = usuarios.unidade_id
    )
    and usuarios.papel = 'motorista'
  );

-- Gestores podem atualizar motoristas da mesma unidade
create policy "Gestores podem atualizar motoristas da mesma unidade"
  on usuarios for update
  using (
    exists (
      select 1 from usuarios as u
      where u.id = auth.uid()
        and u.papel = 'gestor'
        and u.unidade_id = usuarios.unidade_id
    )
    and usuarios.papel = 'motorista'
  );

-- Usuarios podem atualizar seu proprio registro (dados basicos)
create policy "Usuarios podem atualizar seu proprio registro"
  on usuarios for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================
-- 5. POLITICAS PARA TABELA: rotas
-- =====================================================

-- Gestores podem visualizar todas as rotas de sua unidade
create policy "Gestores podem visualizar rotas de sua unidade"
  on rotas for select
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Motoristas podem visualizar apenas suas proprias rotas
create policy "Motoristas podem visualizar suas proprias rotas"
  on rotas for select
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'motorista'
        and usuarios.id = rotas.motorista_id
    )
  );

-- Gestores podem inserir rotas em sua unidade
create policy "Gestores podem inserir rotas em sua unidade"
  on rotas for insert
  with check (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Gestores podem atualizar rotas de sua unidade
create policy "Gestores podem atualizar rotas de sua unidade"
  on rotas for update
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Motoristas podem atualizar apenas suas proprias rotas
create policy "Motoristas podem atualizar suas proprias rotas"
  on rotas for update
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'motorista'
        and usuarios.id = rotas.motorista_id
    )
  );

-- Gestores podem deletar rotas de sua unidade
create policy "Gestores podem deletar rotas de sua unidade"
  on rotas for delete
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- =====================================================
-- 6. POLITICAS PARA TABELA: paradas
-- =====================================================

-- Gestores podem visualizar paradas de rotas de sua unidade
create policy "Gestores podem visualizar paradas de sua unidade"
  on paradas for select
  using (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Motoristas podem visualizar paradas de suas proprias rotas
create policy "Motoristas podem visualizar paradas de suas rotas"
  on paradas for select
  using (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'motorista'
        and rotas.motorista_id = usuarios.id
    )
  );

-- Gestores podem inserir paradas em rotas de sua unidade
create policy "Gestores podem inserir paradas em sua unidade"
  on paradas for insert
  with check (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Gestores podem atualizar paradas de rotas de sua unidade
create policy "Gestores podem atualizar paradas de sua unidade"
  on paradas for update
  using (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- Motoristas podem atualizar paradas de suas proprias rotas
create policy "Motoristas podem atualizar paradas de suas rotas"
  on paradas for update
  using (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'motorista'
        and rotas.motorista_id = usuarios.id
    )
  );

-- Gestores podem deletar paradas de rotas de sua unidade
create policy "Gestores podem deletar paradas de sua unidade"
  on paradas for delete
  using (
    exists (
      select 1 from rotas
      inner join usuarios on usuarios.id = auth.uid()
      where rotas.id = paradas.rota_id
        and usuarios.papel = 'gestor'
        and usuarios.unidade_id = rotas.unidade_id
    )
  );

-- =====================================================
-- 7. POLITICAS PARA TABELA: logs
-- =====================================================

-- Gestores podem visualizar logs de sua unidade
create policy "Gestores podem visualizar logs de sua unidade"
  on logs for select
  using (
    exists (
      select 1 from usuarios
      where usuarios.id = auth.uid()
        and usuarios.papel = 'gestor'
        and (
          -- Logs do proprio gestor
          logs.usuario_id = usuarios.id
          -- Ou logs de rotas da unidade
          or exists (
            select 1 from rotas
            where rotas.id = logs.rota_id
              and rotas.unidade_id = usuarios.unidade_id
          )
        )
    )
  );

-- Motoristas podem visualizar apenas seus proprios logs
create policy "Motoristas podem visualizar seus proprios logs"
  on logs for select
  using (
    auth.uid() = usuario_id
  );

-- Todos os usuarios autenticados podem inserir logs
create policy "Usuarios podem inserir logs"
  on logs for insert
  with check (
    auth.uid() = usuario_id
  );

-- =====================================================
-- 8. FUNCOES AUXILIARES (recriar se necessario)
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
-- 9. COMENTARIOS E DOCUMENTACAO
-- =====================================================

comment on policy "Gestores podem visualizar sua unidade" on unidades is
  'Gestores tem acesso de leitura apenas a sua propria unidade';

comment on policy "Motoristas podem visualizar sua unidade" on unidades is
  'Motoristas tem acesso de leitura apenas a sua propria unidade';

comment on policy "Gestores podem visualizar rotas de sua unidade" on rotas is
  'Gestores visualizam todas as rotas da unidade onde trabalham';

comment on policy "Motoristas podem visualizar suas proprias rotas" on rotas is
  'Motoristas visualizam apenas as rotas onde sao designados como motorista';

comment on policy "Usuarios podem inserir logs" on logs is
  'Todos usuarios podem registrar logs de suas proprias acoes';

-- =====================================================
-- FIM - RLS POLICIES RESETADAS E REAPLICADAS
-- =====================================================
