# Varredura de refatorações — trilha `lib` — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir B1 (aviso de rota estimada some no painel web) e B10 (resumo `rota_finalizada` inalcançável), unificar a série das filas offline e os utilitários de dígitos/telefone, e apagar o código morto de `src/lib` mantido vivo só por teste ou reexport.

**Architecture:** Uma branch, um commit por tarefa, cada um verde sozinho. B1 sai apagando `google.web.ts` (o Metro o escolhia no web e o Jest nunca o carregava) e deixando um conversor OSRM→resultado só em `google.ts`. As filas ganham `criarSerie` (`src/lib/serie.ts`) e `lerJsonParaExibir` (`src/lib/leituraLocal.ts`), sem tocar em retry, dono, geração ou política de erro de cada fila. O código morto sai por último, depois das tarefas que mexem nos mesmos arquivos.

**Tech Stack:** TypeScript, Expo/React Native (Metro escolhe `.web.ts` por extensão), Jest (jest-expo, resolve sempre a variante nativa), AsyncStorage, Zod.

**Spec:** `docs/superpowers/2026-11-03-varredura-refatoracoes.md` (branch `docs/varredura-refatoracoes-03-11`), itens 1.1, 1.7, 1.9, 1.10 e 0.2, mais os bugs B1 e B10. Relatório de origem: `3-lib.md` da varredura (achados 1, 2, 4, 8 e B2). Leia também `CLAUDE.md` e `docs/PROJECT_CONTEXT.md` (Armadilhas).

## Global Constraints

