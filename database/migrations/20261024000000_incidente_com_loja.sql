-- ============================================================================
-- Migration 43: o incidente grava a própria loja (`incidentes.unidade_id`)
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   A Migration 42 passou a decidir a visibilidade do incidente pela loja DA
--   ROTA. Incidente sem rota (reportado fora de rota pelo app, ou cuja rota foi
--   apagada — `incidentes_rota_id_fkey` é ON DELETE SET NULL) não tinha loja
--   para olhar e ficava na regra do vínculo do motorista: com motorista de duas
--   lojas (Migration 31), valia para as duas. Esta migration grava a loja no
--   próprio incidente, e a visibilidade passa a seguir a loja gravada nele.
--
--   1. Coluna `unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE` +
--      índice. CASCADE como `rotas.unidade_id`: loja apagada (só por
--      service_role) leva as rotas e os incidentes dela. Nullable: motorista
--      sem nenhum vínculo ativo não tem loja — o incidente fica só com ele.
--
--   2. Helper `unidade_do_incidente(motorista, rota)` — fonte única do
--      critério, usada pelo gatilho e pelo backfill:
--        a. com rota: a loja da rota (o gatilho da Migration 38 já garante,
--           no INSERT e quando a rota muda, que a rota é do motorista);
--        b. sem rota: os vínculos ATIVOS do motorista, em ordem determinística
--           — o único, se houver um só; com vários, o principal, depois a loja
--           de `usuarios.unidade_id` (a loja em que a conta nasceu, ou a
--           última que o próprio usuário escolheu no seletor), depois o
--           vínculo mais antigo; sem vínculo ativo, NULL.
--      Decisão para "várias lojas e sem rota": o SERVIDOR escolhe, o cliente
--      não manda. O app do motorista não tem loja ativa (o seletor de loja é
--      do gestor), as versões nativas já instaladas não mandariam o campo, e
--      um valor vindo do cliente teria de ser validado contra os vínculos de
--      qualquer jeito. Recusar o INSERT perderia o incidente; deixar NULL
--      visível a todas as lojas é exatamente o que esta migration fecha.
--      A ordem "principal primeiro" é a que o aviso ao gestor já usava
--      (Migration 34), agora sem o `LIMIT 1` sem ordem.
--
--   3. Gatilho BEFORE INSERT OR UPDATE `incidentes_define_unidade`:
--        - INSERT: a loja é sempre a do helper (o que o cliente mandar é
--          ignorado — ninguém escolhe a loja de um incidente);
--        - UPDATE com rota nova não nula: a loja da rota nova (o WITH CHECK
--          do UPDATE então exige que o gestor seja daquela loja: mover para a
--          rota de outra loja é recusado);
--        - UPDATE de loja ainda vazia (motorista sem vínculo no INSERT): tenta
--          de novo pelo helper;
--        - qualquer outro UPDATE, inclusive o ON DELETE SET NULL da rota: a
--          loja gravada fica. É o caso que a coluna existe para resolver.
--      Nome escolhido para rodar DEPOIS de `incidentes_confere_rota_parada`
--      (Migration 38): gatilhos BEFORE da mesma tabela disparam em ordem
--      alfabética, então a rota já foi conferida quando a loja é lida dela.
--      Sem lista de colunas no UPDATE de propósito: a coluna tem de ficar
--      travada em qualquer UPDATE, não só nos que tocam `rota_id`.
--
--   4. Backfill pelo mesmo helper, ANTES de criar o gatilho. Medido em
--      23/10/2026 (só SELECT): 26 incidentes, 23 com rota (todos de rota do
--      próprio motorista) e 3 sem rota, todos do mesmo motorista, de
--      27/12/2025, com dois vínculos ativos, nenhum principal, e
--      `usuarios.unidade_id` numa das duas — a mesma loja de todas as rotas
--      dele entre 24/12 e 28/12/2025. O critério dá essa loja aos três.
--      Efeito colateral conhecido: o gatilho `update_incidentes_updated_at`
--      põe `updated_at = now()` nas 26 linhas (o app não exibe `updated_at`
--      de incidente).
--
--   5. Policies (ALTER POLICY: nomes mantidos, sem janela sem policy), todas
--      `TO authenticated`:
--        - `incidentes_select` / `incidentes_update` (USING = WITH CHECK): o
--          próprio motorista, ou gestor ativo da loja gravada. Sai o ramo
--          "rota_id IS NULL → vínculo do motorista" da Migration 42;
--        - `incidentes_delete_optimized`: gestor ativo da loja gravada (antes,
--          a da rota — incidente sem rota não podia ser apagado por ninguém).
--          Era `public`; o motorista continua sem DELETE.
--      A policy "fotos-entrega select" (Migration 38, ramo `incidentes/`) não
--      muda: o EXISTS dela lê `incidentes` com o RLS de quem pede, então a foto
--      herda a regra nova. O gatilho `incidentes_confere_rota_parada` não
--      muda: confere rota e parada; este só grava a loja.
--
--   6. `notify_incidente_criado` (AFTER INSERT) avisa os gestores de
--      `NEW.unidade_id` — a mesma loja que vai enxergar o incidente. Antes,
--      sem rota, escolhia pelo vínculo principal ou por qualquer vínculo
--      (`LIMIT 1` sem ordem) e podia avisar um gestor que não o veria. O link
--      da rota só vai quando a rota é do próprio motorista (como na 34).
--
--   Alternativas consideradas:
--     - Gatilho que "congela" `rota_id` (recusa o SET NULL ou guarda a rota
--       antiga): não dá — a FK é ON DELETE SET NULL e a rota deixa de existir;
--       guardar o id de rota apagada não diz mais de que loja ela era, e
--       recusar o SET NULL bloquearia apagar a rota. Também não resolve o
--       incidente que já nasce sem rota.
--     - View com a loja derivada: a view não tem como derivar a loja de
--       incidente sem rota (é a informação que falta), e RLS em view exige
--       `security_invoker` + a mesma regra na tabela — a tabela continuaria
--       exposta pela API.
--     - Coluna + gatilho (esta): a loja é um fato do momento em que o
--       incidente nasce, sobrevive à rota, e a policy fica mais simples e
--       mais barata (um EXISTS por índice, sem JOIN em `rotas`).
--
--   App: a lista de incidentes e o contador do dashboard passam a filtrar por
--   `unidade_id` da loja ativa; o app NÃO manda `unidade_id` no INSERT.
--   APLICAR ANTES DO MERGE do PR: o filtro por `unidade_id` falha (coluna
--   inexistente) se o app publicado chegar antes da coluna.
--
-- Sonda transacional: database/sondas/20261024000000_sonda_migration43.sql
-- (rodar DEPOIS desta migration, no SQL Editor — tem um DELETE da rota que
-- ela mesma cria; termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. coluna + índice
-- ---------------------------------------------------------------------------
ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS unidade_id uuid
  REFERENCES public.unidades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_incidentes_unidade_id
  ON public.incidentes (unidade_id);

COMMENT ON COLUMN public.incidentes.unidade_id IS
  'Loja do incidente, gravada pelo gatilho incidentes_define_unidade (Migration 43): a da rota; sem rota, a do vínculo ativo do motorista (único, principal, usuarios.unidade_id, mais antigo). Não muda quando a rota vira NULL.';

-- ---------------------------------------------------------------------------
-- 2. helper: a loja de um incidente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unidade_do_incidente(p_motorista_id uuid, p_rota_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade_id uuid;
BEGIN
  IF p_rota_id IS NOT NULL THEN
    SELECT r.unidade_id INTO v_unidade_id
    FROM public.rotas r WHERE r.id = p_rota_id;
    IF v_unidade_id IS NOT NULL THEN
      RETURN v_unidade_id;
    END IF;
  END IF;

  SELECT uu.unidade_id INTO v_unidade_id
  FROM public.usuario_unidades uu
  LEFT JOIN public.usuarios u ON u.id = uu.usuario_id
  WHERE uu.usuario_id = p_motorista_id
    AND uu.ativo = true
  ORDER BY uu.is_principal DESC NULLS LAST, (uu.unidade_id = u.unidade_id) DESC NULLS LAST, uu.created_at, uu.unidade_id
  LIMIT 1;

  RETURN v_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unidade_do_incidente(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. função do gatilho (o gatilho só nasce depois do backfill)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.incidentes_define_unidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.unidade_id := public.unidade_do_incidente(NEW.motorista_id, NEW.rota_id);
    RETURN NEW;
  END IF;

  IF NEW.rota_id IS NOT NULL AND NEW.rota_id IS DISTINCT FROM OLD.rota_id THEN
    NEW.unidade_id := public.unidade_do_incidente(NEW.motorista_id, NEW.rota_id);
  ELSIF OLD.unidade_id IS NULL THEN
    NEW.unidade_id := public.unidade_do_incidente(NEW.motorista_id, NEW.rota_id);
  ELSE
    NEW.unidade_id := OLD.unidade_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.incidentes_define_unidade() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. backfill (antes do gatilho, pelo mesmo critério)
-- ---------------------------------------------------------------------------
UPDATE public.incidentes i
SET unidade_id = public.unidade_do_incidente(i.motorista_id, i.rota_id)
WHERE i.unidade_id IS NULL;

DROP TRIGGER IF EXISTS incidentes_define_unidade ON public.incidentes;
CREATE TRIGGER incidentes_define_unidade
  BEFORE INSERT OR UPDATE ON public.incidentes
  FOR EACH ROW EXECUTE FUNCTION public.incidentes_define_unidade();

-- ---------------------------------------------------------------------------
-- 5. policies pela loja gravada
-- ---------------------------------------------------------------------------
ALTER POLICY incidentes_select ON public.incidentes
  TO authenticated
  USING (
    incidentes.motorista_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel::text = 'gestor'
        AND uu.ativo = true
        AND uu.unidade_id = incidentes.unidade_id
    )
  );

ALTER POLICY incidentes_update ON public.incidentes
  TO authenticated
  USING (
    incidentes.motorista_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel::text = 'gestor'
        AND uu.ativo = true
        AND uu.unidade_id = incidentes.unidade_id
    )
  )
  WITH CHECK (
    incidentes.motorista_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel::text = 'gestor'
        AND uu.ativo = true
        AND uu.unidade_id = incidentes.unidade_id
    )
  );

