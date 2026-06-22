# Security Hardening Multi-tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar, numa única migração SQL, os furos multi-tenant exploráveis (RPCs cross-tenant, grants amplos, vazamento de push tokens, views inseguras) — sem tocar no app.

**Architecture:** Uma migração consolidada nos dois diretórios (`database/migrations/` canônico + `supabase/migrations/`). As RPCs `DEFINER` ganham guard de autorização espelhando as policies `paradas_insert`/`paradas_update` + `SET search_path=''`. Grants amplos são revogados; a policy de `push_notification_logs` é escopada por unidade; as 2 views `DEFINER` passam a `security_invoker`. Aplicação no banco vivo via MCP Supabase (`apply_migration`), com verificação por queries de estado e teste funcional via JWT simulado.

**Tech Stack:** PostgreSQL (Supabase), RLS, plpgsql; MCP `supabase` (`apply_migration`, `execute_sql`); agente `rls-policy-reviewer`; skill `/new-migration`.

## Global Constraints

- Projeto Supabase de produção: `xezslsyxjivunmhhyxtd` (confirmar antes de qualquer escrita).
- Migração em **dois diretórios idênticos**: `database/migrations/` (canônico) e `supabase/migrations/` (`supabase db push`).
- Nas RPCs: `SECURITY DEFINER` + `SET search_path = ''` + corpo **inteiramente schema-qualified** (`public.`, `auth.uid()`).
- Guard C1 = regra de `paradas_insert` (gestor ativo da unidade da rota). Guard C2 = regra de `paradas_update` (motorista dono OU gestor da unidade).
- Funções não devem mudar de comportamento de negócio — só ganhar autorização + hardening.
- **`rls-policy-reviewer` é gate obrigatório** antes de aplicar no banco.
- **Toda escrita no banco de produção exige confirmação explícita do gestor** imediatamente antes.
- App **não** é modificado (call sites já tratam `{success:false}` — verificado em `routeUtils.ts:158` e `useAddStopForm.ts:192`).
- Branch dedicada: `fix/security-rls-multitenant` (não trabalhar no `main`).

---

## File Structure

- Create: `database/migrations/<ts>_security_hardening_multitenant.sql` — a migração (fonte canônica). `<ts>` = timestamp `YYYYMMDDHHMMSS` gerado pelo `/new-migration`.
- Create: `supabase/migrations/<ts>_security_hardening_multitenant.sql` — cópia byte-a-byte da anterior.
- Modify: nenhum arquivo de app.
- Verify (não versionado): queries SQL rodadas via MCP `execute_sql` (estão neste plano).

---

### Task 1: Branch + escrever a migração consolidada

**Files:**

- Create: `database/migrations/<ts>_security_hardening_multitenant.sql`
- Create: `supabase/migrations/<ts>_security_hardening_multitenant.sql`

**Interfaces:**

- Consumes: helpers/policies já existentes no banco (`usuario_unidades`, `paradas_insert`, `paradas_update`).
- Produces: o arquivo de migração que a Task 3 aplica. Objetos afetados: funções `public.inserir_parada(...)`, `public.reordenar_paradas(uuid[], integer[])`, `public.expire_old_pending_routes()`, `public.remind_pending_routes(text)`; policy `push_notification_logs_select_scoped`; views `vw_*`/`admin_dashboard_metrics`; grants de `notificacoes`.

- [ ] **Step 1: Criar a branch a partir do main atualizado**

```bash
git checkout main && git pull
git checkout -b fix/security-rls-multitenant
```

- [ ] **Step 2: Gerar o scaffold da migração** (via skill `/new-migration`, que cria o par de arquivos com timestamp e cabeçalho). Se preferir manual: criar os dois arquivos com o mesmo `<ts>`.

- [ ] **Step 3: Escrever o conteúdo completo da migração** em `database/migrations/<ts>_security_hardening_multitenant.sql`:

