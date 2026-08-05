# Auditoria de uso do otimizador — Fase 1 (registrar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passar a registrar, em cada rota, se ela foi otimizada, manual ou otimizada-e-depois-alterada, com a distância antes e depois e o autor — para que a Fase 2 possa auditar adesão.

**Architecture:** Cinco colunas anuláveis em `rotas` (fonte para filtro rápido) + evento `rota_otimizada` em `logs` (fonte para a Timeline). A escrita acontece em três pontos: no clique de otimizar (captura o "antes"), ao salvar a rota (grava estado + distâncias) e na reordenação manual (transição para `otimizada_alterada`). Rota antiga fica `NULL` = "sem registro", nunca "manual".

**Tech Stack:** Postgres/Supabase (migrations em `database/migrations/` + `supabase/migrations/`), React Native + Expo + TypeScript, Jest + `@testing-library/react-native`.

## Global Constraints

- Rota sem registro é `NULL` e **nunca** deve ser exibida ou contada como `'manual'`.
- Estados válidos, exatamente estes três: `'otimizada'`, `'manual'`, `'otimizada_alterada'`.
- Ganho = `otimizacao_distancia_antes − otimizacao_distancia_depois`. Positivo = economia. **Não** criar coluna de ganho — é derivado na leitura.
- Adicionar parada **não** altera `otimizacao_estado` (só reordenação manual altera).
- Falha ao calcular a distância "antes" **nunca** pode bloquear a otimização: grava `'otimizada'` com `otimizacao_distancia_antes = NULL`.
- Migration versionada nos **dois** diretórios com o mesmo timestamp e conteúdo (`database/MIGRATIONS.md`).
- Logging: `logger.warn(mensagem, erro)`, no máximo 2 argumentos (`CLAUDE.md`).
- Sem `as any` em código de produção.
- Esta fase **não muda nada visível na tela**. Isso é esperado — a UI é a Fase 2.

## File Structure

| Arquivo                                                                                                | Responsabilidade                                                      |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `database/migrations/<ts>_auditoria_otimizacao_rotas.sql` (+ cópia idêntica em `supabase/migrations/`) | Colunas, CHECK, índice e substituição da RPC `criar_rota_com_paradas` |
| `src/types/database.ts`                                                                                | Regenerado após a migration                                           |
| `src/components/gestor/nova-entrega/types.ts`                                                          | Campo `distanciaAntesKm` em `RotaOtimizadaState`                      |
| `src/hooks/nova-entrega/useRouteOptimization.ts`                                                       | Calcula e guarda a distância "antes" no clique de otimizar            |
| `src/hooks/nova-entrega/useRouteCreation.ts`                                                           | Envia estado + distâncias + autor à RPC                               |
| `src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts`                                         | Transição para `otimizada_alterada` ao reordenar                      |
| `src/lib/timeline.ts`                                                                                  | Evento `rota_otimizada` + nuance `desfez_otimizacao`                  |

---

### Task 1: Migration — colunas de auditoria, índice e RPC

**Files:**

- Create: `database/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql`
- Create: `supabase/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql` (conteúdo idêntico)
- Modify: `src/types/database.ts` (regenerado, não editar à mão)

**Interfaces:**

- Consumes: nada.
- Produces: colunas `rotas.otimizacao_estado`, `rotas.otimizacao_distancia_antes`, `rotas.otimizacao_distancia_depois`, `rotas.otimizada_em`, `rotas.otimizada_por`. RPC `criar_rota_com_paradas` passa a aceitar **3** parâmetros novos, todos com DEFAULT NULL: `p_otimizacao_estado text`, `p_otimizacao_distancia_antes numeric`, `p_otimizacao_distancia_depois numeric`. O autor **não** é parâmetro: a RPC usa `auth.uid()`, para que a autoria não possa ser forjada pelo cliente.

- [ ] **Step 1: Gerar o arquivo da migration**

