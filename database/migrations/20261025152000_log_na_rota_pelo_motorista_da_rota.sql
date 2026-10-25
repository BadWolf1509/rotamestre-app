-- ============================================================================
-- Migration 63: log na rota pelo gestor da loja ou pelo motorista da rota
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   `pode_registrar_log_na_rota(p_rota_id)` decide quem grava em `logs` um
--   registro ligado a uma rota: é chamada pela policy `logs_insert_optimized`
--   (INSERT direto do app), pelo `registrar_sos` e pelo gatilho
--   `logs_sos_sem_rota_quando_recusada` (nesses dois, a rota recusada vira
--   SOS sem rota, nunca SOS perdido). Na Migration 49 ela passou a exigir
--   vínculo ativo na loja da rota e, fora do gestor, pessoa ativa — mas não
--   exigia que a rota fosse de quem grava: qualquer motorista ativo da loja
--   gravava log na rota de outro motorista. Esta migration acrescenta essa
--   exigência: fora do gestor ativo da loja, só o motorista da própria rota
--   (`rotas.motorista_id = auth.uid()`), com pessoa ativa, grava log nela. É a
--   mesma regra de leitura e escrita de `rotas` e `paradas`
--   (`rotas_select`, `paradas_update`: gestor OU motorista da rota e pessoa
--   ativa).
--
--   Alternativas consideradas:
--     (a) mudar o corpo da função, mantendo a assinatura (escolhida): os três
--         chamadores passam a seguir a mesma regra de uma vez, e a policy não
--         é recriada;
--     (b) acrescentar `r.motorista_id = auth.uid()` só na WITH CHECK de
--         `logs_insert_optimized`: o INSERT direto fecharia, mas o
--         `registrar_sos` e o gatilho do SOS continuariam aceitando a rota
--         alheia — o SOS de um colega apareceria na linha do tempo da rota de
--         outro motorista e avisaria pela rota errada;
--     (c) gatilho BEFORE INSERT em `logs` que recusa: duplicaria a regra que a
--         função já centraliza, e um RAISE no caminho do SOS o derrubaria (o
--         SOS nunca pode falhar).
--
--   Efeito no que já existe:
--     - App: o motorista grava log só na rota dele (conclusão, pulo e
--       incidente de parada, `logParadaAction`/`logAction`); o gestor grava
--       nas rotas da loja (criar, otimizar, reordenar, editar, excluir). Os
--       dois caminhos seguem passando.
--     - SOS: o colega que cita a rota de outro motorista continua tendo o SOS
--       gravado e os gestores avisados, só que sem a rota
--       (`rota_recusada: true`), como já acontece com rota de outra loja.
--     - Dados: nenhum log com rota gravado por uma pessoa que não seja o
--       motorista da rota nem gestor da loja (medido em 25/10/2026, histórico
--       inteiro); fora isso, 1 registro sem usuário, gravado por gatilho.
--     - Rota reatribuída a outro motorista: o motorista anterior deixa de
--       gravar log nela — o mesmo que já vale para ler a rota.
--
--   Assinatura, linguagem, volatilidade (STABLE), SECURITY DEFINER e
--   `search_path` vazio iguais aos da Migration 49; os GRANTs são repetidos
--   para deixar a regra de EXECUTE explícita (o CREATE OR REPLACE já os
--   preserva).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.pode_registrar_log_na_rota(p_rota_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND (
        uu.papel = 'gestor'
        OR (
          r.motorista_id = auth.uid()
          AND (SELECT public.usuario_atual_ativo())
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pode_registrar_log_na_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_registrar_log_na_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.pode_registrar_log_na_rota(uuid) IS
  'Quem grava log ligado à rota: gestor ativo da loja da rota, ou o motorista da própria rota com vínculo e pessoa ativos (Migration 63).';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_userbyid(proowner) AS dono, prosecdef, proconfig,
--        prosrc LIKE '%r.motorista_id = auth.uid()%' AS propria_rota,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth
--   FROM pg_proc WHERE oid = 'public.pode_registrar_log_na_rota(uuid)'::regprocedure;
--   → postgres, true, {search_path=""}, true, false, true
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.pode_registrar_log_na_rota(p_rota_id uuid)
-- RETURNS boolean
-- LANGUAGE sql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
--   SELECT EXISTS (
--     SELECT 1
--     FROM public.rotas r
--     JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
--     WHERE r.id = p_rota_id
--       AND uu.usuario_id = auth.uid()
--       AND uu.ativo = true
--       AND (
--         uu.papel = 'gestor'
--         OR (SELECT public.usuario_atual_ativo())
--       )
--   );
-- $$;
-- COMMIT;
