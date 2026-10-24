-- ============================================================================
-- Migration 49: rotas e paradas do motorista pelo vínculo ativo com a loja
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   O motorista lê e atualiza uma rota (e as paradas dela) quando é o
--   motorista da rota, está ativo como pessoa (`usuarios.ativo = true`) e tem
--   vínculo ativo (`usuario_unidades.ativo = true`) com a loja da rota
--   (`rotas.unidade_id`). Quem atende duas lojas e tem o vínculo desativado
--   numa delas segue trabalhando normalmente na outra; o vínculo (ou a
--   pessoa) reativado devolve o acesso. O gestor não muda: lê e atualiza as
--   rotas das lojas onde é gestor ativo.
--
--   Regra única, nas quatro policies e nas três funções SECURITY DEFINER que o
--   motorista alcança: "quem consulta tem vínculo ativo na loja da rota, e é
--   gestor dessa loja OU é o motorista da rota e está ativo". O papel do
--   motorista não é exigido no vínculo: o gatilho
--   `validar_motorista_e_loja_da_rota` já só atribui rota a quem tem vínculo
--   `motorista` ativo na loja, e o par (usuario_id, unidade_id) é único.
--
--   Pessoa ativa: `alternar_motorista_na_unidade` desativa o motorista de uma
--   loja só pela pessoa (`usuarios.ativo`), mantendo o vínculo. O helper
--   `usuario_atual_ativo()` (STABLE, SECURITY DEFINER, search_path vazio,
--   devolve só o booleano do próprio `auth.uid()`) entra no ramo do motorista,
--   chamado como `(SELECT public.usuario_atual_ativo())` — vira initplan,
--   avaliado uma vez por consulta. O ramo do gestor segue pelo vínculo de
--   gestor ativo na loja. Alternativa considerada:
--   desativar também o vínculo no caminho "pessoa" da RPC — muda a tela de
--   Motoristas (o vínculo inativo esconde perfil e edição) e pede backfill;
--   fica como passo separado.
--
--   Policies (ALTER POLICY: nomes mantidos, sem janela sem policy; passam de
--   `public` para `authenticated`, como na Migration 48 — anon já não lia
--   nada, `auth.uid()` é NULL):
--     - `rotas_select`, `rotas_update` (USING; o UPDATE não tem WITH CHECK
--       próprio, então a mesma expressão vale para a linha nova);
--     - `paradas_select`, `paradas_update` (pela rota da parada).
--   `rotas_insert`/`rotas_delete`/`paradas_insert`/`paradas_delete` já são só
--   do gestor ativo e não mudam.
--
--   Funções que o motorista chama sobre a rota ou a parada (EXECUTE para
--   authenticated; SECURITY DEFINER passa por cima do RLS, então cada uma
--   confere a regra por conta própria):
--     - `finalizar_rota(uuid)`: vínculo ativo e pessoa ativa entram no WHERE
--       do SELECT que trava a rota; sem eles, o mesmo ROTA_NAO_ENCONTRADA de
--       rota alheia;
--     - `reordenar_paradas(uuid[], integer[])`: o ramo do motorista passa a
--       exigir vínculo ativo e pessoa ativa (o app só a chama na tela do
--       gestor);
--     - `pode_registrar_log_na_rota(uuid)`: usada por `logs_insert_optimized`
--       e por `registrar_sos`. Passa a ser "vínculo ativo na loja da rota, e
--       gestor dela ou pessoa ativa".
--
--   SOS nunca é recusado por causa da rota. Quando quem aciona o SOS não pode
--   mais registrar na rota informada (rota guardada no aparelho de uma loja
--   onde ele foi desativado), o SOS é gravado SEM rota, com
--   `detalhes.rota_recusada = true` e sem `rota_id`/`rota_status` em
--   `detalhes`. Sem rota, `notify_sos_acionado` → `avisar_gestores_do_sos`
--   avisa os gestores de todas as lojas onde ele tem vínculo ativo; nada da
--   rota recusada é gravado. Dois caminhos:
--     - INSERT direto em `logs` (versões do app que não usam a RPC): gatilho
--       BEFORE INSERT `logs_sos_sem_rota_quando_recusada`, só para
--       `evento = 'sos_acionado'` com rota e com usuário na sessão. O nome
--       ordena antes de `prevent_duplicate_log_trigger` (BEFORE da mesma
--       tabela disparam em ordem alfabética), então a deduplicação já vê a
--       linha sem rota; o WITH CHECK de `logs_insert_optimized` é avaliado
--       depois dos gatilhos BEFORE e aceita pelo ramo `rota_id IS NULL`.
--       Sem usuário na sessão (service_role, cron) o gatilho não age;
--     - `registrar_sos(jsonb, uuid)` (Migration 46): redefinida a partir do
--       corpo em produção; muda só a recusa, que vira a mesma queda para
--       "sem rota" (inclusive na busca do SOS deduplicado).
--   Nos dois, a checagem da rota roda num bloco com `EXCEPTION WHEN OTHERS`:
--   se ela falhar (função ausente, erro inesperado), o SOS segue sem rota,
--   com a mesma marcação, e o motivo vai para o log do Postgres (WARNING).
--   Alternativas consideradas: (a) tornar `pode_registrar_log_na_rota` à
--   prova de erro — função SQL não captura exceção, e não cobre a própria
--   função ausente; (b) repetir a regra inline no gatilho, sem chamar a
--   função — duas fontes para o mesmo critério, e a consulta inline também
--   pode falhar. O bloco com EXCEPTION custa uma subtransação só no INSERT de
--   SOS com rota (o WHEN do gatilho filtra o resto).
--
--   Conferidas e sem mudança: `inserir_parada`, `criar_rota_com_paradas`,
--   `criar_notificacao`, `alternar_motorista_na_unidade`,
--   `listar_motoristas_unidade` (só gestor ativo); `estatisticas_rota`,
--   `obter_paradas_ordenadas`, `rotas_ativas_motorista` (sem EXECUTE para
--   authenticated); `notify_sos_acionado`/`avisar_gestores_do_sos` (já tratam
--   rota NULL como SOS sem rota). Os demais gatilhos (notify_*,
--   log_*_status, validar_*) rodam sobre a linha que a policy ou a RPC já
--   deixou passar.
--
--   Herdam a regra pelo RLS de `rotas`, porque consultam a tabela com o papel
--   de quem grava: `motorista_locations_insert_optimized` (Migration 48 — a
--   posição só entra em rota do motorista que ele enxerga) e o embed
--   `paradas → rotas` das consultas do app.
--
--   Medido em 24/10/2026: 873 rotas; 652 com motorista de vínculo ativo na
--   loja da rota (nenhuma pendente ou em andamento fora disso); 3
--   `nao_executada` com o vínculo do motorista desativado, que deixam de
--   aparecer para ele; nenhuma rota com motorista sem linha em
--   `usuario_unidades`; `usuarios.ativo` sem NULL (7 inativos).
--
--   Índices (nenhum novo; conferidos com EXPLAIN em 24/10/2026): paradas por
--   `idx_paradas_ordem` + `rotas_pkey`; a lista do motorista entra por
--   `idx_rotas_motorista` ou, conforme o planejador, por `idx_rotas_unidade`
--   via o vínculo (sub-milissegundo no volume atual; se crescer, índice
--   `rotas(unidade_id, motorista_id)`); `auth.uid()` e o helper viram
--   initplan; `usuario_unidades` (21 linhas) por seq scan.
--
-- Sonda transacional: database/sondas/20261024111000_sonda_migration49.sql
-- (termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Helper: quem chama está ativo como pessoa?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_atual_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT u.ativo FROM public.usuarios u WHERE u.id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.usuario_atual_ativo() IS
  'true quando quem chama tem usuarios.ativo = true. Usada no ramo do motorista das policies de rotas/paradas e das RPCs finalizar_rota, reordenar_paradas e pode_registrar_log_na_rota (Migration 49).';

-- As policies rodam com o papel de quem consulta: authenticated precisa de
-- EXECUTE. anon não.
REVOKE ALL ON FUNCTION public.usuario_atual_ativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_atual_ativo() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- rotas: gestor ativo da loja, ou o motorista da rota, ativo, com vínculo
-- ativo nela
-- ----------------------------------------------------------------------------
ALTER POLICY rotas_select ON public.rotas
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
        AND (
          uu.papel::text = 'gestor'
          OR (
            rotas.motorista_id = (SELECT auth.uid())
            AND (SELECT public.usuario_atual_ativo())
          )
        )
    )
  );