ALTER POLICY incidentes_delete_optimized ON public.incidentes
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel::text = 'gestor'
        AND uu.ativo = true
        AND uu.unidade_id = incidentes.unidade_id
    )
  );

COMMENT ON POLICY incidentes_delete_optimized ON public.incidentes IS
  'Gestor ativo da loja gravada no incidente (incidentes.unidade_id, Migration 43).';

-- ---------------------------------------------------------------------------
-- 6. aviso ao gestor pela loja gravada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_incidente_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
  v_unidade_id UUID;
  v_rota_id UUID;
BEGIN
  SELECT u.nome INTO v_motorista_nome
  FROM public.usuarios u
  WHERE u.id = NEW.motorista_id;

  -- A loja que vai enxergar o incidente (gatilho incidentes_define_unidade).
  v_unidade_id := NEW.unidade_id;

  -- Link da rota só quando ela é do próprio motorista (Migration 34).
  IF NEW.rota_id IS NOT NULL THEN
    SELECT r.id INTO v_rota_id
    FROM public.rotas r
    WHERE r.id = NEW.rota_id
      AND r.motorista_id = NEW.motorista_id;
  END IF;

  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereco incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veiculo'
    ELSE 'Outros'
  END;

  FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
    PERFORM public.criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      v_rota_id,
      NULL,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. coluna, FK com CASCADE e índice → 1 linha cada
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'incidentes' AND column_name = 'unidade_id';
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'public.incidentes'::regclass AND contype = 'f'
--   AND pg_get_constraintdef(oid) LIKE '%unidade_id%';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_incidentes_unidade_id';
-- 2. nenhum incidente sem loja → 0 (3 dos 26 eram sem rota em 23/10/2026)
-- SELECT count(*) FILTER (WHERE unidade_id IS NULL) AS sem_loja,
--        count(*) FILTER (WHERE rota_id IS NULL) AS sem_rota,
--        count(*) AS total
-- FROM public.incidentes;
-- 3. com rota, a loja gravada é a da rota → 0
-- SELECT count(*) FROM public.incidentes i JOIN public.rotas r ON r.id = i.rota_id
-- WHERE i.unidade_id IS DISTINCT FROM r.unidade_id;
-- 4. os sem rota ficaram numa loja onde o motorista tem vínculo ativo → 0
-- SELECT count(*) FROM public.incidentes i
-- WHERE i.rota_id IS NULL AND NOT EXISTS (
--   SELECT 1 FROM public.usuario_unidades uu
--   WHERE uu.usuario_id = i.motorista_id AND uu.unidade_id = i.unidade_id AND uu.ativo);
-- 5. gatilhos BEFORE da tabela, em ordem → incidentes_confere_rota_parada,
--    incidentes_define_unidade, update_incidentes_updated_at
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'public.incidentes'::regclass AND NOT tgisinternal
--   AND (tgtype & 2) <> 0 ORDER BY tgname;
-- 6. as três policies: authenticated, pela loja gravada, sem o ramo antigo
--    → 3 linhas: roles {authenticated}, loja_gravada true, ramo_antigo false
-- SELECT policyname, roles,
--        qual ~ 'uu\.unidade_id = incidentes\.unidade_id' AS loja_gravada,
--        qual ~ 'motorista_uu|rota_id IS NULL' AS ramo_antigo
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'incidentes'
--   AND policyname IN ('incidentes_select', 'incidentes_update', 'incidentes_delete_optimized');
-- 7. o UPDATE tem WITH CHECK igual ao USING → true
-- SELECT with_check = qual FROM pg_policies
-- WHERE schemaname = 'public' AND policyname = 'incidentes_update';
-- 8. helpers sem EXECUTE para a API → false, false, false, false
-- SELECT has_function_privilege('authenticated', 'public.unidade_do_incidente(uuid, uuid)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.unidade_do_incidente(uuid, uuid)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.incidentes_define_unidade()', 'EXECUTE'),
--        has_function_privilege('anon', 'public.incidentes_define_unidade()', 'EXECUTE');
-- 9. o aviso usa a loja gravada → true
-- SELECT prosrc LIKE '%v_unidade_id := NEW.unidade_id;%'
-- FROM pg_proc WHERE oid = 'public.notify_incidente_criado'::regproc;

