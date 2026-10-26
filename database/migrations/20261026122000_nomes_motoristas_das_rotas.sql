-- ============================================================================
-- Migration 72: RPC nomes_motoristas_das_rotas — o gestor vê o nome do
-- motorista que já atendeu a loja
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy `usuarios_select_optimized` só deixa o gestor ler quem tem
--   vínculo ATIVO numa loja dele. Quando o vínculo do motorista com a loja
--   fica inativo, as rotas antigas dele continuam na loja, mas o embed
--   `motorista:usuarios(...)` do select de `rotas` volta vazio e a tela mostra
--   a rota sem motorista. Medido em 26/10/2026: 3 rotas têm `motorista_id`
--   com vínculo inativo na loja da rota (todas com `usuarios.ativo = false`);
--   nenhuma tem `motorista_id` sem vínculo algum (a FK
--   `rotas_motorista_id_fkey` é `ON DELETE SET NULL`).
--
--   Esta migration cria `public.nomes_motoristas_das_rotas(uuid[])`, que
--   devolve uma linha `(rota_id, nome)` por rota pedida quando:
--     - quem chama é gestor ativo (`usuario_unidades.papel = 'gestor'` e
--       `ativo`) da `rotas.unidade_id`;
--     - `rotas.motorista_id` não é nulo e a linha em `usuarios` existe;
--     - o motorista tem linha em `usuario_unidades` NESSA loja, ativa ou não
--       ("tem ou teve vínculo"). Qualquer papel conta: a pergunta é se a
--       pessoa já pertenceu à loja, não o que fazia nela.
--   Mais de 1000 ids → `RAISE EXCEPTION 'LISTA_GRANDE: ...'` com ERRCODE
--   22023 (erro de uso da API, não regra de negócio). Lista nula ou vazia,
--   ou chamada sem sessão → zero linhas.
--
--   Só o nome sai da função: nenhuma outra coluna de `usuarios`. O app chama
--   a RPC só para as rotas cujo embed veio vazio (hoje 3 rotas; na maioria
--   das telas, nenhuma chamada).
--
--   Alternativas consideradas:
--     (a) RPC por lista de `rota_id` (escolhida): devolve só o nome, a regra
--         de acesso fica numa função com ACL própria e a chamada só acontece
--         quando o embed volta vazio.
--     (b) visão `security definer` com o filtro por `auth.uid()` dentro,
--         embutida pelo PostgREST no select de `rotas`: deixaria a busca por
--         nome da Gestão de Rotas achar esses motoristas, mas visão nova
--         nasce com SELECT para `anon` (privilégio padrão, ver Migration 69)
--         e exige REVOKE explícito, o advisor do Supabase acusa
--         `security_definer_view`, e o relacionamento detectado pelo
--         PostgREST em visão depende das colunas-fonte.
--     (c) coluna `rotas.motorista_nome` copiada por gatilho: dado duplicado
--         que envelhece quando o nome muda, e todo leitor de `rotas` passaria
--         a ver o nome.
--     Linguagem: `plpgsql` (escolhida) porque o teto de 1000 ids precisa de
--       RAISE com ERRCODE próprio; em `LANGUAGE sql` o teto exigiria um
--       artifício (divisão por zero, cast inválido) com SQLSTATE sem relação.
--     Tipo do nome: `usuarios.nome` é `varchar(255)`; a função converte com
--       `u.nome::text` (escolhido) em vez de declarar `nome varchar` no
--       RETURNS TABLE, para que a assinatura não dependa do tamanho da coluna.
--     Ordem das conferências: o teto vem antes da sessão, para que a mesma
--       lista dê o mesmo erro com ou sem usuário.
--
--   Limite registrado: a busca por nome da Gestão de Rotas continua sem achar
--   o motorista fora da loja (a rota aparece pela data ou sem filtro).
--
--   Efeito no app instalado: nenhum. A função é nova e só a 1.14.8 (Tarefa
--   A2) passa a chamá-la.
--
--   Função nova: SECURITY DEFINER, STABLE (só leitura), `SET search_path =
--   ''` (nomes qualificados), dono postgres, REVOKE explícito de PUBLIC e
--   anon (a Migration 69 não alcança CREATE OR REPLACE), EXECUTE para
--   authenticated e service_role.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.nomes_motoristas_das_rotas(p_rota_ids uuid[])
RETURNS TABLE (rota_id uuid, nome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF cardinality(p_rota_ids) > 1000 THEN
    RAISE EXCEPTION 'LISTA_GRANDE: no máximo 1000 rotas por chamada.' USING ERRCODE = '22023';
  END IF;

  v_uid := auth.uid();

  IF v_uid IS NULL OR p_rota_ids IS NULL OR cardinality(p_rota_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.id, u.nome::text
    FROM public.rotas r
    JOIN public.usuarios u ON u.id = r.motorista_id
   WHERE r.id = ANY (p_rota_ids)
     AND EXISTS (
       SELECT 1 FROM public.usuario_unidades g
        WHERE g.usuario_id = v_uid
          AND g.unidade_id = r.unidade_id
          AND g.papel = 'gestor'
          AND g.ativo = true
     )
     AND EXISTS (
       SELECT 1 FROM public.usuario_unidades v
        WHERE v.usuario_id = r.motorista_id
          AND v.unidade_id = r.unidade_id
     );
END;
$$;

ALTER FUNCTION public.nomes_motoristas_das_rotas(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.nomes_motoristas_das_rotas(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nomes_motoristas_das_rotas(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.nomes_motoristas_das_rotas(uuid[]) IS
  'Migration 72: para o gestor ativo da loja, devolve (rota_id, nome) das rotas pedidas cujo motorista tem ou teve vínculo com a loja da rota. Só o nome. Mais de 1000 ids: erro 22023 LISTA_GRANDE.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_function_result(p.oid), p.provolatile, p.prosecdef, p.proconfig,
--        pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_executa
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.nomes_motoristas_das_rotas(uuid[])');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.nomes_motoristas_das_rotas(uuid[]);
-- COMMIT;
