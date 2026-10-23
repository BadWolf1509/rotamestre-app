-- ============================================================================
-- Migration 39: token de push pertence a UMA conta
-- Date: 2026-10-23
-- Author: Wellinton Ribeiro
-- Purpose: o app gravava o token direto em `usuarios.push_token` da conta
-- logada. Se o logout de A não conseguiu limpar a linha dela (offline, sessão
-- vencida) e B entrou no mesmo aparelho, as DUAS linhas ficavam com o mesmo
-- token — e os pushes de A chegavam ao celular de B. Do lado do app não há
-- conserto: a RLS não deixa B tocar na linha de A.
--
-- `registrar_push_token(p_token)` grava o token na conta de quem chama e o
-- tira de qualquer OUTRA conta, numa transação. O app (a partir desta versão)
-- registra por ela; se a função ainda não existir (PGRST202), cai no UPDATE
-- direto antigo. Aditiva: versões antigas continuam funcionando como antes.
--
-- A trava `trava_motorista_outra_loja` (Migration 31) recusaria a limpeza
-- quando A é motorista que atende outra loja ("só nome e telefone"). Ela passa
-- a aceitar, SÓ no caminho desta RPC (marca `rotamestre.push_rpc` da
-- transação), uma mudança que apenas zera o push_token. A exceção não serve
-- para pôr token em linha alheia, nem para UPDATE direto de gestor.
-- Não há UNIQUE em push_token de propósito: o UPDATE direto das versões
-- antigas passaria a falhar no registro de quem entra depois.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária para registrar o push.'
      USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL
     OR length(p_token) > 200
     OR p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' THEN
    RAISE EXCEPTION 'Token de push fora do formato Expo.'
      USING ERRCODE = '22023';
  END IF;

  -- Duas contas registrando o mesmo token ao mesmo tempo: uma de cada vez.
  PERFORM pg_advisory_xact_lock(hashtext(p_token));

  -- Primeiro a própria linha: conta sem perfil em usuarios não pode tirar o
  -- token de ninguém.
  UPDATE public.usuarios
     SET push_token = p_token
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado para registrar o push.'
      USING ERRCODE = '42501';
  END IF;

  -- O aparelho é de uma conta por vez: quem mais tinha este token o perde.
  -- A marca deixa a trava de motorista aceitar este UPDATE (e só ele).
  PERFORM set_config('rotamestre.push_rpc', '1', true);

  UPDATE public.usuarios
     SET push_token = NULL
   WHERE push_token = p_token
     AND id <> v_uid;

  PERFORM set_config('rotamestre.push_rpc', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.registrar_push_token(text) IS
  'Grava o token de push na conta logada e o tira de qualquer outra conta (um aparelho, uma conta). Migration 39.';

CREATE OR REPLACE FUNCTION public.trava_motorista_outra_loja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Service role (Edge Function, painel admin) chega sem auth.uid(); o próprio
  -- motorista edita o próprio perfil (foto, push_token, ultimo_login).
  IF auth.uid() IS NULL OR auth.uid() = OLD.id OR OLD.papel <> 'motorista' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios a
    WHERE a.id = auth.uid() AND a.admin_role IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- `registrar_push_token` tirando de A o token do aparelho em que B acabou
  -- de entrar (Migration 39). Só com a marca da RPC e só zerando o
  -- push_token: não muda loja nem dado pessoal, e não põe token em ninguém.
  IF current_setting('rotamestre.push_rpc', true) = '1'
     AND NEW.push_token IS NULL
     AND (to_jsonb(NEW) - 'push_token' - 'updated_at')
         IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'push_token' - 'updated_at') THEN
    RETURN NEW;
  END IF;

  IF NOT public.motorista_atende_outra_loja(OLD.id) THEN
    RETURN NEW;
  END IF;

  -- unidade_id NULL -> valor é o sync_usuario_unidade_ativa preenchendo o
  -- cache ao reativar um vínculo (roda com o auth.uid() do gestor); só
  -- preencher o vazio não tira o motorista de loja nenhuma.
  IF (to_jsonb(NEW) - 'nome' - 'telefone' - 'updated_at'
        - CASE WHEN OLD.unidade_id IS NULL THEN 'unidade_id' ELSE '' END)
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'nome' - 'telefone' - 'updated_at'
        - CASE WHEN OLD.unidade_id IS NULL THEN 'unidade_id' ELSE '' END) THEN
    RAISE EXCEPTION
      'Este motorista também atende outra loja: aqui só dá para mudar nome e telefone.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;