Use o skill `/new-migration` com o nome `auditoria_otimizacao_rotas`. Ele gera o timestamp `YYYYMMDDhhmmss` e os arquivos nos dois diretórios. Anote o timestamp gerado — os passos seguintes usam o mesmo nome nos dois diretórios.

- [ ] **Step 2: Escrever o DDL das colunas e do índice**

No arquivo criado, escreva:

```sql
-- Auditoria de uso do otimizador de rotas.
-- NULL em otimizacao_estado significa "sem registro" (rota criada antes desta
-- migration). NUNCA interpretar NULL como 'manual'.

ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS otimizacao_estado text,
  ADD COLUMN IF NOT EXISTS otimizacao_distancia_antes numeric,
  ADD COLUMN IF NOT EXISTS otimizacao_distancia_depois numeric,
  ADD COLUMN IF NOT EXISTS otimizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS otimizada_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.rotas
  DROP CONSTRAINT IF EXISTS rotas_otimizacao_estado_check;

ALTER TABLE public.rotas
  ADD CONSTRAINT rotas_otimizacao_estado_check
  CHECK (otimizacao_estado IS NULL OR otimizacao_estado IN ('otimizada', 'manual', 'otimizada_alterada'));

COMMENT ON COLUMN public.rotas.otimizacao_estado IS
  'otimizada | manual | otimizada_alterada. NULL = sem registro (rota anterior a esta feature).';

-- Índice para o filtro da listagem de rotas (unidade + estado).
CREATE INDEX IF NOT EXISTS idx_rotas_unidade_otimizacao
  ON public.rotas (unidade_id, otimizacao_estado);

-- FK sem índice vira scan em cascata de DELETE de usuario.
CREATE INDEX IF NOT EXISTS idx_rotas_otimizada_por
  ON public.rotas (otimizada_por);
```

- [ ] **Step 3: Estender a RPC `criar_rota_com_paradas`**

A função existe em `supabase/migrations/20260723223000_nova_entrega_drafts_atomic_route.sql`. **Copie a definição completa dela** para o fim da nova migration, mantendo tudo idêntico exceto as mudanças abaixo. Não reescreva a lógica de validação/idempotência — ela é o caminho crítico de criação de rota.

> **Por que não basta `CREATE OR REPLACE`:** no Postgres a identidade de uma função é **nome + tipos dos argumentos**. Acrescentar parâmetros cria um **overload novo** em vez de substituir a função de 8 parâmetros. Isso produz dois problemas graves: (1) o app chama com 8 parâmetros nomeados, que passariam a casar com as duas assinaturas — risco de `function is not unique` no caminho crítico de criação de rota; (2) o overload novo nasceria **sem os GRANTs**, herdando o default do schema — a mesma classe de falha que este repo já fechou em `20260622195500_security_revoke_definer_anon.sql` e `20260722195606_security_revoke_definer_anon_param.sql`.

Mudança 1 — **derrubar a assinatura antiga** antes de criar a nova. O `DROP` + `CREATE` roda na transação da migration, então não há janela sem a função:

```sql
DROP FUNCTION IF EXISTS public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb);
```

Mudança 2 — acrescentar os parâmetros **no fim** da assinatura, todos com DEFAULT:

```sql
  p_otimizacao_estado text DEFAULT NULL,
  p_otimizacao_distancia_antes numeric DEFAULT NULL,
  p_otimizacao_distancia_depois numeric DEFAULT NULL,
  p_otimizada_por uuid DEFAULT NULL
```

Mudança 3 — **reaplicar os grants na assinatura nova**, espelhando exatamente o que a função de 8 parâmetros tem hoje em produção (`postgres`, `authenticated`, `service_role` — sem `anon`):

```sql
REVOKE ALL ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb,
  text, numeric, numeric, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb,
  text, numeric, numeric, uuid) TO authenticated, service_role;
```

