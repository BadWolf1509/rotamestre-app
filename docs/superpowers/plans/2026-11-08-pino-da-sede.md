# Pino da sede (partida e chegada) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os seis mapas desenham partida e chegada com uma regra só: um pino de **sede** quando os dois pontos coincidem (100% das rotas hoje), dois pinos distintos quando não.

**Architecture:** Uma função pura (`pontosDaUnidade`) decide quantos pinos e de que tipo. Um construtor de elemento DOM serve os três mapas web e um componente RN serve os três nativos, os dois lendo a mesma especificação de ícone, rótulo e cor. Os mapas deixam de desenhar partida e chegada por conta própria, e uma guarda estática cobra isso.

**Tech Stack:** React Native + Expo, MapLibre GL (web, v6) e `@maplibre/maplibre-react-native`, Jest + Testing Library.

**Spec:** a análise de 08/11/2026 (esta sessão), resumida aqui.

- As 362 rotas dos últimos 90 dias têm a partida e a chegada no mesmo ponto: as duas saem do único campo "Endereço da sede (partida e chegada das rotas)".
- Hoje os seis mapas usam cinco desenhos diferentes:
  - web: "I" verde e "F" vermelho, com o F cobrindo o I;
  - nativo: bandeira e casa em azul;
  - mini-mapa nativo: local e bandeira (a bandeira com sentido invertido);
  - mini-mapa web: bolinha sem ícone;
  - navegação: bandeira verde e casa azul.
- O vermelho e o verde coincidem com cores de status.

## Global Constraints

- **Raio de "mesmo local":** `RAIO_MESMO_LOCAL_METROS` (30 m), de `src/lib/route-optimization/agrupamento.ts`. Não criar outro.
- **Distância:** `distanciaMetros` de `src/lib/geo/distancia.ts`.
- **Cor do pino:** `CORES_SOBRE_O_MAPA.sede` = `claro.primaryDark` (`#1b2c63`, azul-marinho da marca), com borda e ícone `CORES_SOBRE_O_MAPA.branco`. Não usar nenhuma cor de status (verde, laranja, `primary`, cinza, vermelho).
- **Forma:** quadrado arredondado (raio 6 a 28 px; proporcional nos outros tamanhos). As paradas continuam redondas.
- **Ícones:**
  - sede: `home`;
  - partida: `flag`;
  - chegada: `location`.
  - Ionicons no nativo. No web, SVG nos paths do Material:
    - home `M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z`;
    - flag `M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z`;
    - location `M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z`.
- **Textos** (sentence case, sem caixa alta e sem emoji):
  - título: sede `Sede da unidade`, partida `Ponto de partida`, chegada `Ponto de chegada`;
  - subtítulo: sede `Partida e chegada da rota`, partida `Início da rota`, chegada `Fim da rota`;
  - `accessibilityLabel` / `aria-label`: `<título>, <endereço>`.
- **Mapa:** cor de algo desenhado sobre o mapa vem de `CORES_SOBRE_O_MAPA`, nunca do tema. O mapa web não ganha glifo novo de fonte.
- **Toque no nativo:** é tratado no `onPress` do `<Marker>`, com nada clicável dentro dele (`aoTocarPino` no `MapaMobile`).
- **Copy e logging:** seguem o `CLAUDE.md`. Nada de `as any`.

## Review Focus

1. Partida e chegada a **31 m** uma da outra: dois pinos. A **29 m**: um pino de sede. O limite tem teste (Tarefa 1).
2. **Rota só com partida**, ou checkpoint **sem coordenada**: nenhum pino fantasma e nenhuma exceção (Tarefa 1).
3. **Navegação voltando à sede:** quando a parada atual é a chegada, o pino da sede não aparece sobre o destino, porque a sede contém a chegada (Tarefa 6).
4. **Seleção pelo id da chegada** (`selectedParadaId` = id da chegada): abre o balão da sede, não um vazio (Tarefas 3 e 4).
5. **Tema escuro:** o pino continua com as cores da paleta clara. Os testes de tema escuro existentes passam a cobrir o pino novo (Tarefas 3 a 6).

---

### Tarefa 1: decisão e especificação (`pontosDaUnidade`)

**Arquivos:**

- Criar `src/components/map/pontosDaUnidade.ts`.
- Teste: `src/components/map/__tests__/pontosDaUnidade.test.ts`.
- Alterar `src/components/map/coresSobreOMapa.ts`: chave `sede: claro.primaryDark`.

**Interfaces (Produz):**