```sql
-- Migration: security_hardening_multitenant
-- Fecha furos multi-tenant (validado no banco vivo 2026-06-22).
-- Spec: docs/superpowers/specs/2026-06-22-security-hardening-multitenant-design.md
-- C1/C2: guard de tenant + search_path nas RPCs. C4: revogar funções platform-wide.
-- A1: escopar push_notification_logs por unidade. A3: views anon + security_invoker.
-- A4: remover grant INSERT morto em notificacoes.

-- ============================================================
-- C1 — inserir_parada: guard (gestor da unidade da rota) + search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.inserir_parada(
  p_rota_id UUID,
  p_tipo TEXT,
  p_endereco TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_posicao_insercao INTEGER DEFAULT NULL,
  p_destinatario TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
BEGIN
  -- Authorization guard (mirrors paradas_insert): gestor ativo da unidade da rota
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: gestor da unidade da rota requerido.');
  END IF;

  SELECT COUNT(*) INTO v_parada_count
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  SELECT id, ordem INTO v_chegada
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  IF p_posicao_insercao IS NULL THEN
    v_new_ordem := v_parada_count + 1;
  ELSE
    v_new_ordem := p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  IF v_chegada.id IS NOT NULL AND v_chegada.ordem <= v_new_ordem THEN
    UPDATE public.paradas
    SET ordem = GREATEST(v_chegada.ordem + 1, v_new_ordem + 1)
    WHERE id = v_chegada.id;
  END IF;

  INSERT INTO public.paradas (
    rota_id, tipo, endereco, latitude, longitude, ordem,
    destinatario, telefone, observacoes, status, is_checkpoint
  ) VALUES (
    p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
    p_destinatario, p_telefone, p_observacoes, 'pendente', true
  )
  RETURNING id INTO v_new_parada_id;

  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE public.paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  IF v_chegada.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_parada_count
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
    UPDATE public.paradas
    SET ordem = v_parada_count + 1
    WHERE id = v_chegada.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) FROM PUBLIC, anon;

-- ============================================================
-- C2 — reordenar_paradas: guard (motorista dono OU gestor da unidade) + search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.reordenar_paradas(
  p_parada_ids UUID[],
  p_novas_ordens INTEGER[]
)
RETURNS JSONB
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

  -- Authorization guard (mirrors paradas_update): motorista dono OU gestor da unidade
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    WHERE r.id = v_rota_id
      AND (
        r.motorista_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuario_unidades uu
          WHERE uu.usuario_id = auth.uid()
            AND uu.papel = 'gestor'
            AND uu.unidade_id = r.unidade_id
            AND uu.ativo = true
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

REVOKE EXECUTE ON FUNCTION public.reordenar_paradas(uuid[], integer[]) FROM PUBLIC, anon;

-- ============================================================
-- C4 — revogar funções platform-wide (cron usa service_role, que mantém EXECUTE)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_routes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remind_pending_routes(text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- A1 — push_notification_logs: escopar SELECT por unidade (espelha logs_select)
-- ============================================================
DROP POLICY IF EXISTS "push_notification_logs_select_optimized" ON public.push_notification_logs;
CREATE POLICY "push_notification_logs_select_scoped" ON public.push_notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_unidades my_uu
    JOIN public.usuario_unidades target_uu ON target_uu.unidade_id = my_uu.unidade_id
    WHERE my_uu.usuario_id = (SELECT auth.uid())
      AND my_uu.papel = 'gestor'
      AND my_uu.ativo = true
      AND target_uu.usuario_id = push_notification_logs.usuario_id
      AND target_uu.ativo = true
  )
);

-- ============================================================
-- A3 — views: revogar anon (grant ALL) + security_invoker nas 2 DEFINER
-- ============================================================
REVOKE ALL ON public.vw_rotas_resumo, public.vw_performance_motoristas,
              public.vw_paradas_com_vinculo, public.admin_dashboard_metrics FROM anon;
ALTER VIEW public.vw_performance_motoristas SET (security_invoker = true);
ALTER VIEW public.admin_dashboard_metrics  SET (security_invoker = true);
REVOKE ALL ON public.admin_dashboard_metrics FROM authenticated;

-- ============================================================
-- A4 — notificacoes: remover grant INSERT morto (RLS já bloqueia; via criar_notificacao)
-- ============================================================
REVOKE INSERT ON public.notificacoes FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 4: Copiar o arquivo idêntico para `supabase/migrations/<ts>_security_hardening_multitenant.sql`**

```bash
cp database/migrations/<ts>_security_hardening_multitenant.sql supabase/migrations/<ts>_security_hardening_multitenant.sql
```

- [ ] **Step 5: Conferir igualdade dos dois arquivos**

Run: `diff database/migrations/<ts>_security_hardening_multitenant.sql supabase/migrations/<ts>_security_hardening_multitenant.sql`
Expected: sem saída (arquivos idênticos).

---

### Task 2: Revisão de segurança (gate obrigatório)

**Files:** nenhum (revisão).

- [ ] **Step 1: Rodar o `rls-policy-reviewer`** sobre a migração nova, pedindo veredito (APPROVE / REQUEST_CHANGES) e checagem específica de: guards das RPCs corretos, `search_path=''` com corpo qualificado, REVOKEs não quebrarem cron/app, policy A1 escopada corretamente, `security_invoker` nas views.

- [ ] **Step 2: Aplicar ajustes** apontados pelo reviewer no arquivo `database/migrations/...` e re-copiar para `supabase/migrations/...` (repetir Task 1 Step 4-5). Só prosseguir com veredito APPROVE.

---

### Task 3: Aplicar no banco vivo + verificar estado (TDD via queries de estado)

**Files:** nenhum (aplicação + verificação via MCP).

**Interfaces:**

- Consumes: o arquivo de migração aprovado na Task 2.
- Produces: estado seguro no banco `xezslsyxjivunmhhyxtd`.

- [ ] **Step 1: Snapshot "antes" (estado inseguro — deve mostrar o problema)**

Via MCP `execute_sql`:

```sql
SELECT 'C1/C2 search_path' AS check, proname, proconfig
FROM pg_proc WHERE proname IN ('inserir_parada','reordenar_paradas');
SELECT 'C4/C1/C2 grants' AS check, routine_name, grantee
FROM information_schema.routine_privileges
WHERE routine_schema='public'
  AND routine_name IN ('inserir_parada','reordenar_paradas','expire_old_pending_routes','remind_pending_routes')
  AND grantee IN ('anon','PUBLIC','authenticated');