Mudança 4 — no `INSERT INTO public.rotas`, acrescentar as colunas e os valores (a lista de colunas atual termina em `client_request_id`):

```sql
    client_request_id,
    otimizacao_estado,
    otimizacao_distancia_antes,
    otimizacao_distancia_depois,
    otimizada_em,
    otimizada_por
  ) VALUES (
    -- ...valores existentes, até client_request_id...
    p_request_id,
    p_otimizacao_estado,
    p_otimizacao_distancia_antes,
    p_otimizacao_distancia_depois,
    CASE WHEN p_otimizacao_estado = 'otimizada' THEN now() ELSE NULL END,
    CASE WHEN p_otimizacao_estado = 'otimizada' THEN p_otimizada_por ELSE NULL END
```

Mudança 5 — logo depois do `INSERT INTO public.logs` que grava `rota_criada`, acrescentar o evento de otimização (só quando houve otimização):

```sql
  IF p_otimizacao_estado = 'otimizada' THEN
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
    VALUES (
      p_otimizada_por,
      v_rota_id,
      'rota_otimizada',
      jsonb_build_object(
        'distancia_antes', p_otimizacao_distancia_antes,
        'distancia_depois', p_otimizacao_distancia_depois
      )
    );
  END IF;
```

Use o mesmo nome de variável do `rota_id` que a função já usa (confira na definição original antes de colar).

- [ ] **Step 4: Copiar a migration para o segundo diretório**

```bash
cp database/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql supabase/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql
```

Confirme que ficaram idênticos:

```bash
diff database/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql supabase/migrations/<TIMESTAMP>_auditoria_otimizacao_rotas.sql && echo "IDENTICOS"
```

Esperado: `IDENTICOS`

- [ ] **Step 5: Revisar a migration com o agente de RLS**

Dispare o agente `rls-policy-reviewer` sobre o arquivo da migration. Ele deve retornar `APPROVE`. Se retornar `REQUEST_CHANGES`, corrija antes de seguir — **não** aplique a migration com pendência de RLS.

- [ ] **Step 6: Aplicar e verificar no banco**

Aplique a migration (via `supabase db push` ou a ferramenta MCP de migration, conforme o fluxo do projeto). Depois verifique:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='rotas'
  and column_name like 'otimiz%';
```

Esperado: 5 linhas, todas com `is_nullable = YES`.

E que o CHECK rejeita valor inválido:

```sql
update rotas set otimizacao_estado = 'qualquer_coisa' where id = (select id from rotas limit 1);
```

Esperado: erro `violates check constraint "rotas_otimizacao_estado_check"`.

- [ ] **Step 7: Regenerar os tipos**

Use o skill `/regenerate-supabase-types`. Confirme que `src/types/database.ts` passou a conter `otimizacao_estado`:

```bash
grep -c "otimizacao_estado" src/types/database.ts
```

Esperado: número maior que 0.

- [ ] **Step 8: Rodar type-check**

```bash
npm run type-check
```

Esperado: exit 0.

- [ ] **Step 9: Commit**

```bash
git add database/migrations supabase/migrations src/types/database.ts
git commit -m "feat: colunas de auditoria de otimizacao em rotas + RPC"
```

---

### Task 2: Capturar a distância "antes" no clique de otimizar

**Files:**

- Modify: `src/components/gestor/nova-entrega/types.ts` (tipo `RotaOtimizadaState`)
- Modify: `src/hooks/nova-entrega/useRouteOptimization.ts:58` (`otimizarRota`)
- Test: `src/hooks/nova-entrega/__tests__/useRouteOptimization.test.ts`

**Interfaces:**

- Consumes: nada da Task 1 (independente).
- Produces: `RotaOtimizadaState.distanciaAntesKm?: number | null` — preenchido quando a rota é otimizada e o cálculo da ordem original funciona; `null` quando o cálculo falha.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/hooks/nova-entrega/__tests__/useRouteOptimization.test.ts` (crie o arquivo se não existir, seguindo os mocks já usados em `src/lib/__tests__/routeUtils.test.ts` para `googleMapsService`):

