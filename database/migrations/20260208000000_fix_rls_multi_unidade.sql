-- Migration: Fix RLS policies for multi-unit support
-- Data: 2026-02-08
-- Descrição:
--   A migration 20251220_optimize_rls_policies sobrescreveu as policies
--   multi-unidade (20251204000001) com versões single-unit usando usuarios.unidade_id.
--   Isso causa JOIN null quando um gestor tenta ver o nome de um motorista vinculado
--   via usuario_unidades mas cujo usuarios.unidade_id aponta para outra unidade.
--
-- Solução:
--   1. Criar get_my_unidade_ids() — SECURITY DEFINER que retorna TODAS as unidades ativas
--   2. Atualizar SELECT/UPDATE/INSERT de usuarios para usar usuario_unidades
--   3. Atualizar motorista_locations SELECT para usar usuario_unidades
--
-- Bug corrigido: Motorista "Saulo Fernandes" aparecia como "Desconhecido" na tela de
--   incidentes da gestora "Fernanda" porque ele está vinculado a 2 unidades via
--   usuario_unidades, mas seu usuarios.unidade_id aponta para a outra unidade.

-- ============================================
-- FUNÇÃO: get_my_unidade_ids
-- ============================================
-- Retorna TODAS as unidade_ids onde o usuário logado tem vínculo ativo.
-- SECURITY DEFINER bypassa RLS para evitar recursão.
-- Melhoria sobre get_my_unidade_id() que retorna apenas 1 UUID.

CREATE OR REPLACE FUNCTION public.get_my_unidade_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT unidade_id
  FROM public.usuario_unidades
  WHERE usuario_id = auth.uid()
    AND ativo = true
$$;

-- ============================================
-- TABELA: usuarios — SELECT
-- ============================================
-- ANTES: unidade_id = get_my_unidade_id() → só vê users da "unidade principal"
-- DEPOIS: vê users que compartilham qualquer unidade via usuario_unidades

DROP POLICY IF EXISTS "usuarios_select_optimized" ON public.usuarios;

CREATE POLICY "usuarios_select_optimized" ON public.usuarios
FOR SELECT USING (
  -- Usuário sempre vê seu próprio perfil
  id = (SELECT auth.uid())
  OR
  -- Vê usuários que compartilham qualquer unidade ativa
  EXISTS (
    SELECT 1 FROM public.usuario_unidades target_uu
    WHERE target_uu.usuario_id = usuarios.id
      AND target_uu.ativo = true
      AND target_uu.unidade_id IN (SELECT public.get_my_unidade_ids())
  )
);

-- ============================================
-- TABELA: usuarios — UPDATE
-- ============================================
-- ANTES: apenas id = auth.uid() (gestor perdeu acesso a editar motoristas)
-- DEPOIS: gestor pode editar motoristas de suas unidades

DROP POLICY IF EXISTS "usuarios_update_optimized" ON public.usuarios;

CREATE POLICY "usuarios_update_optimized" ON public.usuarios
FOR UPDATE USING (
  -- Usuário atualiza seu próprio perfil
  id = (SELECT auth.uid())
  OR
  -- Gestores atualizam motoristas que compartilham alguma unidade
  (
    usuarios.papel = 'motorista'
    AND EXISTS (
      SELECT 1 FROM public.usuario_unidades my_uu
      WHERE my_uu.usuario_id = (SELECT auth.uid())
        AND my_uu.papel = 'gestor'
        AND my_uu.ativo = true
        AND my_uu.unidade_id IN (
          SELECT uu.unidade_id FROM public.usuario_unidades uu
          WHERE uu.usuario_id = usuarios.id
            AND uu.ativo = true
        )
    )
  )
);

-- ============================================
-- TABELA: usuarios — INSERT
-- ============================================
-- ANTES: usava usuarios.unidade_id (campo legado, single-unit)
-- DEPOIS: gestor pode inserir se é gestor em alguma unidade

DROP POLICY IF EXISTS "usuarios_insert_optimized" ON public.usuarios;

CREATE POLICY "usuarios_insert_optimized" ON public.usuarios
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuario_unidades uu
    WHERE uu.usuario_id = (SELECT auth.uid())
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  )
);

-- ============================================
-- TABELA: motorista_locations — SELECT
-- ============================================
-- ANTES: usava get_my_unidade_id() → single-unit
-- DEPOIS: gestor vê localizações de motoristas de todas as suas unidades

DROP POLICY IF EXISTS "motorista_locations_select_optimized" ON public.motorista_locations;

CREATE POLICY "motorista_locations_select_optimized" ON public.motorista_locations
FOR SELECT USING (
  -- Motorista vê sua própria localização
  motorista_id = (SELECT auth.uid())
  OR
  -- Gestor vê localização de motoristas que compartilham unidade
  EXISTS (
    SELECT 1 FROM public.usuario_unidades motorista_uu
    WHERE motorista_uu.usuario_id = motorista_locations.motorista_id
      AND motorista_uu.ativo = true
      AND motorista_uu.unidade_id IN (SELECT public.get_my_unidade_ids())
  )
);

-- ============================================
-- NOTA: get_my_unidade_id() mantida (backward compat)
-- ============================================
-- A função get_my_unidade_id() (singular) continua existindo para
-- código/policies que dependam dela. Nenhuma policy ativa usa mais,
-- mas não removemos para evitar quebrar possíveis referências.
