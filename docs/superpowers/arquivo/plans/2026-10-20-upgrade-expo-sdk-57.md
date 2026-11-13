# Upgrade Expo SDK 56 → 57 (RN 0.86.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recomendado aqui — ver "Execução") ou superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o app Android do Hermes V1 com a regressão de memória (RN 0.85.3 / Hermes `250829098.0.10`) subindo para Expo SDK 57 (`expo@~57.0.30`, RN 0.86.3, Hermes V1 `250829098.0.17`), e **medir** o ganho de memória no moto g15 antes de publicar.

**Architecture:** Um PR só, com a troca de SDK e nada além do que o `expo install --fix` exige (mais o bump de versão, obrigatório por causa do `runtimeVersion: appVersion`). A validação sobe três degraus — estático → build EAS `preview` → aparelho — e a medição de memória compara dois APKs `preview` do EAS (baseline da `main` no SDK 56 contra o candidato) no mesmo aparelho, no mesmo dia, com o mesmo roteiro. Publicação só depois, interna → alpha, com reversão por build novo de versionCode maior.

**Tech Stack:** Expo SDK 57 / React Native 0.86.3 / Hermes V1, EAS Build (perfil `preview` e `production`), `adb` (platform-tools do WinGet), Play Developer API via `scripts/play-*.mjs`.

