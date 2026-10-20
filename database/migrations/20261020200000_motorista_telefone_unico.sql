-- ============================================================================
-- Migration: telefone único entre motoristas ativos
-- Date: 2026-10-20
-- Author: Wellinton Ribeiro
-- Purpose: o mesmo motorista foi cadastrado por duas lojas com e-mails
--   diferentes e acabou com duas contas, cada uma vendo só as rotas de uma
--   loja. O telefone é a única chave que o gestor sempre informa, então vira
--   a identidade: dois motoristas ATIVOS não podem ter o mesmo número.
--   Normalização: só dígitos; com prefixo 55 e 12 ou 13 dígitos, tira o 55;
--   menos de 10 dígitos vira NULL (não participa da unicidade, não bloqueia
--   quem não tem telefone ou tem número incompleto).
--   - normalizar_telefone: IMMUTABLE, usada pelo índice e pela busca.
--   - motorista_ativo_por_telefone: usada só pela Edge Function (service_role)
--     para dizer ao gestor que o motorista já existe, sem expor quem é.
--   - usuarios_motorista_telefone_unico: índice único parcial; a corrida entre
--     duas criações simultâneas termina em 23505 na segunda.
--   Não cria tabela nem policy. Um DO $$ aborta se já houver duplicata ativa.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.normalizar_telefone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN length(d.digitos) IN (12, 13) AND d.digitos LIKE '55%'
      THEN substr(d.digitos, 3)
    WHEN length(d.digitos) >= 10 THEN d.digitos
    ELSE NULL
  END
  FROM (
    SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS digitos
  ) d;
$function$;

COMMENT ON FUNCTION public.normalizar_telefone(text) IS
  'Telefone só com dígitos; tira o 55 com 12/13 dígitos; < 10 dígitos = NULL.';

CREATE OR REPLACE FUNCTION public.motorista_ativo_por_telefone(p_telefone text)
RETURNS TABLE (id uuid, unidade_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT u.id, u.unidade_id
  FROM public.usuarios u
  WHERE public.normalizar_telefone(p_telefone) IS NOT NULL
    AND u.papel = 'motorista'
    AND u.ativo
    AND public.normalizar_telefone(u.telefone)
        = public.normalizar_telefone(p_telefone);
$function$;

REVOKE ALL ON FUNCTION public.motorista_ativo_por_telefone(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.motorista_ativo_por_telefone(text)
  TO service_role;

-- Aborta com mensagem clara se já houver duplicata ativa: o CREATE UNIQUE INDEX
-- falharia de qualquer jeito, mas sem dizer quais números.
DO $$
DECLARE
  v_duplicados text;
BEGIN
  SELECT string_agg(t.tel || ' (' || t.qtd || ' contas)', ', ')
    INTO v_duplicados
  FROM (
    SELECT public.normalizar_telefone(telefone) AS tel, count(*) AS qtd
    FROM public.usuarios
    WHERE papel = 'motorista'
      AND ativo
      AND public.normalizar_telefone(telefone) IS NOT NULL
    GROUP BY public.normalizar_telefone(telefone)
    HAVING count(*) > 1
  ) t;

  IF v_duplicados IS NOT NULL THEN
    RAISE EXCEPTION
      'Motoristas ativos com telefone duplicado: %. Desative ou corrija antes de aplicar.',
      v_duplicados;
  END IF;
END
$$;

CREATE UNIQUE INDEX usuarios_motorista_telefone_unico
  ON public.usuarios (public.normalizar_telefone(telefone))
  WHERE papel = 'motorista'
    AND ativo
    AND public.normalizar_telefone(telefone) IS NOT NULL;

COMMIT;
