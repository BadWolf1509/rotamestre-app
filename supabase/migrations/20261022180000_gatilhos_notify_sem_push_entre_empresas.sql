-- ============================================================================
-- Migration 33: gatilhos notify_* sem push entre empresas
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose:
--   A Migration 32 travou a `criar_notificacao` na chamada direta, mas os
--   gatilhos `notify_*` passam por fora da trava (`pg_trigger_depth() > 0`), e
--   dois deles derivam o destinatário de dado que o usuário controla:
--
--   1. `logs` → `notify_sos_acionado`. A policy `logs_insert_optimized` só
--      exigia `usuario_id = auth.uid()`. Qualquer logado inseria
--      `evento='sos_acionado'` com o `rota_id` de outra loja e `detalhes.motivo`
--      livre; o gatilho achava a loja pela rota e mandava "SOS - EMERGÊNCIA",
--      com o texto do atacante, ao gestor dela.
--   2. `rotas` → `notify_motorista_nova_rota(_insert)`. `rotas_insert` e
--      `rotas_update` não olhavam o `motorista_id`: um gestor da loja A
--      atribuía um motorista da loja B e o gatilho notificava (e dava push)
--      nele. (`unidade_id` já não muda pelo cliente: `authenticated` não tem
--      UPDATE nessa coluna — medido na sonda.)
--
--   Correção:
--   - guarda BEFORE INSERT/UPDATE em `rotas`: `motorista_id` (quando não nulo)
--     precisa de vínculo `motorista` ATIVO na `unidade_id` da rota — o mesmo
--     critério da RPC `criar_rota_com_paradas` e do modal de troca de motorista.
--     No UPDATE só confere quando `motorista_id` ou `unidade_id` mudam: rota
--     antiga cujo motorista perdeu o vínculo continua concluindo/expirando.
--     Vale também sem `auth.uid()` (service role): é integridade de dado, não
--     permissão;
--   - `logs_insert_optimized`: linha com `rota_id` só se o autor for o
--     motorista da rota ou tiver vínculo ativo (qualquer papel) na loja dela.
--     Os gatilhos que gravam em `logs` (`log_parada_status`, `log_rota_status`)
--     e a RPC `criar_rota_com_paradas` são SECURITY DEFINER de `postgres`, que
--     ignora RLS — não passam pela policy.
--
-- Medido em produção (22/10/2026), antes de aplicar: 0 logs com rota seriam
-- recusados pela regra nova; 3 rotas antigas (fechadas) têm motorista com
-- vínculo inativo — a guarda não as afeta, porque o UPDATE de status não muda
-- `motorista_id` nem `unidade_id`.
--
-- APLICAR PELO SQL EDITOR (tem ALTER POLICY e REVOKE). Depois, inserir a linha
-- em `supabase_migrations.schema_migrations` com a versão `20261022180000`.
-- ============================================================================

BEGIN;

-- 1. rotas: o motorista precisa atender a loja da rota.
CREATE OR REPLACE FUNCTION public.validar_motorista_e_loja_da_rota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rota antiga cujo motorista perdeu o vínculo segue mudando de status.
  IF TG_OP = 'UPDATE'
     AND NEW.motorista_id IS NOT DISTINCT FROM OLD.motorista_id
     AND NEW.unidade_id IS NOT DISTINCT FROM OLD.unidade_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id
      AND uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'motorista'
      AND uu.ativo = true
  ) THEN
    RAISE EXCEPTION 'Motorista sem vínculo ativo com a loja da rota.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.validar_motorista_e_loja_da_rota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validar_motorista_e_loja_da_rota ON public.rotas;
CREATE TRIGGER trg_validar_motorista_e_loja_da_rota
  BEFORE INSERT OR UPDATE OF motorista_id, unidade_id ON public.rotas
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_motorista_e_loja_da_rota();

-- 2. logs: rota só a de quem dirige ou atende a loja dela.
-- SECURITY DEFINER para não depender da RLS de `rotas` (o motorista de uma loja
-- não vê a rota do colega, e a regra aceita vínculo de qualquer papel).
CREATE OR REPLACE FUNCTION public.pode_registrar_log_na_rota(p_rota_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.rotas r
    WHERE r.id = p_rota_id
      AND (
        r.motorista_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuario_unidades uu
          WHERE uu.usuario_id = auth.uid()
            AND uu.unidade_id = r.unidade_id
            AND uu.ativo = true
        )
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.pode_registrar_log_na_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_registrar_log_na_rota(uuid) TO authenticated;

ALTER POLICY logs_insert_optimized ON public.logs
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND (rota_id IS NULL OR public.pode_registrar_log_na_rota(rota_id))
  );

COMMENT ON FUNCTION public.validar_motorista_e_loja_da_rota() IS
  'Migration 33: motorista_id da rota exige vínculo motorista ativo na unidade_id. Fecha o push entre empresas pelo notify_motorista_nova_rota.';
COMMENT ON FUNCTION public.pode_registrar_log_na_rota(uuid) IS
  'Migration 33: usada pela logs_insert_optimized. Autor é o motorista da rota ou tem vínculo ativo na loja dela. Fecha o SOS forjado pelo notify_sos_acionado.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER POLICY logs_insert_optimized ON public.logs
--   WITH CHECK (usuario_id = (SELECT auth.uid()));
-- DROP FUNCTION IF EXISTS public.pode_registrar_log_na_rota(uuid);
-- DROP TRIGGER IF EXISTS trg_validar_motorista_e_loja_da_rota ON public.rotas;
-- DROP FUNCTION IF EXISTS public.validar_motorista_e_loja_da_rota();
-- COMMIT;
