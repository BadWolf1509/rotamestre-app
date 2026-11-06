# Migração Expo SDK 57 → 58 — relatório

Branch `chore/expo-sdk-58` (worktree `.claude/worktrees/expo-sdk-58`), base `91047392`.
Nada foi enviado (sem push e sem PR), não houve escrita no banco nem build nativo.
Este arquivo não está commitado.

## Commits (do mais antigo ao mais novo)

| Hash       | Assunto                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| `4d134c60` | chore(deps): Expo SDK 57 -> 58 (RN 0.88, React 19.3, Jest 30)                   |
| `fa04f144` | fix(tipos): adapta o app à API TypeScript estrita do RN 0.88                    |
| `721ca282` | fix(mapa): mini-mapa sem InteractionManager, removido no RN 0.88                |
| `ca382f9e` | fix(swipe): SwipeableRow sobre o ReanimatedSwipeable (Gesture Handler 3)        |
| `db49a51c` | test: ambiente do Jest 30 / Expo SDK 58                                         |
| `41ebeb7e` | chore(config): web.output e asyncRoutes explícitos para o SDK 58                |
| `1dacd64b` | chore(audit): allowlist vazia com o Expo SDK 58                                 |
| `85045dca` | fix(reordenar): patch no react-native-draggable-flatlist sem InteractionManager |
| `f0029fbb` | ci: aplica os patches depois do npm ci --ignore-scripts                         |

O `git status` mostra 11 arquivos como `M`. Não há mudança de conteúdo neles
(`git diff HEAD --stat` sai vazio). O que aparece é ruído de stat e de fim de
linha (autocrlf) deixado pelo backup do lint-staged.

## 1. Mudanças do SDK 58 que tocam o app

Fonte: https://expo.dev/changelog/sdk-58, mais conferência no `node_modules` instalado.