```ts
export type TipoPontoDaUnidade = 'sede' | 'partida' | 'chegada';
export interface PontoComCoordenada {
  id: string;
  ordem: number;
  latitude?: number | null;
  longitude?: number | null;
  endereco: string;
}
export interface PontoDaUnidade<T extends PontoComCoordenada> {
  tipo: TipoPontoDaUnidade;
  ponto: T; // onde o pino fica (na sede, é a partida)
  membros: T[]; // ids que este pino representa (sede: [partida, chegada])
}
export function pontosDaUnidade<T extends PontoComCoordenada>(
  checkpoints: T[],
  raioMetros?: number,
): PontoDaUnidade<T>[];
export const ESPEC_DO_PONTO: Record<
  TipoPontoDaUnidade,
  {
    titulo: string;
    subtitulo: string;
    ionicon: 'home' | 'flag' | 'location';
    svgPath: string;
  }
>;
export function rotuloAcessivelDoPonto(
  p: PontoDaUnidade<PontoComCoordenada>,
): string; // `${titulo}, ${endereco}`
export function pontoQueContem<T extends PontoComCoordenada>(
  pontos: PontoDaUnidade<T>[],
  id: string,
): PontoDaUnidade<T> | undefined;
```

Regras:

- `checkpoints` sem coordenada saem.
- A partida é a de menor `ordem` e a chegada a de maior `ordem`. Com um ponto só, ele é a `partida`.
- Os dois a até `raioMetros` (padrão `RAIO_MESMO_LOCAL_METROS`) viram um `sede`.

- [ ] **Passo 1: testes que falham.**
  - `sede quando partida e chegada coincidem` → `[{tipo:'sede', ponto: partida, membros:[partida, chegada]}]`
  - `a 29 m é sede, a 31 m são dois` → usar `0.00026°`/`0.00028°` de latitude (≈29 m/31 m) e conferir com `distanciaMetros`.
  - `dois pontos distantes: partida e chegada` → tipos `['partida','chegada']`.
  - `ordem decide, não a posição no array` → chegada vem antes no array e continua `chegada`.
  - `só partida` → `[{tipo:'partida'}]`. `vazio` → `[]`. `sem coordenada sai` → chegada com `latitude: null` → só partida.
  - `pontoQueContem(pontos, idDaChegada)` devolve o `sede`.
  - `ESPEC_DO_PONTO.sede.titulo === 'Sede da unidade'` e `rotuloAcessivelDoPonto` = `'Sede da unidade, Av. X'`.
- [ ] **Passo 2:** `npx jest src/components/map/__tests__/pontosDaUnidade.test.ts` → FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS.
- [ ] **Passo 5:** commit `feat(mapa): pontosDaUnidade — um pino de sede quando partida e chegada coincidem`.

### Tarefa 2: desenho compartilhado (web e nativo)

**Arquivos:**

- Criar `src/components/map/elementoDoPinoDaUnidade.ts`. Só DOM, importado apenas pelos três mapas web. Sem sufixo `.web`, para o nativo nunca resolver para ele.
- Criar `src/components/map/PinoDaUnidade.tsx`, o componente RN.
- Testes: `src/components/map/__tests__/elementoDoPinoDaUnidade.test.ts` e `src/components/map/__tests__/PinoDaUnidade.test.tsx`.

**Interfaces (Produz):**

```ts
export function criarElementoDoPinoDaUnidade(
  ponto: PontoDaUnidade<PontoComCoordenada>,
  tamanho: number,
  aoClicar?: () => void,
): HTMLDivElement;
export function PinoDaUnidade(props: {
  ponto: PontoDaUnidade<PontoComCoordenada>;
  tamanho: number;
  testID?: string;
}): JSX.Element;
```

**O elemento web tem:**

- `role="button"` quando `aoClicar` existe, e `aria-label` = `rotuloAcessivelDoPonto`;
- `data-tipo` com o tipo do ponto;
- fundo `CORES_SOBRE_O_MAPA.sede`, borda 2px `branco`, `border-radius` = `round(tamanho*0.22)`;
- SVG com `ESPEC_DO_PONTO[tipo].svgPath`, `fill` branco e lado igual a `round(tamanho*0.57)`;
- `cursor:pointer` e listener de `click` com `stopPropagation` quando `aoClicar` existe.

**O componente RN:** `View` com as mesmas medidas, `Ionicons` com `ESPEC_DO_PONTO[tipo].ionicon` e `accessible` + `accessibilityLabel`. Não tem nada clicável dentro, por causa da regra do `Marker`.

- [ ] **Passo 1: testes que falham.**
  - Web: `data-tipo` e `aria-label` da sede; `innerHTML` contém o path de `home` e `CORES_SOBRE_O_MAPA.sede`; não contém `CORES_DE_STATUS_SOBRE_O_MAPA.errorDark` nem `.successDark`; o clique chama `aoClicar` uma vez.
  - RN: o `Ionicons` recebe `name='home'` para a sede e `'location'` para a chegada; o `backgroundColor` é `CORES_SOBRE_O_MAPA.sede`; não há `Pressable`/`TouchableOpacity` na árvore.
