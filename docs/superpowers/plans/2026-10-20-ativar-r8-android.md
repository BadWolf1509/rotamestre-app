# Ativar R8 (minificação + ofuscação) no build Android — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar R8 e `shrinkResources` no build `release` Android, tirando a Play do aviso "Ofuscação (1%)" (prazo fev/2027), sem quebrar nada que dependa de reflexão/JNI.

**Architecture:** Só configuração: plugin `expo-build-properties` no `app.config.js`. Regras ProGuard extras **apenas** onde a documentação/fonte da lib pedir — hoje nenhuma (ver Decisões). A prova é o build EAS `preview` (que é `assembleRelease`, logo passa pelo R8) instalado no moto g15 com o roteiro completo.

**Tech Stack:** Expo SDK 56 → 57 (`expo-build-properties`), AGP/R8, EAS Build, `adb`.

**Spec:** sem documento separado; a spec é a seção Decisões abaixo + o aviso da Play sobre a 1.12.9.

## Decisões

1. **Ordem: com o SDK 57, não antes.** A 1.13.0 sai sem R8 (já leva mudanças nativas). O plano do SDK 57 (`origin/docs/plano-sdk-57`, `docs/superpowers/plans/2026-10-20-upgrade-expo-sdk-57.md`) exige uma bateria no aparelho; o R8 aproveita a mesma bateria. **Mas não pode contaminar a medição de memória** daquele plano (Decisão 4 de lá: "uma variável só"). Proposta: R8 é **um commit separado no mesmo PR do SDK 57** (ou um PR logo depois, sem empilhar), e:
   - a medição de memória (Tasks 1 e 5 do SDK 57) usa o APK **sem** R8;
   - o roteiro funcional (Task 4 do SDK 57) roda **uma vez**, no APK **com** R8 — cobre os dois.
     **Decidido pelo usuário em 20/10/2026: commit separado dentro do PR do SDK 57.** Este plano roda na branch `chore/expo-sdk-57`, depois da Task 2 daquele plano (troca de SDK) e antes da Task 4 (roteiro no aparelho); o APK da Task 5 de lá (medição) sai do commit anterior a este.