| Área                         | Mudança                                                                                                                                                                                                                      | Efeito aqui                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React Native                 | 0.86 → **0.88.1** (inclui 0.87)                                                                                                                                                                                              | API TypeScript estrita: componente tipado como função, refs como `*Instance` e `ColorValue` com `number                                                                                                                                                                                                                                                                        | null`. Gerou 32 erros de tipo, todos corrigidos. |
| RN, APIs removidas           | `InteractionManager`, export raiz `Touchable`, `NativeMethods`, `Modal animated`, props `backgroundColor`/`translucent` do `StatusBar`                                                                                       | O **InteractionManager** era usado em `MiniMap.tsx` e na lib `react-native-draggable-flatlist`, e os dois foram corrigidos. Os demais não são usados (varredura sem ocorrência). `ImageBackground` está só depreciado (getter com aviso em dev) e continua em `AuthBrandPanel.tsx`.                                                                                            |
| React                        | 19.2.3 → **19.3.0**                                                                                                                                                                                                          | `react-test-renderer` acompanhou para 19.3.0.                                                                                                                                                                                                                                                                                                                                  |
| react-native-gesture-handler | 2.32 → **3.3** (fixado pelo SDK)                                                                                                                                                                                             | O `Swipeable` legado foi **removido**, e `SwipeableRow` foi migrado. O builder `Gesture.Pan()` continua: o `GestureDetector` v3 manda gestos legados para o `LegacyGestureDetector`.                                                                                                                                                                                           |
| Reanimated / worklets        | 4.5.1 → 4.7.1 / 0.10.1 → 0.13.0                                                                                                                                                                                              | No Jest o import real quebra, o que exigiu mocks no setup (ver §2).                                                                                                                                                                                                                                                                                                            |
| expo-router 58               | Núcleo de navegação refeito; padrão de `web.output` anunciado como `server`; `asyncRoutes.web` ligado por padrão (medido no `expo config`); insets de safe-area **no web** deixam de vir do `react-native-safe-area-context` | `web.output: "single"` e `asyncRoutes: { web: false }` ficaram explícitos. Não usamos `withLayoutContext` nem `expo-router/react-navigation`. Os insets no web são um risco (ver §5).                                                                                                                                                                                          |
| expo-notifications 58        | Notificação em primeiro plano aparece por padrão, e o módulo instala um handler padrão ao carregar                                                                                                                           | O app já define `setNotificationHandler` (`src/lib/notifications.ts`), então o comportamento não muda. No Jest, isso quebrava 160 suítes (ver §2).                                                                                                                                                                                                                             |
| expo-file-system 58          | `File.write()` virou assíncrono e `md5` foi depreciado                                                                                                                                                                       | O app usa só `expo-file-system/legacy`, que continua existindo.                                                                                                                                                                                                                                                                                                                |
| expo-updates 58              | Opção `maxUpdatesToKeep`                                                                                                                                                                                                     | Nada a fazer.                                                                                                                                                                                                                                                                                                                                                                  |
| expo-location / task-manager | `expo-location/next` em preview; no iOS, geofence sem o background mode                                                                                                                                                      | **Corrigido (04/11):** no Android a 58 passa a respeitar `accuracy`, `timeInterval` e `distanceInterval`, que a 57 descartava (cast de Double; vale o Balanced, 3 s e 100 m). A navegação vai a GPS de alta precisão, 5 s e 10 m, e a rota cai de 100 m para 50 m: mais posições e mais bateria. Medir na rua antes de recalibrar.                                             |
| expo-image-picker            | Sem breaking change no changelog                                                                                                                                                                                             | Validar no aparelho.                                                                                                                                                                                                                                                                                                                                                           |
| Android R8                   | Ligado por padrão no release                                                                                                                                                                                                 | Já estava ligado por `expo-build-properties`. O `expo-modules-core` 58 mantém o meta-data `org.unimodules.core.AppLoader#react-native-headless` e a classe `RNHeadlessAppLoader`, então a regra `-keep` do HeadlessAppLoader **continua necessária**. As opções `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds` e `extraProguardRules` seguem no schema. |
| expo-modules-core            | Passa a vir com `.so` pré-compilados (`buildExpoModulesCoreFromSource` para compilar da fonte)                                                                                                                               | Muda o build nativo. É novidade a observar no primeiro build pelo Actions/EAS.                                                                                                                                                                                                                                                                                                 |
| New Architecture / Hermes    | Sem mudança de opção. `newArchEnabled: true` segue                                                                                                                                                                           | —                                                                                                                                                                                                                                                                                                                                                                              |
| Metro                        | `EXPO_PUBLIC_*` agora entra na chave do cache de transformação; o transformer Noxcturnal é experimental e opcional                                                                                                           | Não ativamos o Noxcturnal: ele não se aplica com plugin Babel próprio (unistyles e reanimated).                                                                                                                                                                                                                                                                                |
| Jest                         | jest-expo 58 pede Jest 30, `jest-environment-jsdom` 30 e `@react-native/jest-preset` 0.88                                                                                                                                    | Ajustes no §2.                                                                                                                                                                                                                                                                                                                                                                 |
| Node                         | ≥ 22.13 (linha 22) ou ≥ 24.3                                                                                                                                                                                                 | O CI usa `22.x` (última) e a máquina local, 24.16. Atende.                                                                                                                                                                                                                                                                                                                     |
| `NODE_ENV`                   | O CLI força `development`/`production`                                                                                                                                                                                       | Os scripts não dependem disso.                                                                                                                                                                                                                                                                                                                                                 |

Unistyles 3.7.0 e nitro-modules 0.37.1 ficaram como estavam. O
`devDependency` do Unistyles 3.7.0 já é `react-native 0.88.0` + `nitro 0.37.1`,
e o changelog do 3.7.0 traz suporte às props de estilo do RN 0.88. A 3.8.0 saiu
em 02/11 com uma breaking change (RN ≥ 0.85) e a migração do plugin Babel para o
Metro: ela fica para o Dependabot, para não misturar com o upgrade. O maplibre
fica na 11.3.10: o caret aceitaria a 11.5.1, mas o lockfile manteve a 11.3.10,
e as notas da 11.4 e da 11.5 não falam do RN 0.88.