ALTER POLICY rotas_update ON public.rotas
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = rotas.unidade_id
        AND uu.ativo = true
        AND (
          uu.papel::text = 'gestor'
          OR (
            rotas.motorista_id = (SELECT auth.uid())
            AND (SELECT public.usuario_atual_ativo())
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- paradas: a mesma regra, pela rota da parada
-- ----------------------------------------------------------------------------
ALTER POLICY paradas_select ON public.paradas
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
      WHERE r.id = paradas.rota_id
        AND uu.usuario_id = (SELECT auth.uid())
        AND uu.ativo = true
        AND (
          uu.papel::text = 'gestor'
          OR (
            r.motorista_id = (SELECT auth.uid())
            AND (SELECT public.usuario_atual_ativo())
          )
        )
    )
  );

ALTER POLICY paradas_update ON public.paradas
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
      WHERE r.id = paradas.rota_id
        AND uu.usuario_id = (SELECT auth.uid())
        AND uu.ativo = true
        AND (
          uu.papel::text = 'gestor'
          OR (
            r.motorista_id = (SELECT auth.uid())
            AND (SELECT public.usuario_atual_ativo())
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- finalizar_rota: o motorista da rota, ativo, com vínculo ativo na loja dela
-- (corpo da Migration 40; muda só o WHERE do SELECT que trava a rota)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalizar_rota(p_rota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_pendentes integer;
  v_chegada_id uuid;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO: sessão expirada ao finalizar a rota.'
      USING ERRCODE = '42501';
  END IF;

  -- O dono, a pessoa ativa e o vínculo ativo no WHERE: só a rota própria, de
  -- loja onde o motorista está ativo, é travada. "Não existe", "não é sua" e
  -- "desativado" caem no mesmo NOT FOUND (não revela rota alheia).
  SELECT r.status
    INTO v_status
    FROM public.rotas r
   WHERE r.id = p_rota_id
     AND r.motorista_id = auth.uid()
     AND (SELECT public.usuario_atual_ativo())
     AND EXISTS (
       SELECT 1
         FROM public.usuario_unidades uu
        WHERE uu.usuario_id = auth.uid()
          AND uu.unidade_id = r.unidade_id
          AND uu.ativo = true
     )
     FOR NO KEY UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROTA_NAO_ENCONTRADA: rota não encontrada para este motorista.'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotente: o dono pedindo de novo uma rota já concluída é sucesso.
  IF v_status = 'concluida' THEN RETURN; END IF;

  IF v_status IS DISTINCT FROM 'em_andamento' THEN
    RAISE EXCEPTION 'ROTA_NAO_EM_ANDAMENTO: a rota precisa estar em andamento para ser finalizada (status atual: %).',
      v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Trava as paradas antes de contar (ver 2b no cabeçalho da Migration 40).
  PERFORM 1
     FROM public.paradas p
    WHERE p.rota_id = p_rota_id
      FOR NO KEY UPDATE;

  SELECT count(*)
    INTO v_pendentes
    FROM public.paradas p
   WHERE p.rota_id = p_rota_id
     AND p.is_checkpoint IS DISTINCT FROM false
     AND p.status IN ('pendente', 'em_andamento');

  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'ROTA_PARADAS_PENDENTES: não é possível finalizar a rota com % parada(s) pendente(s).',
      v_pendentes
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id
    INTO v_chegada_id
    FROM public.paradas p
   WHERE p.rota_id = p_rota_id
     AND p.is_checkpoint = false
   ORDER BY p.ordem DESC
   LIMIT 1;

  IF v_chegada_id IS NOT NULL THEN
    UPDATE public.paradas
       SET status = 'concluida',
           concluida_em = v_agora
     WHERE id = v_chegada_id
       AND status IS DISTINCT FROM 'concluida';
  END IF;

  UPDATE public.rotas
     SET status = 'concluida',
         concluida_em = v_agora
   WHERE id = p_rota_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- reordenar_paradas: gestor ativo da loja, ou o motorista da rota, ativo,
-- com vínculo ativo nela (muda só a guarda de autorização)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reordenar_paradas(p_parada_ids uuid[], p_novas_ordens integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_rota_id UUID;
  v_i INTEGER;
BEGIN
  IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
  END IF;

  v_count := array_length(p_parada_ids, 1);
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
  IF v_rota_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = v_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND (
        uu.papel = 'gestor'
        OR (
          r.motorista_id = auth.uid()
          AND (SELECT public.usuario_atual_ativo())
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = 1000 + v_i
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = p_novas_ordens[v_i]
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- pode_registrar_log_na_rota: vínculo ativo na loja da rota, e gestor dela
-- ou pessoa ativa (o motorista da rota entra por esse mesmo vínculo)
-- ----------------------------------------------------------------------------
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
        OR (SELECT public.usuario_atual_ativo())
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- registrar_sos: rota que quem chama não pode mais usar vira SOS sem rota
-- (corpo em produção da Migration 46; muda só a recusa da rota)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_sos(p_detalhes jsonb, p_rota_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rota_id uuid := p_rota_id;
  v_detalhes jsonb := COALESCE(p_detalhes, '{}'::jsonb) - 'gestores_avisados';
  v_permitida boolean;
  v_log_id uuid;
  v_avisados integer;
BEGIN
  -- As mesmas regras da policy logs_insert_optimized (o DEFINER passa por cima dela).
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória para registrar o SOS.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- O SOS nunca é recusado pela rota: sem permissão nela, vai sem rota, e os
  -- gestores das lojas com vínculo ativo são avisados. Se a própria checagem
  -- falhar, também vai sem rota: a emergência não depende dela.
  IF v_rota_id IS NOT NULL THEN
    BEGIN
      v_permitida := public.pode_registrar_log_na_rota(v_rota_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'registrar_sos: checagem da rota % falhou, SOS segue sem rota: %',
        v_rota_id, SQLERRM;
      v_permitida := false;
    END;

    IF v_permitida IS NOT TRUE THEN
      v_rota_id := NULL;
      v_detalhes := (v_detalhes - 'rota_id' - 'rota_status')
        || jsonb_build_object('rota_recusada', true);
    END IF;
  END IF;

  INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
  VALUES (v_uid, v_rota_id, 'sos_acionado', v_detalhes)
  RETURNING id INTO v_log_id;

  -- Descartado pelo prevent_duplicate_log (o mesmo SOS em 5 s): o anterior
  -- é o que avisou, e é por ele que se responde.
  IF v_log_id IS NULL THEN
    SELECT l.id INTO v_log_id
    FROM public.logs l
    WHERE l.usuario_id = v_uid AND l.evento = 'sos_acionado' AND l.rota_id IS NOT DISTINCT FROM v_rota_id
    ORDER BY l.timestamp DESC
    LIMIT 1;
  END IF;

  SELECT (l.detalhes->>'gestores_avisados')::integer INTO v_avisados
  FROM public.logs l
  WHERE l.id = v_log_id;

  RETURN COALESCE(v_avisados, 0);
END;
$$;

-- ----------------------------------------------------------------------------
-- logs (INSERT direto de SOS): rota que quem grava não pode mais usar vira
-- SOS sem rota. Ordena antes de prevent_duplicate_log_trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sos_sem_rota_quando_recusada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_permitida boolean;
BEGIN
  -- Sem usuário na sessão (service_role, cron), a linha passa como veio.
  -- Com usuário: se a checagem falhar, o SOS segue sem rota, nunca falha.
  BEGIN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    v_permitida := public.pode_registrar_log_na_rota(NEW.rota_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sos_sem_rota_quando_recusada: checagem da rota % falhou, SOS segue sem rota: %',
      NEW.rota_id, SQLERRM;
    v_permitida := false;
  END;

  IF v_permitida IS NOT TRUE THEN
    NEW.rota_id := NULL;
    NEW.detalhes := (COALESCE(NEW.detalhes, '{}'::jsonb) - 'rota_id' - 'rota_status')
      || jsonb_build_object('rota_recusada', true);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sos_sem_rota_quando_recusada() IS
  'BEFORE INSERT em logs (sos_acionado com rota): sem permissão na rota, grava o SOS sem rota, com detalhes.rota_recusada = true (Migration 49).';

REVOKE ALL ON FUNCTION public.sos_sem_rota_quando_recusada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS logs_sos_sem_rota_quando_recusada ON public.logs;
CREATE TRIGGER logs_sos_sem_rota_quando_recusada
  BEFORE INSERT ON public.logs
  FOR EACH ROW
  WHEN (NEW.evento::text = 'sos_acionado' AND NEW.rota_id IS NOT NULL)
  EXECUTE FUNCTION public.sos_sem_rota_quando_recusada();

-- CREATE OR REPLACE mantém os privilégios; reafirmados para ficar explícito.
REVOKE ALL ON FUNCTION public.finalizar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_rota(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reordenar_paradas(uuid[], integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_paradas(uuid[], integer[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pode_registrar_log_na_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_registrar_log_na_rota(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_sos(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_sos(jsonb, uuid) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. as quatro policies só para authenticated, com vínculo e pessoa ativos
--    → 4 linhas, roles {authenticated}, vinculo true, pessoa true
-- SELECT tablename, policyname, roles,
--        qual ~ 'uu\.ativo = true' AS vinculo,
--        qual ~ 'usuario_atual_ativo' AS pessoa
-- FROM pg_policies WHERE schemaname = 'public'
--   AND policyname IN ('rotas_select', 'rotas_update',
--                      'paradas_select', 'paradas_update');
-- 2. funções: helper nas três do motorista; EXECUTE sem anon
--    → 5 linhas; pessoa true nas três primeiras; anon false; authenticated true
-- SELECT p.proname, pg_get_functiondef(p.oid) ~ 'usuario_atual_ativo' AS pessoa,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
-- FROM pg_proc p WHERE p.oid IN (
--   'public.finalizar_rota(uuid)'::regprocedure,
--   'public.reordenar_paradas(uuid[], integer[])'::regprocedure,
--   'public.pode_registrar_log_na_rota(uuid)'::regprocedure,
--   'public.registrar_sos(jsonb, uuid)'::regprocedure,
--   'public.usuario_atual_ativo()'::regprocedure);
-- 3. gatilhos BEFORE INSERT de logs, na ordem em que disparam
--    → logs_sos_sem_rota_quando_recusada, depois prevent_duplicate_log_trigger
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'public.logs'::regclass AND NOT tgisinternal
--   AND (tgtype & 2) = 2 AND (tgtype & 4) = 4
-- ORDER BY tgname;
-- 4. rotas abertas cujo motorista ficaria sem acesso → 0 (em 24/10/2026)
-- SELECT count(*) FROM public.rotas r
-- JOIN public.usuarios u ON u.id = r.motorista_id
-- WHERE r.status IN ('pendente', 'em_andamento')
--   AND (u.ativo IS NOT TRUE OR NOT EXISTS (
--     SELECT 1 FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = r.motorista_id AND uu.unidade_id = r.unidade_id
--       AND uu.ativo = true));

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS logs_sos_sem_rota_quando_recusada ON public.logs;
-- DROP FUNCTION IF EXISTS public.sos_sem_rota_quando_recusada();
-- ALTER POLICY rotas_select ON public.rotas
--   TO public
--   USING (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1 FROM public.usuario_unidades uu
--       WHERE ((uu.usuario_id = (SELECT auth.uid())) AND ((uu.papel)::text = 'gestor'::text)
--         AND (uu.unidade_id = rotas.unidade_id) AND (uu.ativo = true))))
--   );
-- ALTER POLICY rotas_update ON public.rotas
--   TO public
--   USING (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1 FROM public.usuario_unidades uu
--       WHERE ((uu.usuario_id = (SELECT auth.uid())) AND ((uu.papel)::text = 'gestor'::text)
--         AND (uu.unidade_id = rotas.unidade_id) AND (uu.ativo = true))))
--   );
-- ALTER POLICY paradas_select ON public.paradas
--   TO public
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.rotas r
--       WHERE ((r.id = paradas.rota_id) AND ((r.motorista_id = (SELECT auth.uid()))
--         OR (EXISTS (
--           SELECT 1 FROM public.usuario_unidades uu
--           WHERE ((uu.usuario_id = (SELECT auth.uid())) AND ((uu.papel)::text = 'gestor'::text)
--             AND (uu.unidade_id = r.unidade_id) AND (uu.ativo = true)))))))
--   );
-- ALTER POLICY paradas_update ON public.paradas
--   TO public
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.rotas r
--       WHERE ((r.id = paradas.rota_id) AND ((r.motorista_id = (SELECT auth.uid()))
--         OR (EXISTS (
--           SELECT 1 FROM public.usuario_unidades uu
--           WHERE ((uu.usuario_id = (SELECT auth.uid())) AND ((uu.papel)::text = 'gestor'::text)
--             AND (uu.unidade_id = r.unidade_id) AND (uu.ativo = true)))))))
--   );
-- CREATE OR REPLACE FUNCTION public.finalizar_rota(p_rota_id uuid)
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $$
-- DECLARE
--   v_status text;
--   v_pendentes integer;
--   v_chegada_id uuid;
--   v_agora timestamptz := now();
-- BEGIN
--   IF auth.uid() IS NULL THEN
--     RAISE EXCEPTION 'NAO_AUTENTICADO: sessão expirada ao finalizar a rota.'
--       USING ERRCODE = '42501';
--   END IF;
--   -- O dono no WHERE: só a rota própria é travada, e "não existe" e "não é
--   -- sua" caem no mesmo NOT FOUND (não revela rota alheia).
--   SELECT r.status
--     INTO v_status
--     FROM public.rotas r
--    WHERE r.id = p_rota_id
--      AND r.motorista_id = auth.uid()
--      FOR NO KEY UPDATE;
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'ROTA_NAO_ENCONTRADA: rota não encontrada para este motorista.'
--       USING ERRCODE = '42501';
--   END IF;
--   -- Idempotente: o dono pedindo de novo uma rota já concluída é sucesso.
--   IF v_status = 'concluida' THEN RETURN; END IF;
--   IF v_status IS DISTINCT FROM 'em_andamento' THEN
--     RAISE EXCEPTION 'ROTA_NAO_EM_ANDAMENTO: a rota precisa estar em andamento para ser finalizada (status atual: %).',
--       v_status
--       USING ERRCODE = 'P0001';
--   END IF;
--   -- Trava as paradas antes de contar (ver 2b no cabeçalho).
--   PERFORM 1
--      FROM public.paradas p
--     WHERE p.rota_id = p_rota_id
--       FOR NO KEY UPDATE;
--   SELECT count(*)
--     INTO v_pendentes
--     FROM public.paradas p
--    WHERE p.rota_id = p_rota_id
--      AND p.is_checkpoint IS DISTINCT FROM false
--      AND p.status IN ('pendente', 'em_andamento');
--   IF v_pendentes > 0 THEN
--     RAISE EXCEPTION 'ROTA_PARADAS_PENDENTES: não é possível finalizar a rota com % parada(s) pendente(s).',
--       v_pendentes
--       USING ERRCODE = 'P0001';
--   END IF;
--   SELECT p.id
--     INTO v_chegada_id
--     FROM public.paradas p
--    WHERE p.rota_id = p_rota_id
--      AND p.is_checkpoint = false
--    ORDER BY p.ordem DESC
--    LIMIT 1;
--   IF v_chegada_id IS NOT NULL THEN
--     UPDATE public.paradas
--        SET status = 'concluida',
--            concluida_em = v_agora
--      WHERE id = v_chegada_id
--        AND status IS DISTINCT FROM 'concluida';
--   END IF;
--   UPDATE public.rotas
--      SET status = 'concluida',
--          concluida_em = v_agora
--    WHERE id = p_rota_id;
-- END;
-- $$;
-- CREATE OR REPLACE FUNCTION public.reordenar_paradas(p_parada_ids uuid[], p_novas_ordens integer[])
-- RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
-- AS $$
-- DECLARE
--   v_count INTEGER;
--   v_rota_id UUID;
--   v_i INTEGER;
-- BEGIN
--   IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
--   END IF;
--   v_count := array_length(p_parada_ids, 1);
--   IF v_count IS NULL OR v_count = 0 THEN
--     RETURN jsonb_build_object('success', true, 'updated', 0);
--   END IF;
--   SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
--   IF v_rota_id IS NULL THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
--   END IF;
--   IF NOT EXISTS (
--     SELECT 1
--     FROM public.rotas r
--     WHERE r.id = v_rota_id
--       AND (
--         r.motorista_id = auth.uid()
--         OR EXISTS (
--           SELECT 1 FROM public.usuario_unidades uu
--           WHERE uu.usuario_id = auth.uid()
--             AND uu.papel = 'gestor'
--             AND uu.unidade_id = r.unidade_id
--             AND uu.ativo = true
--         )
--       )
--   ) THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
--   END IF;
--   FOR v_i IN 1..v_count LOOP
--     UPDATE public.paradas SET ordem = 1000 + v_i
--     WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
--   END LOOP;
--   FOR v_i IN 1..v_count LOOP
--     UPDATE public.paradas SET ordem = p_novas_ordens[v_i]
--     WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
--   END LOOP;
--   RETURN jsonb_build_object('success', true, 'updated', v_count);
-- EXCEPTION
--   WHEN OTHERS THEN
--     RETURN jsonb_build_object('success', false, 'error', SQLERRM);
-- END;
-- $$;
-- CREATE OR REPLACE FUNCTION public.pode_registrar_log_na_rota(p_rota_id uuid)
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
-- AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.rotas r
--     WHERE r.id = p_rota_id
--       AND (r.motorista_id = auth.uid()
--         OR EXISTS (SELECT 1 FROM public.usuario_unidades uu
--           WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = r.unidade_id
--             AND uu.ativo = true))
--   );
-- $$;
-- CREATE OR REPLACE FUNCTION public.registrar_sos(p_detalhes jsonb, p_rota_id uuid DEFAULT NULL::uuid)
-- RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
-- AS $$
-- DECLARE
--   v_uid uuid := auth.uid();
--   v_log_id uuid;
--   v_avisados integer;
-- BEGIN
--   -- As mesmas regras da policy logs_insert_optimized (o DEFINER passa por cima dela).
--   IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória para registrar o SOS.'
--       USING ERRCODE = 'insufficient_privilege';
--   END IF;
--   IF p_rota_id IS NOT NULL AND NOT public.pode_registrar_log_na_rota(p_rota_id) THEN RAISE EXCEPTION 'Sem permissão para registrar SOS nesta rota.'
--       USING ERRCODE = 'insufficient_privilege';
--   END IF;
--   INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
--   VALUES (v_uid, p_rota_id, 'sos_acionado', COALESCE(p_detalhes, '{}'::jsonb) - 'gestores_avisados')
--   RETURNING id INTO v_log_id;
--   IF v_log_id IS NULL THEN
--     SELECT l.id INTO v_log_id
--     FROM public.logs l
--     WHERE l.usuario_id = v_uid AND l.evento = 'sos_acionado' AND l.rota_id IS NOT DISTINCT FROM p_rota_id
--     ORDER BY l.timestamp DESC
--     LIMIT 1;
--   END IF;
--   SELECT (l.detalhes->>'gestores_avisados')::integer INTO v_avisados
--   FROM public.logs l
--   WHERE l.id = v_log_id;
--   RETURN COALESCE(v_avisados, 0);
-- END;
-- $$;
-- DROP FUNCTION IF EXISTS public.usuario_atual_ativo();
-- COMMIT;
