-- =====================================================
-- FIX RLS RECURSION - SUPABASE COMPATIBLE
-- =====================================================
-- Data: 2025-10-22
-- Compatível com Supabase Dashboard SQL Editor
-- =====================================================

-- =====================================================
-- 1. REMOVER POLÍTICAS PROBLEMÁTICAS
-- =====================================================

drop policy if exists "Gestores podem visualizar usuarios da mesma unidade" on usuarios;
drop policy if exists "Gestores podem inserir motoristas na mesma unidade" on usuarios;
drop policy if exists "Gestores podem atualizar motoristas da mesma unidade" on usuarios;
drop policy if exists "Gestores podem visualizar sua unidade" on unidades;
drop policy if exists "Motoristas podem visualizar sua unidade" on unidades;
drop policy if exists "Gestores podem visualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem visualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem inserir rotas em sua unidade" on rotas;
drop policy if exists "Gestores podem atualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem atualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem deletar rotas de sua unidade" on rotas;

-- Remover políticas antigas duplicadas
drop policy if exists "usuarios_select_own" on usuarios;
drop policy if exists "usuarios_select_same_unit" on usuarios;
drop policy if exists "usuarios_insert_motorista" on usuarios;
drop policy if exists "usuarios_update_motorista" on usuarios;
drop policy if exists "usuarios_update_own" on usuarios;
drop policy if exists "unidades_select_own" on unidades;
drop policy if exists "rotas_select_gestor" on rotas;
drop policy if exists "rotas_select_motorista" on rotas;
drop policy if exists "rotas_insert_gestor" on rotas;
drop policy if exists "rotas_update_gestor" on rotas;
drop policy if exists "rotas_update_motorista" on rotas;
drop policy if exists "rotas_delete_gestor" on rotas;

-- =====================================================
-- 2. FUNÇÕES HELPER NO SCHEMA PUBLIC
-- =====================================================

-- Função para obter papel do usuário (no schema public)
create or replace function public.get_user_papel()
returns text
language sql
security definer
stable
as $$
  select papel from public.usuarios where id = auth.uid() limit 1;
$$;

-- Função para obter unidade do usuário (no schema public)
create or replace function public.get_user_unidade_id()
returns uuid
language sql
security definer
stable
as $$
  select unidade_id from public.usuarios where id = auth.uid() limit 1;
$$;

-- =====================================================
-- 3. POLÍTICAS PARA USUARIOS (SEM RECURSÃO)
-- =====================================================

-- Usuário pode ver apenas seu próprio registro
create policy "usuarios_select_own"
  on usuarios for select
  using (auth.uid() = id);

-- Gestor pode ver outros usuários da mesma unidade (usando função helper)
create policy "usuarios_select_same_unit"
  on usuarios for select
  using (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
  );

-- Gestor pode inserir motoristas na mesma unidade
create policy "usuarios_insert_motorista"
  on usuarios for insert
  with check (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
    and papel = 'motorista'
  );

-- Gestor pode atualizar motoristas da mesma unidade
create policy "usuarios_update_motorista"
  on usuarios for update
  using (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
    and papel = 'motorista'
  );

-- Usuário pode atualizar seu próprio registro
create policy "usuarios_update_own"
  on usuarios for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================
-- 4. POLÍTICAS PARA UNIDADES
-- =====================================================

-- Usuários podem ver sua própria unidade
create policy "unidades_select_own"
  on unidades for select
  using (id = public.get_user_unidade_id());

-- =====================================================
-- 5. POLÍTICAS PARA ROTAS
-- =====================================================

-- Gestor pode ver rotas de sua unidade
create policy "rotas_select_gestor"
  on rotas for select
  using (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
  );

-- Motorista pode ver apenas suas rotas
create policy "rotas_select_motorista"
  on rotas for select
  using (
    public.get_user_papel() = 'motorista'
    and auth.uid() = motorista_id
  );

-- Gestor pode inserir rotas em sua unidade
create policy "rotas_insert_gestor"
  on rotas for insert
  with check (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
  );

-- Gestor pode atualizar rotas de sua unidade
create policy "rotas_update_gestor"
  on rotas for update
  using (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
  );

-- Motorista pode atualizar apenas suas rotas
create policy "rotas_update_motorista"
  on rotas for update
  using (
    public.get_user_papel() = 'motorista'
    and auth.uid() = motorista_id
  );

-- Gestor pode deletar rotas de sua unidade
create policy "rotas_delete_gestor"
  on rotas for delete
  using (
    public.get_user_papel() = 'gestor'
    and public.get_user_unidade_id() = unidade_id
  );

-- =====================================================
-- 6. POLÍTICAS PARA PARADAS
-- =====================================================

-- Remover políticas antigas de paradas se existirem
drop policy if exists "paradas_select" on paradas;
drop policy if exists "paradas_insert" on paradas;
drop policy if exists "paradas_update" on paradas;
drop policy if exists "paradas_delete" on paradas;

-- Gestor e motorista podem ver paradas das rotas que têm acesso
create policy "paradas_select"
  on paradas for select
  using (
    exists (
      select 1 from rotas
      where rotas.id = paradas.rota_id
      and (
        (public.get_user_papel() = 'gestor' and rotas.unidade_id = public.get_user_unidade_id())
        or (public.get_user_papel() = 'motorista' and rotas.motorista_id = auth.uid())
      )
    )
  );

-- Gestor pode inserir paradas em rotas de sua unidade
create policy "paradas_insert"
  on paradas for insert
  with check (
    exists (
      select 1 from rotas
      where rotas.id = paradas.rota_id
      and public.get_user_papel() = 'gestor'
      and rotas.unidade_id = public.get_user_unidade_id()
    )
  );

-- Gestor pode atualizar paradas de sua unidade, motorista pode atualizar paradas de suas rotas
create policy "paradas_update"
  on paradas for update
  using (
    exists (
      select 1 from rotas
      where rotas.id = paradas.rota_id
      and (
        (public.get_user_papel() = 'gestor' and rotas.unidade_id = public.get_user_unidade_id())
        or (public.get_user_papel() = 'motorista' and rotas.motorista_id = auth.uid())
      )
    )
  );

-- Gestor pode deletar paradas de rotas de sua unidade
create policy "paradas_delete"
  on paradas for delete
  using (
    exists (
      select 1 from rotas
      where rotas.id = paradas.rota_id
      and public.get_user_papel() = 'gestor'
      and rotas.unidade_id = public.get_user_unidade_id()
    )
  );

-- =====================================================
-- 7. POLÍTICAS PARA LOGS (se a tabela existir)
-- =====================================================

drop policy if exists "logs_select" on logs;
drop policy if exists "logs_insert" on logs;

-- Gestor pode ver logs de sua unidade
create policy "logs_select"
  on logs for select
  using (
    public.get_user_papel() = 'gestor'
    and usuario_id in (
      select id from usuarios where unidade_id = public.get_user_unidade_id()
    )
  );

-- Todos podem inserir logs
create policy "logs_insert"
  on logs for insert
  with check (true);

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

grant execute on function public.get_user_papel() to authenticated;
grant execute on function public.get_user_unidade_id() to authenticated;

-- =====================================================
-- 9. TESTE FINAL
-- =====================================================

-- Comentários para documentação
comment on function public.get_user_papel() is 'Retorna o papel do usuário logado (gestor/motorista)';
comment on function public.get_user_unidade_id() is 'Retorna o ID da unidade do usuário logado';