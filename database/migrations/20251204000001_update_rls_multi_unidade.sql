-- =============================================
-- Migration: Update RLS Policies for Multi-Unit Support
-- =============================================
-- Data: 2025-12-04
-- Descrição: Atualiza RLS policies para usar usuario_unidades ao invés de usuarios.unidade_id
--
-- Dependência: 20251204000000_usuario_unidades.sql
--
-- Mudança principal: Substituir `u.unidade_id = X` por lookup em usuario_unidades

-- =============================================
-- TABELA: usuarios
-- =============================================

-- Drop políticas antigas
DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update ON public.usuarios;

-- SELECT: Usuário vê seu perfil OU gestores veem usuários de suas unidades (via usuario_unidades)
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT
  USING (
    -- Usuário vê seu próprio perfil
    id = (SELECT auth.uid())
    OR
    -- Gestores veem usuários que compartilham alguma unidade
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades my_uu
      JOIN public.usuario_unidades target_uu ON target_uu.unidade_id = my_uu.unidade_id
      WHERE my_uu.usuario_id = (SELECT auth.uid())
        AND my_uu.papel = 'gestor'
        AND my_uu.ativo = true
        AND target_uu.usuario_id = usuarios.id
        AND target_uu.ativo = true
    )
  );

-- UPDATE: Usuário atualiza seu perfil OU gestores atualizam motoristas de suas unidades
CREATE POLICY usuarios_update ON public.usuarios
  FOR UPDATE
  USING (
    -- Usuário atualiza seu próprio perfil
    id = (SELECT auth.uid())
    OR
    -- Gestores atualizam motoristas que compartilham alguma unidade
    (
      usuarios.papel = 'motorista'
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        JOIN public.usuario_unidades target_uu ON target_uu.unidade_id = my_uu.unidade_id
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND my_uu.papel = 'gestor'
          AND my_uu.ativo = true
          AND target_uu.usuario_id = usuarios.id
          AND target_uu.ativo = true
      )
    )
  );

-- =============================================
-- TABELA: rotas
-- =============================================

-- Drop políticas antigas
DROP POLICY IF EXISTS rotas_select ON public.rotas;
DROP POLICY IF EXISTS rotas_update ON public.rotas;
DROP POLICY IF EXISTS rotas_insert ON public.rotas;
DROP POLICY IF EXISTS rotas_delete ON public.rotas;

-- SELECT: Motorista vê suas rotas OU gestor vê rotas de suas unidades
CREATE POLICY rotas_select ON public.rotas
  FOR SELECT
  USING (
    -- Motoristas veem rotas atribuídas a eles
    motorista_id = (SELECT auth.uid())
    OR
    -- Gestores veem rotas das unidades onde são gestores
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
    )
  );

-- INSERT: Apenas gestores podem criar rotas em suas unidades
CREATE POLICY rotas_insert ON public.rotas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
    )
  );

-- UPDATE: Motorista atualiza suas rotas OU gestor atualiza rotas de suas unidades
CREATE POLICY rotas_update ON public.rotas
  FOR UPDATE
  USING (
    -- Motoristas atualizam rotas atribuídas a eles
    motorista_id = (SELECT auth.uid())
    OR
    -- Gestores atualizam rotas das unidades onde são gestores
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
    )
  );

-- DELETE: Apenas gestores podem deletar rotas de suas unidades
CREATE POLICY rotas_delete ON public.rotas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
    )
  );

-- =============================================
-- TABELA: paradas
-- =============================================

-- Drop políticas antigas
DROP POLICY IF EXISTS paradas_select ON public.paradas;
DROP POLICY IF EXISTS paradas_update ON public.paradas;
DROP POLICY IF EXISTS paradas_insert ON public.paradas;
DROP POLICY IF EXISTS paradas_delete ON public.paradas;

-- SELECT: Via rota (motorista ou gestor)
CREATE POLICY paradas_select ON public.paradas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      WHERE r.id = paradas.rota_id
        AND (
          -- Motorista vê paradas das suas rotas
          r.motorista_id = (SELECT auth.uid())
          OR
          -- Gestor vê paradas das rotas das suas unidades
          EXISTS (
            SELECT 1
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = (SELECT auth.uid())
              AND uu.papel = 'gestor'
              AND uu.unidade_id = r.unidade_id
              AND uu.ativo = true
          )
        )
    )
  );

-- INSERT: Via rota (apenas gestor da unidade)
CREATE POLICY paradas_insert ON public.paradas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
      WHERE r.id = paradas.rota_id
        AND uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.ativo = true
    )
  );

-- UPDATE: Via rota (motorista ou gestor)
CREATE POLICY paradas_update ON public.paradas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      WHERE r.id = paradas.rota_id
        AND (
          -- Motorista atualiza paradas das suas rotas
          r.motorista_id = (SELECT auth.uid())
          OR
          -- Gestor atualiza paradas das rotas das suas unidades
          EXISTS (
            SELECT 1
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = (SELECT auth.uid())
              AND uu.papel = 'gestor'
              AND uu.unidade_id = r.unidade_id
              AND uu.ativo = true
          )
        )
    )
  );

-- DELETE: Via rota (apenas gestor)
CREATE POLICY paradas_delete ON public.paradas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
      WHERE r.id = paradas.rota_id
        AND uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.ativo = true
    )
  );

-- =============================================
-- TABELA: logs
-- =============================================