- TDD: escreva o teste, **veja-o falhar** pelo motivo certo, e só então implemente. Tarefa de pura deleção prova pelo `git grep` sem importador + `tsc` + Jest (não há vermelho possível para "apagar").
- Branch própria `refactor/varredura-lib`, num worktree em `.claude/worktrees/varredura-lib`, a partir de `c64859af`.
- Nunca `--no-verify`.
- Nunca escrever em banco nem em rede.
- Jest dentro do worktree: `npx jest <caminhos> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. **Caminho de teste ANTES das opções** (depois de `--testPathIgnorePatterns=` ele vira padrão de exclusão, ver Armadilhas). Confira que a contagem `Tests:` é maior que zero: se for 0, o padrão casou com o caminho do worktree.
- Verificação final: suíte inteira do Jest, `npm run type-check`, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`, `npm run build:web` (esta trilha toca código que vai para o web) e `npm run scan:morto:arquivos`.
- Sem push. O coordenador abre o PR.
- Commits em PT-BR no estilo do repo (`fix(...)`, `refactor(...)`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O pre-commit reformata e pode deixar ruído CRLF: confira com `git diff --ignore-cr-at-eol` e descarte o que for só fim de linha.
- Arquivos proibidos nesta trilha: `src/services/locationTracking.ts`, `src/components/**`, `app/**`, `src/hooks/route-status/**`, `src/lib/gestor/**`, `.github/**`.
- Não apagar `logAction`/`logRotaAction` (`src/lib/queries/logs.ts`, usados pelo item 1.5) nem nada de `src/lib/statusLabels.ts` (item 1.3).
- O CI roda `npm test -- --coverage` com `coverageThreshold` global (branches 65, functions 72, lines 73, statements 72, folga de cerca de 1 ponto). Apagar código morto **coberto** baixa a porcentagem. Se um limiar cair, pare e reporte ao coordenador. Não baixe o limiar por conta própria.

## Ajustes em relação ao spec

Conferidos no código em `c64859af`:

1. **B1 é maior que o descrito.** Além do `.web` derrubar os dois campos, `google.ts:162-182` (`getDirectionsSequentialWithError`) também não repassa `sem_rota_entre_paradas`. Hoje isso não aparece, porque o OSRM só marca o campo no caminho otimizado (`osrm/api.ts:453,461`), mas é a mesma cópia divergente. O conversor único (Task 1) fecha os três casos.
2. **`google.web.test.ts` não é um teste "sequencial".** Cobre OSRM e fallback Haversine nos dois métodos (inclusive `AbortError` e `TypeError`), pela variante nativa. O nome passa a ser `google.fallback-haversine.test.ts`, que diz o que o arquivo testa, em vez de `google.sequencial.test.ts`.
3. **Dois testes fixam B10, não um.** Além de `timeline.test.ts:437`, `src/lib/__tests__/utils.test.ts:138-153` afirma `finalizada?.title` `toContain('Rota')`. Com o conserto, o título passa a ser "Resumo Confirmado", então esse teste também muda. O preview (`mapLogToTimelinePreview`) continua mapeando `rota_finalizada` para "Rota concluída"/`conclusao` (`timeline.test.ts:150`). Isso fica de propósito: nenhum código grava o evento, e mudar o preview é decisão de produto fora do bug.
4. **1.7: `armazenamentoLocal.ts` vira dois lugares.** `criarSerie` vai para `src/lib/serie.ts`, que não depende do AsyncStorage. `lerJsonParaExibir` vai para `src/lib/leituraLocal.ts`, ao lado de `lerJsonParaGravar`, porque o cabeçalho desse arquivo já define a regra das leituras para exibir. Há uma **5ª leitura** igual que o spec não cita: `offline.ts:272` (`getOfflinePhotosIndex`). `aplicarAcoesNaRotaGuardada` (ler, modificar e gravar dentro da série, com `catch` que não grava) fica como está.
5. **1.9 quase todo fora desta trilha.** As cópias citadas no spec estão em arquivos proibidos aqui: `formatPhone` local em `app/perfil/editar.tsx:29` e `app/motorista/perfil/editar.tsx:23`, `formatCnpj` em `app/unidade/index.tsx:72`, WhatsApp/`tel:` em `ParadaCard*`, e a regra 10/11 em `BulkStopImporter.tsx:146`. Nesta trilha: `soDigitos` (`src/lib/documentos.ts`), `telefoneComDDD` (`phone.ts`), a remoção dos 3 aliases mortos e a troca nos schemas de `src/lib/schemas/`. `formatCnpj` **não** é criado: o único chamador é `app/unidade/index.tsx`, e ele muda de lugar junto com esse chamador (repasse abaixo). O nome `telefoneValido` do spec vira `telefoneComDDD`, porque `validatePhone` (mais estrito: DDD ≥ 11, 9º dígito, dígitos repetidos) já existe, e "válido" para os dois confundiria. `viacep.ts` fica intocado (contrato de `maskCEP`/`formatCEP`), e `src/hooks/useNovaEntrega*.ts` também (trilha gestor).
6. **0.2, o que foi confirmado e o que saiu do escopo.**
   - Confirmado sem importador de produção: `type-guards.ts`; `utils/timeEstimation.ts`; os adaptadores Routes API de `google-shared.ts` (vivos por **reexport** de `google.ts:28-33`, não por teste: `google-shared` não tem teste); `offline.ts:507-555` com `OfflineData`/`OFFLINE_DATA_KEY`; `cache.ts` (`getCacheWithFetch`, `invalidateRelatedCaches`); `queries/paradas.ts` (12 de 14 funções mortas, vivas `updateParadaStatus` e `logParadaAction`); `queries/incidentes.ts` (5 de 8 mortas, vivas `fetchIncidentesForGestor`, `createIncidente` e `logIncidenteAction`); `queryClient.buildCacheKey`. `withRetry` e `safeQuery` ficam, porque `incidentes`, `paradas` e `usuarios` os usam por dentro.
   - Fora desta trilha: os barrels `lib/utils.ts` e `lib/routeOptimization.ts` (importados por `src/components/**`); `statusLabels.ts` (1.3); `queries/logs.ts` (1.5); `styles.base.ts`, `useAuth.clearMockSession`, `errorHandling.showConfirmation` e `icons.isValidIconName` (fora de `src/lib`, vão para a 0.1).
   - Nenhum teste apagado é guarda estática (nenhum usa `readFileSync`).
7. **Repasses para outras trilhas** (o coordenador redistribui):
   - Comentário de `src/components/gestor/mapa-rota/RouteInfoHeader.tsx:35`, que cita `type-guards.ts` (some com a 0.3).
   - Troca das cópias de telefone e CNPJ em `app/**` e `src/components/**`. `formatCnpj` vai para `src/lib/documentos.ts` na trilha que tocar `app/unidade/index.tsx`, e `BulkStopImporter` passa a usar `telefoneComDDD`.

## Review Focus

1. **O bundle web ainda levar o código do `.web`** (cache do Metro ou export residual). Espera-se que o `dist` não contenha `[OSRM.web]` e contenha `[OSRM Sequential]`. Pinado na Task 1, Step 7.
2. **A série "imediata" das fotos ganhar microtarefas** por uma camada `async` a mais (`criarSerie` ou `getOfflinePhotosIndex` virando `async` que devolve outra promessa). Espera-se que `offline-foto-sem-esperar-refresh.test.ts` siga verde sem mudar o laço de 20 microtarefas. Pinado na Task 3, Steps 1 e 6.
3. **Evento de log em maiúsculas ou com `detalhes` nulo** (`ROTA_FINALIZADA`, `detalhes: null`). Espera-se "Resumo Confirmado" com "0 concluída(s), 0 pulada(s)", sem cair no ramo de substring. Pinado na Task 2, Step 1.
4. **Lista guardada como JSON `null`** (ou leitura que lança) numa leitura para exibir. Espera-se o vazio do chamador, nunca `null` onde a fila espera `[]`, e nada gravado. Pinado na Task 3, Step 1.
5. **Telefone com `+55` (12/13 dígitos) no schema de parada.** Hoje é recusado (regra 10/11), e a troca para `telefoneComDDD` não pode passar a aceitá-lo em silêncio. Pinado na Task 4, Step 1.

---

### Task 0: Worktree e linha de base

**Files:** nenhum versionado.

- [ ] **Step 1: Criar o worktree**

Run: `git worktree add .claude/worktrees/varredura-lib -b refactor/varredura-lib c64859af`, depois `npm ci` dentro dele (o `postinstall` copia o worker do maplibre).
Expected: `git -C .claude/worktrees/varredura-lib log -1 --oneline` mostra `c64859af`.

- [ ] **Step 2: Medir a linha de base (dentro do worktree)**

Run: `npx jest --coverage --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: suíte verde, `Tests:` > 0. Anote o número de testes e as 4 porcentagens globais. É contra elas que a Task 9 compara.

---

### Task 1: `google.web.ts` fora e um conversor OSRM→resultado (1.1, corrige B1)

**Files:**

- Delete: `src/lib/google.web.ts`
- Modify: `src/lib/google.ts:84-108,161-182` (as duas conversões viram uma chamada)
- Rename: `src/lib/__tests__/google.web.test.ts` → `src/lib/__tests__/google.fallback-haversine.test.ts` (`git mv`; o `describe` passa a dizer o que testa, e saem os `Platform.OS = 'web'`, que não mudavam nada)
- Create: `src/lib/__tests__/variantes-web-lib.test.ts`
- Modify: `src/lib/__tests__/google.osrm-mock.test.ts` (casos novos)
- Modify: `supabase/functions/_shared/__tests__/configFuncoes.test.ts:55-61` (lê `src/lib/google.ts`)
- Modify: `jest.config.js:28-31` (sai `'!src/lib/google.web.ts'` e o comentário passa a citar só `navigation.web.ts`)
- Modify: `src/lib/google-shared.ts:4,30,227,271` (comentários que citam `google.web.ts`)

**Interfaces:**

- Produces: em `google.ts`, a função de módulo (não exportada) `osrmParaResultadoGoogle(osrm: DirectionsResult, ordemOtimizada: number[]): GoogleDirectionsResult`. Ela copia `polyline`, as distâncias, `legs` e `is_estimated: osrm.is_estimated === true`, e põe `sem_rota_entre_paradas: true` só quando o OSRM o marcou. `DirectionsResult` vem de `@/lib/osrm`. O contrato público de `googleMapsService` não muda.

- [ ] **Step 1: Escrever os testes que falham**

`variantes-web-lib.test.ts`:

```ts
it('as variantes .web de src/lib são só as que têm motivo de plataforma', () => {
  const web = readdirSync(join(__dirname, '..'))
    .filter((f) => /\.web\.tsx?$/.test(f))
    .sort();
  // google.web.ts divergiu de google.ts (B1) e o Jest nunca o carregava.
  expect(web).toEqual(['navigation.web.ts', 'supabase.web.ts']);
});
```

Em `google.osrm-mock.test.ts`, com `getOptimizedDirections` mockado para devolver `{ …, is_estimated: true, sem_rota_entre_paradas: true }`:

```ts
it('getDirectionsSequentialWithError repassa is_estimated e sem_rota_entre_paradas', async () => {
  const r = await googleMapsService.getDirectionsSequentialWithError(a, b, [c]);
  expect(r.data).toMatchObject({
    is_estimated: true,
    sem_rota_entre_paradas: true,
    ordem_otimizada: [],
  });
});
it('sem o aviso do OSRM, o resultado não ganha sem_rota_entre_paradas', async () => {
  // mock sem os dois campos
  expect(r.data?.is_estimated).toBe(false);
  expect(r.data).not.toHaveProperty('sem_rota_entre_paradas');
});
```

(o segundo caso vale para os dois métodos: use `it.each` sobre `getDirectionsWithError` e `getDirectionsSequentialWithError`)

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/lib/__tests__/variantes-web-lib.test.ts src/lib/__tests__/google.osrm-mock.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL. A lista inclui `google.web.ts`, e o caso sequencial não tem `sem_rota_entre_paradas`.

- [ ] **Step 3: Implementar**

Apague `google.web.ts`. Extraia `osrmParaResultadoGoogle`: `getDirectionsWithError` passa `osrm.ordem_otimizada` e o sequencial passa `[]`. Faça o `git mv` do teste. Ajuste `configFuncoes.test.ts` para ler `google.ts` (mesma asserção: não contém `google-distance-matrix`), além do `jest.config.js` e dos comentários de `google-shared.ts`.

- [ ] **Step 4: Ver passar**

Run: `npx jest src/lib/__tests__/variantes-web-lib.test.ts src/lib/__tests__/google src/hooks/nova-entrega supabase/functions/_shared --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS, `Tests:` > 0.

- [ ] **Step 5: Tipos**

Run: `npm run type-check`
Expected: sem erro.

- [ ] **Step 6: Build web**

Run: `npm run build:web`
Expected: termina sem erro.

- [ ] **Step 7: Provar no bundle que o web usa o `google.ts`**

Run: `grep -rl "OSRM.web" dist/ ; grep -rl "OSRM Sequential" dist/`
Expected: o primeiro não imprime nada, e o segundo imprime ao menos um `.js`.

- [ ] **Step 8: Commit**

```bash
git add -A src/lib supabase/functions/_shared/__tests__/configFuncoes.test.ts jest.config.js
git commit -m "fix(rotas): web volta a avisar rota estimada; google.web.ts apagado e conversor único do OSRM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Validação manual (coordenador, fora do subagente): no dev web, com o serviço viário falhando, Nova Rota mostra o aviso de ordem estimada.

---

### Task 2: Timeline, eventos conhecidos antes das substrings (1.10, corrige B10)

**Files:**

- Modify: `src/lib/timeline.ts:244-370` (`mapLogToTimelineEvent`)
- Test: `src/lib/__tests__/timeline.test.ts:437-452` (invertido) e casos novos
- Test: `src/lib/__tests__/utils.test.ts:138-153` (fixa o mesmo defeito)

**Interfaces:**

- Produces: nada novo exportado. Constante de módulo `EVENTOS_CONHECIDOS: ReadonlySet<string>` a partir de `TIMELINE_LOG_EVENTS`.

Alternativas: (A) só subir o ramo `rota_finalizada` acima dos `includes`; (B) evento de `TIMELINE_LOG_EVENTS` nunca entra num ramo de substring, que fica só para eventos legados fora da lista; (C) trocar todas as substrings por igualdade. **Escolhida: B.** A corrige só esta instância, e um evento novo com "start", "cancel" ou "finaliz" no nome cairia no mesmo buraco. C descarta logs legados que `isTimelineLogEvent` ainda conta, e não dá para medir no banco quantos existem (sem consultas nesta trilha).

- [ ] **Step 1: Escrever os testes que falham**

Em `timeline.test.ts`, troque o `it` da linha 437 por:

```ts
it('rota_finalizada mostra o resumo, não "Rota Concluída"', () => {
  expect(
    map('rota_finalizada', { paradas_concluidas: 8, paradas_puladas: 2 }),
  ).toMatchObject({
    title: 'Resumo Confirmado',
    description: '8 concluída(s), 2 pulada(s)',
    icon: 'document-text',
    colorKey: 'blue',
  });
});
it('ROTA_FINALIZADA sem detalhes: resumo com zeros', () => {
  expect(map('ROTA_FINALIZADA', null)).toMatchObject({
    title: 'Resumo Confirmado',
    description: '0 concluída(s), 0 pulada(s)',
  });
});
it.each(
  TIMELINE_LOG_EVENTS.filter(
    (e) =>
      ![
        'motorista_iniciou_rota',
        'motorista_concluiu_rota',
        'rota_cancelada',
      ].includes(e),
  ),
)('%s não é capturado pelos ramos de substring de status', (evento) => {
  expect(['Rota Iniciada', 'Rota Concluída', 'Rota Cancelada']).not.toContain(
    map(evento, {})?.title,
  );
});
it('evento legado fora da lista ainda passa pelas substrings', () => {
  expect(map('motorista_finalizou', null)?.title).toBe('Rota Concluída');
});
```

(`map(evento, detalhes)` é um helper local que chama `mapLogToTimelineEvent({ id, evento, timestamp: ts, detalhes })`)

Em `utils.test.ts:153`, troque `toContain('Rota')` por `expect(finalizada?.title).toBe('Resumo Confirmado')`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/lib/__tests__/timeline.test.ts src/lib/__tests__/utils.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos casos `rota_finalizada`/`ROTA_FINALIZADA` e no `utils.test` (título "Rota Concluída").

- [ ] **Step 3: Implementar**

Nos três ramos de status de `mapLogToTimelineEvent`, a substring só vale para evento fora de `EVENTOS_CONHECIDOS`, e a igualdade com o evento canônico continua. `mapLogToTimelinePreview` e `isTimelineLogEvent` não mudam (ver Ajuste 3).

- [ ] **Step 4: Ver passar**

Run: o mesmo comando do Step 2, mais `src/hooks/gestao-rotas`.
Expected: PASS, `Tests:` > 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts src/lib/__tests__/utils.test.ts
git commit -m "fix(timeline): rota_finalizada mostra o resumo; evento conhecido não cai em substring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Série e leitura para exibir das filas offline (1.7)

**Files:**

- Create: `src/lib/serie.ts`
- Create: `src/lib/__tests__/serie.test.ts`
- Modify: `src/lib/leituraLocal.ts` (acrescenta `lerJsonParaExibir`) e `src/lib/__tests__/leituraLocal.test.ts`
- Modify: `src/lib/offline.ts:110-133` (`emSerieNoIndice`) e `:272-280` (`getOfflinePhotosIndex`)
- Modify: `src/lib/motorista/filaAcoesParada.ts:137-153` (`emSerie`, `lerLista`)
- Modify: `src/lib/motorista/filaPosicoes.ts:300-318` (`emSerie`, `ler`)
- Modify: `src/lib/motorista/rotaGuardada.ts:45-53` (`emSerie`) e `:106-118` (`lerRotaGuardada`)

**Interfaces:**

- Produces: `criarSerie(opcoes?: { imediato?: boolean }): <T>(fn: () => Promise<T>) => Promise<T>`. Cada chamada cria uma série independente (estado no fechamento). O padrão encadeia sempre por `cadeia.then(fn, fn)`. Com `imediato: true` e a série livre, chama `fn()` na hora e libera a série (volta a `null`) quando o último passo termina: é o algoritmo exato de `emSerieNoIndice`. A função devolvida **não** é `async`.
- Produces: `lerJsonParaExibir<T>(chave: string, vazio: T, aviso: string): Promise<T>`. Sem nada guardado, JSON `null` ou inválido, ou `getItem` que lança → devolve `vazio`. Em falha chama `logger.warn(aviso, error)` e nunca grava (sem quarentena: leitura de exibição não escreve).

Alternativas: (A) `criarSerie` como fábrica de função, uma instância por fila; (B) classe `Serie` com `executar()`; (C) `emSerie(nomeDaFila, fn)` com um registro global. **Escolhida: A.** É o desenho atual sem as 4 cópias. B acrescenta cerimônia sem ganho. C convida a usar o mesmo nome por engano, e uma série compartilhada faria a foto esperar a fila de posições (quebra a medida de microtarefas). A fábrica única de fila persistente foi descartada no spec (seção 6.7): retry, dono e política de 42501 continuam em cada fila.

- [ ] **Step 1: Escrever os testes que falham**

`serie.test.ts`:

- `'executa os passos na ordem das chamadas, um de cada vez'`: 3 passos com promessas controladas. A ordem de início é `[1, 2, 3]` e nunca há 2 em voo.
- `'passo que rejeita: quem chamou recebe a rejeição e o seguinte roda'`
- `'padrão: o passo não começa na mesma volta síncrona'`: `iniciou === false` logo após a chamada.
- `'imediato e livre: o passo começa na hora'`: `iniciou === true` logo após a chamada.
- `'imediato e ocupado: espera o anterior terminar'`
- `'imediato: depois que a fila esvazia, o próximo volta a começar na hora'`
- `'séries criadas separadamente não se esperam'`: a série A bloqueada numa promessa pendente, e o passo da série B resolve.

`leituraLocal.test.ts`, bloco `lerJsonParaExibir`:

- `'devolve o JSON guardado'`
- `'sem nada guardado, devolve o vazio'`
- `'JSON "null" guardado devolve o vazio'` (`await lerJsonParaExibir('k', [], 'x')` → `[]`)
- `'getItem lança → devolve o vazio, avisa com o texto dado e não grava'` (`logger.warn` com `('x', erro)`, `setItem` não chamado)
- `'JSON inválido → devolve o vazio e não grava quarentena'`

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/lib/__tests__/serie.test.ts src/lib/__tests__/leituraLocal.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL com "Cannot find module '../serie'" e `lerJsonParaExibir` não exportado.

- [ ] **Step 3: Implementar `serie.ts` e `lerJsonParaExibir`**

O comentário de `serie.ts` leva o porquê (OFF-3, e por que a foto é `imediato`) e cita `offline-foto-sem-esperar-refresh.test.ts`. Os comentários de justificativa das 4 cópias saem dos arquivos de origem. Cada fila guarda só uma linha (`const emSerie = criarSerie();`) e, se for o caso, o que a regra dela tem de próprio.

- [ ] **Step 4: Ver passar**

Run: o mesmo comando do Step 2.
Expected: PASS.

- [ ] **Step 5: Trocar as 4 séries e as 5 leituras**

`offline.ts`: `const emSerieNoIndice = criarSerie({ imediato: true })`. As outras três usam `criarSerie()`. As leituras passam a usar `lerJsonParaExibir` com o mesmo texto de aviso de hoje: `lerLista` (2 chaves), `filaPosicoes.ler` (vazio `null`), `getOfflinePhotosIndex` (vazio `[]`) e `lerRotaGuardada` (lê `Registro | null` e filtra o `userId` como hoje). **`getOfflinePhotosIndex` e os demais wrappers devolvem a promessa direto, sem `async`/`await`** (Review Focus 2).

- [ ] **Step 6: Rodar as suítes que medem a ordem**

Run: `npx jest src/lib/__tests__/offline src/lib/__tests__/leituraLocal.test.ts src/lib/__tests__/serie.test.ts src/lib/__tests__/storage-foto-da-fila.test.ts src/lib/motorista src/lib/auth --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS, inclusive `offline-foto-sem-esperar-refresh` e `offline-indice-fotos-em-serie`, sem nenhuma alteração nesses dois testes. Se o das microtarefas falhar, a causa é uma camada `async` a mais. Não aumente o laço do teste.

- [ ] **Step 7: Tipos e grep da forma antiga**

Run: `npm run type-check` e `git grep -n "\.then(fn, fn)" -- src`
Expected: sem erro de tipo. O grep só acha `src/lib/serie.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/serie.ts src/lib/leituraLocal.ts src/lib/offline.ts src/lib/motorista src/lib/__tests__/serie.test.ts src/lib/__tests__/leituraLocal.test.ts
git commit -m "refactor(offline): uma criarSerie e uma leitura para exibir nas quatro filas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `soDigitos`, `telefoneComDDD` e aliases mortos (1.9, parte de `src/lib`)

**Files:**

- Create: `src/lib/documentos.ts`, `src/lib/__tests__/documentos.test.ts`
- Modify: `src/lib/phone.ts:17-19` (`cleanPhone` delega), `:147,161` (transforms), `:169-180` (saem os aliases); acrescenta `telefoneComDDD`
- Modify: `src/lib/schemas/index.ts:32` (sai `telefoneSchema`)
- Modify: `src/lib/schemas/parada.ts:48-56`, `src/lib/schemas/unidade.ts:28,43`
- Test: `src/lib/__tests__/phone.test.ts`, `src/lib/schemas/__tests__/parada.test.ts`

**Interfaces:**

- Produces: `soDigitos(valor: string | null | undefined): string` em `src/lib/documentos.ts` (`null`/`undefined` viram `''`).
- Produces: `telefoneComDDD(valor: string | null | undefined): boolean` em `src/lib/phone.ts`: `true` com 10 ou 11 dígitos, `false` com qualquer outro número, inclusive 0. É mais frouxa que `validatePhone` de propósito: é a regra do cadastro de parada e da importação em lote.

Alternativas para `soDigitos`: (A) `documentos.ts` novo, e `cleanPhone` delega a ele; (B) exportar de `phone.ts`; (C) manter `replace(/\D/g, '')` inline. **Escolhida: A.** CEP e CNPJ importando de `phone` engana quem lê (B), e C é a duplicação que o item ataca. `documentos.ts` também recebe `formatCnpj` quando a trilha de `app/unidade` o trouxer.

- [ ] **Step 1: Escrever os testes que falham**

`documentos.test.ts`:

- `'soDigitos tira tudo o que não é dígito'` (`'(83) 9.8765-4321'` → `'83987654321'`)
- `'soDigitos de null, undefined e vazio é ""'`

`phone.test.ts`:

- `it.each(['(83) 3333-4444', '83987654321'])('telefoneComDDD aceita %s', …)`
- `it.each(['', '833334444', '558398765432', '+55 83 98765-4321', null])('telefoneComDDD recusa %s', …)`
- `'os aliases legados não são mais exportados'`: `expect(Object.keys(await import('../phone'))).not.toEqual(expect.arrayContaining(['telefoneSchema']))`, e o mesmo para `isValidTelefone` e `formatTelefone`.

`parada.test.ts`:

- `'telefone com +55 continua recusado (regra 10/11 inalterada)'`: `paradaModalSchema.safeParse({ …, telefone: '+55 83 98765-4321' }).success === false`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/lib/__tests__/documentos.test.ts src/lib/__tests__/phone.test.ts src/lib/schemas --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL em "Cannot find module '../documentos'", `telefoneComDDD` indefinido e aliases ainda presentes. O caso `+55` do schema já passa hoje e serve de trava.

- [ ] **Step 3: Implementar**

Crie `documentos.ts`. `cleanPhone` e os dois `transform` passam a usar `soDigitos`. `parada.ts`: `!soDigitos(valor) || telefoneComDDD(valor)`, com a mesma mensagem. `unidade.ts`: `soDigitos` nas duas linhas. Saem os 3 aliases e o reexport de `schemas/index.ts`.

- [ ] **Step 4: Ver passar**

Run: o mesmo comando do Step 2.
Expected: PASS, `Tests:` > 0.

- [ ] **Step 5: Tipos e alias sem uso**

Run: `npm run type-check` e `git grep -nw "telefoneSchema\|isValidTelefone\|formatTelefone" -- src app e2e`
Expected: sem erro de tipo, e o grep sem resultado.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos.ts src/lib/phone.ts src/lib/schemas src/lib/__tests__/documentos.test.ts src/lib/__tests__/phone.test.ts
git commit -m "refactor(lib): soDigitos e telefoneComDDD; aliases de telefone sem uso removidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Adaptadores Routes API mortos (0.2, fatia google)

Depende da Task 1 (mesmos arquivos).

**Files:**

- Modify: `src/lib/google-shared.ts` (saem `GoogleAutocompletePrediction`, `RouteMatrixElement`, `RoutesAPIResponse`, `parseDuration`, `adaptRoutesAPIResponse`, `mapRoutesAPIError`, `DirectionsAccumulators`, `createAccumulators`, `processDirectionsSegment`, `validateAndAdaptRoutesResponse`, o reexport de `createNetworkError` e `GoogleAddressComponent`, se ficar sem uso; ficam `PlaceSuggestion`, `handleDirectionsError` e o reexport de `parseGoogleError`/`success`/`failure`/tipos)
- Modify: `src/lib/google.ts:27-33` (sai o reexport "backwards compatibility")

- [ ] **Step 1: Provar que não há importador**

Run: `git grep -nw "RoutesAPIResponse\|adaptRoutesAPIResponse\|mapRoutesAPIError\|parseDuration\|createAccumulators\|processDirectionsSegment\|validateAndAdaptRoutesResponse\|DirectionsAccumulators\|RouteMatrixElement\|GoogleAutocompletePrediction\|GoogleAddressComponent" -- src app e2e supabase`
Expected: só `src/lib/google-shared.ts` e `src/lib/google.ts`.

- [ ] **Step 2: Apagar e verificar**

Run: `npm run type-check` e `npx jest src/lib src/hooks/nova-entrega --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: sem erro de tipo, PASS, `Tests:` > 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-shared.ts src/lib/google.ts
git commit -m "refactor(lib): adaptadores da Routes API do Google sem chamador removidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `type-guards.ts` e `timeEstimation.ts` (0.2, fatia de módulos inteiros)

**Files:**

- Delete: `src/lib/type-guards.ts`, `src/lib/__tests__/type-guards.test.ts`, `src/utils/timeEstimation.ts`, `src/utils/__tests__/timeEstimation.test.ts`
- Modify: `src/types/rota.ts:18-19` (sai a frase "atualize também `validStatusRota` em `src/lib/type-guards.ts`")

- [ ] **Step 1: Provar que não há importador**

Run: `git grep -n "type-guards\|timeEstimation" -- src app e2e tools scripts`
Expected: só os 4 arquivos a apagar, `src/types/rota.ts:19` e o comentário de `src/components/gestor/mapa-rota/RouteInfoHeader.tsx:35` (arquivo proibido aqui, vai como repasse).

- [ ] **Step 2: Apagar e verificar**

Run: `npm run type-check` e `npx jest src/lib src/utils src/types --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: sem erro de tipo e PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/type-guards.ts src/lib/__tests__/type-guards.test.ts src/utils/timeEstimation.ts src/utils/__tests__/timeEstimation.test.ts src/types/rota.ts
git commit -m "refactor(lib): type-guards e timeEstimation, vivos só pelos próprios testes, removidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Dados offline legados e cache (0.2, fatia offline/cache)

Depende da Task 3 (mesmo `offline.ts`).

**Files:**

- Modify: `src/lib/offline.ts` (saem `OFFLINE_DATA_KEY`, a interface `OfflineData`, `saveOfflineData`, `getOfflineData`, `clearOfflineData` e `hasOfflineData`)
- Modify: `src/lib/auth/limparEstadoLocal.ts:41`: a chave `'@rotamestre:offline_data'` **fica** e o comentário passa a dizer "chave legada (sem escritor desde 11/2026): fica para limpar instalações antigas"
- Modify: `src/lib/__tests__/offline.test.ts:6-9,150-284` (saem os 4 `describe`)
- Modify: `src/lib/cache.ts:300-380` (saem `getCacheWithFetch` e `invalidateRelatedCaches`; `CACHE_KEYS` fica, com 5 usuários)
- Modify: `src/lib/__tests__/cache.test.ts:16-17,278-365`

- [ ] **Step 1: Provar que não há importador e que a chave segue na limpeza**

Run: `git grep -nw "saveOfflineData\|getOfflineData\|clearOfflineData\|hasOfflineData\|OfflineData\|getCacheWithFetch\|invalidateRelatedCaches" -- src app e2e` e `git grep -n "offline_data" -- src`
Expected: o primeiro só acha `offline.ts`, `cache.ts` e os dois testes. O segundo continua achando `limparEstadoLocal.ts` e os testes de limpeza (`limpezaDeCache.test.ts`, `limparEstadoLocal.test.ts`), que **não mudam**.

- [ ] **Step 2: Apagar e verificar**

Run: `npm run type-check` e `npx jest src/lib/__tests__/offline src/lib/__tests__/cache.test.ts src/lib/__tests__/limpezaDeCache.test.ts src/lib/auth --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: sem erro de tipo e PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offline.ts src/lib/cache.ts src/lib/auth/limparEstadoLocal.ts src/lib/__tests__/offline.test.ts src/lib/__tests__/cache.test.ts
git commit -m "refactor(offline): dados offline legados e helpers de cache sem chamador removidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Consultas mortas em `src/lib/queries` (0.2, fatia queries)

**Risco de conflito:** a trilha gestor (item 1.5) muda `logParadaAction` em `queries/paradas.ts:371-392`, logo abaixo de `fetchNextPendingParada`, que sai aqui. Não toque em `logParadaAction`, em `updateParadaStatus` nem em `queries/logs.ts`. Se a 1.5 já estiver na `main` quando esta tarefa rodar, faça o rebase antes.

**Files:**

- Modify: `src/lib/queries/paradas.ts` (saem `fetchParadasByRota`, `fetchParadaById`, `fetchCheckpointsByRota`, `fetchParadasStats`, `createParadasBatch`, `completeParada`, `skipParada`, `updateParada`, `updateParadaOrder`, `deleteParada`, `deleteParadasByRota`, `fetchNextPendingParada`, além de `ParadaInsert`/`ParadaWithDetails` se ficarem sem uso; ficam `ParadaDB`, `ParadaUpdate`, `updateParadaStatus` e `logParadaAction`)
- Modify: `src/lib/queries/incidentes.ts` (saem `fetchIncidenteById`, `fetchIncidentesByMotorista`, `updateIncidenteStatus`, `updateIncidente` e `fetchIncidentesStats`; ficam `fetchIncidentesForGestor`, `createIncidente`, `logIncidenteAction` e os tipos que eles usam)
- Modify: `src/lib/queries/queryClient.ts:351` (sai `buildCacheKey`)
- Modify: `src/lib/queries/index.ts` (saem só os reexports dos símbolos apagados; os de `logs`, `usuarios`, `createIncidente`, `logIncidenteAction` e `IncidenteCategoria` ficam)
- Modify: `src/lib/queries/__tests__/{paradas,incidentes,queryClient}.test.ts` (saem os `describe` das funções apagadas)

- [ ] **Step 1: Provar que não há importador**

Run: para cada símbolo da lista, `git grep -nw "<símbolo>" -- src app e2e | grep -v "src/lib/queries/"`
Expected: vazio para todos. (Medido em `c64859af`: os únicos usos externos são `updateParadaStatus`/`logParadaAction` em `app/motorista/_screens/checkpoints.tsx:36`, `fetchIncidentesForGestor` em `useIncidentesModals.ts:9`, `createIncidente`/`logIncidenteAction`/`IncidenteCategoria` em `useIncidentSubmit.ts:36-37`, e `updateUsuario`/`logUserAction` em `useMotoristasOperations.ts:15`.)

- [ ] **Step 2: Apagar e verificar**

Run: `npm run type-check` e `npx jest src/lib/queries src/hooks/useIncidentSubmit src/hooks/incidentes-gestor src/hooks/motoristas-gestor app/motorista --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: sem erro de tipo, PASS, `Tests:` > 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries
git commit -m "refactor(queries): consultas de paradas e incidentes sem chamador removidas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação final

- [ ] **Step 1: Suíte inteira com cobertura**

Run: `npx jest --coverage --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS, nenhum limiar global quebrado. O número de testes muda só pelos apagados e acrescentados. Compare as 4 porcentagens com as da Task 0 e informe ao coordenador.

- [ ] **Step 2: Tipos e lint**

Run: `npm run type-check` e `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`
Expected: os dois terminam sem saída de erro (exit 0).

- [ ] **Step 3: Build web e bundle**

Run: `npm run build:web` e repita o Step 7 da Task 1.
Expected: build OK. O `dist` não contém `OSRM.web`.

- [ ] **Step 4: Varredura de arquivos mortos**

Run: `npm run scan:morto:autoteste` e depois `npm run scan:morto:arquivos`
Expected: o autoteste acha a isca. A lista de arquivos continua vazia (`serie.ts` e `documentos.ts` têm importador).

- [ ] **Step 5: Ruído de fim de linha**

Run: `git diff c64859af --stat --ignore-cr-at-eol` contra `git diff c64859af --stat`
Expected: as duas listas iguais. Arquivo que só aparece na segunda mudou só no fim de linha: em cada tarefa, antes do commit, confira com `git diff --ignore-cr-at-eol` e descarte esse arquivo com `git checkout -- <arquivo>`. Se o ruído já foi commitado, desfaça-o num commit `style:` separado.

- [ ] **Step 6: Relatório ao coordenador**

Liste os 8 commits, as porcentagens de cobertura antes e depois, os repasses do Ajuste 7 e a validação manual da Task 1 (aviso "estimada" no dev web), que fica para o coordenador.
