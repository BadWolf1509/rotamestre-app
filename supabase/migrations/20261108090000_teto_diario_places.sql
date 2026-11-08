-- ============================================================================
-- Migration 84: teto diário por usuário nas buscas do Google Places
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   O cadastro é aberto (sem confirmação de e-mail) e o Google Places é pago
--   por consulta/sessão. Desde 26/10/2026 as Edge Functions
--   `google-places-autocomplete` e `google-place-details` exigem usuário
--   logado, mas um usuário só podia chamar sem limite. Decisão do gestor
--   (BKD-4): teto diário por usuário, sem exigir confirmação de e-mail.
--
--   - `uso_places_diario`: uma linha por (usuário, dia, serviço) com o número
--     de chamadas. RLS ligada e SEM policy, sem privilégio de anon e
--     authenticated: ninguém da API lê nem escreve direto; só a função abaixo
--     (SECURITY DEFINER, dona postgres) mexe nela.
--   - `consumir_cota_places(p_servico)`: chamada pelas duas Edge Functions com
--     o JWT de quem busca, ANTES de chamar a Google. Conta uma chamada do
--     `auth.uid()` no dia de hoje em America/Sao_Paulo e devolve true; no
--     teto, não conta e devolve false (a função responde 429). Limites fixos
--     na função: autocomplete 1000/dia, details 300/dia (o uso medido em
--     07–08/11 foi 1 chamada de cada em 24 h; um gestor cadastrando rotas o
--     dia inteiro fica muito abaixo). Sem sessão (`auth.uid()` nulo) → false.
--     Serviço fora dos dois → exceção 22023: é erro de programação da Edge
--     Function, e a exceção aparece no log dela (devolver false bloquearia a
--     busca de todo mundo calado).
--   - Incremento atômico: INSERT ... ON CONFLICT DO UPDATE ... WHERE
--     chamadas < limite RETURNING. Duas chamadas simultâneas do mesmo usuário
--     serializam na linha; a que encontra o teto não grava e não devolve
--     linha. Sem SELECT antes do UPDATE (corrida de leitura-e-escrita).
--   - Limpeza: cada chamada apaga as linhas do próprio usuário com mais de 7
--     dias (pela chave primária), sem cron.
--
--   APLICAR COMO `postgres`: a função precisa ser dona da tabela para
--   escrever nela sem policy.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 1. Tabela de uso (a chave primária começa por usuario_id e cobre a FK)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uso_places_diario (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia date NOT NULL,
  servico text NOT NULL CHECK (servico IN ('autocomplete', 'details')),
  chamadas integer NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, dia, servico)
);

ALTER TABLE public.uso_places_diario ENABLE ROW LEVEL SECURITY;

-- Sem policy de propósito: com RLS ligada, a API não vê nem grava linha.
REVOKE ALL ON TABLE public.uso_places_diario FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.uso_places_diario IS
  'Migration 84: chamadas ao Google Places por usuário, dia (America/Sao_Paulo) e serviço (autocomplete, details). Escrita só por consumir_cota_places; RLS sem policy.';

-- ----------------------------------------------------------------------------
-- 2. Consumo da cota
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumir_cota_places(p_servico text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_limite integer;
  v_chamadas integer;
BEGIN
  v_limite := CASE p_servico
    WHEN 'autocomplete' THEN 1000
    WHEN 'details' THEN 300
  END;

  IF v_limite IS NULL THEN
    RAISE EXCEPTION 'Serviço do Places desconhecido: %', p_servico
      USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
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
  'Migration 84: conta uma chamada ao Google Places do auth.uid() hoje (America/Sao_Paulo) e devolve true; no teto diário (autocomplete 1000, details 300) não conta e devolve false; sem sessão, false; serviço desconhecido, 22023. Chamada pelas Edge Functions google-places-autocomplete e google-place-details.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT c.relrowsecurity, c.relacl,
--        (SELECT count(*) FROM pg_policies WHERE tablename = 'uso_places_diario') AS policies
--   FROM pg_class c WHERE c.oid = 'public.uso_places_diario'::regclass;
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.consumir_cota_places(text)');
-- ============================================================================

-- ROLLBACK:
-- -- Sem a função, as Edge Functions publicadas com a cota recebem erro da RPC
-- -- e seguem buscando (fail-open, `_shared/cotaPlaces.ts`), só sem teto.
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
-- DROP FUNCTION IF EXISTS public.consumir_cota_places(text);
-- DROP TABLE IF EXISTS public.uso_places_diario;
-- COMMIT;
