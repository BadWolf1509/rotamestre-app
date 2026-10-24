-- ============================================================================
-- Migration 52: contato do gestor segue o vínculo ativo
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   `get_gestor_contato()` (botão "Falar com o gestor" do menu do motorista,
--   `src/components/drawer/hooks/useDrawerContact.ts`) passa a escolher a loja
--   e o gestor pelos vínculos de `usuario_unidades`, com o mesmo critério das
--   policies de `rotas`/`paradas` da Migration 49:
--
--   - quem chama precisa estar ativo no cadastro (`usuario_atual_ativo()`,
--     Migration 49); senão, nenhuma linha;
--   - a loja é sempre uma em que quem chama tem vínculo ativo. Regra
--     determinística, na ordem:
--       1. a rota aberta que o app mostra no card da Início
--          (`useLoadActiveRoute`): `em_andamento` antes de `pendente`, depois
--          `data`, `created_at` e `id` crescentes;
--       2. sem rota aberta, a loja da rota mais recente (`created_at`
--          decrescente, `id`) — a última loja para a qual a pessoa trabalhou;
--       3. sem rota, o vínculo ativo: `is_principal` primeiro, depois o mais
--          antigo (`created_at`), depois `unidade_id`;
--     rota de loja sem vínculo ativo não conta em nenhum passo;
--   - o gestor devolvido é ativo no cadastro e tem vínculo ativo de gestor
--     naquela loja: primeiro o gestor principal da loja (a mesma definição de
--     `transferir_gestao_principal`: `is_gestor_principal` com
--     `usuarios.unidade_id` igual à loja), depois o vínculo de gestor mais
--     antigo, `usuarios.created_at` e `id`;
--   - sem loja ou sem gestor: nenhuma linha (antes, "sem loja" era exceção).
--
--   Antes, a loja vinha do vínculo ativo mais recente ou, sem vínculo, da
--   coluna `usuarios.unidade_id`, e o gestor era procurado por
--   `usuarios.unidade_id`/`papel`/`ativo`, sem olhar o vínculo dele. As duas
--   colunas continuam existindo, mas não decidem mais nada aqui.
--
--   Compatibilidade: assinatura e retorno iguais (`TABLE(nome text, telefone
--   text, email text)`, no máximo uma linha), para o app já instalado. O app
--   antigo consulta com `.single()`: zero linhas vira erro e ele mostra
--   "Não foi possível obter os dados do gestor" — o mesmo que acontecia com
--   a exceção de "sem loja". O app novo usa `.maybeSingle()` e mostra
--   mensagem própria. "Não autenticado" segue como exceção (ERRCODE 42501).
--
--   Alternativas consideradas:
--   - loja: (a) manter o vínculo mais recente — com motorista em duas lojas,
--     aponta para a loja recém-vinculada mesmo sem nenhuma rota lá (medido em
--     24/10/2026: um dos 3 motoristas com duas lojas ativas cai assim);
--     (b) só a rota `em_andamento` e depois o vínculo — com a rota pendente na
--     tela, o contato poderia ser de outra loja que não a do card. Escolhida a
--     ordem acima, que segue o que a pessoa vê e, sem rota aberta, onde
--     trabalhou por último;
--   - gestor: (a) ordem antiga (`is_gestor_principal` sozinho) — a flag é da
--     pessoa, não da loja, e um gestor de várias lojas seria "principal" em
--     todas; (b) só o vínculo mais antigo — ignoraria a transferência de
--     gestão principal. Escolhida a definição de `transferir_gestao_principal`;
--   - sem loja: (a) manter a exceção — o app novo teria de distinguir erro de
--     estado esperado pela mensagem; (b) nenhuma linha. Escolhida (b).
--
--   Medido em 24/10/2026 (9 motoristas): o gestor escolhido por loja é o
--   mesmo da regra antiga nas 9 lojas com vínculo ativo; a loja muda para os
--   4 motoristas inativos no cadastro (passam a ficar sem contato) e para 2
--   dos 3 motoristas com duas lojas ativas, sem rota aberta: um sai da loja
--   recém-vinculada, sem nenhuma rota, para a loja onde trabalha; o outro
--   passa à loja da rota mais recente (na do vínculo mais recente houve uma
--   rota só, em agosto). Custo: até quatro consultas pequenas, < 1 ms cada
--   no EXPLAIN ANALYZE com as tabelas de hoje.
--
--   STABLE: só lê. SECURITY DEFINER (precisa ler o gestor, que o RLS de
--   `usuarios` não mostra ao motorista) com `search_path` vazio e nomes
--   qualificados. EXECUTE para `authenticated` e `service_role`, como hoje.
--
-- Aplicar pelo CLI (`db query --linked`) e registrar a versão
-- `20261024140000` em `supabase_migrations.schema_migrations`. Sonda:
-- `database/sondas/20261024140000_sonda_migration52.sql`.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_gestor_contato()
RETURNS TABLE(nome text, telefone text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_unidade_id uuid;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Inativo no cadastro: nenhum contato (critério da Migration 49).
  IF NOT public.usuario_atual_ativo() THEN
    RETURN;
  END IF;

  -- 1. a rota aberta que o app mostra (em andamento antes de pendente)
  SELECT r.unidade_id
    INTO v_unidade_id
    FROM public.rotas r
   WHERE r.motorista_id = v_usuario_id
     AND r.status IN ('em_andamento', 'pendente')
     AND EXISTS (
       SELECT 1
         FROM public.usuario_unidades uu
        WHERE uu.usuario_id = v_usuario_id
          AND uu.unidade_id = r.unidade_id
          AND uu.ativo = true
     )
   ORDER BY (r.status = 'em_andamento') DESC, r.data ASC, r.created_at ASC, r.id ASC
   LIMIT 1;

  -- 2. sem rota aberta: a loja da rota mais recente
  IF v_unidade_id IS NULL THEN
    SELECT r.unidade_id
      INTO v_unidade_id
      FROM public.rotas r
     WHERE r.motorista_id = v_usuario_id
       AND EXISTS (
         SELECT 1
           FROM public.usuario_unidades uu
          WHERE uu.usuario_id = v_usuario_id
            AND uu.unidade_id = r.unidade_id
            AND uu.ativo = true
       )
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1;
  END IF;

  -- 3. sem rota: o vínculo ativo (principal, depois o mais antigo)
  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
      INTO v_unidade_id
      FROM public.usuario_unidades uu
     WHERE uu.usuario_id = v_usuario_id
       AND uu.ativo = true
     ORDER BY uu.is_principal DESC NULLS LAST, uu.created_at ASC NULLS LAST, uu.unidade_id ASC
     LIMIT 1;
  END IF;

  IF v_unidade_id IS NULL THEN
    RETURN;
  END IF;

  -- Gestor ativo, com vínculo ativo de gestor nesta loja.
  RETURN QUERY
  SELECT u.nome::text, u.telefone::text, u.email::text
    FROM public.usuario_unidades uu
    JOIN public.usuarios u ON u.id = uu.usuario_id
   WHERE uu.unidade_id = v_unidade_id
     AND uu.ativo = true
     AND uu.papel::text = 'gestor'
     AND u.ativo = true
   ORDER BY COALESCE(u.is_gestor_principal IS TRUE AND u.unidade_id = v_unidade_id, false) DESC,
            uu.created_at ASC NULLS LAST,
            u.created_at ASC NULLS LAST,
            u.id ASC
   LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_gestor_contato() IS
  'Contato (nome, telefone, email) de um gestor ativo, com vínculo ativo de gestor, de uma loja em que quem chama tem vínculo ativo; quem chama precisa estar ativo no cadastro. Loja: rota aberta, rota mais recente, vínculo. No máximo uma linha; nenhuma quando não há loja ou gestor (Migration 52).';

REVOKE ALL ON FUNCTION public.get_gestor_contato() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_contato() TO authenticated, service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Conferência depois de aplicar (só SELECT):
--   SELECT pg_get_function_result('public.get_gestor_contato()'::regprocedure);
--     -- TABLE(nome text, telefone text, email text)
--   SELECT p.prosecdef, p.provolatile, p.proconfig, p.proacl
--     FROM pg_proc p WHERE p.oid = 'public.get_gestor_contato()'::regprocedure;
--     -- true, s, {search_path=""}, sem anon
-- ----------------------------------------------------------------------------

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.get_gestor_contato()
--  RETURNS TABLE(nome text, telefone text, email text)
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   v_usuario_id UUID;
--   v_unidade_id UUID;
-- BEGIN
--   -- Obter ID do usuário autenticado
--   v_usuario_id := auth.uid();
--
--   IF v_usuario_id IS NULL THEN
--     RAISE EXCEPTION 'Usuário não autenticado';
--   END IF;
--
--   -- Obter unidade do usuário (via tabela usuarios ou usuario_unidades)
--   SELECT COALESCE(
--     -- Primeiro, tentar pegar da tabela usuario_unidades (multi-unidade)
--     (SELECT uu.unidade_id
--      FROM usuario_unidades uu
--      WHERE uu.usuario_id = v_usuario_id
--        AND uu.ativo = true
--      ORDER BY uu.created_at DESC
--      LIMIT 1),
--     -- Fallback: pegar direto da tabela usuarios
--     (SELECT u.unidade_id
--      FROM usuarios u
--      WHERE u.id = v_usuario_id)
--   ) INTO v_unidade_id;
--
--   IF v_unidade_id IS NULL THEN
--     RAISE EXCEPTION 'Usuário não possui unidade vinculada';
--   END IF;
--
--   -- Retornar dados do gestor (prioriza gestor principal, depois qualquer gestor)
--   RETURN QUERY
--   SELECT
--     u.nome::TEXT,
--     u.telefone::TEXT,
--     u.email::TEXT
--   FROM usuarios u
--   WHERE u.unidade_id = v_unidade_id
--     AND u.papel = 'gestor'
--     AND u.ativo = true
--   ORDER BY
--     u.is_gestor_principal DESC NULLS LAST,  -- Gestor principal primeiro
--     u.created_at ASC                         -- Mais antigo se não tiver principal
--   LIMIT 1;
--
--   -- Se não encontrou gestor, retornar vazio (não lança exceção)
--   -- Isso permite que o app trate o caso de "gestor não encontrado"
-- END;
-- $function$;
-- COMMENT ON FUNCTION public.get_gestor_contato() IS
--   'Retorna nome, telefone e email do gestor da unidade do usuário autenticado. Usa SECURITY DEFINER para bypassing RLS de forma segura.';
-- REVOKE ALL ON FUNCTION public.get_gestor_contato() FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_gestor_contato() TO authenticated, service_role;
-- COMMIT;