## 2. O que mudou e por quê

### Dependências (`4d134c60`)

- `npx expo install expo@~58.0.22` e `npx expo install --fix`. O `--fix` gravou
  `"expo": "^58"`, que corrigi para `~58.0.22`, no padrão dos outros.
- Fora do conjunto do SDK: `@expo/log-box` ~58.0.14, `react-test-renderer`
  19.3.0 (exato, acompanha o React), `@react-native/jest-preset` ^0.88.1 e
  `jest-environment-jsdom` ^30.5.2, os três exigidos pelo jest-expo 58.
- Alternativa avaliada e descartada: migrar para RNTL 14 com `test-renderer`
  (o jest-expo 58 já usa `test-renderer`). O RNTL 14 muda a API de render e
  mexeria em centenas de testes. O RNTL 13 com `react-test-renderer` 19.3
  continua funcionando.

### Tipos do RN 0.88 (`fa04f144`)

- `useRef<View|ScrollView|TextInput>` foi trocado por `ViewInstance`,
  `ScrollViewInstance` e `TextInputInstance` nos **8 usos**, inclusive o
  `inputRef` público do `AddressAutocomplete`, e não só nos que quebraram.
- `onPress/onSubmitEditing={handleSubmit(fn)}` virou `() => handleSubmit(fn)()`,
  o mesmo padrão de `useAddStopForm` e `useEditStopForm`. O evento do RN deixou
  de ser compatível com o `BaseSyntheticEvent` do RHF. A mudança cobre login,
  forgot, reset, unidade e FormularioParada. No navegador, o login vazio mostra
  os erros inline (verificado).
- `ColorValue` (agora com `number`/`null`): nos layouts, a cor é estreitada para
  string antes do Ionicons.
- `AppState.currentState` agora é `string`, e `ListEmptyComponent` não aceita
  mais `null`.
- `StopCard`: passa a usar sempre `Animated.View`. A união `Animated.View | View`
  não tipa mais, e o componente trocava de tipo quando o pulso começava, o que
  remontava a subárvore.
- Alternativa descartada: o opt-out `customConditions` no tsconfig. É
  temporário e sai depois do RN 0.89.

### InteractionManager removido

- `MiniMap.tsx` (`721ca282`): passou a `requestIdleCallback`/`cancelIdleCallback`,
  o substituto indicado pelo RN. Só roda no nativo (o `.web.tsx` é separado).
- `react-native-draggable-flatlist` 4.0.3 (`85045dca`): a lib está sem
  manutenção e chama `InteractionManager.runAfterInteractions` sempre que os
  dados mudam, ou seja, logo depois de **todo arrasto**. No aparelho isso seria
  um `TypeError` na reordenação de paradas do gestor (MobileList) e na lista da
  nova entrega. O web não quebra, porque o react-native-web ainda exporta o
  InteractionManager. Por isso nem o e2e nem o Jest, que mockam a lib,
  acusariam o problema.
  - A correção é um `patch-package` (novo devDependency e `postinstall`) que
    troca a chamada por `setTimeout(0)` nas três entradas: `src`, usada pelo
    Metro, e `lib/module` e `lib/commonjs`. Escolhi `setTimeout` em vez de
    `requestIdleCallback` porque o caminho também roda no web, e o Safari não
    tem `requestIdleCallback`.
  - Alternativas descartadas: trocar de lib (`react-native-reorderable-list`),
    que é uma reescrita fora do escopo; ou um shim global no módulo
    `react-native`, que mexeria no RN inteiro.
  - A guarda é `src/lib/__tests__/draggable-flatlist-sem-interaction-manager.test.ts`.
    Ela fica **vermelha com o patch revertido** (3/3 falham) e verde com ele
    aplicado (verificado).
  - CI (`f0029fbb`): os jobs `test`, e2e, `visual-regression` e `bundle-size`
    instalam com `--ignore-scripts`, o que pula o patch. Ganharam o passo
    `npx patch-package`. Sem ele, a guarda ficaria vermelha no CI e o artefato
    divergiria do da Vercel e do EAS, que rodam o postinstall.

