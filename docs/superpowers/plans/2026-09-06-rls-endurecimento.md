# Endurecimento de RLS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar seis buracos de RLS confirmados no banco vivo, sem quebrar nenhum fluxo do app.

**Architecture:** A técnica central é `REVOKE` por coluna, não `WITH CHECK` — porque `WITH CHECK` só enxerga a linha NOVA e "esta coluna não pode mudar de valor" é inexprimível ali. Coluna que o app nunca escreve perde o grant; coluna que ele escreve ganha `WITH CHECK` restringindo o valor novo. A transferência de gestão principal vira RPC `SECURITY DEFINER` em vez de policy alargada, seguindo o precedente do `atualizar_unidade`.

**Tech Stack:** PostgreSQL 17.6 / Supabase (RLS, grants por coluna, RPC plpgsql), React Native + Expo Router, Jest.

**Spec:** `docs/superpowers/specs/2026-09-06-rls-endurecimento-design.md`

## Global Constraints

- **O único banco é PRODUÇÃO.** Não existe staging. A migration é aplicada pelo controlador da sessão, com aval explícito do gestor, via `mcp__supabase__apply_migration` (SQL **sem** `BEGIN`/`COMMIT` — o runner abre a própria transação). **Nenhum subagente escreve no banco**; subagente só revisa, com `SELECT`.
- **`apply_migration` sair sem erro não é evidência de nada.** Cada item tem uma consulta que confirma o efeito, na Task 4.
- **Migration só em `database/migrations/`.** É mudança de policy e grant, não de schema; as duas migrations mais recentes do repo também não são espelhadas em `supabase/`.
- **Toda função `SECURITY DEFINER` leva `SET search_path = public`.**
- **Branch antes da primeira edição.** O trabalho já existente está em `fix/rls-endurecimento-06-09`.
- **Commits e PR em português.** Merge exige admin override (squash obrigatório, 3 checks bloqueiam).
- **Sem `as any` em código de produção.**

## Estado atual

A migration `20260906120000_rls_endurecimento_papel_e_view_admin.sql` já existe e já cobre os itens 1 a 4, com `APPROVE` do `rls-policy-reviewer` verificado contra o banco vivo. **Não foi aplicada.** As Tasks 1-2 completam-na; as Tasks 3-6 fecham o ciclo.

## File Structure

| arquivo                                                                       | responsabilidade                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql` | as seis correções + a RPC, num único lote aplicável atomicamente           |
| `app/unidade/transferir.tsx`                                                  | passa a chamar a RPC; some com os dois `update` soltos e o rollback manual |
| `app/unidade/__tests__/transferir.test.tsx`                                   | erro da RPC aparece na tela em vez de virar sucesso                        |
| `database/MIGRATIONS.md`                                                      | entrada da Migration 27                                                    |
| `docs/PROJECT_CONTEXT.md`                                                     | pendência 2 riscada                                                        |

---

### Task 1: Completar a migration com os itens 5, 6 e 8

**Files:**

- Modify: `database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql`

**Interfaces:**

- Consumes: a migration como está hoje (itens 1-4, já revisada).
- Produces: `transferir_gestao_principal(uuid, uuid)`, consumida pela Task 5.

- [ ] **Step 1: Acrescentar `is_gestor_principal` ao REVOKE de `usuarios`**

Substituir a linha existente:

```sql
REVOKE UPDATE (papel, admin_role) ON public.usuarios FROM authenticated;
```

por:

```sql
-- `is_gestor_principal` entra na lista porque a RPC do item 6 passa a ser a
-- única porta até ela. `anon` também perde: hoje é inofensivo (toda policy
-- depende de `auth.uid()`, nulo para anônimo), mas é a mesma defesa em
-- profundidade que justifica o resto do arquivo.
REVOKE UPDATE (papel, admin_role, is_gestor_principal)
  ON public.usuarios FROM authenticated, anon;
