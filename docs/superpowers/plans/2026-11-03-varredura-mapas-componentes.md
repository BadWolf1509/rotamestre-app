# Varredura: mapas e componentes — Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** Tudo o que é desenhado sobre o mapa (nativo e web, motorista e gestor) passa a usar a paleta clara fixa de um módulo neutro, o `MapaAdapter` passa a ter uma interface de props só, e os `export default` órfãos dos componentes saem.

**Architecture:** `CORES_SOBRE_O_MAPA` sai da pasta de feature do motorista para `src/components/map/coresSobreOMapa.ts`, e cada mapa troca os tokens do tema pelos dela, só nos pinos, na linha da rota e no popup. A interface `MapaAdapterProps` vai para `src/types/parada-map.ts` (onde já moram `ParadaMapItem` e `StatusFilter`) e os dois adaptadores passam a repassar por spread. Os defaults saem com uma guarda estática que impede a volta.

**Tech Stack:** Expo/React Native + TypeScript, react-native-unistyles, `@maplibre/maplibre-react-native` (nativo), `maplibre-gl` v6 (web), Jest + `@testing-library/react-native`, knip.

**Spec:** `docs/superpowers/2026-11-03-varredura-refatoracoes.md` (branch `docs/varredura-refatoracoes-03-11`), itens **1.2** (corrige B2/B3), **1.15** e **0.1**. Relatórios de origem: `4-componentes.md` (§2, §7, §11 e bug C) e `1-motorista.md` §4.

## Global Constraints