```

Expected (antes): `proconfig=null` para as RPCs; grants para anon/PUBLIC presentes. (Confirma o estado inseguro que vamos corrigir.)

- [ ] **Step 2: CONFIRMAR COM O GESTOR antes de escrever em produção.** Só prosseguir com OK explícito.

- [ ] **Step 3: Aplicar a migração** via MCP `apply_migration` (name: `security_hardening_multitenant`, query: conteúdo do arquivo). É transacional (tudo ou nada).

- [ ] **Step 4: Snapshot "depois" (estado seguro) — verificação**

Via MCP `execute_sql`:

```sql
-- C1/C2: search_path setado + função existe
SELECT proname, prosecdef, proconfig FROM pg_proc
WHERE proname IN ('inserir_parada','reordenar_paradas');
-- C1/C2/C4: grants de anon/PUBLIC removidos
SELECT routine_name, grantee FROM information_schema.routine_privileges
WHERE routine_schema='public'
  AND routine_name IN ('inserir_parada','reordenar_paradas','expire_old_pending_routes','remind_pending_routes')
  AND grantee IN ('anon','PUBLIC');
-- A1: policy nova presente
SELECT policyname FROM pg_policies WHERE tablename='push_notification_logs';
-- A3: anon sem grant nas views + views com security_invoker
SELECT table_name, grantee FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('vw_rotas_resumo','vw_performance_motoristas','vw_paradas_com_vinculo','admin_dashboard_metrics')
  AND grantee IN ('anon','authenticated');
