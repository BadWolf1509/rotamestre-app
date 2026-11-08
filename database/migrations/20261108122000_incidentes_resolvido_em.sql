-- ============================================================================
-- Migration 87: `resolvido_em` do incidente mantido pelo banco
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   Pendência 30(i). `incidentes.resolvido_em` marca QUANDO o incidente foi
--   resolvido. Hoje só o app o mantém (`useIncidentesModals`): grava a hora ao
--   entrar em `resolvido` e manda `null` ao sair dele; salvar só a observação
--   de um incidente já resolvido não troca a data. Quem muda o status por
--   outro caminho (painel, chave secreta, SQL, versão antiga do app) deixa a
--   coluna incoerente com o status.
--
--   Gatilho BEFORE INSERT OR UPDATE OF status, com a regra do app:
--     - entra em `resolvido` (INSERT já resolvido, ou UPDATE de outro status
--       para `resolvido`) com `resolvido_em` nulo → `now()`. O valor que o
--       app mandou fica: o gatilho só preenche o que veio nulo;
--     - sai de `resolvido` (UPDATE de `resolvido` para outro status) →
--       `resolvido_em` nulo, como o app já manda;
--     - `resolvido` → `resolvido` (só a observação, ou o mesmo status
--       reenviado) não mexe na data, nem quando ela é nula (registro antigo:
--       a hora real da resolução não é conhecida, e `now()` mentiria).
--
--   Status que contam como resolvido: só `resolvido`. O CHECK aceita
--   `aberto`, `em_analise`, `resolvido` e `fechado`; o app grava
--   `resolvido_em` só para `resolvido` e manda `null` em `resolvido` →
--   `fechado`. As estatísticas da tela somam `fechado` como "resolvido", mas
--   isso é leitura, não a data.
--
--   Alternativas consideradas:
--     Quais status: (a) só `resolvido` (escolhida): é a regra que o app grava
--          hoje; (b) `resolvido` e `fechado`: em `resolvido` → `fechado` o app
--          manda `null` e o gatilho teria de escolher entre apagar a data do
--          app ou preenchê-la de novo com `now()`, trocando a data da
--          resolução — mudaria o significado da coluna sem decisão do gestor.
--     Onde: (a) gatilho BEFORE (escolhida): vale para todo caminho de escrita,
--          sem mudar o app; (b) só no app (como hoje): o painel e a chave
--          secreta continuam fora; (c) coluna gerada: não guarda hora, e a
--          data tem de sobreviver a edições posteriores.
--     Sobrescrever: (a) preencher só se nulo (escolhida): o app atual e o
--          publicado mandam a hora do aparelho e ela fica; (b) sempre
--          `now()`: trocaria a hora que o app mandou pela do servidor sem
--          ganho.
--
--   A função do gatilho é SECURITY INVOKER (só lê OLD/NEW, não lê tabela),
--   com EXECUTE revogado de PUBLIC, anon e authenticated (o disparo não
--   confere EXECUTE), como nas Migrations 73 e 75. Não muda o RLS nem as
--   permissões por coluna de `incidentes`: quem não pode mudar o status
--   continua sem poder.
--
--   Medido em 08/11/2026 (só SELECT de catálogo): gatilhos BEFORE de
--   `incidentes`: `incidentes_confere_rota_parada`,
--   `incidentes_define_unidade`, `trg_incidentes_foto_vinculada_preservada`,
--   `trg_incidentes_mantem_o_motorista`,
--   `trg_incidentes_troca_de_rota_pelo_gestor`, `update_incidentes_updated_at`;
--   nenhum mexe em `status` ou `resolvido_em`. CHECK de status como acima;
--   `resolvido_em timestamptz NULL`, sem default.
--
--   `SET LOCAL lock_timeout = '3s'`: o DROP/CREATE TRIGGER pede trava forte
--   em `incidentes`; sem ela em 3 s, a migration para sem efeito e é
--   repetida.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.incidentes_resolvido_em()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'resolvido' THEN
    -- Entrou em resolvido: preenche só o que veio nulo.
    IF NEW.resolvido_em IS NULL
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'resolvido') THEN
      NEW.resolvido_em := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'resolvido' THEN
    -- Saiu de resolvido (reaberto, em análise ou fechado).
    NEW.resolvido_em := NULL;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.incidentes_resolvido_em() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.incidentes_resolvido_em() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.incidentes_resolvido_em() IS
  'Migration 87: gatilho BEFORE INSERT OR UPDATE OF status de incidentes. Ao entrar em resolvido, resolvido_em = now() se veio nulo (o valor mandado fica); ao sair de resolvido, resolvido_em = null; resolvido -> resolvido não mexe na data. Só o status resolvido conta.';

DROP TRIGGER IF EXISTS trg_incidentes_resolvido_em ON public.incidentes;
CREATE TRIGGER trg_incidentes_resolvido_em
  BEFORE INSERT OR UPDATE OF status ON public.incidentes
  FOR EACH ROW
  EXECUTE FUNCTION public.incidentes_resolvido_em();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.incidentes'::regclass AND t.tgname = 'trg_incidentes_resolvido_em';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.incidentes_resolvido_em()');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_incidentes_resolvido_em ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.incidentes_resolvido_em();
-- COMMIT;