### SwipeableRow (`ca382f9e`)

- Migrado para o `ReanimatedSwipeable`: `progress` agora é SharedValue, e a
  animação de cada ação foi para um componente de módulo, `AcaoDeslize`, com
  `useAnimatedStyle`. Fica fora do render, conforme a regra do CLAUDE.md.
- `onSwipeableOpen` mantém o contrato antigo (`'left'` = abriram as ações da
  esquerda). O componente novo informa o sentido do arrasto, que é o inverso,
  e o mapeamento foi feito.
- **Corrigido (04/11):** o componente também é usado no card principal da Início
  (`MainCardActive`) e nos cards da aba Paradas (`ParadaCard`), não só na
  vitrine. O deslizar para os dois lados, a abertura do fluxo de conclusão e a
  rolagem vertical sobre os cards foram conferidos no dev client do moto g15
  (04/11/2026). Os testes mockam o `SwipeableRow`, então só o aparelho prova.

### Infra de testes (`db49a51c`)

- `jest.setup.js`:
  1. Mock de `expo-notifications/build/NotificationsHandlerModule` com um
     `addListener` que devolve `{ remove }`. O handler padrão do SDK 58,
     combinado com o mock genérico do jest-expo (que devolve uma Promise),
     quebrava **160 suítes** no import.
  2. Mocks oficiais do `react-native-worklets` e do `react-native-reanimated`,
     mais o `react-native-gesture-handler/jestSetup` oficial. O SwipeableRow
     (exportado pelo design system) agora carrega o reanimated em quase toda
     árvore de teste.
  3. No reanimated 4.7, sob a resolução nativa do jest-expo, o módulo
     `initializers.native` chama `setCSSEventHandler` no JSReanimated e quebra
     no import. Troquei pelo inicializador da implementação JS nas árvores
     `lib/` e `src/`. Parece um defeito upstream, e vale reavaliar no próximo
     bump do reanimated.
- `jest.ambiente-jsdom.js`, um ambiente novo, resolve dois problemas:
  - O jsdom do Jest 30 tem `window` não configurável, e o setup do preset do RN
    tenta redefini-lo (`Cannot redefine property: window`, 4 suítes). O
    ambiente pula só essa chave, já que `window` já é o global.
  - O ajuste de teardown do `nativeEnvironment` do jest-expo, que pula getters
    preguiçosos do Expo, foi replicado aqui. As 4 suítes com
    `@jest-environment jsdom` passaram a apontar para esse ambiente.
- `reset-password.test.tsx`: troquei `waitFor(() => expect(q).toBeNull())` por
  `waitForElementToBeRemoved`.
  - Causa medida por sonda: com Jest 30 e React 19.3, cada tentativa falha de
    `expect(instancia).toBeNull()` formata a fiber inteira (~18 s). O `waitFor`
    estourava o prazo com só 2 verificações, embora o erro já tivesse sumido.
  - A suíte caiu de 77 s para 9 s.
  - **O mesmo custo vale para qualquer `waitFor` + `toBeNull()` sobre instância
    que precise de nova tentativa.** Hoje só esse falhava, mas é a mesma classe
    de defeito, e vale uma varredura à parte.
- Snapshots: só o cabeçalho, que o Jest 30 reescreve.

### Config (`41ebeb7e`)

