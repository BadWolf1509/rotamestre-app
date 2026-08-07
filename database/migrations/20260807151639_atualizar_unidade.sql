-- ============================================================================
-- Migration: RPC de atualização de dados da unidade
-- Date: 2026-08-07
-- Purpose: `unidades` tem RLS ligada e só a policy `unidades_select`. O
--          `.update()` da tela "Minha unidade" não dá erro — dá 0 linhas
--          afetadas — e o código só olha `error`, então exibe "Dados
--          atualizados com sucesso!" e recarrega os valores antigos.
--
--          NÃO criamos policy de UPDATE de propósito: `anon`/`authenticated`
--          já têm grant de tabela cheio (default do Supabase), e RLS não
--          restringe coluna. Uma policy liberaria plano, status,
--          desconto_percentual, asaas_customer_id e observacoes_admin de uma
--          vez. Esta RPC é a única porta, com 10 campos explícitos.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_unidade(
  p_unidade_id      uuid,
  p_nome            text,
  p_telefone        text,
  p_endereco        text,
  p_cidade          text,
  p_uf              text,
  p_cep             text,
  p_sede_endereco   text DEFAULT NULL,
  p_sede_latitude   numeric DEFAULT NULL,
  p_sede_longitude  numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_atualiza_sede boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  -- Qualquer gestor ATIVO daquela unidade. Deliberadamente não usa flag de
  -- "principal": `usuarios.is_gestor_principal` é false para os 9 gestores
  -- atuais e `usuario_unidades.is_principal` é false para 2 deles — exigir
  -- qualquer uma travaria gestor legítimo.
  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_unidades
    WHERE usuario_id = v_uid
      AND unidade_id = p_unidade_id
      AND papel = 'gestor'
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;

  -- `cidade` entra aqui porque é NOT NULL no schema: sem a guarda, cidade
  -- vazia estouraria com violação de constraint crua em vez de sentinela.
  IF coalesce(btrim(p_nome), '') = ''
     OR coalesce(btrim(p_cidade), '') = '' THEN
    RAISE EXCEPTION 'CAMPOS_OBRIGATORIOS' USING ERRCODE = '22023';
  END IF;

  IF p_uf IS NOT NULL
     AND btrim(p_uf) <> ''
     AND length(btrim(p_uf)) <> 2 THEN
    RAISE EXCEPTION 'UF_INVALIDA' USING ERRCODE = '22023';
  END IF;

  -- A sede só é sobrescrita quando os TRÊS campos vierem juntos. Apagar a
  -- sede por omissão deixaria a unidade incapaz de gerar rota: partida e
  -- chegada saem de sede_latitude/sede_longitude
  -- (src/hooks/nova-entrega/useEnderecoUnidade.ts).
  v_atualiza_sede := p_sede_endereco IS NOT NULL
                     AND btrim(p_sede_endereco) <> ''
                     AND p_sede_latitude IS NOT NULL
                     AND p_sede_longitude IS NOT NULL;

  IF v_atualiza_sede
     AND (p_sede_latitude NOT BETWEEN -90 AND 90
          OR p_sede_longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'COORDENADAS_INVALIDAS' USING ERRCODE = '22023';
  END IF;

  UPDATE public.unidades SET
    nome           = btrim(p_nome),
    cidade         = btrim(p_cidade),
    telefone       = nullif(btrim(coalesce(p_telefone, '')), ''),
    endereco       = nullif(btrim(coalesce(p_endereco, '')), ''),
    uf             = nullif(btrim(coalesce(p_uf, '')), ''),
    cep            = nullif(btrim(coalesce(p_cep, '')), ''),
    sede_endereco  = CASE WHEN v_atualiza_sede
                          THEN btrim(p_sede_endereco) ELSE sede_endereco END,
    sede_latitude  = CASE WHEN v_atualiza_sede
                          THEN p_sede_latitude ELSE sede_latitude END,
    sede_longitude = CASE WHEN v_atualiza_sede
                          THEN p_sede_longitude ELSE sede_longitude END,
    updated_at     = now()
  WHERE id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) TO authenticated;

COMMENT ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) IS 'Única porta de escrita em unidades pelo app. NÃO existe policy de UPDATE: as demais colunas (plano, status, desconto_percentual, asaas_customer_id, observacoes_admin...) ficam inalcançáveis por construção.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.atualizar_unidade(
--   uuid, text, text, text, text, text, text, text, numeric, numeric);
-- COMMIT;
-- NÃO crie policy de UPDATE como "compensação" ao reverter: isso abriria as
-- 17 colunas que esta RPC protege.