-- Drop políticas antigas
DROP POLICY IF EXISTS logs_select ON public.logs;

-- SELECT: Usuário vê seus logs OU gestor vê logs de usuários das suas unidades
CREATE POLICY logs_select ON public.logs
  FOR SELECT
  USING (
    -- Usuários veem seus próprios logs
    usuario_id = (SELECT auth.uid())
    OR
    -- Gestores veem logs de usuários das suas unidades
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades my_uu
      JOIN public.usuario_unidades log_user_uu ON log_user_uu.unidade_id = my_uu.unidade_id
      WHERE my_uu.usuario_id = (SELECT auth.uid())
        AND my_uu.papel = 'gestor'
        AND my_uu.ativo = true
        AND log_user_uu.usuario_id = logs.usuario_id
        AND log_user_uu.ativo = true
    )
  );

-- =============================================
-- TABELA: unidades
-- =============================================

-- Drop políticas antigas se existirem
DROP POLICY IF EXISTS unidades_select ON public.unidades;

-- SELECT: Usuário vê unidades das quais faz parte
CREATE POLICY unidades_select ON public.unidades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = unidades.id
        AND uu.ativo = true
    )
  );

-- =============================================
-- TABELA: incidentes (se existir)
-- =============================================
-- NOTA: A tabela incidentes NÃO tem coluna unidade_id
-- Ela tem motorista_id, então usamos join via usuario_unidades do motorista

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidentes') THEN
    -- Drop políticas antigas
    DROP POLICY IF EXISTS incidentes_select ON public.incidentes;
    DROP POLICY IF EXISTS incidentes_select_policy ON public.incidentes;
    DROP POLICY IF EXISTS incidentes_insert ON public.incidentes;
    DROP POLICY IF EXISTS incidentes_insert_policy ON public.incidentes;
    DROP POLICY IF EXISTS incidentes_update ON public.incidentes;
    DROP POLICY IF EXISTS incidentes_update_policy ON public.incidentes;

    -- SELECT: Motorista vê seus próprios incidentes OU gestor vê incidentes de motoristas das suas unidades
    EXECUTE '
      CREATE POLICY incidentes_select ON public.incidentes
        FOR SELECT
        USING (
          -- Motorista vê seus próprios incidentes
          motorista_id = (SELECT auth.uid())
          OR
          -- Gestor vê incidentes de motoristas que compartilham alguma unidade
          EXISTS (
            SELECT 1
            FROM public.usuario_unidades my_uu
            JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
            WHERE my_uu.usuario_id = (SELECT auth.uid())
              AND my_uu.papel = ''gestor''
              AND my_uu.ativo = true
              AND motorista_uu.usuario_id = incidentes.motorista_id
              AND motorista_uu.ativo = true
          )
        )
    ';

    -- INSERT: Motorista cria incidente para si mesmo
    EXECUTE '
      CREATE POLICY incidentes_insert ON public.incidentes
        FOR INSERT
        WITH CHECK (
          motorista_id = (SELECT auth.uid())
        )
    ';

    -- UPDATE: Motorista atualiza seus incidentes OU gestor atualiza incidentes de motoristas das suas unidades
    EXECUTE '
      CREATE POLICY incidentes_update ON public.incidentes
        FOR UPDATE
        USING (
          -- Motorista atualiza seus próprios incidentes
          motorista_id = (SELECT auth.uid())
          OR
          -- Gestor atualiza incidentes de motoristas que compartilham alguma unidade
          EXISTS (
            SELECT 1
            FROM public.usuario_unidades my_uu
            JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
            WHERE my_uu.usuario_id = (SELECT auth.uid())
              AND my_uu.papel = ''gestor''
              AND my_uu.ativo = true
              AND motorista_uu.usuario_id = incidentes.motorista_id
              AND motorista_uu.ativo = true
          )
        )
    ';
  END IF;
END
$$;

-- =============================================
-- TABELA: notificacoes (se existir)
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificacoes') THEN
    DROP POLICY IF EXISTS notificacoes_select ON public.notificacoes;

    EXECUTE '
      CREATE POLICY notificacoes_select ON public.notificacoes
        FOR SELECT
        USING (
          usuario_id = (SELECT auth.uid())
        )
    ';
  END IF;
END
$$;

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Contar políticas atualizadas
SELECT
  tablename AS "Tabela",
  COUNT(*) AS "Políticas"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'rotas', 'paradas', 'logs', 'unidades', 'usuario_unidades', 'incidentes', 'notificacoes')
GROUP BY tablename
ORDER BY tablename;

-- =============================================
-- NOTAS
-- =============================================
--
-- MUDANÇA PRINCIPAL:
-- ANTES: u.unidade_id = rotas.unidade_id
-- DEPOIS: EXISTS (SELECT 1 FROM usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = rotas.unidade_id)
--
-- Isso permite que:
-- 1. Um motorista veja rotas de TODAS as unidades onde está vinculado
-- 2. Um gestor gerencie usuários de TODAS as unidades onde é gestor
-- 3. A lógica de acesso seja baseada em vinculações ativas, não em um único unidade_id
--
-- COMPATIBILIDADE:
-- A coluna usuarios.unidade_id continua existindo como "cache"
-- O app pode continuar usando ela para saber a "unidade ativa" do usuário
-- As queries antigas que usam unidade_id ainda funcionam