- [ ] **Passos 2 a 4:** FAIL, depois implementar, depois PASS.
- [ ] **Passo 5:** commit `feat(mapa): pino da unidade — elemento web e componente nativo`.

### Tarefa 3: mapa web (`MapaWebMapLibre.tsx`, do gestor e da aba Mapa no web)

**Arquivos:**

- Alterar `src/components/MapaWebMapLibre.tsx`.
- Alterar `src/utils/mapMarkerColors.ts`: o ramo `is_checkpoint` sai, porque nenhuma feature o terá mais.
- Testes:
  - `src/components/__tests__/MapaWebMapLibre.motorista.test.tsx` (`montarFeaturesDosMarcadores`);
  - `src/components/__tests__/MapaWebMapLibre.temaEscuro.test.tsx` ("popup do checkpoint");
  - `src/utils/__tests__/mapMarkerColors.test.ts`.

**Consome:** Tarefas 1 e 2.

**Mudanças:**

- `montarFeaturesDosMarcadores(pinos, selectedParadaId)`: perde o parâmetro `checkpoints` e devolve só as paradas.
- Os pontos da unidade viram `maplibregl.Marker({ element: criarElementoDoPinoDaUnidade(p, 28, abrir) })`. Ficam guardados num ref próprio, removidos e recriados quando `pontos` mudar, e removidos no desmonte.
- `createPopupContent` do checkpoint passa a receber o `PontoDaUnidade`: título e subtítulo vêm de `ESPEC_DO_PONTO`, mais unidade e endereço. Some `isPartida`.
- `selecao`: se `selectedParadaId` estiver em `pontoQueContem(pontos, id)`, o popup é o desse ponto.

- [ ] **Passo 1: testes que falham.**
  - `montarFeaturesDosMarcadores` não devolve partida nem chegada, ajustando os três testes existentes que passam `checkpoints`.
  - Com partida e chegada no mesmo lugar, o mapa cria **um** `Marker` com `data-tipo="sede"`, e nenhum com `I`/`F`.
  - O popup da sede contém `Sede da unidade` e `Partida e chegada da rota`, e não contém `🚀`. No tema escuro, a cor do texto continua `CORES_SOBRE_O_MAPA.texto`.
  - `selectedParadaId` = id da chegada abre o popup da sede.
  - `getMarkerColorExpression` não cita mais `is_checkpoint`/`is_partida`. Ajuste os testes de estrutura.
- [ ] **Passos 2 a 4:** FAIL, depois implementar, depois PASS em `npx jest src/components/__tests__/MapaWebMapLibre src/utils/__tests__/mapMarkerColors`.
- [ ] **Passo 5:** commit `feat(mapa-web): partida e chegada viram o pino da sede`.

### Tarefa 4: mapa nativo (`MapaMobile.tsx`)

**Arquivos:**

- Alterar `src/components/MapaMobile.tsx` e `src/components/map/mobile/markers/CheckpointCallout.tsx`.
- Apagar `src/components/map/mobile/markers/CheckpointMarker.tsx` e o teste dele, porque o `PinoDaUnidade` toma o lugar.
- Testes: `src/components/map/mobile/__tests__/coresNoTemaEscuro.test.tsx` e um teste novo do `MapaMobile`, ou o existente que monta checkpoints.

**Mudanças:**

- Um `<MapLibreGL.Marker>` por `PontoDaUnidade`, com `key` = id do `ponto`, contendo `<PinoDaUnidade tamanho={28}/>`. O toque seleciona `ponto.id`.
- `checkpointSelecionado` passa a ser `pontoQueContem(pontos, selectedCheckpointId)`.
- `ALTURA_PINO_CHECKPOINT` passa a 28.
- `CheckpointCallout` recebe `ponto: PontoDaUnidade` em vez de `index`: título de `ESPEC_DO_PONTO`, sentence case (sai `PARTIDA`/`CHEGADA`), ícone do tipo e badge `CORES_SOBRE_O_MAPA.sede`. O resto continua (unidade, endereço, Copiar).

- [ ] **Passo 1: testes que falham.**
  - Com partida e chegada iguais, um `PinoDaUnidade` só, com `accessibilityLabel` `Sede da unidade, …`.
  - O callout da sede mostra `Sede da unidade`, e `queryByText('PARTIDA')` é nulo.
  - No tema escuro, o fundo do pino é `CORES_SOBRE_O_MAPA.sede`.
- [ ] **Passos 2 a 4:** FAIL, depois implementar, depois PASS.
- [ ] **Passo 5:** commit `feat(mapa-nativo): partida e chegada viram o pino da sede`.