**Spec:** sem documento separado. A "spec" é a seção **Decisões** abaixo, montada a partir do changelog do SDK 57 (<https://expo.dev/changelog/sdk-57>, "Known regressions"), das notas do RN 0.86 (<https://reactnative.dev/blog/2026/06/11/react-native-0.86>), do `bundledNativeModules.json` do `expo@57.0.30` (lido do tarball em 20/10/2026) e das memórias do projeto citadas em cada passo.

## Decisões (a "spec")

1. **Por que subir.** O `expo doctor` do build EAS de 20/10/2026 aponta a regressão de memória do Hermes V1 ([expo/expo#46519](https://github.com/expo/expo/issues/46519)): apps que importam `react-native-reanimated` ou `react-native-worklets` podem ter aumento grande de memória no SDK 56 / RN 0.85. O RotaMestre importa os dois (reanimated 4.3.1, worklets 0.8.3; o import vive em `StartRouteButton.tsx`, `ReorderableList.tsx`, `ParadasListAndActions.tsx`, mas basta a lib inicializar). A correção está no RN ≥ 0.86.2 (`expo@57.0.9`); o SDK 56 não recebe patch. O contorno "Worklets bundle mode" é **experimental e desaconselhado em produção** pelo próprio changelog — descartado.
2. **Alvo: `expo@~57.0.30`** (último do SDK 57 em 20/10/2026), que fixa **`react-native@0.86.3`**. O 0.86.3 (`expo@57.0.17`) também corrige uma regressão de tempo de partida em **dev** (#48298) — irrelevante para produção, mas não há motivo para parar no 57.0.9. O `react-native@0.86.3` depende de `hermes-compiler@250829098.0.17`; o runtime vem de `HERMES_V1_VERSION_NAME` em `node_modules/react-native/sdks/hermes-engine/version.properties` (hoje `250829098.0.10`; tem de passar a ≥ `250829098.0.16`).
3. **Não pular para o SDK 58.** O `latest` do npm já é `expo@58.0.16`, mas ele traz **RN 0.88 e React 19.3**, reanimated 4.7 e worklets 0.13 — dois saltos de RN (0.87 tem "Strict TypeScript API, Metro update, AGP 9") de uma vez, numa cadeia nativa sem trava (Nitro → Unistyles, maplibre). A Expo recomenda um SDK por vez. O 58 vira plano próprio depois que o 57 estiver em campo — e já tem um bloqueio conhecido: o RN 0.87 remove `InteractionManager`, usado pelo `react-native-draggable-flatlist` e por `MiniMap.tsx` (ver matriz).
4. **Um PR só, mínimo.** Entra o que o `npx expo install expo@~57.0.30 --fix` muda, mais `version`/`androidVersionCode`. **Não** entram bumps "aproveitando a viagem" (maplibre 11.5.0, Nitro, Unistyles) — se um quebrar, a bisseção precisa de uma variável só. Exceção: se o build EAS falhar numa dessas libs com o RN 0.86, o bump mínimo que compila entra no mesmo PR, com a causa registrada.
5. **Versão nova é obrigatória, não cosmética.** `app.config.js` usa `runtimeVersion: { policy: "appVersion" }` com `expo-updates`. Sem trocar `version`, um OTA publicado para 1.12.9 (bundle compilado contra RN 0.85) chegaria ao binário 0.86 e vice-versa. O PR leva **1.12.9 → 1.13.0** e `androidVersionCode` +1 (`npm run bump:android`). **Revisto em 21/10/2026:** a `main` já estava em 1.13.0 (publicada), e o usuário decidiu que o PR #608 **não** muda versão. Consequência: até sair um binário 1.13.1+, nenhum `eas update` pode ser publicado para 1.13.0 — atingiria tanto o binário RN 0.85 da Play quanto o RN 0.86 deste PR. O bump fica para o PR/etapa de release.
6. **A medição decide a narrativa, não o merge sozinha.** Se o ganho medido ficar dentro do ruído entre corridas, a conclusão é "a regressão não pesava no nosso uso" e a publicação vira decisão do gestor, com os números na mão — o SDK 56 continua sem patch de qualquer forma.

## Matriz de compatibilidade

Versões-alvo lidas do `bundledNativeModules.json` do `expo@57.0.30` em 20/10/2026. Os patches exatos serão os que o `expo install --fix` resolver no dia; o que importa é a linha (`~57.0.x`).

**Fixados pelo SDK (o `--fix` resolve):**

- `expo` ~56.0.20 → **~57.0.30**; `react-native` 0.85.3 → **0.86.3**; `react` / `react-dom` / `react-test-renderer` 19.2.3 → **19.2.3** (sem mudança).
- `react-native-reanimated` ~4.3.1 → **4.5.1** (peer: `react-native 0.83 - 0.86`, `react-native-worklets 0.10.x`).
- `react-native-worklets` 0.8.3 → **0.10.1** (peer: `react-native 0.83 - 0.86`). O plugin Babel `react-native-reanimated/plugin` (em `babel.config.js`) **continua** existindo no 4.5.1 e reexporta `react-native-worklets/plugin` — conferido no tarball; `babel.config.js` não muda.
- `react-native-gesture-handler` ~2.31.2 → **~2.32.0**.
- Sem mudança de linha: `react-native-screens` ~4.26.0, `react-native-safe-area-context` ~5.7.0, `@shopify/flash-list` 2.0.2, `@react-native-async-storage/async-storage` 2.2.0, `@react-native-community/datetimepicker` 9.1.0, `@react-native-community/netinfo` 12.0.1, `@react-native-community/slider` 5.2.0, `react-native-web` ~0.21.
- Módulos `expo-*` (todos 56 → 57): `expo-asset` ~57.0.20 · `expo-audio` ~57.0.5 · `expo-battery` ~57.0.3 · `expo-clipboard` ~57.0.2 · `expo-constants` ~57.0.22 · `expo-dev-client` ~57.0.20 · `expo-device` ~57.0.2 · `expo-file-system` ~57.0.7 · `expo-font` ~57.0.4 · `expo-haptics` ~57.0.3 · `expo-image-manipulator` ~57.0.21 · `expo-image-picker` ~57.0.20 · `expo-keep-awake` ~57.0.2 · `expo-linking` ~57.0.13 · `expo-location` ~57.0.21 · `expo-network` ~57.0.2 · `expo-notifications` ~57.0.23 · `expo-router` 56.2.19 → **~57.0.28** · `expo-secure-store` ~57.0.4 · `expo-sharing` ~57.0.23 · `expo-splash-screen` ~57.0.10 · `expo-status-bar` ~57.0.1 · `expo-task-manager` ~57.0.21 · `expo-updates` ~57.0.26 · `@expo/log-box` → ^57.0.4 · `jest-expo` → ~57.0.6.
- `@react-native/jest-preset` já está em **^0.86.2** no `package.json` (adiantado em relação ao RN 0.85.3 de hoje). Alinhar a **0.86.3**, junto do RN.

**Fora do SDK (a cadeia nativa sem trava):**

- **`react-native-nitro-modules` 0.37.1 — manter.** Peer `react-native: *`, sem trava; o `devDependency` revela que foi construído contra o **RN 0.85.3**. O acoplamento com o RN é a JSI. Medido em 20/10 (tarballs do RN 0.85.3 × 0.86.3): o 0.86 reestruturou `jsi.h` — nasce `jsi::IRuntime` com os métodos de runtime virtuais puros, e `class Runtime : public IRuntime` mantém a API acessível pelo `Runtime&` "por compatibilidade". Isso quebra quem **herda** `Runtime` (decorators, engines), não quem **chama**. O `cpp/` do Nitro só inclui `<jsi/jsi.h>` e `<jsi/JSIDynamic.h>` (este idêntico entre as versões), não herda `Runtime`/`RuntimeDecorator` e não usa `getRuntimeData`/`setRuntimeData`/`castInterface`/`PointerValue` — **zero** ocorrências. Previsão: compila. O juiz é o build EAS (Task 3).
- **`react-native-unistyles` 3.5.3 — manter, e não descer.** Peer `react-native >=0.81.0`; o `devDependency` mostra que o 3.5.3 já é construído contra **RN 0.87.1**, Nitro 0.37.1 e reanimated 4.7.0 — mais novo que o nosso alvo. Tem guarda explícita para o RN 0.86: `cxx/shadowTree/NativeProps.h` trava `family->nativePropsMutex` quando `REACT_NATIVE_VERSION_MINOR == 86 && PATCH >= 1`, porque desde o 0.86.1 o RN protege `nativeProps_DEPRECATED` com esse mutex e sem ele há corrida. A guarda existe desde o 3.4.0 — o bump para 3.5.3 (#583, 19/10) **já** nos põe do lado certo; reverter o #583 depois deste upgrade reabriria a corrida. Também não herda `jsi::Runtime` (zero ocorrências em `cxx/`).
- **`@maplibre/maplibre-react-native` 11.3.10 (lock) — manter.** Peer `react-native >=0.80.0`, `expo >=54`; tanto o 11.3.10 quanto o último (11.5.0) declaram `devDependency` RN 0.85.3. O `android/` é Kotlin + componentes Fabric via codegen, sem C++ contra a JSI — acoplamento menor que o da cadeia Nitro. O 11.5.0 muda 7 arquivos de `android/`; fica para um PR próprio depois (Decisão 4). Validação no aparelho com os cenários que discriminam (Task 4, Step 2).
- **`react-native-draggable-flatlist` 4.0.3 — manter, risco a vigiar.** JS puro, sem release desde 05/2025, peers `reanimated >=2.8.0` e `gesture-handler >=2.0.0` (nada trava). Usado só no gestor (`ReorderableList.tsx`, `ParadasListAndActions.tsx`), que roda essencialmente na web — validar arrastando paradas no modal de reordenação na web (dev server) e pelos e2e.
- **JS puro, peer `*`:** `react-native-toast-message` 2.5.2, `react-native-ui-datepicker` 3.3.0, `react-native-url-polyfill` 4.0.0 — sem ação.

**O que mais se sabe (pesquisa de 20/10/2026, releases e issues no GitHub):**

- **Causa da regressão** ([post da Software Mansion](https://swmansion.com/blog/how-worklets-bundle-mode-accidentally-fixed-Hermes-v1-memory-regression/), comentário da Expo em #46519): o Hermes V1 ≤ `250829098.0.15` guarda ~512 KB de metadados de depuração **por função avaliada com `eval`**; o modo "Legacy Eval" dos worklets avalia cada worklet, e o reanimated avalia **mais de 100 na partida**. Ou seja, o custo é **fixo e aparece logo após a inicialização** (ordem de dezenas de MB de heap nativo), não um vazamento que cresce com as horas. Isso define o que medir (Task 1/5). Resíduo conhecido: expo/expo#51581 (aberta, 15/10) — `expo-modules-core` ainda segura ~0,57 MiB por classe no Hermes `.0.17`; não há correção a esperar para ela neste plano.
- **Nitro:** nenhuma issue de compilação por `jsi::IRuntime`. A única quebra do RN ≥ 0.86 conhecida (margelo/nitro#1656, Android sem `ViewProps` base) atinge só **Hybrid Views** — o Unistyles usa zero (memória `rotamestre-nitro-unistyles-acoplamento`). A correção (#1749) foi mergeada em 19/10 e ainda não saiu; não precisamos dela.
- **Unistyles:** o crash "an empty object is not a valid style value" com reanimated **4.5.0** (jpudysz/react-native-unistyles#1213) foi fechado com a orientação de usar reanimated > 4.5.0 — o SDK 57 instala o **4.5.1**. Não deixar o `--fix` (nem ninguém) fixar 4.5.0. Aberta e sem versão: #1309 (`withUnistyles(Animated.View)` perde estilos do array) — o app não usa `withUnistyles` em lugar nenhum (varredura de 20/10).
- **maplibre:** o defeito do drawer sobre o mapa (#1455) foi corrigido no MapLibre Native Android 13.2.0, que o 11.3.10 já traz. O PR de exemplos "RN 0.86 + Expo 57" do projeto (#1713) ainda está aberto; nenhuma falha de build reportada com RN 0.86.
- **draggable-flatlist:** usa `InteractionManager`, que o RN 0.86 só **deprecia** (aviso `warnOnce`) e o **0.87 remove** (issue #627 aberta, correção #628 não mergeada). Funciona no SDK 57; **bloqueia o SDK 58** se nada mudar. O próprio app também chama `InteractionManager.runAfterInteractions` em `src/components/motorista/home/MiniMap.tsx:313` — mesma situação.
- **reanimated 4.4/4.5 e worklets 0.10:** removidos `useInterpolateConfig`, `InterpolateConfig`, `ColorSpace`, `withInitialValues`/`withTargetValues`, `PlainStyle`, `workletizableModules` — **nenhum** usado no código (varredura de 20/10). O 4.5.0 corrige animações congelando no RN 0.86.
- **gesture-handler 2.32:** suporte ao RN 0.86 e correção do import de `RNRenderer` para 0.86+; remove `getChildInDrawingOrderAtIndex` no Android (não usado aqui).
- **Módulos `expo-*` 57.0.0:** os CHANGELOGs de notifications, location, task-manager, image-picker, updates, file-system, splash-screen e jest-expo dizem "no user-facing changes". Patches 57.0.x relevantes: `expo-location` (corrige `startLocationUpdatesAsync` exigindo `FOREGROUND_SERVICE_LOCATION`), `expo-task-manager` (vazamento do `TaskService`), `expo-updates` ("Launch asset not found") e `expo-modules-core` (callbacks de worklet com `NoSuchFieldError` em release minificado). **E um que toca fluxo nosso:** `expo-router` — _"[android] Remove navigation state restoration across activity recreation"_ (expo/expo#47422). O restore da conclusão com foto já supõe que a navegação volta à Início (por isso vive em hook de **tela** — ver `CLAUDE.md`), mas isso precisa ser visto no aparelho, não presumido (Task 4, Step 4).
- **Toolchain Android:** `libs.versions.toml` do RN idêntico entre 0.85.3 e 0.86.3 — minSdk 24, compile/target 36, NDK 27.1.12297006, AGP 8.12.0, Kotlin 2.1.20, Gradle 9.3.1. Nenhuma mudança de imagem EAS esperada (`image: latest` no `eas.json`).

## Breaking changes que tocam o código

O SDK 57 declara **nenhuma** quebra de SDK e o RN 0.86 se anuncia "no breaking changes". O que existe são **mudanças de comportamento**, e o moto g15 roda **Android 15** — justamente onde várias delas mudam layout:

1. **`KeyboardAvoidingView` passa a funcionar no Android 15+ com edge-to-edge.** Usado em `app/auth/login.tsx:422`, `forgot-password.tsx` e `reset-password.tsx`. Se havia compensação implícita, o formulário pode subir em dobro. → roteiro de aparelho, item "Login com teclado".
2. **`Modal` passa a aplicar a prop `style` ao contêiner interno.** São 51 `<Modal` em `src/` e `app/`; a varredura de 20/10 não achou nenhum com `style` direto na tag (o `style` em `DrawerMenu.tsx:114` é do `TouchableOpacity` filho). → Task 2 repete a varredura como guarda.
3. **`Dimensions` / `measureInWindow` corrigidos sob edge-to-edge.** Nenhum uso de `measureInWindow` hoje. O PiP de navegação força `ANDROID_MIN_NAV_BAR_HEIGHT = 34` porque "Android 15 may return insets.bottom = 0" (`src/hooks/navigation/pip/constants.ts:27`) — se o inset passar a vir certo, a soma pode dobrar o espaço. → roteiro de aparelho, item "Modo navegação: PiP e barra inferior".
4. **`StatusBar` pode mudar estilo com `Modal` aberto; contraste da barra de navegação respeita o tema.** Toca a cor da status bar nos modais (`StopCompletionFlow`) com tema escuro. → roteiro, item "Tema".
5. **Sincronia do Animated nativo com commits do React** e **transformações não inversíveis (`scale: 0`) deixam de receber toque.** 33 arquivos `.tsx` usam `Animated`; risco baixo, coberto pelo uso geral do roteiro.
6. **Metro `^0.84.3`** vem com o RN 0.86. O `metro.config.js` não referencia `metro-minify-terser` (dev dep ^0.87.1, sem uso no config) — não mexer; o `build:web` da Task 2 prova o empacotamento.
7. **`expo prebuild` limpa `android/` e `ios/` por padrão.** Irrelevante: o repo é CNG puro (não há `android/` nem `ios/` versionados) e o EAS faz o prebuild.
8. **iOS 27 exige ciclo de vida por scene;** no SDK 57 é opt-in via `ios.enableSceneSupport` no `expo-build-properties` (≥ `expo@57.0.23`). Não há build iOS publicado ainda (`docs/APP_STORE_DEPLOYMENT.md`); registrar como pendência do caminho iOS, **fora deste PR**.

## Global Constraints

- Nenhuma mudança de código de produção além do que o upgrade exigir; cada mudança de código no PR vem com a causa (log de build, erro de tipo, teste) no corpo do PR.
- Versões: `expo ~57.0.30`, `react-native 0.86.3`, Hermes V1 ≥ `250829098.0.16`; React continua 19.2.3.
- Sem Android SDK nesta máquina: **todo build nativo é EAS** (`npx --yes eas-cli@latest`, nunca o global sem conferir — memória `eas-cli-global-desatualizado-quebra-build`).
- O app de teste fala com o **Supabase de produção**: login, permissões e qualquer ação que grave no banco (atribuir rota, concluir parada, push) são do usuário ou com o OK dele (memória `validar-bump-nativo-em-aparelho`).
- Desinstalar o app do aparelho apaga sessão e fotos offline — **pedir OK antes**. Entre dois APKs do EAS, `adb install -r` preserva o login.
- Anotar o valor original **antes** de mexer em `always_finish_activities`, `font_scale`, `screen_off_timeout`, `accelerometer_rotation`, e restaurar no fim.
- Publicar na Play é ação externa: cada faixa com o OK explícito do gestor. Nunca anotar versionCode em documento — perguntar ao `npm run play:status`.
- Merge: squash + `--admin` (memória `rotamestre-merge-precisa-admin-override`).

## Review Focus

1. **Login no Android 15 com teclado aberto** — o `KeyboardAvoidingView` muda de comportamento justo no aparelho de campo; o motorista precisa ver o botão "Entrar" sem rolar. Coberto no roteiro (Task 4, passo 5).
2. **Recriação da Activity no meio da conclusão com foto** — o hook `useRestaurarConclusaoEmVoo` depende de `ImagePicker.getPendingResultAsync()` do `expo-image-picker` 57; se a API mudou de forma, a foto some ou cai na parada errada. Coberto (Task 4, passo 4).
3. **Serviço em primeiro plano ao entrar na navegação** — `expo-location`/`expo-task-manager` 57 e a janela de `onHostPause` (#570): "Rastreando" tem de aparecer já na primeira entrada. Coberto (Task 4, passo 3).
4. **Ler o ganho no lugar certo** — pela causa conhecida (metadados de `eval` dos worklets na partida), a diferença deve aparecer como **patamar** de `Native Heap`/`TOTAL PSS` já na Início, não como inclinação. Mas o motorista usa o app por horas: a série de 30 min no modo navegação garante que o patamar menor não seja compensado por crescimento novo. Coberto (Task 1 e Task 5).
5. **OTA cruzando runtime** — sem o bump para 1.13.0, um `eas update` derrubaria o app. Coberto pela checagem da Task 2, passo 6.

## Execução

As tasks são sequenciais e quase nada é código: são builds EAS, comandos `adb` e decisões que pedem o usuário (desinstalar, logar, gravar no banco, publicar). Execução **inline** (`superpowers:executing-plans`), numa sessão com o aparelho conectado; subagentes não ajudam onde o gargalo é a fila do EAS e a mão do usuário. Só o script da Task 1 é código, e cabe numa revisão.

---

### Task 0: Pré-requisito — `main` alinhada no SDK 56

O `expo doctor` também apontou patches `expo-*` desalinhados no SDK 56; a sessão [Alinhar patches expo-* do SDK 56](#local_62b62dfc-d025-4d44-955f-7ed0b96cb282) cuida disso. A baseline de memória tem de sair **dessa** `main`, senão o "antes" mistura duas mudanças.

- [ ] **Step 1:** Confirmar que o PR do alinhamento do SDK 56 foi mergeado e que o run de `main` depois dele está verde (`gh run list --branch main --limit 3`).
- [ ] **Step 2:** `git switch main && git pull --ff-only`; anotar o SHA — é o commit da **baseline**.

### Task 1: Script de medição + baseline (SDK 56)

**Files:**

- Create: `scripts/medir-memoria-android.sh`

**Interfaces:**

- Produces: `bash scripts/medir-memoria-android.sh <rotulo> [duracao_s=1800] [intervalo_s=60]` — imprime CSV em stdout e grava o mesmo em `$TMPDIR/memoria-<rotulo>-<AAAAMMDD-HHMMSS>.csv`. Colunas: `t_s,pid,total_pss_kb,total_rss_kb,java_heap_pss_kb,native_heap_pss_kb,graphics_pss_kb,code_pss_kb,total_swap_pss_kb`. Pacote fixo `br.tec.rotamestre.app`. Sai com código 2 se o `pid` mudar no meio da série (processo reiniciou → série inválida).

Fonte: a seção `App Summary` de `adb shell dumpsys meminfo br.tec.rotamestre.app` (linhas `Java Heap:`, `Native Heap:`, `Code:`, `Graphics:` — coluna Pss — e `TOTAL PSS:` / `TOTAL RSS:`). `export MSYS_NO_PATHCONV=1` no topo (Git Bash).

- [ ] **Step 1: Escrever o script** com a interface acima.
- [ ] **Step 2: Conferir o parser contra a saída crua.** Com o app aberto: `bash scripts/medir-memoria-android.sh teste 60 30` e, no mesmo minuto, `adb shell dumpsys meminfo br.tec.rotamestre.app | sed -n '/App Summary/,/TOTAL SWAP/p'`. Esperado: os números da última linha do CSV batem com o bloco cru (±ruído de 1 amostra). Um campo vazio ou `0` em `total_pss_kb` = parser quebrado, não app leve.
- [ ] **Step 3: Commit** `chore(scripts): medição de memória do app Android por dumpsys`.
- [ ] **Step 4: Build da baseline.** `npx --yes eas-cli@latest build --platform android --profile preview --non-interactive --wait` no SHA da Task 0. Acompanhar por `build:list --platform android --limit 3 --json --non-interactive` (nunca `build:view`). Fila > 1 h é normal.
- [ ] **Step 5: Instalar no moto g15.** Conferir a assinatura instalada (`adb shell dumpsys package br.tec.rotamestre.app | grep -A1 signatures`). Se for a da Play, **pedir OK** ao usuário para desinstalar. Instalar com `adb install -r`, conferir md5 do APK instalado contra o baixado. Pedir ao usuário que faça login como o motorista de teste.
- [ ] **Step 6: Preparar o cenário comparável** (vale também para a Task 5 — repetir idêntico):
  - rota do motorista de teste `em_andamento` via `e2e/fixtures/garantir-rota-do-mapa.ts` (escreve em produção: OK do usuário);
  - Configurações → "Navegar com" = **Mapa do RotaMestre**; tema = o que estiver, **anotado**; `font_scale` 1.0;
  - aparelho no cabo, economia de bateria desligada, tela sem bloquear (anotar `screen_off_timeout` antes de mudar);
  - fechar outros apps em primeiro plano.
- [ ] **Step 7: Medir 3 corridas.** Cada corrida: `adb shell am force-stop br.tec.rotamestre.app` → `adb shell monkey -p br.tec.rotamestre.app -c android.intent.category.LAUNCHER 1` → disparar **imediatamente** `bash scripts/medir-memoria-android.sh baseline-N 1920 60` (t=0 é a partida) → ficar até t=120 s na **Início** → tocar "Navegar" na próxima parada (entra no modo navegação) → ficar parado no modo navegação até o fim da série → sair do modo navegação. Guardar os 3 CSV fora do repo e anotar SHA, md5 do APK e horário.
- [ ] **Step 8: Registrar** no corpo do (futuro) PR, por corrida: `total_pss_kb` e `native_heap_pss_kb` em t=120 s (**Início estável** — onde a causa conhecida prevê a maior diferença), t=420 s (5 min de navegação) e t=1920 s (30 min de navegação), e a inclinação `(pss_1920 − pss_420) / 25` em KB/min. Anotar também a amplitude entre as 3 corridas — é o ruído contra o qual o ganho será lido.

### Task 2: Troca de SDK (estático)

**Files:**

- Modify: `package.json`, `package-lock.json` (só pelo `expo install`)
- Modify: `package.json` campos `version` (1.13.0) e `androidVersionCode` (+1 via script)
- Modify (se e somente se exigido por erro): arquivos apontados pelos checks abaixo

- [ ] **Step 1:** `git switch -c chore/expo-sdk-57 main` (memória `criar-branch-antes-de-editar`).
- [ ] **Step 2:** `npx expo install expo@~57.0.30 --fix` e depois `npx expo install --check`. Esperado: `Dependencies are up to date`. Conferir no diff que **só** mudaram pacotes da matriz "Fixados pelo SDK"; alinhar `@react-native/jest-preset` a `0.86.3` à mão se o `--fix` não o fizer.
- [ ] **Step 3: Confirmar o Hermes novo.** `grep HERMES_V1_VERSION_NAME node_modules/react-native/sdks/hermes-engine/version.properties` → ≥ `250829098.0.16` (esperado `.17`). Abaixo disso, parar: o upgrade não entrega o motivo dele.
- [ ] **Step 4:** `npx expo-doctor@latest`. Esperado: **sem** o aviso da regressão de memória do Hermes. Registrar qualquer outro aviso no PR.
- [ ] **Step 5: Varredura de quebras de comportamento.** `grep -rn --include=*.tsx -A8 "<Modal\b" src app | grep -E "^\S+-\s+style="` — esperado: só a linha de `DrawerMenu.tsx` (que é do filho). Qualquer `style` direto num `<Modal>` vai para o roteiro de aparelho como item a olhar.
- [ ] **Step 6: Bump de versão.** `version` → `1.13.0` no `package.json` e `npm run bump:android`. Conferir: `node -e "const c=require('./app.config.js')({config:{}});console.log(c.version,c.android.versionCode,c.runtimeVersion)"` imprime `1.13.0`, o versionCode novo e `{ policy: 'appVersion' }`.
- [ ] **Step 7: Checks locais**, cada um com o sinal positivo esperado:
  - `npm run type-check` → sem saída, exit 0;
  - `npm run lint` → exit 0 (`--max-warnings=0`);
  - `npm test` → mesmo número de suítes/testes da `main` (anotar os dois);
  - `npm run build:web` → termina e `dist/` contém o worker do maplibre (`ls dist | grep -i maplibre`);
  - `npm run scan:nao-declarado` e `npm run audit:prod` → exit 0. Advisory novo no audit: provar no lockfile da `main` antes de culpar o upgrade (memória `audit-vermelho-na-main-nao-e-do-merge`).
- [ ] **Step 8: Análise estática da cadeia nativa** (critério da memória `rotamestre-nitro-unistyles-acoplamento`: _o delta toca símbolo que a lib usa e, se toca, é aditivo?_). Refazer contra o `node_modules` instalado — o resultado de 20/10 está na matriz e serve de referência:
  - `diff -rq` de `ReactCommon/jsi/` entre o RN 0.85.3 (baixado com `npm pack react-native@0.85.3` num scratch) e o instalado. Esperado: só `jsi.h`, `jsi-inl.h`, `jsi.cpp`, `decorator.h`, `JSIDynamic.cpp`, teste e podspec; `JSIDynamic.h` idêntico.
  - `grep -rnE "public (jsi::|facebook::jsi::)?(Runtime|RuntimeDecorator|WithRuntimeDecorator|IRuntime)\b|getRuntimeData|setRuntimeData|castInterface|PointerValue" node_modules/react-native-nitro-modules/cpp node_modules/react-native-unistyles/cxx` → **zero** ocorrências (nenhuma das duas herda `Runtime` nem usa o que virou virtual puro).
  - `grep -n nativePropsMutex node_modules/react-native-unistyles/cxx/shadowTree/NativeProps.h` → presente (guarda do RN ≥ 0.86.1).
  - `node_modules/@maplibre/maplibre-react-native/android/` sem C++ contra o RN (só Kotlin + codegen).
    Qualquer resultado diferente: registrar no PR e deixar o build EAS da Task 3 julgar antes de mexer em versão.
- [ ] **Step 9: Commit** `chore(deps): Expo SDK 57 (RN 0.86.3) — sai da regressão de memória do Hermes V1`, push e PR em rascunho. CI: os três checks obrigatórios; disparar também `gh workflow run test.yml --ref chore/expo-sdk-57 -f update_snapshots=false` e procurar `4 passed` (mapa) e `95 passed` (suíte e2e) no log (memória `ci-verde-em-pr-do-dependabot-nao-testa-o-mapa`).

### Task 3: Build EAS `preview` do candidato

- [ ] **Step 1:** `eas --version` contra `npm view eas-cli version`; usar `npx --yes eas-cli@latest` de qualquer forma.
- [ ] **Step 2:** `npx --yes eas-cli@latest build --platform android --profile preview --non-interactive --wait` no último commit da branch. Anotar o build id completo (UUID), o `gitCommitHash` do `build:list --json` e a duração.
- [ ] **Step 3: Ler o log de build**, não só o status: procurar `expo doctor` (sem o aviso do Hermes), avisos de `react-native-nitro-modules`, `react-native-unistyles`, `maplibre`, `worklets`. Se falhar numa lib de terceiro: aplicar a regra da Decisão 4 (bump mínimo que compila, causa no PR) e voltar ao Step 2.

### Task 4: Aparelho — roteiro funcional

Instalar o APK do candidato com `adb install -r` por cima da baseline (mesma assinatura EAS → login preservado); provar a troca pelo md5 e por `lastUpdateTime` em `dumpsys package` (a versão muda para 1.13.0, mas o md5 é a prova).

- [ ] **Step 1: Partida e carga das libs nativas.** `adb logcat -c`, abrir via `monkey`, `adb logcat -d | grep -E "FATAL|nitro|unistyles|UnsatisfiedLink|dlopen"`. Esperado: `unistylesOnLoad: Successfully loaded unistyles C++ library!` **e** `NitroModules: Successfully loaded NitroModules C++ library!`, zero `FATAL`/`UnsatisfiedLinkError`. Ruído conhecido que não é do app: `libmagtsync.so` (Motorola) e `Could not find generated setter for MLRN*Manager`. Repetir a frio 3 vezes (`am force-stop` + `monkey`); erros de JS em `adb logcat -d --pid=$(adb shell pidof br.tec.rotamestre.app)` (`ReactNativeJS`).
- [ ] **Step 2: Mapa nativo (aba Mapa).** Tiles carregam; pan, zoom, rotação do aparelho (anotar `accelerometer_rotation` antes); drawer sobre o mapa (maplibre-react-native#1455); background → foreground. O toque no pino **já não funcionava** antes (memória `validar-bump-nativo-em-aparelho`) — não é critério; se passar a funcionar, registrar.
- [ ] **Step 3: Rastreamento em segundo plano.** Na rota `em_andamento`, entrar na navegação por "Navegar" (`handleNavigateToStop`). Esperado: "Rastreando" já na primeira entrada; `adb shell dumpsys activity services br.tec.rotamestre.app | grep LocationTaskService` presente; `dumpsys window windows` com `fl=KEEP_SCREEN_ON` na `MainActivity`. Mandar o app para segundo plano por 5 min e conferir, pelo Supabase (somente leitura), que `motorista_locations` do motorista de teste continuou recebendo linhas nesse intervalo.
- [ ] **Step 4: Câmera com Activity recriada** (é o passo que o `expo-router` 57 mexe: ele deixou de restaurar o estado de navegação na recriação da Activity, #47422). Anotar e ligar `settings put global always_finish_activities 1`; concluir uma parada da rota de teste pelo `StopCompletionFlow` com foto (OK do usuário — grava em produção). Esperado: ao voltar da câmera, o fluxo é restaurado na **mesma** parada e o comprovante fica nela (conferir `paradas.foto_url` daquela parada). Desligar `always_finish_activities` (valor anotado).
- [ ] **Step 5: Login com teclado (Android 15).** Pedir ao usuário que saia e volte a entrar; `adb exec-out screencap -p > login.png` com o teclado aberto no campo de senha. Esperado: botão "Entrar" visível, sem espaço vazio dobrado entre formulário e teclado. Repetir em "Esqueci a senha".
- [ ] **Step 6: Modo navegação: PiP e barra inferior.** Com a navegação aberta, screencap: o PiP e os controles não ficam atrás da barra de navegação do sistema, nem com folga dobrada (efeito possível de `ANDROID_MIN_NAV_BAR_HEIGHT` somado a um inset agora correto).
- [ ] **Step 7: Push.** Pelo caminho real (OK do usuário): o gestor atribui uma rota ao motorista de teste no painel web, o que insere em `notificacoes` com tipo `nova_rota_atribuida` e dispara `send-push-notification`. Esperado: a notificação aparece no aparelho (`adb shell dumpsys notification --noredact | grep -A3 br.tec.rotamestre.app`) e tocar nela abre o app na rota.
- [ ] **Step 8: Tema.** Configurações → Aparência: escuro ↔ claro em telas já montadas e montadas depois; abrir um modal (conclusão de parada) no escuro e olhar a status bar; 3 partidas a frio com o tema persistido (o app usa `adaptiveThemes: false`).
- [ ] **Step 9: Limpeza.** Restaurar todas as configurações anotadas, sair do modo navegação. Registrar no PR cada passo com a evidência (linha de log, screencap, consulta).

### Task 5: Medição do candidato e comparação

- [ ] **Step 1:** Repetir **exatamente** os Steps 6–7 da Task 1 com o APK do candidato, rótulos `candidato-1..3`, no mesmo dia da baseline se possível.
- [ ] **Step 2:** Montar no PR, lado a lado, as medianas das 3 corridas de cada build: `total_pss_kb` e `native_heap_pss_kb` em t=120, 420 e 1920 s, e a inclinação KB/min. Referência para a leitura: >100 worklets × ~512 KB prevê uma queda da ordem de dezenas de MB no `Native Heap` em t=120 s; muito menos que isso, com o Hermes conferido no Step 3 da Task 2, é achado a registrar, não erro de medição a esconder. Declarar o ganho **só** se a diferença das medianas for maior que a amplitude entre corridas do mesmo build; senão, escrever "dentro do ruído" (Decisão 6).
- [ ] **Step 3:** Tirar o PR de rascunho com: matriz efetiva instalada, resultados das Tasks 2–5, build ids e md5.

### Task 6: Publicação e reversão

- [ ] **Step 1: Merge** (squash, `--admin`) e acompanhar o run de `main` até os testes de mapa passarem.
- [ ] **Step 2: Build de produção do mesmo commit.** `git diff --quiet <commit-do-preview> <commit-da-producao>` tem de sair 0 (mesma árvore). `npx --yes eas-cli@latest build --platform android --profile production --non-interactive --wait`.
- [ ] **Step 3: Faixa interna** (OK do gestor): `npx --yes eas-cli@latest submit --platform android --profile internal --id <buildId> --non-interactive --wait`. **Antes**, o gestor confere no Play Console quem está na lista da interna: a Play entrega a faixa de maior prioridade, então motorista que estiver na interna recebe o candidato já aqui.
- [ ] **Step 4: Observar 1 dia de rota real** com o motorista que estiver na interna: Play Console → Android vitals (crashes/ANR — **não há Sentry**, é o único sinal de crash) e logs HTTP do Supabase filtrados pela versão 1.13.0 (memória `diagnosticar-motorista-pelos-logs-http`).
- [ ] **Step 5: Alpha** (OK do gestor): `npm run play:promote -- alpha <versionCode> 1.13.0`, depois **reaplicar as notas pt-BR** (o `play-promote.mjs` não leva `releaseNotes`; memória `play-store-faixas-e-notas`) e conferir com `npm run play:status`.
- [ ] **Step 6: Reversão, se precisar.** A Play não aceita versionCode menor e faixas de teste não têm "suspender rollout". Reverter = `git revert` do squash na `main` → versão **1.13.1** com `androidVersionCode` +1 (a árvore volta ao SDK 56; `runtimeVersion` 1.13.1 isola os OTAs) → build `production` → interna → alpha com notas. Antes do Step 3 a reversão é só não publicar (ou reverter o PR). Quem já instalou a 1.13.0 recebe a 1.13.1 pela Play como atualização normal.
- [ ] **Step 7: Registrar.** Atualizar a memória `rotamestre-nitro-unistyles-acoplamento` (seção "No horizonte" → resultado do RN 0.86 nos três degraus) e `validar-bump-nativo-em-aparelho` (o roteiro de memória e os números de referência). Entrada em `docs/HISTORICO.md` com os números de memória antes/depois. Não copiar versões para `CLAUDE.md`/`PROJECT_CONTEXT.md`.