- `web.output: "single"`, que é o comportamento do SDK 57 (SPA), servido pela
  Vercel (rewrite para `index.html`) e pelo `serve-dist.cjs`.
  - `static` geraria um HTML por rota e mudaria o deploy.
  - `server` exigiria um servidor de API Routes.
- `["expo-router", { asyncRoutes: { web: false } }]`: o padrão do 58 é `true`,
  que carrega cada rota sob demanda. Desliguei para o upgrade não mudar junto o
  carregamento do web. A ativação merece avaliação própria, com e2e e Vercel.

## 3. Resultado das verificações

| Verificação                                                                            | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx expo-doctor`                                                                      | 20/20 checks passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npx expo install --check`                                                             | Dependencies are up to date                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run type-check`                                                                   | exit 0. Partiu de **32 erros** e chegou a 0                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run lint` (repo inteiro, `--max-warnings=0`)                                      | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Jest (`--testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`) | **618 suítes / 8637 testes, todos passando**, 133 s. Antes das correções: 81 suítes falhando                                                                                                                                                                                                                                                                                                                                                                                                        |
| Jest com `--coverage`                                                                  | Statements 88% · Branches 79,23% · Functions 88,34% · Lines 89,09%, acima dos limites                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run audit:prod`                                                                   | exit 0, "Nenhuma vulnerabilidade high/critical fora da allowlist", **com a allowlist vazia**                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run build:web`                                                                    | exit 0. 2516 módulos. `index-*.js` 6,7 MB (1,72 MB gzip) + `xlsx` 492 KB (159 KB gzip), abaixo dos 3,5 MB do size-limit. O worker `maplibre-gl-worker.mjs` foi copiado para `public/` e para `dist/`, e o bundle o referencia (2 ocorrências)                                                                                                                                                                                                                                                       |
| `npm run scan:nao-declarado`                                                           | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Navegador (dist servido na porta 8093, Browser pane)                                   | `/auth/login` renderiza, e o submit vazio mostra "E-mail é obrigatório" e "Senha é obrigatória". O único erro de console é o registro do service worker ("unknown error when fetching the script"), que se reproduz chamando `register('/sw.js')` à mão no pane. Parece limitação do pane, e o `sw.js` não mudou. Não foi possível passar do login: o worktree não tem `.env` (Supabase placeholder), e o login é seu. O **mapa web não foi exercitado**: rode o e2e `renders motorista mapa` no CI |

## 4. Allowlist do audit (`scripts/audit-producao.js`)

As 6 entradas foram removidas e `ACEITOS` ficou `{}`, com um comentário de
histórico.

- **Deixaram de casar** (o próprio script as acusou):
  - `GHSA-qr28-fpjm-wq7f` e `GHSA-vcc3-ghjq-m6fr` (decode-uri-component 0.2.2, via expo-router 57)
  - `GHSA-mrhx-c7xc-m3w5` (zod 3, via @expo/cli 57)
  - `GHSA-gcqx-w48m-w2h4` (deepmerge, via @expo/config)