```ts
it('guarda a distancia da ordem original ao otimizar', async () => {
  mockGetDirectionsSequential.mockResolvedValue({
    distanciaKm: 30.5,
    tempoMin: 40,
    polyline: 'abc',
  });

  const { result } = renderHook(() =>
    useRouteOptimization({ paradas, enderecoUnidade, showToast }),
  );

  await act(async () => {
    await result.current.otimizarRota();
  });

  expect(result.current.rotaOtimizada?.distanciaAntesKm).toBe(30.5);
});

it('nao bloqueia a otimizacao quando o calculo do "antes" falha', async () => {
  mockGetDirectionsSequential.mockRejectedValue(new Error('OSRM fora'));

  const { result } = renderHook(() =>
    useRouteOptimization({ paradas, enderecoUnidade, showToast }),
  );

  await act(async () => {
    await result.current.otimizarRota();
  });

  expect(result.current.rotaOtimizada).not.toBeNull();
  expect(result.current.rotaOtimizada?.distanciaAntesKm).toBeNull();
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npx jest src/hooks/nova-entrega/__tests__/useRouteOptimization.test.ts -t "distancia da ordem original"
```

Esperado: FAIL — `distanciaAntesKm` é `undefined`.

- [ ] **Step 3: Acrescentar o campo ao tipo**

Em `src/components/gestor/nova-entrega/types.ts`, dentro de `RotaOtimizadaState`:

```ts
  /**
   * Distância (km) da ordem em que as paradas estavam ANTES da otimização.
   * null quando o cálculo falhou — o ganho fica desconhecido, mas a
   * otimização acontece normalmente.
   */
  distanciaAntesKm?: number | null;
```

- [ ] **Step 4: Calcular o "antes" antes de otimizar**

Em `src/hooks/nova-entrega/useRouteOptimization.ts`, dentro de `otimizarRota`, logo após `setIsOptimizing(true)` e antes do `if (temVinculos)`:

```ts
// Distância na ordem atual, para medir o ganho da otimização.
// Falha aqui não pode impedir a otimização: o ganho vira desconhecido.
let distanciaAntesKm: number | null = null;
try {
  const rotaAtual = await googleMapsService.getDirectionsSequential(
    pontoUnidade,
    pontoUnidade,
    paradasParaValidar.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  );
  distanciaAntesKm = rotaAtual?.distanciaKm ?? null;
} catch (error) {
  logger.warn(
    '[useRouteOptimization] Falha ao medir a distância antes da otimização',
    error,
  );
}
```

Depois, em **cada** ponto que chama `setRotaOtimizada(...)` dentro de `otimizarRota`, inclua `distanciaAntesKm` no objeto gravado. Confira os dois ramos (`temVinculos` e o caminho direto) — ambos precisam do campo.

- [ ] **Step 5: Rodar os testes e ver passar**

```bash
npx jest src/hooks/nova-entrega/__tests__/useRouteOptimization.test.ts
```

Esperado: PASS nos dois testes.

- [ ] **Step 6: Commit**

```bash
git add src/components/gestor/nova-entrega/types.ts src/hooks/nova-entrega/useRouteOptimization.ts src/hooks/nova-entrega/__tests__/useRouteOptimization.test.ts
git commit -m "feat: medir distancia da ordem original ao otimizar"
```

---

### Task 3: Enviar a auditoria na criação da rota

**Files:**

- Modify: `src/hooks/nova-entrega/useRouteCreation.ts:188-197`
- Test: `src/hooks/nova-entrega/__tests__/useRouteCreation.test.ts`

**Interfaces:**

- Consumes: `RotaOtimizadaState.distanciaAntesKm` (Task 2); parâmetros novos da RPC (Task 1).
- Produces: rota gravada com `otimizacao_estado` preenchido.

