-- ============================================================================
-- Migration 38: token de push pertence a UMA conta
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
-- registra só por ela. Aditiva: versões antigas, que fazem UPDATE direto,
-- continuam funcionando como antes.
--
-- A trava `trava_motorista_outra_loja` (Migration 31) recusaria a limpeza
-- quando A é motorista que atende outra loja ("só nome e telefone"); ela passa
-- a aceitar uma mudança que SÓ zera o push_token — não muda loja nem dado
-- pessoal, e não dá a ninguém o poder de apontar o token de outro para si.
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

  IF p_token IS NULL OR p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' THEN
    RAISE EXCEPTION 'Token de push fora do formato Expo.'
      USING ERRCODE = '22023';
  END IF;

  -- O aparelho é de uma conta por vez: quem tinha este token o perde.
  UPDATE public.usuarios
     SET push_token = NULL
   WHERE push_token = p_token
     AND id <> v_uid;

  UPDATE public.usuarios
     SET push_token = p_token
   WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.registrar_push_token(text) IS
  'Grava o token de push na conta logada e o tira de qualquer outra conta (um aparelho, uma conta). Migration 38.';

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

  -- Só zerar o push_token: é `registrar_push_token` tirando de A o token do
  -- aparelho em que B acabou de entrar (Migration 38). Não muda loja nem dado
  -- pessoal; pôr um token NÃO passa por aqui.
  IF NEW.push_token IS NULL
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

-- SONDA (SQL Editor, DEPOIS de aplicar; tudo é desfeito pelo RAISE final).
-- A = motorista com vínculo numa loja onde B NÃO é gestor (exercita a trava);
-- B = outro usuário qualquer, não admin. B registra o token que está em A.
--
-- DO $$
-- DECLARE
--   v_a uuid; v_b uuid; v_token_a text; v_token_b text;
--   v_tok constant text := 'ExponentPushToken[sonda-migration-38]';
-- BEGIN
--   SELECT u.id INTO v_a FROM public.usuarios u
--    WHERE u.papel = 'motorista' AND u.ativo LIMIT 1;
--   SELECT b.id INTO v_b FROM public.usuarios b
--    WHERE b.id <> v_a AND b.admin_role IS NULL
--      AND NOT EXISTS (
--        SELECT 1 FROM public.usuario_unidades ua
--        JOIN public.usuario_unidades gb
--          ON gb.unidade_id = ua.unidade_id AND gb.usuario_id = b.id
--         AND gb.papel = 'gestor'
--        WHERE ua.usuario_id = v_a)
--    LIMIT 1;
--   UPDATE public.usuarios SET push_token = v_tok WHERE id = v_a;
--
--   PERFORM set_config('request.jwt.claims',
--     json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
--   PERFORM public.registrar_push_token(v_tok);
--
--   SELECT push_token INTO v_token_a FROM public.usuarios WHERE id = v_a;
--   SELECT push_token INTO v_token_b FROM public.usuarios WHERE id = v_b;
--   IF v_token_a IS NOT NULL OR v_token_b IS DISTINCT FROM v_tok THEN
--     RAISE EXCEPTION 'SONDA FALHOU: A=% B=%', v_token_a, v_token_b;
--   END IF;
--
--   -- Formato inválido é recusado.
--   BEGIN
--     PERFORM public.registrar_push_token('qualquer-coisa');
--     RAISE EXCEPTION 'SONDA FALHOU: aceitou token inválido';
--   EXCEPTION WHEN invalid_parameter_value THEN NULL;
--   END;
--
--   RAISE EXCEPTION 'SONDA OK: A=% perdeu o token, B=% ficou com ele', v_a, v_b;
-- END $$;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.registrar_push_token(text);
-- -- trava_motorista_outra_loja: recriar com o corpo da Migration 31
-- -- (database/migrations/20261020220000_vinculo_motorista_seguro.sql),
-- -- que é este sem o bloco "Só zerar o push_token".
-- COMMIT;