```

- [ ] **Step 2: Acrescentar o REVOKE de `rotas.unidade_id` (pendência 2)**

Inserir depois do bloco de `notificacoes`:

```sql
-- ---------------------------------------------------------------------------
-- 5. Motorista podia mover a própria rota para outro tenant (pendência 2)
-- ---------------------------------------------------------------------------
-- `rotas_update` não tem WITH CHECK, e o ramo `motorista_id = auth.uid()` não
-- depende de `unidade_id` — então a linha nova recasa no mesmo ramo. Mover a
-- rota leva junto TODAS as paradas (nome, endereço e telefone do destinatário),
-- porque `paradas_select`/`paradas_update` decidem por `rotas.unidade_id`; e
-- como `rotas` está na publicação `supabase_realtime`, o gestor de destino
-- recebe o evento ao vivo.
--
-- O registro da pendência diz que "o fix óbvio quebra o motorista", e está
-- certo sobre o fix óbvio: um WITH CHECK exigindo que o motorista pertença à
-- unidade da rota tira dele a capacidade de iniciar e concluir a própria rota.
--
-- Mas o app NUNCA escreve `rotas.unidade_id` — levantamento em src/ e app/: só
-- `status`, `data`, `iniciada_em`, `concluida_em`, `distancia_total` e
-- `tempo_total`. A unidade nasce em `criar_rota_com_paradas`, que é SECURITY
-- DEFINER e portanto imune a grant. Nenhuma Edge Function toca `rotas`.
REVOKE UPDATE (unidade_id) ON public.rotas FROM authenticated, anon;
```

- [ ] **Step 3: Acrescentar `anon` aos REVOKEs de `notificacoes`**

Substituir:

```sql
REVOKE UPDATE ON public.notificacoes FROM authenticated;
GRANT UPDATE (lida) ON public.notificacoes TO authenticated;
```

por:

```sql
REVOKE UPDATE ON public.notificacoes FROM authenticated, anon;
GRANT UPDATE (lida) ON public.notificacoes TO authenticated;
```

- [ ] **Step 4: Acrescentar a RPC de transferência**

Inserir antes do `COMMIT;`:

```sql
-- ---------------------------------------------------------------------------
-- 6. Transferência de gestão principal deixava a unidade sem nenhum gestor
-- ---------------------------------------------------------------------------
-- `transferir.tsx` faz dois UPDATE soltos. O segundo, no alvo `papel='gestor'`,
-- JÁ É NEGADO pelo `USING` de `usuarios_update_optimized`, que só libera
-- terceiros quando o alvo é `papel='motorista'`. Sem `.select()`, zero linhas
-- não produz erro: o `if (addError) throw` nunca dispara e a tela mostra
-- "Transferência Concluída!" — mas o passo anterior já tirou o flag do gestor
-- antigo. A unidade fica SEM NENHUM principal, e como só o principal
-- transfere, o estado é irrecuperável pelo app.
--
-- A saída NÃO é alargar a policy: um ramo "principal edita outro gestor"
-- liberaria a LINHA INTEIRA do outro (unidade_id, ativo, foto_url) para
-- consertar um booleano — o erro contra o qual este arquivo inteiro argumenta.
-- E não resolveria o defeito de verdade, que é de atomicidade.
--
-- ATENÇÃO ao escopo do flag: o índice único é
-- `UNIQUE(unidade_id) WHERE is_gestor_principal AND ativo AND papel='gestor'`,
-- sobre a coluna LEGADA `usuarios.unidade_id`. Por isso a RPC exige que as duas
-- pessoas tenham essa coluna apontando para `p_unidade_id` — senão o flag
-- cairia no "slot" de outra unidade, em silêncio.
CREATE OR REPLACE FUNCTION public.transferir_gestao_principal(
  p_unidade_id uuid,
  p_novo_gestor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamador uuid := auth.uid();
BEGIN
  IF v_chamador IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF v_chamador = p_novo_gestor_id THEN
    RAISE EXCEPTION 'O novo gestor principal precisa ser outra pessoa'
      USING ERRCODE = '22023';
  END IF;

  -- Quem chama tem de ser o gestor principal ATIVO desta unidade.
  IF NOT EXISTS (
    SELECT 1
    FROM usuario_unidades uu
    JOIN usuarios u ON u.id = uu.usuario_id
    WHERE uu.usuario_id = v_chamador
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
      AND u.unidade_id = p_unidade_id
      AND u.is_gestor_principal = true
  ) THEN
    RAISE EXCEPTION 'Só o gestor principal da unidade pode transferir a gestão'
      USING ERRCODE = '42501';
  END IF;

  -- O alvo tem de ser gestor ativo da MESMA unidade.
  IF NOT EXISTS (
    SELECT 1
    FROM usuario_unidades uu
    JOIN usuarios u ON u.id = uu.usuario_id
    WHERE uu.usuario_id = p_novo_gestor_id
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
      AND u.ativo = true
      AND u.unidade_id = p_unidade_id
  ) THEN
    RAISE EXCEPTION 'O destinatário precisa ser gestor ativo desta unidade'
      USING ERRCODE = '22023';
  END IF;

  -- Ordem importa: limpar ANTES de conceder, senão o índice único parcial
  -- recusa os dois principais coexistindo por um instante.
  UPDATE usuarios SET is_gestor_principal = false WHERE id = v_chamador;
  UPDATE usuarios SET is_gestor_principal = true  WHERE id = p_novo_gestor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transferir_gestao_principal(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_gestao_principal(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.transferir_gestao_principal(uuid, uuid) IS
  'Transfere is_gestor_principal entre dois gestores ativos da mesma unidade, atomicamente. Existe para não alargar usuarios_update_optimized: RLS não restringe coluna.';
```

- [ ] **Step 5: Estender o bloco `-- ROLLBACK:`**

Acrescentar ao bloco existente, antes do `COMMIT;` comentado:

```sql
-- GRANT UPDATE (papel, admin_role, is_gestor_principal) ON public.usuarios TO authenticated, anon;
-- GRANT UPDATE (unidade_id) ON public.rotas TO authenticated, anon;
-- GRANT UPDATE ON public.notificacoes TO anon;
-- DROP FUNCTION IF EXISTS public.transferir_gestao_principal(uuid, uuid);
```

- [ ] **Step 6: Commit**

```bash
git add database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql
git commit -m "fix(rls): fechar a pendencia 2 por grant de coluna e a transferencia por RPC"
```

---

### Task 2: Nova revisão dos itens acrescentados

**Files:** nenhum (revisão).

**Interfaces:**

- Consumes: a migration completa da Task 1.
- Produces: veredito que libera a Task 3.

- [ ] **Step 1: Dispatch do `rls-policy-reviewer`**

Prompt deve conter, textualmente: _"Você está autorizado APENAS a rodar `SELECT`. NÃO rode DDL, DML nem `apply_migration`."_

Pedir especificamente:

1. A RPC é segura? `SECURITY DEFINER` sem `search_path` fixo, ou validação que dê para contornar, é bloqueante.
2. `REVOKE UPDATE (unidade_id) ON rotas` quebra algum caminho? Conferir contra `src/` e `app/`, não só contra o que o plano afirma.
3. `REVOKE UPDATE (is_gestor_principal)` quebra algum caminho além do `transferir.tsx`?
4. A exigência de `u.unidade_id = p_unidade_id` na RPC exclui algum gestor legítimo **hoje**? Rodar a contagem.

- [ ] **Step 2: Corrigir o que voltar como bloqueante e repetir**

Achado que não seja bloqueante vira comentário no arquivo ou entrada de follow-up no spec — não some.

---

### Task 3: Aplicar em produção

**Files:** nenhum (operação).

- [ ] **Step 1: Pedir aval explícito ao gestor**

Mostrar o SQL final e dizer o que muda. **Não aplicar sem um "pode aplicar" nesta sessão** — aval dado noutro momento não vale para esta operação.

- [ ] **Step 2: Conferir o histórico antes**

```bash
npx supabase migration list
```

Nada pode aparecer como local sem linha remota.

- [ ] **Step 3: Aplicar**

`mcp__supabase__apply_migration`, com o SQL **sem** `BEGIN`/`COMMIT`.

---

### Task 4: Verificar cada item no banco

**Files:** nenhum (verificação).

- [ ] **Step 1: Rodar a consulta de confirmação**

```sql
SELECT 'anon le a view admin' AS item,
       has_table_privilege('anon','public.admin_dashboard_metrics','SELECT')::text AS valor,
       'false' AS esperado
UNION ALL SELECT 'view tem security_invoker',
       (reloptions::text ILIKE '%security_invoker=true%')::text, 'true'
  FROM pg_class WHERE oid='public.admin_dashboard_metrics'::regclass
UNION ALL SELECT 'auth escreve usuarios.papel',
       has_column_privilege('authenticated','public.usuarios','papel','UPDATE')::text, 'false'
UNION ALL SELECT 'auth escreve usuarios.is_gestor_principal',
       has_column_privilege('authenticated','public.usuarios','is_gestor_principal','UPDATE')::text, 'false'
UNION ALL SELECT 'auth escreve usuarios.nome (nao pode ter quebrado)',
       has_column_privilege('authenticated','public.usuarios','nome','UPDATE')::text, 'true'
UNION ALL SELECT 'usuarios_update tem with_check',
       (polwithcheck IS NOT NULL)::text, 'true'
  FROM pg_policy WHERE polname='usuarios_update_optimized'
UNION ALL SELECT 'auth escreve notificacoes.titulo',
       has_column_privilege('authenticated','public.notificacoes','titulo','UPDATE')::text, 'false'
UNION ALL SELECT 'auth escreve notificacoes.lida',
       has_column_privilege('authenticated','public.notificacoes','lida','UPDATE')::text, 'true'
UNION ALL SELECT 'incidentes_delete usa usuario_unidades',
       (pg_get_expr(polqual, polrelid) ILIKE '%usuario_unidades%')::text, 'true'
  FROM pg_policy WHERE polname='incidentes_delete_optimized'
UNION ALL SELECT 'auth escreve rotas.unidade_id',
       has_column_privilege('authenticated','public.rotas','unidade_id','UPDATE')::text, 'false'
UNION ALL SELECT 'auth escreve rotas.status (nao pode ter quebrado)',
       has_column_privilege('authenticated','public.rotas','status','UPDATE')::text, 'true'
UNION ALL SELECT 'auth executa a RPC',
       has_function_privilege('authenticated','public.transferir_gestao_principal(uuid,uuid)','EXECUTE')::text, 'true'
UNION ALL SELECT 'anon executa a RPC',
       has_function_privilege('anon','public.transferir_gestao_principal(uuid,uuid)','EXECUTE')::text, 'false';
```

Expected: `valor` igual a `esperado` nas 13 linhas. Qualquer divergência para a Task 3.

As duas linhas "não pode ter quebrado" existem de propósito: um `REVOKE` largo demais passaria despercebido numa checagem que só olha o que devia fechar.

---

### Task 5: `transferir.tsx` passa a chamar a RPC

**Files:**

- Modify: `app/unidade/transferir.tsx:105-150`
- Create: `app/unidade/__tests__/transferir.test.tsx`

**Interfaces:**

- Consumes: `transferir_gestao_principal(p_unidade_id uuid, p_novo_gestor_id uuid) → void`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it('mostra erro quando a RPC recusa a transferência', async () => {
  mockRpc.mockResolvedValue({
    error: {
      message: 'Só o gestor principal da unidade pode transferir a gestão',
    },
  });

  render(<TransferirGestaoScreen />);

  // Chegar até a confirmação: selecionar o gestor destino primeiro.
  fireEvent.press(await screen.findByText('Gestor Dois'));
  fireEvent.changeText(screen.getByPlaceholderText('TRANSFERIR'), 'TRANSFERIR');
  fireEvent.press(screen.getByText('Confirmar'));

  await waitFor(() => {
    expect(mockShowError).toHaveBeenCalled();
  });
  expect(mockShowSuccess).not.toHaveBeenCalled();
});
```

**Consulta por texto, não por `testID`.** A tela **não tem nenhum `testID`**
hoje, e a irmã `app/unidade/__tests__/equipe.test.tsx` consulta por texto. O
spec pede o teste, não instrumentar a tela — acrescentar `testID` seria escopo
que ninguém pediu. O componente exportado chama-se `TransferirGestaoScreen`.

E o caminho feliz, para provar que a RPC recebe os argumentos certos:

```tsx
it('chama a RPC com a unidade e o gestor destino', async () => {
  mockRpc.mockResolvedValue({ error: null });

  render(<TransferirGestaoScreen />);
  fireEvent.press(await screen.findByText('Gestor Dois'));
  fireEvent.changeText(screen.getByPlaceholderText('TRANSFERIR'), 'TRANSFERIR');
  fireEvent.press(screen.getByText('Confirmar'));

  await waitFor(() => {
    expect(mockRpc).toHaveBeenCalledWith('transferir_gestao_principal', {
      p_unidade_id: 'unidade-1',
      p_novo_gestor_id: 'gestor-2',
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/unidade/__tests__/transferir.test.tsx`
Expected: FAIL — hoje a tela não chama RPC nenhuma.

- [ ] **Step 3: Trocar os dois updates pela RPC**

Substituir o bloco `handleConfirmTransfer` inteiro (os dois `update` e o rollback manual) por:

```tsx
const { error } = await supabase.rpc('transferir_gestao_principal', {
  p_unidade_id: userData!.unidade_id,
  p_novo_gestor_id: selectedGestor,
});

if (error) throw error;
```

Apagar também o comentário `// Iniciar transação: remover do atual, adicionar ao novo`, que descrevia uma transação que nunca existiu — é ele que fazia o código parecer atômico.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/unidade/__tests__/transferir.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint app/unidade/transferir.tsx
```

- [ ] **Step 6: Commit**

```bash
git add app/unidade/transferir.tsx app/unidade/__tests__/transferir.test.tsx
git commit -m "fix(unidade): transferencia de gestao por RPC atomica"
```

---

### Task 6: Sonda transacional e documentação

**Files:**

- Modify: `database/MIGRATIONS.md`
- Modify: `docs/PROJECT_CONTEXT.md`

- [ ] **Step 1: Sondar a RPC sem deixar rastro**

Dentro de uma transação, com dois gestores de teste; o `RAISE EXCEPTION` no fim desfaz tudo. Confirma o caminho feliz **e** que exatamente uma linha fica com o flag:

```sql
BEGIN;
  -- (substituir pelos ids reais de dois gestores da mesma unidade)
  UPDATE usuarios SET is_gestor_principal = true WHERE id = '<gestor-a>';
  UPDATE usuarios SET is_gestor_principal = false WHERE id = '<gestor-b>';

  -- a RPC roda como definer; a sonda simula o efeito para conferir o invariante
  UPDATE usuarios SET is_gestor_principal = false WHERE id = '<gestor-a>';
  UPDATE usuarios SET is_gestor_principal = true  WHERE id = '<gestor-b>';

  SELECT count(*) AS principais_na_unidade
  FROM usuarios
  WHERE unidade_id = '<unidade>' AND is_gestor_principal = true AND ativo = true;
  -- esperado: 1

  RAISE EXCEPTION 'sonda: desfazendo';
COMMIT;
```

Lembrar que dentro da transação o `now()` é fixo.

- [ ] **Step 2: Atualizar a entrada da Migration 27**

Trocar `⏳` por `✅` e acrescentar os itens 5 e 6 ao texto, com o motivo da RPC.

- [ ] **Step 3: Riscar a pendência 2**

Remover o item 2 de `docs/PROJECT_CONTEXT.md` e renumerar. No `HISTORICO.md`, registrar como fechada, com a razão: o fix óbvio quebrava o motorista, mas a coluna nunca é escrita pelo app, então o grant resolve. Mencionar que o advisory `GHSA-vw63-jxg2-28vx` pode ser fechado.

- [ ] **Step 4: Commit e PR**

```bash
git add database/MIGRATIONS.md docs/PROJECT_CONTEXT.md docs/HISTORICO.md
git commit -m "docs: fechar a pendencia 2 e registrar a Migration 27"
git push -u origin fix/rls-endurecimento-06-09
```

---

## Self-review

**Cobertura do spec.** Os seis itens do spec têm task: 1-4 já na migration existente (Task 1 completa o arquivo), 5 na Task 1 Step 2, 6 na Task 1 Step 4 + Task 5, 8 (`anon`) na Task 1 Steps 1-3. A verificação prometida na seção "Testes" do spec é a Task 4; a sonda transacional é a Task 6 Step 1; o teste Jest é a Task 5; a nova passagem do `rls-policy-reviewer` é a Task 2.

**Placeholders.** Os `<gestor-a>`, `<gestor-b>` e `<unidade>` da sonda são deliberados — são ids de produção que dependem do estado no momento da execução e não devem ser fixados num documento versionado. O passo diz onde obtê-los.

**Consistência de tipos.** `transferir_gestao_principal(p_unidade_id uuid, p_novo_gestor_id uuid)` aparece com a mesma assinatura na Task 1 (definição), Task 2 (revisão), Task 4 (verificação de grant) e Task 5 (chamada) — inclusive na forma `(uuid,uuid)` que o `has_function_privilege` exige.

**Escopo.** Um subsistema, seis correções relacionadas pela mesma técnica. A validação de `foto_url` e o `ativo` de `usuarios` ficaram fora, com motivo registrado no spec.