- [ ] **Step 0: Descobrir de onde vem `routeData` (não pule)**

`useRouteCreation.ts:193` já envia `routeData.distanciaKm` à RPC. Antes de injetar qualquer coisa nova, descubra o que é `routeData`:

```bash
grep -n "routeData" src/hooks/nova-entrega/useRouteCreation.ts | head -20
grep -rn "routeData" src/hooks/useNovaEntrega.ts | head -10
```

Dois cenários possíveis:

- **`routeData` já é derivado de `rotaOtimizada`** (provável): então **não injete `rotaOtimizada`**. Basta propagar `distanciaAntesKm` até `routeData` e injetar só `ordemManual`. Nos passos abaixo, leia `routeData.distanciaAntesKm` e `routeData.distanciaKm`.
- **`routeData` é montado de outra fonte**: aí injete `rotaOtimizada` e `ordemManual` pelas opções do hook, como as outras dependências já são injetadas.

Escolha um caminho e siga-o de forma consistente pelo resto da tarefa. **Não crie duas fontes para a mesma distância** — é exatamente o tipo de duplicação que faz os dois números divergirem depois.

Os exemplos abaixo assumem o primeiro cenário; se for o segundo, troque `routeData` por `rotaOtimizada` nas leituras.

- [ ] **Step 1: Escrever o teste que falha**

```ts
const routeDataOtimizada = {
  distanciaKm: 25.9,
  tempoMin: 34,
  polyline: 'x',
  distanciaAntesKm: 30.5,
};
// Sem otimização, distanciaAntesKm nem existe no objeto.
const routeDataManual = { distanciaKm: 30.5, tempoMin: 40, polyline: 'x' };

it('envia estado "otimizada" quando o gestor otimizou e nao mexeu depois', async () => {
  const { result } = renderHook(() =>
    useRouteCreation({
      ...baseOptions,
      routeData: routeDataOtimizada,
      ordemManual: false,
    }),
  );

  await act(async () => {
    await result.current.criarRota();
  });

  expect(mockRpc).toHaveBeenCalledWith(
    'criar_rota_com_paradas',
    expect.objectContaining({
      p_otimizacao_estado: 'otimizada',
      p_otimizacao_distancia_antes: 30.5,
      p_otimizacao_distancia_depois: 25.9,
    }),
  );
});

it('envia estado "manual" quando o gestor nao otimizou', async () => {
  const { result } = renderHook(() =>
    useRouteCreation({
      ...baseOptions,
      routeData: routeDataManual,
      ordemManual: false,
    }),
  );

  await act(async () => {
    await result.current.criarRota();
  });

  expect(mockRpc).toHaveBeenCalledWith(
    'criar_rota_com_paradas',
    expect.objectContaining({ p_otimizacao_estado: 'manual' }),
  );
});

it('envia estado "manual" quando o gestor otimizou mas alterou a ordem depois', async () => {
  const { result } = renderHook(() =>
    useRouteCreation({
      ...baseOptions,
      routeData: routeDataOtimizada,
      ordemManual: true,
    }),
  );

  await act(async () => {
    await result.current.criarRota();
  });

  expect(mockRpc).toHaveBeenCalledWith(
    'criar_rota_com_paradas',
    expect.objectContaining({ p_otimizacao_estado: 'manual' }),
  );
});

it('mantem "otimizada" mesmo quando o calculo do "antes" falhou', async () => {
  const { result } = renderHook(() =>
    useRouteCreation({
      ...baseOptions,
      routeData: { ...routeDataOtimizada, distanciaAntesKm: null },
      ordemManual: false,
    }),
  );

  await act(async () => {
    await result.current.criarRota();
  });

  expect(mockRpc).toHaveBeenCalledWith(
    'criar_rota_com_paradas',
    expect.objectContaining({
      p_otimizacao_estado: 'otimizada',
      p_otimizacao_distancia_antes: null,
    }),
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx jest src/hooks/nova-entrega/__tests__/useRouteCreation.test.ts -t "otimizacao"
```

