-- =====================================================
-- FIX RLS RECURSION - ROTA MESTRE (Public Schema)
-- =====================================================
-- Data: 2025-10-20
-- Problema: Políticas RLS causando recursão infinita
-- Solução: Usar funções no schema public (não requer admin)
-- =====================================================

-- =====================================================
-- 1. REMOVER POLÍTICAS PROBLEMÁTICAS
-- =====================================================

-- Dropar políticas que causam recursão na tabela usuarios
drop policy if exists "Gestores podem visualizar usuarios da mesma unidade" on usuarios;
drop policy if exists "Gestores podem inserir motoristas na mesma unidade" on usuarios;
drop policy if exists "Gestores podem atualizar motoristas da mesma unidade" on usuarios;
drop policy if exists "usuarios_select_own" on usuarios;
drop policy if exists "usuarios_select_same_unit" on usuarios;
drop policy if exists "usuarios_insert_motorista" on usuarios;
drop policy if exists "usuarios_update_motorista" on usuarios;
drop policy if exists "usuarios_update_own" on usuarios;

-- Dropar políticas problemáticas em unidades
drop policy if exists "Gestores podem visualizar sua unidade" on unidades;
drop policy if exists "Motoristas podem visualizar sua unidade" on unidades;
drop policy if exists "unidades_select_own" on unidades;

-- Dropar políticas problemáticas em rotas
drop policy if exists "Gestores podem visualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem visualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem inserir rotas em sua unidade" on rotas;
drop policy if exists "Gestores podem atualizar rotas de sua unidade" on rotas;
drop policy if exists "Motoristas podem atualizar suas proprias rotas" on rotas;
drop policy if exists "Gestores podem deletar rotas de sua unidade" on rotas;
drop policy if exists "rotas_select_gestor" on rotas;
drop policy if exists "rotas_select_motorista" on rotas;
drop policy if exists "rotas_insert_gestor" on rotas;
drop policy if exists "rotas_update_gestor" on rotas;
drop policy if exists "rotas_update_motorista" on rotas;
drop policy if exists "rotas_delete_gestor" on rotas;

-- =====================================================
-- 2. CRIAR FUNÇÕES HELPER NO SCHEMA PUBLIC
-- =====================================================

-- Função segura para obter papel do usuário (PUBLIC SCHEMA)
create or replace function public.get_user_papel()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select papel from public.usuarios where id = auth.uid() limit 1;
$$;

-- Função segura para obter unidade do usuário (PUBLIC SCHEMA)
create or replace function public.get_user_unidade_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select unidade_id from public.usuarios where id = auth.uid() limit 1;
$$;

-- =====================================================
-- 3. POLÍTICAS SIMPLIFICADAS PARA USUARIOS
-- =====================================================

-- Usuario pode ver apenas seu próprio registro
create policy "usuarios_select_own"
  on usuarios for select
  using (auth.uid() = id);

-- Gestor pode ver outros usuários da mesma unidade (SEM recursão)
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

-- Usuario pode atualizar seu próprio registro
create policy "usuarios_update_own"
  on usuarios for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================
-- 4. POLÍTICAS SIMPLIFICADAS PARA UNIDADES
-- =====================================================

-- Usuarios podem ver sua própria unidade
create policy "unidades_select_own"
  on unidades for select
  using (id = public.get_user_unidade_id());

-- =====================================================
-- 5. POLÍTICAS SIMPLIFICADAS PARA ROTAS
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
-- 6. GRANT PERMISSIONS
-- =====================================================

-- Garantir que authenticated users possam executar as funções
grant execute on function public.get_user_papel() to authenticated;
grant execute on function public.get_user_unidade_id() to authenticated;
grant execute on function public.get_user_papel() to anon;
grant execute on function public.get_user_unidade_id() to anon;

-- =====================================================
-- 7. COMENTÁRIOS
-- =====================================================

comment on function public.get_user_papel() is
  'Retorna o papel do usuário logado (gestor/motorista) de forma segura';

comment on function public.get_user_unidade_id() is
  'Retorna o ID da unidade do usuário logado de forma segura';

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