- TDD: ver cada teste **falhar** antes da implementação. Para cor, o teste exige `CORES_SOBRE_O_MAPA` e proíbe token do tema (valores do `darkTheme`) no estilo do que fica sobre o mapa.
- Branch própria `refactor/varredura-mapas-componentes`, num worktree (`D:\rota-mestre\rotamestre-app\.claude\worktrees\varredura-mapas-componentes`), criada **antes** da primeira edição, a partir de `main` em `c64859af`.
- `node_modules` do worktree por **junction** para o do checkout principal. Nunca rodar `npm ci`/`npm install` nele.
- Nunca usar `--no-verify`.
- Nunca escrever em banco nem em rede. O e2e `renders motorista mapa` **escreve no banco** (`e2e/fixtures/garantir-rota-do-mapa.ts`), então não roda localmente. Ele fica para o CI do PR, por decisão do usuário.
- Jest dentro do worktree: caminhos **antes** das flags, `npx jest <caminhos> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Na suíte inteira, confira que o total passa de 450 suítes.
- Verificação final: suíte inteira do Jest, `npm run type-check`, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`, `npm run build:web` e `npm run scan:morto:arquivos`.
- Sem push.
- Commits em PT-BR no estilo do repositório (`refactor(mapa): …`, `fix(mapa): …`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O pre-commit pode deixar ruído CRLF. Confira com `git diff --ignore-cr-at-eol`, que deve vir vazio, e descarte o ruído com `git checkout -- <arquivo>`.
- Arquivos proibidos nesta trilha: `src/lib/**`, `src/services/**`, `src/hooks/route-status/**`, `src/components/gestor/**`, `app/gestor/**`, `app/motorista/**`, `.github/**`. Nenhuma tarefa abaixo precisa deles.
- Em `src/components/motorista/NavigationMode.tsx`, mexa **só** nas cores sobre o mapa (JSX dos `<MapLibreGL.Marker>`/`Layer` e os estilos `currentDestinationMarker` … `markerText`). Não mexa em Marker, toque, câmera, preferências, painel nem botões.
- Nada clicável dentro de `<Marker>` nativo. Nenhuma tarefa acrescenta filho ao Marker.
- Variantes de plataforma (`*.web.tsx`) não são apagadas nem renomeadas (as 13 são `entry` do knip, e o Metro escolhe por extensão).
- Não mexer em `configureMaplibreWorker()` nem nos imports de `@/lib/maplibreWorker`.

## Review Focus

- **Tema escuro com alto contraste** (`darkHighContrastTheme`, `lightHighContrastTheme`): os pinos do mapa web do gestor deixam de usar os cinzas reforçados do alto contraste e passam a usar a paleta clara padrão, como o mini-mapa já faz. Quem usa alto contraste deve continuar lendo o número branco sobre o pino. A Tarefa 4 fixa a borda e o número brancos em qualquer tema, e a conferência visual da Tarefa 7 inclui o alto contraste.
- **UI sobre a tela continua com o tema** (barra superior, botões sair/configurações/recentralizar, painel do NavigationMode): no escuro ela fica clara-translúcida com ícone escuro, e deve continuar legível. A Tarefa 2 tem um teste que exige que o painel siga o tema (`infoPanel.backgroundColor === darkTheme.colors.white`), para ninguém "corrigir" a UI junto com os pinos.
- **Re-render não recria marcadores** (#596, câmera voltando à visão geral): tirar `theme.colors` das deps de efeito não pode criar dep nova instável. O teste existente `não recria os marcadores das paradas num re-render` (NavigationMode.web) e os de `MapaWebMapLibre.camera.test.tsx` têm de seguir verdes.
- **Popup do gestor no escuro**: o fundo do popup do MapLibre é sempre branco, e o subtítulo e o "Ver ações" têm de ser legíveis nele. A Tarefa 4 testa o HTML do `setHTML`.
- **Prop nova no `MapaAdapter`**: quem acrescentar uma prop à interface tem de vê-la chegar aos dois mapas. A Tarefa 5 usa `Required<MapaAdapterProps>` no teste, então o tsc obriga a pôr a prop no teste, e o teste falha se um adaptador não a repassar.

---

## Ajustes em relação ao spec

1. **0.1 — `src/lib/logger.ts:357` fica fora**, porque `src/lib/**` é de outra trilha. O "Duplicate exports" do knip cai de **25 para 5** (logger + os 4 aliases de `phone.ts`/`route-optimization/types.ts`), não para 4.
2. **0.1 — dois reexports de `default` não listados no spec** precisam sair junto, senão o tsc quebra: `src/components/Dialog/index.ts:7` (`export { Dialog, default } from './Dialog'`) e `src/components/DataTable.tsx:8-14` (`default,` no reexport de `./data-table`). Conferido: ninguém importa o default de `@/components/Dialog` nem de `@/components/DataTable`.
3. **0.1 — conferência de importadores** (grep em `src app e2e scripts tools jest.setup.js jest.mocks __mocks__` de `import X from`, `import X, {`, `require(...)`, `.default`, `lazy(`, e `jest.mock` com `default`): **zero** importadores de default dos 19 componentes + `useAlert`. Só há 5 JSDoc com o caminho errado (Badge, EmptyState, Input, Modal, Progress). Ficam fora, por terem consumidor de default: `CameraUpload.tsx` (barrel `export { default as CameraUpload }`), `MapaWebMapLibre.tsx` (`MapaAdapter.web.tsx` faz `import MapaWebMapLibre from`), `Slider.tsx`/`Slider.web.tsx` (variante, `NavigationSettings` importa o default). Nenhum arquivo de `app/` é tocado.
4. **0.1 — o número do knip no CLAUDE.md (285 → medido) fica com o item 0.7**, para não haver duas edições concorrentes no mesmo parágrafo. A Tarefa 6 registra a medição no corpo do commit.
5. **1.2 — sem reexport em `miniMapCompartilhado.ts`.** O spec sugere reexportar, mas são só 5 importadores (`MiniMap.tsx`, `MiniMap.web.tsx`, `MotoristaMarker.tsx`, `MapaWebMapLibre.tsx`, `MotoristaMarker.test.tsx`). Trocar o import deixa um caminho só, e evita um export que o knip acusaria depois. `MAX_FONTE_SOBRE_O_MAPA` e `textoDoChip` continuam lá. O CLAUDE.md (Phonebook → Maps) passa a citar o caminho novo.
6. **1.2 — `NavigationMode.web.tsx` confirmado com o mesmo defeito** (HTML dos marcadores com `theme.colors.gray200/gray400/info/error/warning/success` e a linha com `primary`, `:229-431`). Entra como Tarefa 3. O `white` literal de lá já era fixo.
7. **1.2 — `MapaWebMapLibre.tsx` tem mais pontos que `:636,675,676` + popup**: o preenchimento dos pinos (`getMarkerColorExpression(colors)`, `:583`, recebe os tokens do tema ativo, e no escuro o `primary` vira `#7a9bdf` sob número branco), a linha da rota (`:549`) e o "Ver ações" (`colors.primary`, `:123` e `:415`). Todos entram na Tarefa 4.
8. **1.2 — `maplibre-fonte-unica.test.ts` não cita `miniMapCompartilhado`** (só lista `MiniMap.tsx`/`.web.tsx`): não precisa de ajuste.
9. **1.2 — a mesma classe existe no mapa nativo do gestor e fica FORA desta trilha** (o spec não a lista): `src/components/map/mobile/styles.ts:67-72` (`checkpointMarkerCompact` com `primary`/`white`/`black` do tema), `markers/ParadaMarker.tsx:44` (`getMarkerFillColor(parada.status, theme.colors)`), `markers/CheckpointMarker.tsx:38` (ícone `theme.colors.white`). Vale abrir como item novo, com a mesma receita da Tarefa 4.
10. **1.15 — o tipo vai para `src/types/parada-map.ts`, não para um `src/types/mapa.ts` novo**: o arquivo já existe e já é a fonte de `ParadaMapItem`/`StatusFilter`.
11. **1.15 absorve a parte `MapaAdapter` do item 0.3**: `onMarkerLongPress` **não** entra na interface compartilhada. Nenhum chamador a passa (`mapa-rota.tsx:517,715`, `mapa.tsx:340`), e o próprio `MapaMobile` documenta que ela não dispara no nativo. `MapaMobile` mantém a prop por enquanto, e quem executar o 0.3 a apaga de lá.
12. **1.15 — prova sem o e2e**: o e2e `renders motorista mapa` escreve no banco, e por isso fica para o CI do PR. A prova local é jest + tsc + `build:web`.

## Alternativas e escolhas

- **Onde morar a paleta:** (A) `src/components/map/coresSobreOMapa.ts`; (B) `src/utils/mapMarkerColors.ts`; (C) `src/lib/map/`. **Escolhida A.** `components/map/` já guarda o que os mapas compartilham (`toqueNoPino`, `infoWindowBuilders`, `hooks/`). B mistura a paleta fixa com funções que recebem os tokens do tema, que é justamente o defeito corrigido aqui. C é de outra trilha, e `lib/` não é lugar de cor de UI.
- **Preenchimento dos pinos no mapa web:** (A) passar a paleta clara a `getMarkerColorExpression`; (B) manter o preenchimento do tema e trocar só borda e número. **Escolhida A.** Com B, o número branco fica sobre `#7a9bdf` ou `#fbbf24` no escuro, com contraste ruim, e o mini-mapa já exige "fundo da paleta clara" (`MiniMap.temaEscuro.test.tsx`). Custo: o alto contraste deixa de valer nos pinos (ver Review Focus).
- **Formato do `MapaAdapter`:** (A) tipo compartilhado + repasse por spread; (B) reexport (`export { MapaMobile as MapaAdapter }`), como no R4 §7; (C) tipo compartilhado mantendo o repasse prop a prop. **Escolhida A.** Em B, o tipo do `MapaAdapter` passa a vir de um arquivo diferente por plataforma, e o tsc só enxerga o nativo, de modo que a divergência volta calada. Em C, o esquecimento que já aconteceu continua possível (o `.web` não repassava `onMarkerLongPress`). Com A, `MapaWebMapLibreProps` passa a ser `MapaAdapterProps`, então o tsc confere o `.web.tsx` contra a mesma interface.
- **Defaults:** (A) apagar e pôr uma guarda estática; (B) desligar `duplicates` no knip. **Escolhida A**, porque B esconde o sinal e mantém dois caminhos de import.

---

### Task 1: Paleta sobre o mapa em lugar neutro

**Files:**

- Create: `src/components/map/coresSobreOMapa.ts`
- Modify: `src/components/motorista/home/miniMapCompartilhado.ts:6-29` (sai a constante e o import de `defaultTheme`)
- Modify (só a linha de import): `src/components/motorista/home/MiniMap.tsx:33-38`, `src/components/motorista/home/MiniMap.web.tsx:33-38`, `src/components/MotoristaMarker.tsx:8`, `src/components/MapaWebMapLibre.tsx:32`, `src/components/__tests__/MotoristaMarker.test.tsx:4`
- Modify: `CLAUDE.md` (Phonebook → "Maps (web vs mobile)": caminho de `CORES_SOBRE_O_MAPA`)
- Test: `src/components/map/__tests__/coresSobreOMapa.test.ts`

**Interfaces:**

- Produces: `export const CORES_SOBRE_O_MAPA` em `@/components/map/coresSobreOMapa`, com as mesmas 8 chaves e valores de hoje (`branco, sombra, marca, proxima, pendente, concluida, usuario, erro`), todas de `defaultTheme.colors`. As Tarefas 2 e 4 acrescentam chaves.

- [ ] **Step 0: Worktree e branch**

```bash
cd /d/rota-mestre/rotamestre-app && git pull --ff-only
git worktree add .claude/worktrees/varredura-mapas-componentes -b refactor/varredura-mapas-componentes c64859af
cmd //c mklink /J "D:\\rota-mestre\\rotamestre-app\\.claude\\worktrees\\varredura-mapas-componentes\\node_modules" "D:\\rota-mestre\\rotamestre-app\\node_modules"
```

Expected: `git -C .claude/worktrees/varredura-mapas-componentes branch --show-current` → `refactor/varredura-mapas-componentes`. Daqui em diante, todo comando roda dentro do worktree.

- [ ] **Step 1: Teste que falha**

```ts
import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa';
import { darkTheme, defaultTheme } from '@/utils/styles.base';

it('é a paleta clara, não a do tema escuro', () => {
  expect(CORES_SOBRE_O_MAPA.branco).toBe(defaultTheme.colors.white); // '#ffffff'
  expect(CORES_SOBRE_O_MAPA.sombra).toBe(defaultTheme.colors.black);
  expect(CORES_SOBRE_O_MAPA.branco).not.toBe(darkTheme.colors.white);
  expect(CORES_SOBRE_O_MAPA.marca).toBe(defaultTheme.colors.primary);
});
it('ninguém importa a paleta da pasta do mini-mapa', () => {
  // git ls-files src app e2e | lê cada .ts/.tsx | nenhum casa
  // /CORES_SOBRE_O_MAPA[^;]*from ['"][^'"]*miniMapCompartilhado['"]/s
  // e miniMapCompartilhado.ts não contém 'export const CORES_SOBRE_O_MAPA'
  expect(ofensores).toEqual([]);
});
```

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/map/__tests__/coresSobreOMapa.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL com "Cannot find module '@/components/map/coresSobreOMapa'".

- [ ] **Step 3: Mover a constante** (com o comentário, ampliado para "qualquer mapa: mini-mapa, navegação, mapa do gestor") e trocar os 5 imports. Atualizar o caminho no CLAUDE.md.

- [ ] **Step 4: Ver passar, mais as suítes que importam a paleta**

Run: `npx jest src/components/map src/components/motorista/home src/components/__tests__/MotoristaMarker.test.tsx src/components/__tests__/MapaWebMapLibre --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers && npm run type-check`
Expected: PASS, tsc sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/components/map src/components/motorista/home src/components/MotoristaMarker.tsx src/components/MapaWebMapLibre.tsx src/components/__tests__/MotoristaMarker.test.tsx CLAUDE.md
git commit -m "refactor(mapa): CORES_SOBRE_O_MAPA sai da pasta do mini-mapa para components/map

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Modo navegação nativo com a paleta sobre o mapa (B2)

**Files:**

- Modify: `src/components/map/coresSobreOMapa.ts` (chaves novas)
- Modify: `src/components/motorista/NavigationMode.tsx`, **só** `:399-505` (cores dentro dos `<MapLibreGL.Marker>` e o `paint` da linha) e os estilos `currentDestinationMarker` … `markerText` (`:700-783`)
- Test: `src/components/motorista/__tests__/NavigationMode.temaEscuro.test.tsx` (arquivo à parte, porque o `StyleSheet.create` é avaliado na importação com o tema do mock, como em `MiniMap.temaEscuro.test.tsx`)
- Test: `src/components/map/__tests__/coresSobreOMapa.test.ts` (chaves novas)

**Interfaces:**

- Consumes: `CORES_SOBRE_O_MAPA` (Task 1).
- Produces: chaves `contorno: claro.gray200` (`'#e5e7eb'`) e `apagada: claro.gray400` (`'#9ca3af'`), que preservam exatamente o visual claro de hoje do checkpoint e do pino não-próximo.

Mapa de troca (tema → paleta). Pinos: `white`→`branco`, `black` (sombra)→`sombra`, `gray200`→`contorno`, `gray400`→`apagada`, `warning`→`proxima`, `error`→`erro`, `info`→`usuario`, `withOpacity(info, 0.2)`→`withOpacity(CORES_SOBRE_O_MAPA.usuario, 0.2)`. Ícones dentro do Marker: `cube`/`arrow-up-circle` (`white`→`branco`), `flag` (`success`→`concluida`), `home` (`info`→`usuario`). Linha: `'line-color'` (`primary`→`marca`). **Não mudam:** `topBar`, `exitButton`, `settingsButton`, `recenterButton`, `trackingBadge/Dot/Text`, `infoPanel`, `loading*` e os ícones fora do mapa.

- [ ] **Step 1: Testes que falham**

Mocks no modelo de `NavigationMode.web.test.tsx`: `@/hooks/navigation` controlado (`useNavigationModeLogic` com `isInitializing: false`, `userLocation`, `routePath` com 2 pontos, `startCheckpoint` e `endCheckpoint` com `is_checkpoint: true`, `nextStopAfterCurrent`, `isEntrega: true`, `realParadas` com 3 pendentes; `useNavigationFeedback`/`useNavigationActions` com `jest.fn()`), mais `useAlert`, `useLocationWatcher`, `useRevalidarPermissaoDeLocalizacao`, `@/lib/permissoes`, `expo-keep-awake`, `../NavigationSettings`, `../NavigationInfoPanel` e `@expo/vector-icons`. `@/utils/styles` com o tema escuro real:

```ts
jest.mock('@/utils/styles', () => {
  const { darkTheme } = jest.requireActual('@/utils/styles.base');
  return {
    useUnistyles: () => ({ theme: darkTheme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(darkTheme) : fn),
    },
  };
});
// TOKENS_ESCUROS = valores de darkTheme.colors em [white, black, gray200, gray400,
// warning, error, info, success, primary] que NÃO estão em Object.values(CORES_SOBRE_O_MAPA)

it('pino de parada mantém borda e número brancos de verdade', () => {
  // pino da parada 3 (não-próxima): borderColor === '#ffffff'; Text '3' color === '#ffffff'
});
it('nenhum pino nem ícone dentro de Marker usa token do tema escuro', () => {
  // getAllByTestId('marker') → StyleSheet.flatten de todo descendente + props.color dos Ionicons
  // JSON.stringify(tudo) não contém nenhum TOKENS_ESCUROS
});
it('posição do motorista usa a cor de usuário da paleta clara', () => {
  // backgroundColor === withOpacity(CORES_SOBRE_O_MAPA.usuario, 0.2); borderColor === CORES_SOBRE_O_MAPA.branco
});
it('checkpoint fica claro com contorno claro', () => {
  // backgroundColor === CORES_SOBRE_O_MAPA.branco; borderColor === CORES_SOBRE_O_MAPA.contorno
});
it('linha da rota usa a cor da marca da paleta clara', () => {
  // getByTestId('line-layer').props.paint['line-color'] === CORES_SOBRE_O_MAPA.marca
});
it('o painel continua seguindo o tema (UI sobre a tela, não sobre o mapa)', () => {
  // StyleSheet.flatten(getByTestId('nav-painel').props.style).backgroundColor === darkTheme.colors.white
});
```

Em `coresSobreOMapa.test.ts`: `expect(CORES_SOBRE_O_MAPA.contorno).toBe(defaultTheme.colors.gray200)` e `expect(CORES_SOBRE_O_MAPA.apagada).toBe(defaultTheme.colors.gray400)`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.temaEscuro.test.tsx src/components/map --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos 5 primeiros (por exemplo `Expected '#ffffff', Received '#1a2029'`) e nas 2 chaves novas. O teste do painel **já passa**, porque é a trava de regressão.

- [ ] **Step 3: Aplicar o mapa de troca** em `NavigationMode.tsx`, com `import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa'`, e acrescentar as 2 chaves.

- [ ] **Step 4: Ver passar, com a suíte existente**

Run: `npx jest src/components/motorista/__tests__/NavigationMode src/components/map --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS (inclui os 28 testes de `NavigationMode.test.tsx`).

- [ ] **Step 5: Diff só de cor**

Run: `git diff --ignore-cr-at-eol --stat src/components/motorista/NavigationMode.tsx && git diff --ignore-cr-at-eol src/components/motorista/NavigationMode.tsx | grep '^[-+] ' | grep -v -i 'color\|CORES_SOBRE_O_MAPA\|withOpacity'`
Expected: a última parte sai vazia (nenhuma linha alterada além de cor e import).

- [ ] **Step 6: Commit**

```bash
git add src/components/motorista/NavigationMode.tsx src/components/motorista/__tests__/NavigationMode.temaEscuro.test.tsx src/components/map
git commit -m "fix(navegação): pinos do modo navegação com a paleta sobre o mapa no tema escuro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Modo navegação web com a paleta sobre o mapa

**Files:**

- Modify: `src/components/motorista/NavigationMode.web.tsx:222-431` (HTML dos marcadores e `'line-color'`) e as deps desses efeitos (`theme.colors.info`, `theme.colors`, `theme.colors.primary` saem quando deixarem de ser lidos)
- Test: `src/components/motorista/__tests__/NavigationMode.web.test.tsx` (describe novo)

**Interfaces:**

- Consumes: `CORES_SOBRE_O_MAPA` com `contorno`/`apagada` (Tasks 1-2).

Mesmo mapa de troca da Tarefa 2 (`info`→`usuario`, `error`→`erro`, `warning`→`proxima`, `gray400`→`apagada`, `gray200`→`contorno`, `success`→`concluida`, `primary`→`marca`). O `white` literal pode virar `CORES_SOBRE_O_MAPA.branco` (mesmo `#ffffff`). O `box-shadow` usa `${CORES_SOBRE_O_MAPA.proxima}80`.

- [ ] **Step 1: Teste que falha** (no mesmo arquivo, que já usa o mock global e o `estilos` do `requireMock`)

```ts
describe('NavigationMode.web – tema escuro', () => {
  beforeEach(() => {
    const { darkTheme } = jest.requireActual('@/utils/styles.base');
    jest.spyOn(estilos, 'useUnistyles').mockReturnValue({ theme: darkTheme });
  });
  it('nenhum marcador usa token do tema escuro', async () => {
    await renderizarCarregado();
    const html = MockMarker.mock.calls
      .map((c) => c[0].element.outerHTML)
      .join('\n');
    // TOKENS_ESCUROS (mesma definição da Task 2): nenhum aparece em html
    expect(html).toContain(CORES_SOBRE_O_MAPA.erro); // destino de entrega
    expect(html).toContain(CORES_SOBRE_O_MAPA.proxima); // próxima parada
  });
  it('linha da rota usa a cor da marca da paleta clara', async () => {
    // mockLogica.routePath com 2 pontos; addLayer do mapa → paint['line-color'] === CORES_SOBRE_O_MAPA.marca
  });
});
```

(Restaurar `mockLogica.routePath` e o spy no `afterEach`.)

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.web.test.tsx --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL, com o HTML contendo `#fbbf24`/`#f87171` (warning/error do escuro).

- [ ] **Step 3: Aplicar a troca** em `NavigationMode.web.tsx`.

- [ ] **Step 4: Ver passar**

Run: o mesmo comando do Step 2.
Expected: PASS, inclusive `não recria os marcadores das paradas num re-render`.

- [ ] **Step 5: Commit**

```bash
git add src/components/motorista/NavigationMode.web.tsx src/components/motorista/__tests__/NavigationMode.web.test.tsx
git commit -m "fix(navegação): marcadores da navegação web com a paleta sobre o mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mapa web do gestor com a paleta sobre o mapa (B3)

**Files:**

- Modify: `src/components/map/coresSobreOMapa.ts` (chaves novas)
- Modify: `src/components/MapaWebMapLibre.tsx`: `createPopupContent` (`:91-125`), a chamada de `createGrupoPopupContent` (`:412-416`), `'line-color'` (`:549`, deps `:564`), `getMarkerColorExpression(...)` (`:583`), `'circle-stroke-color'` (`:636`), `'text-color'`/`'text-halo-color'` (`:675-676`), e as deps desses efeitos
- Test: `src/components/__tests__/MapaWebMapLibre.temaEscuro.test.tsx` (mocks de `maplibre-gl`, `useRouteDirections`, `openFreeMapStyle` e `useMotoristaLocationMapLibre` copiados de `MapaWebMapLibre.camera.test.tsx`, com `@/utils/styles` no tema escuro real, como na Tarefa 2)
- Test: `src/components/map/__tests__/coresSobreOMapa.test.ts`

**Interfaces:**

- Consumes: `CORES_SOBRE_O_MAPA` (Task 1); `getMarkerColorExpression(colors: { primary; successDark; warningDark; errorDark; gray500 }): unknown[]` de `@/utils/mapMarkerColors` (sem mudança).
- Produces: `CORES_SOBRE_O_MAPA.textoSecundario = claro.textSecondary` (`'#4b5563'`) e `export const CORES_DE_STATUS_SOBRE_O_MAPA = { primary, successDark, warningDark, errorDark, gray500 } as const`, tudo de `defaultTheme.colors`.
- Muda: `createPopupContent(parada: Parada, isCheckpoint: boolean, isPartida: boolean, unidadeNome: string | undefined, comAcoes: boolean): string` (sai o parâmetro `colors`; lê `textoSecundario` e `marca`). `createGrupoPopupContent` e `htmlBotaoVerAcoes` mantêm a assinatura e passam a ser chamadas com `CORES_SOBRE_O_MAPA.textoSecundario` e `CORES_SOBRE_O_MAPA.marca`.

- [ ] **Step 1: Testes que falham**

```ts
it('pino mantém borda e número brancos de verdade', async () => {
  // addLayer {id:'paradas-circle'} → paint['circle-stroke-color'] === CORES_SOBRE_O_MAPA.branco
  // addLayer {id:'paradas-label'} → paint['text-color'] === CORES_SOBRE_O_MAPA.branco
  //   e paint['text-halo-color'] === withOpacity(CORES_SOBRE_O_MAPA.sombra, 0.3)
});
it('preenchimento dos pinos vem da paleta clara', async () => {
  // JSON.stringify(paint['circle-color']) contém '#047857' (successDark claro)
  // e não contém '#7a9bdf' nem '#b45309' (primary/warningDark do escuro)
});
it('linha da rota usa a cor da marca da paleta clara', async () => {
  // polyline válida → addLayer {id:'route-layer'} → paint['line-color'] === CORES_SOBRE_O_MAPA.marca
});
it('popup da parada é legível no fundo branco do MapLibre', async () => {
  // selectedParadaId de parada comum com onSelectedMarkerPress → html do setHTML
  // contém CORES_SOBRE_O_MAPA.textoSecundario e CORES_SOBRE_O_MAPA.marca ("Ver ações")
  // e não contém '#d1d5db' (textSecondary do escuro) nem '#7a9bdf'
});
it('popup do checkpoint idem', async () => {
  // selectedParadaId do checkpoint de partida → html contém textoSecundario, não '#d1d5db'
});
```

Em `coresSobreOMapa.test.ts`: `textoSecundario === defaultTheme.colors.textSecondary`, e `CORES_DE_STATUS_SOBRE_O_MAPA` `toEqual` o recorte das 5 chaves de `defaultTheme.colors`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/__tests__/MapaWebMapLibre.temaEscuro.test.tsx src/components/map --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL (por exemplo `circle-stroke-color` `'#1a2029'`, popup com `'#d1d5db'`).

- [ ] **Step 3: Implementar.** Trocar os pontos listados e acrescentar as 2 exportações. Tirar `colors`/`theme.colors.primary` das deps só onde deixarem de ser lidos. Não mexer em `configureMaplibreWorker()`, na ordem dos efeitos nem nas camadas.

- [ ] **Step 4: Ver passar, com as suítes do mapa**

Run: `npx jest src/components/__tests__/MapaWebMapLibre src/components/map --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers && npm run type-check`
Expected: PASS (camera, idadeMotorista, motorista e temaEscuro).

- [ ] **Step 5: Commit**

```bash
git add src/components/MapaWebMapLibre.tsx src/components/__tests__/MapaWebMapLibre.temaEscuro.test.tsx src/components/map
git commit -m "fix(mapa): pinos, linha e popup do mapa web do gestor com a paleta sobre o mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `MapaAdapter` com uma interface de props (1.15)

**Files:**

- Modify: `src/types/parada-map.ts` (acrescenta `MapaAdapterProps`)
- Modify: `src/components/MapaAdapter.tsx`, `src/components/MapaAdapter.web.tsx` (sai a interface local, o corpo vira spread)
- Modify: `src/components/MapaWebMapLibre.tsx:54-68` (`MapaWebMapLibreProps` = `MapaAdapterProps`)
- Modify: `src/components/MapaMobile.tsx:31-60` (`interface MapaMobileProps extends MapaAdapterProps { onMarkerLongPress?: … }`, com os JSDoc de cada prop movidos para o tipo compartilhado)
- Modify: `src/components/MapaMobile.web.tsx:13-36` (saem `Parada`/`StatusFilter`/`MapaMobileProps` locais e entra `_props: MapaAdapterProps`; o arquivo **não** é apagado)
- Test: `src/components/__tests__/MapaAdapter.test.tsx` (teste novo de repasse), `src/components/__tests__/MapaAdapter.web.test.tsx` (novo), `src/components/__tests__/MapaAdapter.interfaceUnica.test.ts` (guarda estática)

**Interfaces:**

- Produces: em `@/types/parada-map`,

```ts
export interface MapaAdapterProps {
  paradas: ParadaMapItem[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  onSelectedMarkerPress?: (paradaId: string) => void;
  onMapPress?: () => void;
  statusFilter?: StatusFilter;
  rotaId?: string;
  motoristaNome?: string;
  showMotorista?: boolean;
  unidadeNome?: string;
  polyline?: string | null;
  storedRouteInfo?: RouteInfo | null; // import type de '@/hooks/useRouteDirections'
}
```

- `export function MapaAdapter(props: MapaAdapterProps): JSX.Element` nos dois arquivos (`<MapaMobile {...props} />` e `<MapaWebMapLibre {...props} />`).

- [ ] **Step 1: Testes que falham**

```ts
// MapaAdapter.test.tsx (nativo; MapaMobile já mockado no arquivo)
it('repassa todas as props da interface ao MapaMobile', () => {
  const props: Required<MapaAdapterProps> = { /* um valor para cada uma das 12 chaves */ };
  render(<MapaAdapter {...props} />);
  expect(mockMapaMobile.mock.calls[0][0]).toEqual(props);
});
// MapaAdapter.web.test.tsx: import { MapaAdapter } from '../MapaAdapter.web';
// jest.mock('../MapaWebMapLibre', () => ({ __esModule: true, default: jest.fn(() => null) }))
it('repassa todas as props da interface ao MapaWebMapLibre', () => { /* mesmo corpo */ });
// MapaAdapter.interfaceUnica.test.ts (leitura de arquivo)
it('nenhuma variante declara a própria interface de props do mapa', () => {
  // MapaAdapter.tsx, MapaAdapter.web.tsx, MapaMobile.web.tsx, MapaWebMapLibre.tsx:
  // não casam /interface (MapaAdapterProps|MapaWebMapLibreProps|Parada)\b|type StatusFilter\s*=/
  // e todos importam MapaAdapterProps de '@/types/parada-map'
});
```

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/__tests__/MapaAdapter --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers ; npm run type-check`
Expected: a guarda `interfaceUnica` FALHA (4 arquivos com interface local), e o tsc FALHA com "has no exported member 'MapaAdapterProps'". Os dois testes de repasse já passam no Jest (o babel apaga o tipo, e as 12 props já são repassadas hoje). Eles ficam como trava: com `Required<…>`, prop nova na interface obriga o teste a citá-la.

- [ ] **Step 3: Implementar** conforme as Interfaces.

- [ ] **Step 4: Ver passar**

Run: `npx jest src/components/__tests__/MapaAdapter src/components/__tests__/MapaMobile src/components/__tests__/MapaWebMapLibre --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers && npm run type-check`
Expected: PASS (inclui `MapaMobile.web.test`). O tsc continua sem erro em `app/gestor/mapa-rota.tsx` e `app/motorista/_screens/mapa.tsx` (não editados).

- [ ] **Step 5: Commit**

```bash
git add src/types/parada-map.ts src/components/MapaAdapter.tsx src/components/MapaAdapter.web.tsx src/components/MapaWebMapLibre.tsx src/components/MapaMobile.tsx src/components/MapaMobile.web.tsx src/components/__tests__/MapaAdapter*
git commit -m "refactor(mapa): MapaAdapter com uma interface de props para as duas plataformas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Apagar os `export default` órfãos (0.1)

**Files:**

- Modify (apagar a linha `export default X;`): `src/components/{Alert.tsx:173, AnimatedListItem.tsx:63, Badge.tsx:147, Breadcrumbs.tsx:131, EmptyState.tsx:133, Icon.tsx:51, Input.tsx:233, Modal.tsx:481, Progress.tsx:155, SeletorUnidade.tsx:357, SwipeOnboarding.tsx:259, Text.tsx:79, ThemeSettings.tsx:512}`, `src/components/data-table/index.tsx:143`, `src/components/Dialog/{Dialog.tsx:287, DialogButtons.tsx:122, DialogDestructiveInput.tsx:100, DialogIcon.tsx:80, DialogWeb.tsx:330}`, `src/hooks/useAlert.ts:348`
- Modify (reexport): `src/components/Dialog/index.ts:7` → `export { Dialog } from './Dialog';`; `src/components/DataTable.tsx:8-14` (sai `default,`)
- Modify (JSDoc `import X from` → `import { X } from`): `Badge.tsx:154`, `EmptyState.tsx:140`, `Input.tsx:240`, `Modal.tsx:488`, `Progress.tsx:162`
- Test: `src/components/__tests__/sem-export-default.test.ts`

**Interfaces:**

- Nenhuma mudança de API nomeada. Some só o `default` desses módulos.

- [ ] **Step 0: Medir a base**

Run: `npx knip --include duplicates 2>&1 | grep 'Duplicate exports'; npx knip --include exports 2>&1 | grep 'Unused exports'`
Expected: `Duplicate exports (25)`. Anotar o número de unused exports (216 em 03/11).

- [ ] **Step 1: Guarda que falha**

```ts
// lê (fs) todo .ts/.tsx de src/components e src/hooks, fora de __tests__
const PERMITIDOS = {
  'src/components/CameraUpload.tsx':
    'barrel @/design-system: export { default as CameraUpload }',
  'src/components/MapaWebMapLibre.tsx': 'MapaAdapter.web importa o default',
  'src/components/Slider.tsx':
    'variante de plataforma; NavigationSettings importa o default',
  'src/components/Slider.web.tsx': 'idem',
};
// casa /export\s+default\b/ ou /export\s*\{[^}]*\bdefault\b(?!\s+as)[^}]*\}/s
it('componentes e hooks não exportam default fora da lista', () => {
  expect(ofensores).toEqual([]);
});
it('a lista não guarda arquivo que já não tem default', () => {
  // cada chave de PERMITIDOS ainda casa o regex
});
```

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/components/__tests__/sem-export-default.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL, com os 22 arquivos (20 defaults + `Dialog/index.ts` + `DataTable.tsx`) em `ofensores`.

- [ ] **Step 3: Apagar as linhas e corrigir os reexports e os 5 JSDoc.**

- [ ] **Step 4: Ver passar, e as provas da remoção**

Run: `npx jest src/components/__tests__/sem-export-default.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers && npm run type-check && npx jest src/components src/design-system src/hooks app --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS. O tsc sem erro prova que nenhum `import X from` ficou.

Run: `npm run build:web`
Expected: termina com exit 0 (pega `require(...).default`, que o tsc não vê).

Run: `npx knip --include duplicates 2>&1 | grep 'Duplicate exports'`
Expected: `Duplicate exports (5)` (logger + os 4 aliases de `phone.ts`/`types.ts`). Os unused exports ficam ≤ a base do Step 0, e nenhuma linha nova cita arquivo tocado nesta tarefa.

- [ ] **Step 5: Commit** (com a medição no corpo, para o item 0.7 atualizar o CLAUDE.md)

```bash
git add src/components src/hooks/useAlert.ts
git commit -m "refactor(componentes): apaga os export default sem importador

knip: Duplicate exports 25 -> 5; Unused exports <base> -> <medido>.
Fica o default de src/lib/logger.ts (trilha lib).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificação final e conferência visual

**Files:** nenhum (só correção, se algo falhar, com commit próprio).

- [ ] **Step 1: Suíte inteira**

Run: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: 0 falhas, total > 450 suítes.

- [ ] **Step 2: Tipos, lint, build e código morto**

Run: `npm run type-check && npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**" && npm run build:web && npm run scan:morto:autoteste && npm run scan:morto:arquivos`
Expected: tudo com exit 0. O autoteste acha a isca, e a lista de arquivos sai vazia.

- [ ] **Step 3: Diff limpo e fora das pastas proibidas**

Run: `git diff --ignore-cr-at-eol --name-only c64859af..HEAD | grep -E '^(src/lib|src/services|src/hooks/route-status|src/components/gestor|app/gestor|app/motorista|\.github)/'`
Expected: vazio. `git status` limpo (ruído CRLF descartado).

- [ ] **Step 4: Conferência visual — web, tema escuro** (o login é do usuário; dev server do worktree com `--clear` e worker copiado por `node tools/scripts/copy-maplibre-worker.cjs`; provar no bundle que o módulo vem do worktree, buscando `coresSobreOMapa`)
  - `/gestor/mapa-rota` com uma rota de paradas pendentes/concluídas, nos temas escuro e escuro alto contraste: borda e número dos pinos **brancos**, preenchimento igual ao do tema claro, linha azul-escura (`#284093`), popup com subtítulo cinza legível e "Ver ações" azul-escuro. Comparar com o tema claro: tem de ser idêntico.
  - Navegação web do motorista (modo navegação, tema escuro): destino vermelho/âmbar com borda branca, próxima âmbar, demais cinza-claro, checkpoints brancos com contorno claro.
  - Registrar captura antes/depois no PR.

- [ ] **Step 5: Conferência visual — aparelho Android, tema escuro** (só cor; Marker e toque intocados). Entra no lote de aparelho do spec (§5), depois da validação pendente da 1.14.11. Exige build com este JS ou dev client + Metro.
  - Modo navegação com rota ativa: mesmos critérios do Step 4. Barra superior, botões e painel continuam com o tema e legíveis.
  - Mini-mapa da Início e marcador do motorista no mapa do gestor: sem mudança visual (só o import mudou).

- [ ] **Step 6: Entregar** sem push: listar os commits (`git log --oneline c64859af..HEAD`) e as capturas para o usuário decidir o PR. O e2e `renders motorista mapa` roda no CI do PR (`gh workflow run test.yml --ref refactor/varredura-mapas-componentes`, se o usuário quiser, porque escreve no banco).

---

## Riscos

- **Conflito de merge em `NavigationMode.tsx`** com a trilha motorista (preferências de navegação). Esta trilha só toca as linhas de cor `:399-505` e `:700-783`, e o Step 5 da Tarefa 2 prova isso. Quem mesclar depois rebaseia, e o conflito, se houver, é de linha vizinha.
- **`MapaWebMapLibre.tsx` é tocado por duas tarefas** (4 e 5) e é a armadilha do "Carregando..." silencioso. Nenhuma das duas mexe em worker, ordem de efeitos ou camadas, e o `build:web` + o e2e do CI são a prova.
- **`CLAUDE.md`** é editado na Tarefa 1 (caminho da paleta). O item 0.7 edita outro parágrafo do mesmo arquivo, o que pode dar conflito trivial.
- **Alto contraste nos pinos web** passa a usar a paleta padrão (decisão explícita, ver Alternativas).
- **Itens 0.3 e 2.5/2.6** mexem em `MapaMobile`, `Modal` e `EmptyState` depois desta trilha. A 0.1 vir antes é a ordem pedida pelo spec (§5).