-- ROLLBACK:
-- Volta ao estado da Migration 42 (policies pela loja da rota + ramo do
-- vínculo para incidente sem rota; aviso pelo vínculo principal). Na ordem:
-- policies e aviso primeiro (deixam de ler a coluna), depois gatilho, helper
-- e coluna.
-- BEGIN;
-- ALTER POLICY incidentes_select ON public.incidentes
--   TO authenticated
--   USING (
--     incidentes.motorista_id = (SELECT auth.uid())
--     OR (
--       incidentes.rota_id IS NOT NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades uu
--         JOIN public.rotas r ON r.id = incidentes.rota_id
--         WHERE uu.usuario_id = (SELECT auth.uid())
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--           AND uu.unidade_id = r.unidade_id
--       )
--     )
--     OR (
--       incidentes.rota_id IS NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
--         WHERE my_uu.usuario_id = (SELECT auth.uid())
--           AND my_uu.papel::text = 'gestor'
--           AND my_uu.ativo = true
--           AND motorista_uu.usuario_id = incidentes.motorista_id
--           AND motorista_uu.ativo = true
--       )
--     )
--   );
-- ALTER POLICY incidentes_update ON public.incidentes
--   TO authenticated
--   USING (
--     incidentes.motorista_id = (SELECT auth.uid())
--     OR (
--       incidentes.rota_id IS NOT NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades uu
--         JOIN public.rotas r ON r.id = incidentes.rota_id
--         WHERE uu.usuario_id = (SELECT auth.uid())
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--           AND uu.unidade_id = r.unidade_id
--       )
--     )
--     OR (
--       incidentes.rota_id IS NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
--         WHERE my_uu.usuario_id = (SELECT auth.uid())
--           AND my_uu.papel::text = 'gestor'
--           AND my_uu.ativo = true
--           AND motorista_uu.usuario_id = incidentes.motorista_id
--           AND motorista_uu.ativo = true
--       )
--     )
--   )
--   WITH CHECK (
--     incidentes.motorista_id = (SELECT auth.uid())
--     OR (
--       incidentes.rota_id IS NOT NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades uu
--         JOIN public.rotas r ON r.id = incidentes.rota_id
--         WHERE uu.usuario_id = (SELECT auth.uid())
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--           AND uu.unidade_id = r.unidade_id
--       )
--     )
--     OR (
--       incidentes.rota_id IS NULL
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
--         WHERE my_uu.usuario_id = (SELECT auth.uid())
--           AND my_uu.papel::text = 'gestor'
--           AND my_uu.ativo = true
--           AND motorista_uu.usuario_id = incidentes.motorista_id
--           AND motorista_uu.ativo = true
--       )
--     )
--   );
-- -- (era TO public; authenticated é equivalente, anon não tem auth.uid())
-- ALTER POLICY incidentes_delete_optimized ON public.incidentes
--   TO public
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM public.usuario_unidades uu
--       JOIN public.rotas r ON r.id = incidentes.rota_id
--       WHERE uu.usuario_id = (SELECT auth.uid())
--         AND (uu.papel)::text = 'gestor'::text
--         AND uu.ativo = true
--         AND uu.unidade_id = r.unidade_id
--     )
--   );
-- COMMENT ON POLICY incidentes_delete_optimized ON public.incidentes IS
--   'Gestor ativo da unidade da rota. Migrado de usuarios.papel/unidade_id (legado, envenenável) para usuario_unidades em 06/09/2026.';
-- CREATE OR REPLACE FUNCTION public.notify_incidente_criado()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $fn$
-- DECLARE
--   v_gestor_id UUID;
--   v_motorista_nome VARCHAR(255);
--   v_categoria_label VARCHAR(100);
--   v_unidade_id UUID;
--   v_rota_id UUID;
-- BEGIN
--   SELECT u.nome INTO v_motorista_nome
--   FROM public.usuarios u
--   WHERE u.id = NEW.motorista_id;
--   IF NEW.rota_id IS NOT NULL THEN
--     SELECT r.unidade_id, r.id
--     INTO v_unidade_id, v_rota_id
--     FROM public.rotas r
--     WHERE r.id = NEW.rota_id
--       AND r.motorista_id = NEW.motorista_id;
--   END IF;
--   IF v_unidade_id IS NULL THEN
--     SELECT uu.unidade_id INTO v_unidade_id
--     FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true AND uu.is_principal = true
--     LIMIT 1;
--   END IF;
--   IF v_unidade_id IS NULL THEN
--     SELECT uu.unidade_id INTO v_unidade_id
--     FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
--     LIMIT 1;
--   END IF;
--   v_categoria_label := CASE NEW.categoria
--     WHEN 'accident' THEN 'Acidente/Incidente'
--     WHEN 'absent' THEN 'Cliente ausente'
--     WHEN 'wrong_address' THEN 'Endereco incorreto'
--     WHEN 'blocked' THEN 'Acesso bloqueado'
--     WHEN 'vehicle' THEN 'Problema no veiculo'
--     ELSE 'Outros'
--   END;
--   FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
--     PERFORM public.criar_notificacao(
--       v_gestor_id,
--       'incidente_reportado',
--       'Incidente Reportado',
--       'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
--       ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
--       v_rota_id,
--       NULL,
--       NEW.id
--     );
--   END LOOP;
--   RETURN NEW;
-- END;
-- $fn$;
-- DROP TRIGGER IF EXISTS incidentes_define_unidade ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.incidentes_define_unidade();
-- DROP FUNCTION IF EXISTS public.unidade_do_incidente(uuid, uuid);
-- DROP INDEX IF EXISTS public.idx_incidentes_unidade_id;
-- ALTER TABLE public.incidentes DROP COLUMN IF EXISTS unidade_id;
-- COMMIT;
