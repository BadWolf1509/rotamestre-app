-- ============================================================================
-- Migration 85: Places — teto de details, sessão ausente e limpeza global
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   Ajustes da Migration 84 (teto diário por usuário no Google Places),
--   achados B8-1, B8-4 e B8-5 da varredura de 08/11.
--
--   - `consumir_cota_places(p_servico)` recriada a partir da versão viva da
--     Migration 84 (conferida no catálogo em 08/11), mudando só duas coisas:
--       * B8-1: teto de `details` sobe de 300 para 1000 por dia. Decisão do
--         gestor: uma importação em lote acima de 300 linhas caía no
--         Photon no meio do lote. `autocomplete` continua 1000.
--       * B8-4: sem `auth.uid()` devolve NULL, não false. O false é "cota
--         esgotada" e virava 429 "limite atingido"; NULL cai no ramo
--         "indisponível" da Edge Function (`_shared/cotaPlaces.ts`), que segue
--         a busca e registra o motivo no log.
--     Todo o resto (fuso, upsert atômico com teto, limpeza das linhas do
--     próprio usuário com mais de 7 dias, 22023 para serviço desconhecido)
--     fica igual. `CREATE OR REPLACE` preserva a ACL; ela é refeita mesmo
--     assim, como na 84.
--   - B8-5: `limpar_uso_places_antigo(p_dias integer DEFAULT 8)` apaga, de
--     todos os usuários, as linhas de `uso_places_diario` anteriores a hoje
--     (America/Sao_Paulo) menos p_dias e devolve quantas apagou. Antes, a
--     linha de quem parou de buscar ficava para sempre (a 84 só limpa na
--     chamada do próprio usuário). Piso de 1 dia: um 0 ou negativo por engano
--     apagaria a linha de hoje e zeraria o teto. Chamada pela Edge Function
--     `expire-routes`, ao lado de `limpar_notificacoes_antigas` (Migration
--     83), com a mesma regra: falha só vai para o log. EXECUTE só de
--     `service_role`.
--
--   Alternativas consideradas:
--     B8-4: (a) NULL (escolhida: o helper já trata como indisponível, sem
--          mudar o tipo de retorno nem o contrato das Edge Functions
--          publicadas); (b) exceção (28000): a Edge Function veria erro da
--          RPC e cairia no mesmo fail-open, mas a sessão ausente é estado
--          esperado (token expirado entre o getUser e a RPC), não erro de
--          programação; (c) manter false e tratar na função: o banco
--          continuaria dizendo "esgotada" para quem não tem cota nenhuma.
--     B8-5: (a) RPC chamada pela `expire-routes` (escolhida: mesmo caminho
--          das Migrations 37 e 83, sem pg_cron no projeto); (b) DELETE em
--          lotes como a 83: a tabela tem no máximo 2 linhas por usuário por
--          dia, e o corte de 8 dias a mantém pequena; um DELETE só basta.
--
--   APLICAR COMO `postgres`: as funções precisam ser donas da tabela (RLS
--   sem policy) para escrever nela.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 1. Consumo da cota (B8-1 e B8-4)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumir_cota_places(p_servico text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_limite integer;
  v_chamadas integer;
BEGIN
  v_limite := CASE p_servico
    WHEN 'autocomplete' THEN 1000
    WHEN 'details' THEN 1000
  END;

  IF v_limite IS NULL THEN
    RAISE EXCEPTION 'Serviço do Places desconhecido: %', p_servico
      USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.uso_places_diario
   WHERE usuario_id = v_uid
     AND dia < v_hoje - 7;

  INSERT INTO public.uso_places_diario AS u (usuario_id, dia, servico, chamadas)
  VALUES (v_uid, v_hoje, p_servico, 1)
  ON CONFLICT (usuario_id, dia, servico) DO UPDATE
    SET chamadas = u.chamadas + 1
    WHERE u.chamadas < v_limite
  RETURNING u.chamadas INTO v_chamadas;

  RETURN v_chamadas IS NOT NULL;
END;
$$;

ALTER FUNCTION public.consumir_cota_places(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consumir_cota_places(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consumir_cota_places(text) TO authenticated;

COMMENT ON FUNCTION public.consumir_cota_places(text) IS
  'Migration 85: conta uma chamada ao Google Places do auth.uid() hoje (America/Sao_Paulo) e devolve true; no teto diário (autocomplete 1000, details 1000) não conta e devolve false; sem sessão, null (a Edge Function segue como indisponível); serviço desconhecido, 22023. Chamada pelas Edge Functions google-places-autocomplete e google-place-details.';

-- ----------------------------------------------------------------------------
-- 2. Limpeza global das linhas antigas (B8-5)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_uso_places_antigo(p_dias integer DEFAULT 8)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apagadas integer;
BEGIN
  -- Piso para um argumento errado não apagar a linha de hoje (zeraria o teto).
  IF p_dias IS NULL OR p_dias < 1 THEN
    RAISE EXCEPTION 'Retenção mínima do uso do Places é 1 dia (recebido: %).', p_dias
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.uso_places_diario
   WHERE dia < (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
  GET DIAGNOSTICS v_apagadas = ROW_COUNT;

  RETURN v_apagadas;
END;
$$;

ALTER FUNCTION public.limpar_uso_places_antigo(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.limpar_uso_places_antigo(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_uso_places_antigo(integer) TO service_role;

COMMENT ON FUNCTION public.limpar_uso_places_antigo(integer) IS
  'Migration 85: apaga de uso_places_diario, de todos os usuários, as linhas com dia anterior a hoje (America/Sao_Paulo) menos p_dias (padrão 8, mínimo 1) e devolve quantas apagou. Chamada pela Edge Function expire-routes.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        obj_description(p.oid, 'pg_proc') AS comentario
--   FROM pg_proc p
--  WHERE p.oid IN (to_regprocedure('public.consumir_cota_places(text)'),
--                  to_regprocedure('public.limpar_uso_places_antigo(integer)'));
-- ============================================================================

-- ROLLBACK:
-- -- Volta a consumir_cota_places ao corpo da Migration 84 e apaga a limpeza.
-- -- Sem a limpeza, a expire-routes só registra o erro da RPC no log.
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
-- CREATE OR REPLACE FUNCTION public.consumir_cota_places(p_servico text)
-- RETURNS boolean
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_uid uuid := auth.uid();
--   v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
--   v_limite integer;
--   v_chamadas integer;
-- BEGIN
--   v_limite := CASE p_servico
--     WHEN 'autocomplete' THEN 1000
--     WHEN 'details' THEN 300
--   END;
--
--   IF v_limite IS NULL THEN
--     RAISE EXCEPTION 'Serviço do Places desconhecido: %', p_servico
--       USING ERRCODE = '22023';
--   END IF;
--
--   IF v_uid IS NULL THEN
--     RETURN false;
--   END IF;
--
--   DELETE FROM public.uso_places_diario
--    WHERE usuario_id = v_uid
--      AND dia < v_hoje - 7;
--
--   INSERT INTO public.uso_places_diario AS u (usuario_id, dia, servico, chamadas)
--   VALUES (v_uid, v_hoje, p_servico, 1)
--   ON CONFLICT (usuario_id, dia, servico) DO UPDATE
--     SET chamadas = u.chamadas + 1
--     WHERE u.chamadas < v_limite
--   RETURNING u.chamadas INTO v_chamadas;
--
--   RETURN v_chamadas IS NOT NULL;
-- END;
-- $$;
-- COMMENT ON FUNCTION public.consumir_cota_places(text) IS
--   'Migration 84: conta uma chamada ao Google Places do auth.uid() hoje (America/Sao_Paulo) e devolve true; no teto diário (autocomplete 1000, details 300) não conta e devolve false; sem sessão, false; serviço desconhecido, 22023. Chamada pelas Edge Functions google-places-autocomplete e google-place-details.';
-- DROP FUNCTION IF EXISTS public.limpar_uso_places_antigo(integer);
-- COMMIT;