- **Ainda casam, mas não são mais necessárias:**
  - `GHSA-3g3m-2fjr-6pw4` (glob 13)
  - `GHSA-g3hv-75wg-m249` (minimatch 10)

  As duas seguem na árvore como **moderadas** (via @expo/cli, @expo/config,
  @expo/fingerprint e expo-updates). Só estavam na lista porque o @expo/cli era
  high pelo zod, e o próprio comentário do script dizia "saem com o SDK 58".
  Hoje o `npm audit --omit=dev` não tem nenhum high/critical, e o script sai 0
  sem elas. Esta é uma decisão minha além do pedido literal ("remova as que
  deixarem de casar"). Se preferir manter as duas, é só reverter parte do
  `1dacd64b`.

- `scripts/lib/__tests__/audit-producao.test.ts`: 12/12 passando (usa allowlist
  própria).
- `docs/PROJECT_CONTEXT.md` e `docs/HISTORICO.md` ainda citam esses advisories
  (e a pendência 31). Não editei esses arquivos.

## 5. Riscos nativos (nada disso o CI cobre)

1. **Cadeia Nitro → Unistyles → RN 0.88.** O Unistyles 3.7.0 foi compilado
   contra o RN 0.88.0 e o Nitro 0.37.1, os nossos. Peer permissivo não é
   garantia, e só o build responde. Prova no aparelho: as duas linhas
   `Successfully loaded ... C++ library!` no logcat.
2. **Gesture Handler 3** é major e tem `GestureDetector` como host view. Vale
   para três pontos:
   - o `DraggableFlatList`, com o builder legado e o `FlatList` v3 do RNGH;
   - o `ReanimatedSwipeable`;
   - os `GestureHandlerRootView` em `app/motorista/_layout.tsx`,
     `checkpoints.tsx` e `DraggableStopList`.

   Arrastar para reordenar no nativo é o ponto mais frágil.

3. **R8 + expo-modules-core com `.so` pré-compilado.** A regra do
   HeadlessAppLoader continua. Repita o teste da memória `r8-reflexao-por-manifest`:
   instalar com `-r` por cima, com rastreamento ativo.
4. **Reanimated 4.7 / worklets 0.13.** No Jest, o comportamento real deles não é
   mais exercitado (mock oficial), e as animações só se validam no aparelho.
5. **maplibre-react-native 11.3.10 com RN 0.88.** Não há nota de
   compatibilidade, e o mapa nativo só se valida no aparelho.
6. **Safe-area no web** (PWA em iPhone com notch): o expo-router 58 deixou de
   fornecer insets ao `react-native-safe-area-context` no web, e 27 arquivos usam
   `useSafeAreaInsets`. No desktop o valor já era 0. No PWA iOS em modo
   standalone pode faltar margem. O SDK recomenda `env(safe-area-inset-*)` no CSS.
7. **`ImageBackground` depreciado** (`AuthBrandPanel.tsx`). Funciona, mas vai
   ser removido em uma versão futura do RN.
8. **expo-notifications**: confira se o handler do app continua decidindo a
   exibição em primeiro plano. Ele usa `shouldShowAlert`, que vale conferir
   contra `shouldShowBanner`/`shouldShowList`.
9. **Atualização pela Play**: o `runtimeVersion` usa a policy `appVersion`. Uma
   OTA publicada sob a mesma versão nativa do SDK 57 seria incompatível, então a
   versão precisa subir (`bump:android`) antes do artefato novo.

## 6. Roteiro de teste no aparelho (build pelo Actions `eas-build-android.yml` ou EAS)

Antes de começar: `adb logcat -c`, e depois filtrar por
`FATAL|nitro|unistyles|UnsatisfiedLink|dlopen|ClassNotFound|Cannot initialize app loader|TypeError`.

1. **Partida a frio**: as duas linhas `Successfully loaded` (Unistyles e Nitro),
   o app estilizado e a status bar na cor do tema.
2. **Login**: motorista e gestor. Teste também o erro inline com campos vazios
   e o fluxo "Esqueci a senha" (onSubmitEditing no reset).
3. **Rota do motorista**: Início com o mini-mapa enquadrando as paradas (é o
   `requestIdleCallback` novo), iniciar a rota, abas Mapa e Paradas, balão do
   marcador (toque no `<Marker>`) e abertura no Waze/Google Maps.
   3b. **Deslizar do motorista** (`ReanimatedSwipeable` do GH 3): na Início e na
   aba Paradas, deslizar o card para a direita (Concluir abre o comprovante) e
   para a esquerda (Pular), e rolar a lista na vertical sobre os cards sem abrir
   o deslizar.
4. **Mapa nativo** (maplibre): tiles do OpenFreeMap, pinos e "3+4", e
   alternância de tema com o mapa aberto.
5. **Rastreamento em segundo plano com a tela apagada**: entrar na navegação,
   conferir "Rastreando", apagar a tela por mais de 5 min e voltar. Confira as
   posições gravadas (a geofence não mostra nada: `handleArrival` só chama um
   `sendNotification` vazio). Depois faça
   `adb install -r` do mesmo APK por cima, com o rastreamento ativo, e procure
   `ClassNotFound`/`Cannot initialize app loader` (R8).
6. **Câmera/foto**: concluir uma parada pelo `StopCompletionFlow` com foto e
   reproduzir a recriação da Activity
   (`adb shell settings put global always_finish_activities 1`), confirmando
   que a foto é restaurada na parada certa. Teste também a galeria.
7. **Gestor no nativo, arrasto** (patch do draggable-flatlist: `LegacyFlatList`
   - `queueMicrotask`; root view único na raiz). Repita **na tela da rota do
     gestor (modal Reordenar) e na Nova Entrega**:
   * use uma rota com **15 ou mais paradas** (mais do que cabe na tela);
   * arraste da primeira à última parada, segurando na borda para o
     **autoscroll** levar a lista;
   * **role a lista sem arrastar** (o toque de rolagem não pode ativar o
     arrasto, nem o contrário);
   * faça **dois arrastos seguidos**, sem sair da tela (é o caminho do antigo
     `InteractionManager`), e observe se há **piscada ao soltar**;
   * salve e confira a ordem persistida.
     No dev client, um erro de "GestureHandlerRootView" aqui é regressão do
     root view único.
8. **Notificação**: push FCM com o app em primeiro plano, em segundo plano e
   fechado. Confira se a exibição em primeiro plano segue o handler do app.
   **Toque na notificação** (com o app em segundo plano e fechado): tem de abrir a
   rota certa. O expo-notifications 58 mudou a precedência do `dataString` do FCM
   no Android, e `notificationHandlers.ts` lê `data.tipo` e `data.rota_id`.
9. **Tema escuro**: Configurações → Aparência, alternando claro/escuro em telas
   já montadas e montadas depois, e uma partida a frio com o tema persistido.
10. **Atualização pela Play mantendo o login**: instalar o build da faixa
    interna **por cima** da 1.14.x da Play (mesma assinatura, então sem
    desinstalar), abrir e confirmar que a sessão continua, sem pedir login.
11. **Web, depois do merge**: rodar o e2e no CI pela branch
    (`gh workflow run test.yml --ref chore/expo-sdk-58`, porque os secrets não
    chegam a PR de bot) e conferir o `renders motorista mapa` e um preview da
    Vercel com login.

## 6b. Correções da revisão (rodada 2)

- `d8595833`: patch com `LegacyFlatList as FlatList` (DraggableFlatList nas 3
  árvores + refContext), `queueMicrotask(reset)` (existe no RN 0.88:
  `setUpTimers.js`), lib fixada em 4.0.3 e `patch-package --error-on-fail` no
  postinstall e no CI.
- `6391ff41`: MiniMap `requestIdleCallback(cb, { timeout: 300 })`.
- `d84dbf64`: handler de notificação sem `shouldShowAlert`.
- `e447d911`: um `GestureHandlerRootView` na raiz; saíram os do layout do
  motorista, DraggableStopList e checkpoints.
- `6fef83a8`: 1.15.0 / versionCode 3050.
- `ea5ba678`: pendência 31 do PROJECT_CONTEXT.
- Correção ao §5: o risco 6 (safe-area no web) não procede. O
  `SafeAreaProvider` do app fica dentro do provider zerado do expo-router e
  vence.

## 7. Bloqueios

Nenhum bloqueio definitivo. Todas as dependências nativas têm versão compatível
instalada. O que falta é o que estava fora do meu alcance: build nativo, teste no
aparelho e e2e/mapa web autenticado.
