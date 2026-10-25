-- ============================================================================
-- Migration 54: desativar motorista com rota aberta é recusado
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose: `alternar_motorista_na_unidade` desativava o motorista (a pessoa ou
-- só o vínculo desta loja) mesmo com rota `pendente` ou `em_andamento` nesta
-- loja. Com o corte de acesso de quem está inativo (Migrations 48 e 49), essas
-- rotas ficavam órfãs: o motorista já não as vê e o gestor não sabe que elas
-- existem. Agora, ao desativar, a função recusa e devolve as rotas para a tela
-- mandar o gestor reatribuir ou cancelar.
--
-- Formato do erro (lido pelo app em src/lib/motorista/rotasAbertasDoMotorista.ts):
--   ERRCODE P0001 · MESSAGE: frase em português (o app já instalado mostra a
--   MESSAGE de P0001 como está, então a versão antiga também entende) ·
--   HINT: 'MOTORISTA_COM_ROTA_ABERTA' (sentinela; não depende do texto) ·
--   DETAIL: JSON [{"id","data","status"}], em andamento primeiro, depois por data.
-- O PostgREST devolve DETAIL e HINT em `details`/`hint`, e o supabase-js os
-- repassa crus em `error.details`/`error.hint`.
--
-- Alternativa descartada: trocar o retorno para json ({resultado, rotas}).
-- Exigiria DROP FUNCTION (CREATE OR REPLACE não muda o tipo de retorno), e o
-- app já instalado leria a resposta como sucesso ("Motorista desativado") sem
-- nada ter mudado. A exceção falha fechada nas duas versões.
--
-- Corrida: a checagem roda depois do `FOR UPDATE OF u`. Criar rota ou trocar o
-- motorista de uma rota confere a FK `rotas.motorista_id` com FOR KEY SHARE na
-- mesma linha de `usuarios`, que conflita com FOR UPDATE — quem atribuiu antes
-- já está commitado quando a leitura das rotas roda (READ COMMITTED). O que
-- esta função NÃO barra: atribuição que começa depois do lock (espera e passa
-- quando ele cai). Pela via do vínculo, o gatilho `validar_motorista_e_loja_da_rota`
-- recusa a atribuição seguinte; pela via da pessoa, ele confere só o vínculo,
-- não `usuarios.ativo` — fica para a tela, que só oferece motorista ativo.
--
-- Reativar (p_ativo = true) nunca é bloqueado. Corpo de partida: o VIVO em
-- 24/10/2026 (pg_get_functiondef), igual ao da Migration 31.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.alternar_motorista_na_unidade(
  p_motorista_id uuid,
  p_unidade_id uuid,
  p_ativo boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pessoa_ativa boolean;
  v_rotas json;
  v_total integer;
BEGIN
  IF NOT public.current_user_is_gestor_of_unidade(p_unidade_id) THEN
    RAISE EXCEPTION 'Apenas gestores da unidade podem alterar o motorista.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.ativo INTO v_pessoa_ativa
  FROM public.usuarios u
  JOIN public.usuario_unidades uu
    ON uu.usuario_id = u.id
   AND uu.unidade_id = p_unidade_id
   AND uu.papel = 'motorista'
  WHERE u.id = p_motorista_id
    AND u.papel = 'motorista'
  -- Serializa dois toggles do mesmo motorista (duas lojas ao mesmo tempo).
  FOR UPDATE OF u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motorista não encontrado nesta loja.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Desativar com rota aberta nesta loja deixaria a rota órfã: o motorista
  -- perde o acesso (Migrations 48/49) e ninguém a executa. Vale para as duas
  -- vias abaixo (vínculo e pessoa).
  IF NOT p_ativo THEN
    SELECT
      json_agg(
        json_build_object('id', r.id, 'data', r.data, 'status', r.status)
        ORDER BY (r.status = 'em_andamento') DESC, r.data, r.id
      ),
      count(*)
    INTO v_rotas, v_total
    FROM public.rotas r
    WHERE r.motorista_id = p_motorista_id
      AND r.unidade_id = p_unidade_id
      AND r.status IN ('pendente', 'em_andamento');

    IF v_total > 0 THEN
      RAISE EXCEPTION '%',
        'Não dá para desativar: este motorista tem '
        || CASE WHEN v_total = 1 THEN '1 rota aberta'
                ELSE v_total || ' rotas abertas' END
        || ' nesta loja. Reatribua a outro motorista ou cancele antes de desativar.'
        USING ERRCODE = 'P0001',
              DETAIL = v_rotas::text,
              HINT = 'MOTORISTA_COM_ROTA_ABERTA';
    END IF;
  END IF;

  IF public.motorista_atende_outra_loja(p_motorista_id) THEN
    IF p_ativo AND NOT v_pessoa_ativa THEN
      RAISE EXCEPTION
        'Este motorista também atende outra loja e está desativado. Para reativá-lo, fale com o suporte.'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.usuario_unidades
    SET ativo = p_ativo
    WHERE usuario_id = p_motorista_id
      AND unidade_id = p_unidade_id;

    RETURN 'vinculo';
  END IF;

  UPDATE public.usuarios SET ativo = p_ativo WHERE id = p_motorista_id;

  -- Reativar também reabre o vínculo desta loja: se a outra loja tirou o dela,
  -- este deixou de ser "outra loja" e cairia aqui com o vínculo ainda inativo.
  IF p_ativo THEN
    UPDATE public.usuario_unidades
    SET ativo = true
    WHERE usuario_id = p_motorista_id
      AND unidade_id = p_unidade_id
      AND NOT ativo;
  END IF;

  RETURN 'pessoa';
END;
$$;

-- CREATE OR REPLACE preserva os grants vivos
-- ({postgres=X, authenticated=X, service_role=X}); nada a re-conceder.

COMMIT;

-- Conferência (só SELECT), depois de aplicar:
--   SELECT pg_get_functiondef('public.alternar_motorista_na_unidade(uuid,uuid,boolean)'::regprocedure)
--     LIKE '%MOTORISTA_COM_ROTA_ABERTA%';                      -- true
--   SELECT has_function_privilege('authenticated',
--     'public.alternar_motorista_na_unidade(uuid,uuid,boolean)', 'EXECUTE');  -- true
--   SELECT has_function_privilege('anon',
--     'public.alternar_motorista_na_unidade(uuid,uuid,boolean)', 'EXECUTE');  -- false
-- Comportamento: database/sondas/20261024154000_sonda_migration54.sql

-- ROLLBACK:
-- (corpo VIVO em 24/10/2026, copiado de pg_get_functiondef; colável)
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.alternar_motorista_na_unidade(p_motorista_id uuid, p_unidade_id uuid, p_ativo boolean)
--  RETURNS text
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
-- DECLARE
--   v_pessoa_ativa boolean;
-- BEGIN
--   IF NOT public.current_user_is_gestor_of_unidade(p_unidade_id) THEN
--     RAISE EXCEPTION 'Apenas gestores da unidade podem alterar o motorista.'
--       USING ERRCODE = '42501';
--   END IF;
--
--   SELECT u.ativo INTO v_pessoa_ativa
--   FROM public.usuarios u
--   JOIN public.usuario_unidades uu
--     ON uu.usuario_id = u.id
--    AND uu.unidade_id = p_unidade_id
--    AND uu.papel = 'motorista'
--   WHERE u.id = p_motorista_id
--     AND u.papel = 'motorista'
--   -- Serializa dois toggles do mesmo motorista (duas lojas ao mesmo tempo).
--   FOR UPDATE OF u;
--
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'Motorista não encontrado nesta loja.'
--       USING ERRCODE = 'P0001';
--   END IF;
--
--   IF public.motorista_atende_outra_loja(p_motorista_id) THEN
--     IF p_ativo AND NOT v_pessoa_ativa THEN
--       RAISE EXCEPTION
--         'Este motorista também atende outra loja e está desativado. Para reativá-lo, fale com o suporte.'
--         USING ERRCODE = 'P0001';
--     END IF;
--
--     UPDATE public.usuario_unidades
--     SET ativo = p_ativo
--     WHERE usuario_id = p_motorista_id
--       AND unidade_id = p_unidade_id;
--
--     RETURN 'vinculo';
--   END IF;
--
--   UPDATE public.usuarios SET ativo = p_ativo WHERE id = p_motorista_id;
--
--   -- Reativar também reabre o vínculo desta loja: se a outra loja tirou o dela,
--   -- este deixou de ser "outra loja" e cairia aqui com o vínculo ainda inativo.
--   IF p_ativo THEN
--     UPDATE public.usuario_unidades
--     SET ativo = true
--     WHERE usuario_id = p_motorista_id
--       AND unidade_id = p_unidade_id
--       AND NOT ativo;
--   END IF;
--
--   RETURN 'pessoa';
-- END;
-- $function$;
-- COMMIT;