SELECT relname, reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname IN ('vw_performance_motoristas','admin_dashboard_metrics');
-- A4: notificacoes sem grant INSERT
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='notificacoes' AND privilege_type='INSERT';
```

Expected (depois): RPCs com `proconfig={search_path=""}`; **zero** linhas de grant anon/PUBLIC nas funções e views; policy `push_notification_logs_select_scoped` presente; `reloptions` das 2 views com `security_invoker=true`; **zero** grant INSERT em `notificacoes`.

- [ ] **Step 5: Re-rodar o security advisor** via MCP `get_advisors(security)` e confirmar que `security_definer_view` (as 2 views) saiu da lista e os grants amplos das 4 funções foram reduzidos.

---

### Task 4: Teste funcional de autorização (RLS real via JWT simulado)

**Files:** nenhum (teste via MCP, sempre com ROLLBACK).

- [ ] **Step 1: Obter IDs de teste** (um gestor e uma rota de OUTRA unidade que esse gestor NÃO administra)

```sql
-- Gestor A (qualquer gestor ativo)
SELECT uu.usuario_id AS gestor_a, uu.unidade_id AS unidade_a
FROM public.usuario_unidades uu WHERE uu.papel='gestor' AND uu.ativo=true LIMIT 1;
-- Uma rota cuja unidade NÃO é a do gestor A (troque <unidade_a> pelo valor acima)
SELECT r.id AS rota_outra_unidade, r.unidade_id
FROM public.rotas r WHERE r.unidade_id <> '<unidade_a>' LIMIT 1;
```

- [ ] **Step 2: Tentar `reordenar_paradas` cross-tenant como o gestor A — deve ser NEGADO**

```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<gestor_a>","role":"authenticated"}';
SELECT public.reordenar_paradas(
  ARRAY[(SELECT id FROM public.paradas WHERE rota_id='<rota_outra_unidade>' LIMIT 1)]::uuid[],
  ARRAY[1]::integer[]
);
ROLLBACK;
```

Expected: `{"success": false, "error": "Não autorizado."}` (o guard bloqueia). Se vier `success:true`, o guard falhou — investigar antes de prosseguir.

- [ ] **Step 3: Confirmar caminho legítimo — gestor reordena paradas da PRÓPRIA unidade (deve funcionar)**

```sql
-- pegar uma rota da unidade do gestor A
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<gestor_a>","role":"authenticated"}';
SELECT public.reordenar_paradas(
  ARRAY[(SELECT p.id FROM public.paradas p JOIN public.rotas r ON r.id=p.rota_id
         WHERE r.unidade_id='<unidade_a>' LIMIT 1)]::uuid[],
  ARRAY[1]::integer[]
);
ROLLBACK;
```

Expected: `{"success": true, "updated": 1}` (ou `0` se não houver parada) — **não** "Não autorizado". Confirma que o fluxo legítimo não quebrou.

---

### Task 5: Commit, PR e merge

**Files:** os dois arquivos de migração.

- [ ] **Step 1: Commit**

```bash
git add database/migrations/<ts>_security_hardening_multitenant.sql supabase/migrations/<ts>_security_hardening_multitenant.sql
git commit -m "fix(security): hardening RLS/RPC multi-tenant (C1,C2,C4,A1,A3,A4)"
```

- [ ] **Step 2: Push + abrir PR**

```bash
git push -u origin fix/security-rls-multitenant
gh pr create --base main --title "fix(security): hardening RLS/RPC multi-tenant" --body "Fecha furos multi-tenant validados no banco vivo (ver docs/superpowers/specs/2026-06-22-...). Migração já aplicada e verificada no projeto xezslsyxjivunmhhyxtd."
```

- [ ] **Step 3: Aguardar CI verde** (`gh pr checks <n> --watch`).

- [ ] **Step 4: Mergear** (squash). Como é PR do próprio dono, usar `gh pr merge <n> --squash --admin --delete-branch` **com confirmação do gestor** (ver memória `merge-pr-workflow`).

- [ ] **Step 5: Atualizar main local + commitar o spec/plano** (que estão untracked)

```bash
git checkout main && git pull
git add docs/superpowers/specs/2026-06-22-security-hardening-multitenant-design.md docs/superpowers/plans/2026-06-22-security-hardening-multitenant.md
git commit -m "docs(security): spec + plano do hardening RLS multi-tenant"
```

(Ou incluir o spec/plano no mesmo PR da Task 5 Step 1, antes do push.)

---

## Self-Review

**Spec coverage:** C1 (Task 1 §C1 + Task 4), C2 (Task 1 §C2 + Task 4), C4 (Task 1 §C4), A1 (Task 1 §A1), A3 (Task 1 §A3, com security_invoker), A4 (Task 1 §A4). Verificação de estado (Task 3) + funcional (Task 4) + reviewer (Task 2). Itens fora de escopo (A2, C3, follow-ups sistêmicos) permanecem documentados no spec, não no plano. ✔ cobertura completa.

**Placeholder scan:** `<ts>`, `<n>`, `<gestor_a>`, `<unidade_a>`, `<rota_outra_unidade>` são valores a preencher em runtime (timestamp da migração, número do PR, IDs obtidos via query na Task 4 Step 1) — não são lógica omitida. Todo o SQL está completo.

**Type/identifier consistency:** assinaturas usadas nos REVOKE batem com `pg_proc` validado no vivo — `inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text)`, `reordenar_paradas(uuid[], integer[])`, `remind_pending_routes(text)`, `expire_old_pending_routes()`. Nome da nova policy `push_notification_logs_select_scoped` consistente entre Task 1 e Task 3. Views consistentes.