-- SONDA (SQL Editor, DEPOIS de aplicar). Termina SEMPRE em RAISE, que desfaz
-- tudo. A = motorista ativo em duas lojas ou mais; B = gestor ativo de uma
-- delas que não é gestor de todas (do ponto de vista de B, A "atende outra
-- loja" — confirmado antes dos negativos). Sem esse par: SKIP explícito.
--
-- DO $$
-- DECLARE
--   v_a uuid; v_b uuid; v_token_a text; v_token_b text;
--   v_tok constant text := 'ExponentPushToken[sonda-migration-39]';
--   v_claims_b text;
-- BEGIN
--   -- A: motorista ativo em duas lojas ou mais (vínculos ativos).
--   -- B: gestor ativo de UMA das lojas de A e não gestor de todas — o cenário
--   -- real da trava ("motorista compartilhado, gestor de uma das lojas").
--   SELECT u.id, g.usuario_id INTO v_a, v_b
--     FROM public.usuarios u
--     JOIN public.usuario_unidades ua
--       ON ua.usuario_id = u.id AND ua.ativo
--     JOIN public.usuario_unidades g
--       ON g.unidade_id = ua.unidade_id AND g.papel = 'gestor' AND g.ativo
--      AND g.usuario_id <> u.id
--     JOIN public.usuarios gb
--       ON gb.id = g.usuario_id AND gb.admin_role IS NULL
--    WHERE u.papel = 'motorista' AND u.ativo
--      AND (SELECT count(*) >= 2 FROM public.usuario_unidades x
--            WHERE x.usuario_id = u.id AND x.ativo)
--      -- ...e A tem loja onde B NÃO é gestor ativo.
--      AND EXISTS (
--        SELECT 1 FROM public.usuario_unidades y
--         WHERE y.usuario_id = u.id
--           AND NOT EXISTS (
--             SELECT 1 FROM public.usuario_unidades gg
--              WHERE gg.usuario_id = g.usuario_id
--                AND gg.unidade_id = y.unidade_id
--                AND gg.papel = 'gestor' AND gg.ativo))
--    LIMIT 1;
--   IF v_a IS NULL OR v_b IS NULL THEN
--     RAISE EXCEPTION 'SONDA M39 (desfeita): SKIP sem motorista em duas lojas';
--   END IF;
--   v_claims_b := json_build_object('sub', v_b, 'role', 'authenticated')::text;
--
--   -- Confere do ponto de vista de B (auth.uid() = B) que A "atende outra
--   -- loja"; senão a trava retornaria cedo e os negativos dariam falso defeito.
--   PERFORM set_config('request.jwt.claims', v_claims_b, true);
--   IF NOT public.motorista_atende_outra_loja(v_a) THEN
--     RAISE EXCEPTION 'SONDA M39 (desfeita): SKIP sem motorista em duas lojas';
--   END IF;
--
--   -- Prepara: põe o token em A sem auth.uid() (a trava não age sem uid).
--   PERFORM set_config('request.jwt.claims', '', true);
--   UPDATE public.usuarios SET push_token = v_tok WHERE id = v_a;
--
--   -- Positivo: B registra pela RPC, como authenticated, o token que está em A.
--   PERFORM set_config('request.jwt.claims', v_claims_b, true);
--   SET LOCAL ROLE authenticated;
--   PERFORM public.registrar_push_token(v_tok);
--   RESET ROLE;
--   SELECT push_token INTO v_token_a FROM public.usuarios WHERE id = v_a;
--   SELECT push_token INTO v_token_b FROM public.usuarios WHERE id = v_b;
--   IF v_token_a IS NOT NULL OR v_token_b IS DISTINCT FROM v_tok THEN
--     RAISE EXCEPTION 'SONDA M39 FALHOU (positivo): A=% B=%', v_token_a, v_token_b;
--   END IF;
--
--   -- Os casos (0), (1) e (2) rodam como postgres com as claims de B: exercitam
--   -- a trava DEFINER, não a RLS de authenticated (que talvez nem deixasse B ver
--   -- a linha de A). Cada um espera P0001 da trava.
--
--   -- Devolve um token a A, de novo sem auth.uid().
--   PERFORM set_config('request.jwt.claims', '', true);
--   UPDATE public.usuarios SET push_token = v_tok WHERE id = v_a;
--   PERFORM set_config('request.jwt.claims', v_claims_b, true);
--
--   -- (0) UPDATE direto SEM a marca da RPC que só zera o push_token de A: a
--   -- exceção da trava vale só pela RPC, então é recusado.
--   BEGIN
--     PERFORM set_config('rotamestre.push_rpc', '', true);
--     UPDATE public.usuarios SET push_token = NULL WHERE id = v_a;
--     RAISE EXCEPTION 'SONDA M39 FALHOU (0): UPDATE direto zerou o token sem a RPC';
--   EXCEPTION WHEN raise_exception THEN
--     IF SQLERRM LIKE 'SONDA M39 FALHOU%' THEN RAISE; END IF;
--   END;
--
--   -- (1) B grava token em A, mesmo com a marca: a trava recusa.
--   BEGIN
--     PERFORM set_config('rotamestre.push_rpc', '1', true);
--     UPDATE public.usuarios
--        SET push_token = 'ExponentPushToken[sonda-outro]' WHERE id = v_a;
--     RAISE EXCEPTION 'SONDA M39 FALHOU (1): gravou token em A';
--   EXCEPTION WHEN raise_exception THEN
--     IF SQLERRM LIKE 'SONDA M39 FALHOU%' THEN RAISE; END IF;
--   END;
--
--   -- (2) Zerar push_token junto com o nome, com a marca: a trava recusa.
--   BEGIN
--     PERFORM set_config('rotamestre.push_rpc', '1', true);
--     UPDATE public.usuarios
--        SET push_token = NULL, nome = nome || ' (sonda)' WHERE id = v_a;
--     RAISE EXCEPTION 'SONDA M39 FALHOU (2): mudou nome junto';
--   EXCEPTION WHEN raise_exception THEN
--     IF SQLERRM LIKE 'SONDA M39 FALHOU%' THEN RAISE; END IF;
--   END;
--   PERFORM set_config('rotamestre.push_rpc', '', true);
--
--   -- (3) RPC sem auth.uid(): 42501.
--   BEGIN
--     PERFORM set_config('request.jwt.claims', '', true);
--     PERFORM public.registrar_push_token(v_tok);
--     RAISE EXCEPTION 'SONDA M39 FALHOU (3): aceitou sem auth.uid()';
--   EXCEPTION WHEN insufficient_privilege THEN NULL;
--   END;
--
--   -- (4) anon não executa a função.
--   BEGIN
--     SET LOCAL ROLE anon;
--     PERFORM public.registrar_push_token(v_tok);
--     RAISE EXCEPTION 'SONDA M39 FALHOU (4): anon executou';
--   EXCEPTION WHEN insufficient_privilege THEN NULL;
--   END;
--   RESET ROLE;
--
--   -- Formato inválido é recusado.
--   BEGIN
--     PERFORM set_config('request.jwt.claims', v_claims_b, true);
--     PERFORM public.registrar_push_token('qualquer-coisa');
--     RAISE EXCEPTION 'SONDA M39 FALHOU: aceitou token inválido';
--   EXCEPTION WHEN invalid_parameter_value THEN NULL;
--   END;
--
--   RAISE EXCEPTION 'SONDA M39 (desfeita): OK — A=% perdeu o token para B=%; negativos 0-4 recusados', v_a, v_b;
-- END $$;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.registrar_push_token(text);
-- -- trava_motorista_outra_loja: recriar com o corpo da Migration 31
-- -- (database/migrations/20261020220000_vinculo_motorista_seguro.sql),
-- -- que é este sem o bloco "registrar_push_token tirando de A".
-- COMMIT;
