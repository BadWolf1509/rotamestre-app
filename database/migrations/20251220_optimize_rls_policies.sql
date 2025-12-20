-- Migration: Otimização de políticas RLS para performance
-- Data: 2025-12-20
-- Descrição:
--   1. Substitui auth.uid() por (select auth.uid()) para evitar re-avaliação por linha
--   2. Consolida políticas duplicadas em políticas únicas
--
-- Referência: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================
-- TABELA: usuarios
-- ============================================

-- Remover políticas duplicadas de SELECT
DROP POLICY IF EXISTS "Usuários podem ler próprios dados" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_policy" ON public.usuarios;

-- Remover políticas duplicadas de UPDATE
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON public.usuarios;

-- Remover políticas duplicadas de INSERT
DROP POLICY IF EXISTS "usuarios_insert_motorista" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON public.usuarios;

-- Criar política única otimizada para SELECT
-- Usuários podem ver: próprios dados OU motoristas da mesma unidade (se gestor)
CREATE POLICY "usuarios_select_optimized" ON public.usuarios
FOR SELECT USING (
  id = (select auth.uid())
  OR
  unidade_id IN (
    SELECT unidade_id FROM public.usuarios WHERE id = (select auth.uid())
  )
);

-- Criar política única otimizada para UPDATE
-- Usuários podem atualizar apenas próprios dados
CREATE POLICY "usuarios_update_optimized" ON public.usuarios
FOR UPDATE USING (
  id = (select auth.uid())
);

-- Criar política única otimizada para INSERT
-- Gestores podem inserir motoristas na mesma unidade
CREATE POLICY "usuarios_insert_optimized" ON public.usuarios
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = (select auth.uid())
    AND papel = 'gestor'
    AND unidade_id = usuarios.unidade_id
  )
);

-- ============================================
-- TABELA: notificacoes
-- ============================================

-- Remover políticas duplicadas de SELECT
DROP POLICY IF EXISTS "Usuarios podem ver suas notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_select" ON public.notificacoes;

-- Remover políticas duplicadas de UPDATE
DROP POLICY IF EXISTS "Usuarios podem atualizar suas notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_update" ON public.notificacoes;

-- Criar política única otimizada para SELECT
CREATE POLICY "notificacoes_select_optimized" ON public.notificacoes
FOR SELECT USING (
  usuario_id = (select auth.uid())
);

-- Criar política única otimizada para UPDATE
CREATE POLICY "notificacoes_update_optimized" ON public.notificacoes
FOR UPDATE USING (
  usuario_id = (select auth.uid())
);

-- ============================================
-- TABELA: motorista_locations
-- ============================================

-- Remover políticas duplicadas de SELECT
DROP POLICY IF EXISTS "Gestores podem ver localizacao da sua unidade" ON public.motorista_locations;
DROP POLICY IF EXISTS "Motoristas podem ver sua propria localizacao" ON public.motorista_locations;

-- Remover política de INSERT se existir
DROP POLICY IF EXISTS "Motoristas podem inserir sua localizacao" ON public.motorista_locations;

-- Criar política única otimizada para SELECT
-- Motoristas veem própria localização, gestores veem da unidade
CREATE POLICY "motorista_locations_select_optimized" ON public.motorista_locations
FOR SELECT USING (
  motorista_id = (select auth.uid())
  OR
  motorista_id IN (
    SELECT u.id FROM public.usuarios u
    WHERE u.unidade_id = (
      SELECT unidade_id FROM public.usuarios WHERE id = (select auth.uid())
    )
  )
);

-- Criar política otimizada para INSERT
CREATE POLICY "motorista_locations_insert_optimized" ON public.motorista_locations
FOR INSERT WITH CHECK (
  motorista_id = (select auth.uid())
);

-- ============================================
-- TABELA: logs
-- ============================================

-- Remover política existente
DROP POLICY IF EXISTS "logs_insert" ON public.logs;

-- Criar política otimizada para INSERT
CREATE POLICY "logs_insert_optimized" ON public.logs
FOR INSERT WITH CHECK (
  usuario_id = (select auth.uid())
);

-- ============================================
-- TABELA: incidentes
-- ============================================

-- Remover política existente
DROP POLICY IF EXISTS "incidentes_delete_policy" ON public.incidentes;

-- Criar política otimizada para DELETE (apenas gestor pode deletar incidentes da unidade)
CREATE POLICY "incidentes_delete_optimized" ON public.incidentes
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = (select auth.uid())
    AND u.papel = 'gestor'
    AND u.unidade_id = (
      SELECT r.unidade_id FROM public.rotas r WHERE r.id = incidentes.rota_id
    )
  )
);

-- ============================================
-- TABELA: push_notification_logs
-- ============================================

-- Remover política existente
DROP POLICY IF EXISTS "Admin pode ver logs de push" ON public.push_notification_logs;

-- Criar política otimizada (admin = papel gestor por enquanto)
CREATE POLICY "push_notification_logs_select_optimized" ON public.push_notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = (select auth.uid())
    AND papel = 'gestor'
  )
);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, rode o Linter novamente no Supabase Dashboard
-- para confirmar que os warnings foram resolvidos