2. **Flags** (doc oficial: <https://docs.expo.dev/versions/latest/sdk/build-properties/>): `android.enableMinifyInReleaseBuilds: true`, `android.enableShrinkResourcesInReleaseBuilds: true` (a doc manda usar junto do minify). **Não** ligar `enableBundleCompression` (não é R8 e pode atrasar a partida).
3. **Regras ProGuard — nenhuma extra, por lib:**
   - **expo, expo-modules-core, expo-location, expo-task-manager, expo-notifications, expo-updates; reanimated; worklets** — trazem `consumerProguardFiles 'proguard-rules.pro'` no próprio `android/build.gradle` (conferido em `node_modules` em 20/10). Entram sozinhas.
   - **MapLibre Native Android** (AAR usado por `@maplibre/maplibre-react-native`) — `consumerProguardFiles("proguard-rules.pro")` em `platform/android/MapLibreAndroid/build.gradle.kts`, com keeps de gson/geojson/enums chamados do nativo. O wrapper RN não documenta regra (busca no repo `maplibre/maplibre-react-native`: só o `proguard-rules.pro` vazio do exemplo).
   - **Nitro / Unistyles** — sem doc de ProGuard (busca nos repos `mrousavy/nitro` e `jpudysz/react-native-unistyles`); o código gerado anota com `@Keep`/`@DoNotStrip` (204 ocorrências), mantidos pelas regras do AndroidX e do `react-android`.
   - **FCM** — `firebase-messaging` traz regras no AAR.
   - Se o aparelho mostrar `ClassNotFoundException`/`NoSuchMethodError`/`NoSuchFieldError` com nome ofuscado, aí entra regra em `extraProguardRules`, com o stack e a fonte no PR.
   - **Medido em 21/10/2026, contra a premissa acima:** o `AppLoaderProvider` do expo-modules-core instancia `expo.modules.adapters.react.apploader.RNHeadlessAppLoader` por `Class.forName`, a partir do `meta-data` `org.unimodules.core.AppLoader#react-native-headless` do manifest — referência que o R8 não enxerga e que nenhum `proguard-rules.pro` de lib cobre. Com R8, a classe sumia: o job de localização (`TaskJobService` → `TaskService.executeTask`) caía em `NullPointerException` e o app entrava em crash em loop, inclusive na partida normal com job pendente. Regra em `extraProguardRules`: `-keep class * implements expo.modules.apploader.HeadlessAppLoader { <init>(); }`, guardada por `app-config-r8.test.ts`.
4. **Crash ofuscado:** sem serviço de erro no app; o `mapping.txt` vai dentro do `.aab` (`BUNDLE-METADATA`) e a Play desofusca o ANR/crash do Console sozinha. Conferir no Task 3.

## Global Constraints

- `eas.json` é protegido pelo hook — não editar (o perfil `preview` já é `assembleRelease`).
- Builds só pelo EAS: `npx --yes eas-cli@latest build --profile preview --platform android`; acompanhar com `build:list --json --non-interactive`.
- Jest sempre com `--testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees`; nunca `--no-verify`.
- Banco único = produção: login e ações que gravam (concluir parada, push) com o OK do usuário. Desinstalar só com OK.
- Sem merge e sem upload na Play sem o OK do usuário.

## Review Focus

1. **Rastreamento em segundo plano** — `TaskManager` acha a task por nome via reflexão do expo-task-manager; se o R8 renomear, a navegação entra sem "Rastreando". Roteiro passo 4.
2. **Toque no pino/balão do mapa nativo** — eventos Fabric do maplibre-react-native não têm regra própria. Roteiro passo 3.
3. **Push recebido com o app morto** — o serviço FCM é instanciado pelo sistema a partir do manifest. Roteiro passo 5.
4. **Restauração pós-câmera** (`always_finish_activities 1`) — `ImagePicker.getPendingResultAsync()` sem regra própria do expo-image-picker. Roteiro passo 6.
5. **Tema (Unistyles/Nitro) na partida a frio** — HybridObject não achado = crash na hora. Roteiro passos 1 e 7.

---

### Task 1: Configuração + guarda estática

**Files:**

- Modify: `package.json`, `package-lock.json` (`npx expo install expo-build-properties`)
- Modify: `app.config.js` (array `plugins`)
- Create: `src/lib/__tests__/app-config-r8.test.ts`

- [ ] **Step 1: Teste que falha** — `app-config-r8.test.ts`: chama `require('../../../app.config.js')({ config: {} })`, acha a entrada `['expo-build-properties', opts]` em `plugins` e espera `opts.android.enableMinifyInReleaseBuilds === true` e `opts.android.enableShrinkResourcesInReleaseBuilds === true`.
- [ ] **Step 2:** `npx jest src/lib/__tests__/app-config-r8.test.ts --testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees` → FAIL (plugin ausente).
- [ ] **Step 3:** `npx expo install expo-build-properties` (versão que o SDK fixar) e a entrada no `plugins` com as duas flags e um comentário apontando para este plano.
- [ ] **Step 4:** teste → PASS; `npx expo config --type prebuild` mostra o plugin; `npm run type-check`, `npm run lint`, `npx expo install --check` → exit 0.
- [ ] **Step 5:** commit `build(android): ativa R8 e shrinkResources no release`.

### Task 2: Build EAS e tamanho

- [ ] **Step 1:** Anotar o tamanho do último `preview` sem R8 da mesma base (o do SDK 57, se já existir; senão buildar o commit anterior) e do último `.aab` de produção (`build:list --json`).
- [ ] **Step 2:** `npx --yes eas-cli@latest build --profile preview --platform android --non-interactive --no-wait`; poll com `build:list`. Esperado: `FINISHED`. Falha de R8 (`Missing class …`) → regra `-dontwarn` só para a classe citada, com a fonte.
- [ ] **Step 3:** Baixar o APK, comparar tamanho; `unzip -l` para ver `classes*.dex` antes/depois (dex menor = R8 rodou de fato, não só a flag).

### Task 3: Roteiro no moto g15 (adb, logcat aberto filtrando `AndroidRuntime|ReactNativeJS|R8|ClassNotFound|NoSuch`)

- [ ] **Step 1:** `adb install -r` (preserva login; se a assinatura diferir, pedir OK para desinstalar). Partida a frio (`am force-stop` + `monkey`): sem crash, splash → Início.
- [ ] **Step 2:** Login/logout do motorista de teste (usuário digita).
- [ ] **Step 3:** Início + mapa nativo: tocar pino → balão abre; tocar mapa → fecha (`input motionevent DOWN/MOVE/UP`).
- [ ] **Step 4:** Navegação com "Navegar com" = RotaMestre: "Rastreando" aparece na 1ª entrada; app em 2º plano 2 min → posição continua chegando (consulta ao banco com o OK do usuário).
- [ ] **Step 5:** Push: app morto, disparar notificação (OK do usuário) → chega e abre o app.
- [ ] **Step 6:** Câmera/comprovante com `always_finish_activities 1` (anotar valor original e restaurar) → foto restaurada na parada certa.
- [ ] **Step 7:** Tema claro ↔ escuro; partida a frio de novo em cada tema.
- [ ] **Step 8:** Logcat sem exceção de classe/método ausente durante todo o roteiro.

### Task 4: PR

- [ ] **Step 1:** Abrir PR com tamanhos antes/depois, resultado de cada passo do roteiro e as fontes da Decisão 3. Sem merge, sem upload na Play.
- [ ] **Step 2:** Depois do upload na faixa interna (com OK), conferir no Play Console que o aviso de ofuscação some e que o mapping foi reconhecido (Decisão 4).