Esperado: FAIL — os parâmetros não são enviados.

- [ ] **Step 3: Derivar o estado e enviá-lo**

Em `src/hooks/nova-entrega/useRouteCreation.ts`, antes da chamada `supabase.rpc`:

```ts
// Otimizou e manteve a ordem do otimizador => 'otimizada'.
// Não otimizou, ou otimizou e depois arrastou => 'manual'.
// `foiOtimizada` é verdadeiro quando a distância "antes" foi medida,
// o que só acontece dentro do fluxo de otimização (Task 2).
const foiOtimizada = routeData.distanciaAntesKm !== undefined;
const otimizacaoEstado = foiOtimizada && !ordemManual ? 'otimizada' : 'manual';
```

E acrescente os quatro parâmetros ao objeto da RPC, depois de `p_paradas`:

```ts
        p_paradas: rpcStops,
        p_otimizacao_estado: otimizacaoEstado,
        p_otimizacao_distancia_antes:
          otimizacaoEstado === 'otimizada'
            ? (routeData.distanciaAntesKm ?? null)
            : null,
        p_otimizacao_distancia_depois:
          otimizacaoEstado === 'otimizada' ? (routeData.distanciaKm ?? null) : null,
```

> **Não envie o autor.** A RPC resolve o autor com `auth.uid()` do lado do servidor. Mandar o id pelo cliente permitiria a um gestor forjar a autoria da otimização — o que anularia o propósito da auditoria. Achado do `rls-policy-reviewer` na Task 1.

**Cuidado com o `undefined` vs `null`:** `distanciaAntesKm` é `null` quando a otimização rodou mas o cálculo do "antes" falhou (ainda é `'otimizada'`), e `undefined` quando não houve otimização nenhuma (`'manual'`). Não colapse os dois com `??` na hora de decidir o estado.

Se `userData` ainda não estiver disponível neste hook, injete-o pelas opções junto com `rotaOtimizada` e `ordemManual` — não busque o usuário de novo aqui.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx jest src/hooks/nova-entrega/__tests__/useRouteCreation.test.ts
```

Esperado: PASS nos três testes.

- [ ] **Step 5: Rodar a suíte inteira da Nova Entrega**

Este hook é o caminho crítico de criação de rota; a suíte inteira precisa continuar verde.

```bash
npx jest --testPathPattern="nova-entrega"
```

Esperado: todas as suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/nova-entrega/useRouteCreation.ts src/hooks/nova-entrega/__tests__/useRouteCreation.test.ts
git commit -m "feat: gravar estado de otimizacao ao criar rota"
```

---

### Task 4: Marcar `otimizada_alterada` na reordenação manual

**Files:**

- Modify: `src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts:407-416`
- Test: `src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts`

**Interfaces:**

- Consumes: coluna `rotas.otimizacao_estado` (Task 1).
- Produces: transição de estado + `detalhes.desfez_otimizacao` no log `paradas_reordenadas`, consumido pela Task 5.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('marca otimizada_alterada quando reordena uma rota otimizada', async () => {
  const { result } = renderHook(() =>
    useMapaRotaHandlers({
      ...baseOptions,
      rota: { ...rotaBase, otimizacao_estado: 'otimizada' },
    }),
  );

  await act(async () => {
    await result.current.handleReorderParadas(newOrder);
  });

  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ otimizacao_estado: 'otimizada_alterada' }),
  );
});

it('nao mexe no estado de uma rota sem registro', async () => {
  const { result } = renderHook(() =>
    useMapaRotaHandlers({
      ...baseOptions,
      rota: { ...rotaBase, otimizacao_estado: null },
    }),
  );

  await act(async () => {
    await result.current.handleReorderParadas(newOrder);
  });

  expect(mockUpdate).not.toHaveBeenCalledWith(
    expect.objectContaining({ otimizacao_estado: expect.anything() }),
  );
});

