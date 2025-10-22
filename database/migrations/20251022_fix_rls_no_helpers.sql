-- =====================================================
-- FIX RLS RECURSION - SEM FUNÇÕES HELPER
-- =====================================================
-- Solução definitiva: políticas baseadas apenas em auth.uid()
-- =====================================================

-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
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
drop policy if exists "paradas_select" on paradas;
drop policy if exists "paradas_insert" on paradas;
drop policy if exists "paradas_update" on paradas;
drop policy if exists "paradas_delete" on paradas;
drop policy if exists "logs_select" on logs;
drop policy if exists "logs_insert" on logs;

-- 2. REMOVER FUNÇÕES HELPER (causam recursão)
drop function if exists public.get_user_papel();
drop function if exists public.get_user_unidade_id();

-- =====================================================
-- 3. POLÍTICAS SIMPLES PARA USUARIOS (SEM RECURSÃO)
-- =====================================================

-- Usuário pode ver apenas seu próprio registro
create policy "usuarios_select_own"
  on usuarios for select
  using (auth.uid() = id);

-- Usuário pode atualizar apenas seu próprio registro
create policy "usuarios_update_own"
  on usuarios for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================
-- 4. POLÍTICAS PARA UNIDADES
-- =====================================================

-- Usuários podem ver sua unidade (via JOIN com usuarios)
create policy "unidades_select_by_user"
  on unidades for select
  using (
    id in (select unidade_id from usuarios where id = auth.uid())
  );

-- =====================================================
-- 5. POLÍTICAS PARA ROTAS
-- =====================================================

-- Ver rotas: gestor vê rotas da sua unidade, motorista vê suas rotas
create policy "rotas_select"
  on rotas for select
  using (
    -- Motorista vê suas rotas
    (motorista_id = auth.uid())
    or
    -- Gestor vê rotas da sua unidade
    (
      unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- Inserir rotas: apenas gestor da unidade
create policy "rotas_insert"
  on rotas for insert
  with check (
    unidade_id in (
      select unidade_id from usuarios
      where id = auth.uid() and papel = 'gestor'
    )
  );

-- Atualizar rotas: gestor da unidade ou motorista da rota
create policy "rotas_update"
  on rotas for update
  using (
    (motorista_id = auth.uid())
    or
    (
      unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- Deletar rotas: apenas gestor da unidade
create policy "rotas_delete"
  on rotas for delete
  using (
    unidade_id in (
      select unidade_id from usuarios
      where id = auth.uid() and papel = 'gestor'
    )
  );

-- =====================================================
-- 6. POLÍTICAS PARA PARADAS
-- =====================================================

-- Ver paradas: se tem acesso à rota
create policy "paradas_select"
  on paradas for select
  using (
    rota_id in (
      select id from rotas
      where motorista_id = auth.uid()
      or unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- Inserir paradas: gestor da unidade da rota
create policy "paradas_insert"
  on paradas for insert
  with check (
    rota_id in (
      select id from rotas
      where unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- Atualizar paradas: motorista da rota ou gestor da unidade
create policy "paradas_update"
  on paradas for update
  using (
    rota_id in (
      select id from rotas
      where motorista_id = auth.uid()
      or unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- Deletar paradas: apenas gestor da unidade
create policy "paradas_delete"
  on paradas for delete
  using (
    rota_id in (
      select id from rotas
      where unidade_id in (
        select unidade_id from usuarios
        where id = auth.uid() and papel = 'gestor'
      )
    )
  );

-- =====================================================
-- 7. POLÍTICAS PARA LOGS (se existir)
-- =====================================================

-- Ver logs: apenas gestores da unidade
create policy "logs_select"
  on logs for select
  using (
    usuario_id in (
      select u2.id from usuarios u1
      join usuarios u2 on u2.unidade_id = u1.unidade_id
      where u1.id = auth.uid() and u1.papel = 'gestor'
    )
  );

-- Inserir logs: todos autenticados
create policy "logs_insert"
  on logs for insert
  with check (auth.uid() is not null);

-- =====================================================
-- FIM - POLÍTICAS SEM RECURSÃO
-- =====================================================