### Tarefa 5: mini-mapas da Início (`MiniMap.tsx` e `MiniMap.web.tsx`)

**Arquivos:**

- Alterar `src/components/motorista/home/MiniMap.tsx` e `MiniMap.web.tsx`.
- Testes: os do `MiniMap` em `src/components/motorista/home/__tests__/`.

**Mudanças:**

- **Nativo:** `checkpoints.map(...)` vira `pontosDaUnidade(checkpoints).map(...)`, com `<PinoDaUnidade tamanho={22}/>` (sai o `location`/`flag` com `ordem === 0`).
- **Web:** `createStopMarkerElement` dos checkpoints vira `criarElementoDoPinoDaUnidade(p, 22)`, sem clique, porque o mini-mapa não tem balão.

- [ ] **Passo 1: testes que falham.** Com partida e chegada iguais, cada mini-mapa desenha **um** pino da unidade, de tipo `sede`.
- [ ] **Passos 2 a 4:** FAIL, depois implementar, depois PASS.
- [ ] **Passo 5:** commit `feat(mini-mapa): pino da sede nos dois mini-mapas`.

### Tarefa 6: navegação (`NavigationMode.tsx` e `NavigationMode.web.tsx`)

**Arquivos:**

- Alterar os dois arquivos e, se precisar, `src/hooks/navigation/useNavigationModeLogic.ts` (exporta `checkpoints`).
- Testes:
  - `src/components/motorista/__tests__/NavigationMode.temaEscuro.test.tsx`;
  - `src/components/motorista/__tests__/NavigationMode.web.test.tsx`;
  - `src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts`.

**Mudanças:**

- Os pinos vêm de `pontosDaUnidade(checkpoints)`, **sem** os pontos cujos `membros` contêm `currentStop.id`.
- Pino nativo: `<PinoDaUnidade tamanho={28}/>`. Pino web: `criarElementoDoPinoDaUnidade(p, 28)`, sem clique.
- Os desenhos inline de bandeira e casa saem.

- [ ] **Passo 1: testes que falham.**
  - Parada atual comum: um pino de sede.
  - **Parada atual = chegada: nenhum pino da unidade** (Review Focus 3).
  - No tema escuro, o pino usa `CORES_SOBRE_O_MAPA.sede` e `branco` (substitui o teste "checkpoint fica claro com contorno claro").
  - No web, o HTML contém `CORES_SOBRE_O_MAPA.sede` (substitui o `contorno`/`concluida` do checkpoint).
- [ ] **Passos 2 a 4:** FAIL, depois implementar, depois PASS.
- [ ] **Passo 5:** commit `feat(navegacao): pino da sede no modo navegação`.

### Tarefa 7: guarda, limpeza e documentação

**Arquivos:**

- Criar `src/components/map/__tests__/pino-da-unidade-fonte-unica.test.ts`.
- Alterar `CLAUDE.md` (Phonebook → "Maps").

- [ ] **Passo 1: guarda estática.** Para os seis arquivos de mapa (`MapaWebMapLibre.tsx`, `MapaMobile.tsx`, `MiniMap.tsx`, `MiniMap.web.tsx`, `NavigationMode.tsx`, `NavigationMode.web.tsx`), ela exige:
  - a importação de `pontosDaUnidade`;
  - nenhuma das formas antigas: `isPartida ? 'I' : 'F'`, `ordem === 0 ? 'location'`, `name="flag"`, `name="home"`, `Ponto de Partida`.

  Valide em vermelho: reintroduza uma forma antiga num arquivo, rode, veja falhar e reverta.

- [ ] **Passo 2:** a linha "Maps" do `CLAUDE.md` passa a dizer que partida e chegada são do `pontosDaUnidade` + `PinoDaUnidade`/`criarElementoDoPinoDaUnidade`, e que pino de unidade novo passa por ali.
- [ ] **Passo 3:** `npx jest`, `npx tsc --noEmit`, `npm run lint` e `npm run scan:nao-declarado`, todos limpos. `npm run scan:morto:arquivos` sem arquivo novo morto: o `CheckpointMarker` foi apagado, não ficou órfão.
- [ ] **Passo 4:** commit `test(mapa): guarda da fonte única do pino da unidade; docs`.

### Validação fora do Jest (antes do PR)

- **Navegador** (dev web, gestor logado pelo usuário): Mapa da Rota de uma rota real mostra um quadrado azul-marinho com casa, e o clique abre "Sede da unidade". Aba Mapa do motorista no web, igual. Tema escuro, igual.
- **Aparelho:** fica para a build seguinte à 3058, com mapa do gestor, mini-mapa da Início e modo navegação. O mini-mapa já escondeu defeito de pino que só o aparelho mostrou.