it('registra desfez_otimizacao no log quando desfaz a otimizacao', async () => {
  const { result } = renderHook(() =>
    useMapaRotaHandlers({
      ...baseOptions,
      rota: { ...rotaBase, otimizacao_estado: 'otimizada' },
    }),
  );

  await act(async () => {
    await result.current.handleReorderParadas(newOrder);
  });

  expect(mockLogInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      evento: 'paradas_reordenadas',
      detalhes: expect.objectContaining({ desfez_otimizacao: true }),
    }),
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx jest src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts -t "otimiza"
```

Esperado: FAIL nos três.

- [ ] **Step 3: Implementar a transição**

Em `useMapaRotaHandlers.ts`, entre o recálculo (passo 2, termina na linha 405) e o log (passo 3, linha 408):

```ts
// Reordenar à mão desfaz a otimização. Rota sem registro (NULL)
// permanece sem registro — não inventamos o passado dela.
const desfezOtimizacao = rota.otimizacao_estado === 'otimizada';
if (desfezOtimizacao) {
  const { error: estadoError } = await supabase
    .from('rotas')
    .update({ otimizacao_estado: 'otimizada_alterada' })
    .eq('id', id);
  if (estadoError) {
    logger.warn(
      '[useMapaRotaHandlers] Falha ao marcar otimização desfeita',
      estadoError,
    );
  }
}
```

E no `detalhes` do log já existente, acrescente a chave:

```ts
          detalhes: {
            nova_ordem: newOrder.map((p) => ({ id: p.id, ordem: p.ordem })),
            alterado_por: userData?.nome,
            desfez_otimizacao: desfezOtimizacao,
          },
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx jest src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts
```

Esperado: todos PASS.

- [ ] **Step 5: Confirmar que adicionar parada NÃO altera o estado**

`useAddStopForm.ts:236` também chama `recalcularRota`. Confirme que nenhuma alteração foi feita lá:

```bash
grep -n "otimizacao_estado" src/components/gestor/mapa-rota/useAddStopForm.ts
```

Esperado: nenhuma saída (Decisão 6 do spec).

- [ ] **Step 6: Commit**

```bash
git add src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts
git commit -m "feat: marcar otimizacao desfeita ao reordenar a mao"
```

---

### Task 5: Timeline narra a otimização

**Files:**

- Modify: `src/lib/timeline.ts:17-32` (lista de eventos) e o mapper `mapLogToTimelineEvent`
- Test: `src/lib/__tests__/timeline.test.ts`

**Interfaces:**

- Consumes: evento `rota_otimizada` (Task 1) e `detalhes.desfez_otimizacao` (Task 4).
- Produces: nada para tarefas seguintes.

Atenção: `mapLogToTimelineEvent` retorna `null` para evento fora de `TIMELINE_LOG_EVENTS` (`timeline.ts:465`). Sem o passo 3, o evento gravado no banco fica invisível.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('narra a otimizacao com o ganho', () => {
  const evento = mapLogToTimelineEvent({
    id: '1',
    evento: 'rota_otimizada',
    timestamp: '2026-08-04T12:00:00Z',
    detalhes: { distancia_antes: 30.5, distancia_depois: 25.9 },
    usuario_id: 'u1',
  });

  expect(evento).not.toBeNull();
  expect(evento?.titulo).toBe('Rota otimizada');
  expect(evento?.descricao).toContain('30.5');
  expect(evento?.descricao).toContain('25.9');
});

it('narra otimizacao sem ganho conhecido quando falta o "antes"', () => {
  const evento = mapLogToTimelineEvent({
    id: '2',
    evento: 'rota_otimizada',
    timestamp: '2026-08-04T12:00:00Z',
    detalhes: { distancia_antes: null, distancia_depois: 25.9 },
    usuario_id: 'u1',
  });

  expect(evento).not.toBeNull();
  expect(evento?.descricao).not.toContain('null');
});

it('sinaliza quando a reordenacao desfez a otimizacao', () => {
  const evento = mapLogToTimelineEvent({
    id: '3',
    evento: 'paradas_reordenadas',
    timestamp: '2026-08-04T12:00:00Z',
    detalhes: { alterado_por: 'Amanda', desfez_otimizacao: true },
    usuario_id: 'u1',
  });

  expect(evento?.descricao).toContain('desfez a otimização');
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx jest src/lib/__tests__/timeline.test.ts -t "otimiza"
```

Esperado: FAIL — o primeiro retorna `null`.

- [ ] **Step 3: Registrar o evento na lista canônica**

Em `src/lib/timeline.ts`, acrescente a entrada ao array `TIMELINE_LOG_EVENTS` (após `'paradas_reordenadas'`):

```ts
  'rota_otimizada',
```

- [ ] **Step 4: Mapear o evento**

No `mapLogToTimelineEvent`, junto dos outros `case`, acrescente:

```ts
    case 'rota_otimizada': {
      const antes = log.detalhes?.distancia_antes as number | null | undefined;
      const depois = log.detalhes?.distancia_depois as number | null | undefined;
      const descricao =
        typeof antes === 'number' && typeof depois === 'number'
          ? `${antes.toFixed(1)} km → ${depois.toFixed(1)} km`
          : 'Ordem definida pelo otimizador';
      return {
        ...base,
        titulo: 'Rota otimizada',
        descricao,
      };
    }
```

Use exatamente a mesma forma de montar o objeto de retorno (`base`, ícone, cor) que os `case` vizinhos usam — copie o padrão do `case 'paradas_reordenadas'`.

- [ ] **Step 5: Acrescentar a nuance em `paradas_reordenadas`**

No `case 'paradas_reordenadas'` existente (`timeline.ts:423-435`), componha a descrição:

```ts
const desfez = log.detalhes?.desfez_otimizacao === true;
const descricao = desfez
  ? `Ordem alterada por ${autor} — desfez a otimização`
  : `Ordem alterada por ${autor}`;
```

Reaproveite a variável de autor que o `case` já usa; não crie outra.

- [ ] **Step 6: Rodar e ver passar**

```bash
npx jest src/lib/__tests__/timeline.test.ts
```

Esperado: todos PASS.

- [ ] **Step 7: Validação final da fase**

```bash
npm run type-check && npm run lint && npx jest --testPathPattern="timeline|nova-entrega|mapa-rota"
```

Esperado: exit 0 nos três.

- [ ] **Step 8: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts
git commit -m "feat: timeline narra otimizacao e otimizacao desfeita"
```

---

## Verificação de aceite da Fase 1

Depois das cinco tarefas, com a migration aplicada, valide o ciclo real (não só os testes):

1. Crie uma rota **usando** o botão "Otimizar melhor percurso". Confira no banco:

```sql
select otimizacao_estado, otimizacao_distancia_antes, otimizacao_distancia_depois, otimizada_por
from rotas order by created_at desc limit 1;
```

Esperado: `'otimizada'`, as duas distâncias preenchidas, autor preenchido.

2. Crie uma rota **sem** otimizar. Esperado: `'manual'`, distâncias `NULL`.
3. Na rota otimizada, use "Reordenar" no mapa. Esperado: estado vira `'otimizada_alterada'` e a Timeline mostra "desfez a otimização".
4. Abra qualquer rota antiga. Esperado: `otimizacao_estado` continua `NULL` — e a tela segue idêntica ao que era (esta fase não muda UI).

## Fora do escopo desta fase

Fase 2 (chip na tela da rota, indicador/filtro/contador na Gestão de Rotas) tem plano próprio, escrito depois que esta fase estiver em produção — com dado real acumulando, as decisões de UI ficam mais concretas.
