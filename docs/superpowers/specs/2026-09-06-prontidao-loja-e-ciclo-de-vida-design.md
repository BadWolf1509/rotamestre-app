# Prontidão de loja e ciclo de vida do rastreamento — desenho

**Data:** 06/09/2026
**Origem:** varredura de 06/09/2026, sub-projetos 4 (prontidão de loja) e 3 (ciclo
de vida), fundidos por decisão do gestor porque colidem nas mesmas linhas.
**Estado:** aprovado em conversa; plano de implementação a seguir.

---

## O problema

Três defeitos que a varredura tratou como separados. A leitura do código mostrou
que dois deles se amplificam, e o terceiro compartilha os arquivos.

### 1. O watcher de GPS que sobrevive ao próprio cleanup

Cinco arquivos criam um `Location.watchPositionAsync` dentro de uma função
assíncrona e guardam a assinatura numa variável do escopo do efeito:

| arquivo                                                 | forma                                              | consequência                      |
| ------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `src/components/motorista/NavigationMode.tsx:132`       | `let subscription` + IIFE                          | watcher `BestForNavigation` órfão |
| `src/components/motorista/NavigationMode.web.tsx:448`   | `useCallback` devolve cleanup, consumido em `:535` | idem, na web                      |
| `src/components/motorista/TurnByTurnNavigation.tsx:326` | `let subscription` + IIFE                          | idem                              |
| `src/hooks/useDriverLocationBroadcast.ts:171`           | ref atribuída depois dos `await`                   | **grava em rota já encerrada**    |
| `app/motorista/_screens/inicio.tsx:105`                 | `let subscription` + IIFE                          | idem                              |

A forma é sempre a mesma. O cleanup lê a variável **antes** de ela ser
atribuída — porque a atribuição está depois de um ou dois `await` — e a
assinatura criada em seguida nunca é removida.

O `useDriverLocationBroadcast` é o pior: o callback captura o `rotaId` do
render anterior, então o watcher órfão continua inserindo em
`motorista_locations` para uma rota que já terminou.

### 2. O amplificador: identidade de prop a 1 Hz

O efeito do watcher em `TurnByTurnNavigation.tsx` tem estas dependências:

```
[destination, handleArrival, isRouteReady, proximityRadius, updateNavigation, showError]
```

`destination` é um **literal inline** em
[`NavigationMode.tsx:334`](../../src/components/motorista/NavigationMode.tsx),
e `origin={userLocation}` muda a cada tick do watcher do próprio
`NavigationMode` — configurado com `timeInterval: 1000`.

A cadeia, dirigindo:

```
tick de GPS (1 Hz)
  → updateLocationFromCoords → userLocation muda
    → NavigationMode re-renderiza
      → destination={{…}} ganha identidade nova
        → efeito do watcher de TurnByTurnNavigation desmonta e remonta
          → cada remontagem passa pela corrida do defeito 1
```

Isto reclassifica o defeito 1. Não é "acumula quando a tela desmonta": é um
sorteio por segundo, e cada perda deixa um watcher `BestForNavigation` vivo
para sempre. O efeito irmão (`[initializeNavigation]`, `:316`) remonta junto,
produzindo uma requisição OSRM por segundo, `Speech.stop()` e o TTS rearmando
_"Iniciando navegação"_ — além de zerar `hasArrivedRef`, que é o debounce de
chegada.

### 3. Permissão negada sem saída, e o build iOS que nasce quebrado

`grep canAskAgain` devolve **zero ocorrências** no repo. Todo call site trata
"negou agora" e "bloqueou para sempre" como a mesma coisa. Depois da segunda
negação o Android para de exibir o diálogo e retorna `denied` imediatamente:
sem um caminho para as Configurações, não há volta.

Dez call sites pedem permissão. Um único acerta.

| arquivo                                                   | hoje                           |
| --------------------------------------------------------- | ------------------------------ |
| `src/components/CameraUpload.tsx:170` (câmera)            | aviso sem botão                |
| `src/components/CameraUpload.tsx:204` (galeria)           | aviso sem botão                |
| `src/components/IncidentReportWizard.tsx:215` (foto)      | aviso sem botão                |
| `src/components/IncidentReportWizard.tsx:265` (galeria)   | aviso sem botão                |
| `src/components/motorista/NavigationMode.tsx:136`         | `return` mudo                  |
| `src/components/motorista/NavigationMode.web.tsx:449`     | aviso sem botão                |
| `src/components/motorista/TurnByTurnNavigation.tsx:330`   | aviso sem botão                |
| `src/hooks/useDriverLocationBroadcast.ts:164`             | `logger.warn`                  |
| `app/motorista/_screens/inicio.tsx:110`                   | `logger.debug`, `__DEV__`-only |
| `src/components/motorista/home/PreRouteChecklist.tsx:182` | ✅ **referência**              |

O caso mais grave é `CameraUpload.tsx`: sem câmera não existe comprovante, e
sem comprovante não existe entrega. É um laço fechado dentro do app.

Duas consequências de loja andam junto:

- **`expo-image-picker` não está na lista de `plugins`** do `app.config.js:97`.
  O Expo não aplica config plugin por autolinking, então
  `NSCameraUsageDescription` nunca entra no `Info.plist` — e chamar a câmera sem
  essa chave é `SIGABRT` imediato no iOS. O Android não é afetado (a permissão
  vem do manifesto da própria biblioteca).
- **A galeria não tem as duas metades da correção da câmera.**
  `CameraUpload.openCamera:179` chama `marcarConclusaoEmVoo`; `openGallery:200`
  não. `IncidentReportWizard.takePhoto:230` salva o rascunho; `pickImage:264`
  não. É o bug já corrigido sobrevivendo no ramo vizinho do mesmo `if`.

---

## O desenho

Duas unidades novas, cada uma com uma responsabilidade, mais uma correção de
identidade de prop.

### Unidade 1 — `src/hooks/useLocationWatcher.ts`

**O que faz:** possui o ciclo de vida de um `watchPositionAsync`, e nada mais.
Não pede permissão, não formata coordenada, não conhece rota.

**Como se usa:**

```ts
useLocationWatcher({
  enabled: temPermissao,
  options: {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 5,
  },
  onLocation: (location) => {
    /* … */
  },
});
```

**De que depende:** `expo-location`.

**O núcleo:**

```ts
let cancelado = false;
let sub: Location.LocationSubscription | null = null;

(async () => {
  const s = await Location.watchPositionAsync(options, onLocationRef.current);
  if (cancelado) {
    s.remove(); // ← a metade que falta em todos os cinco call sites
    return;
  }
  sub = s;
})();

return () => {
  cancelado = true;
  sub?.remove();
};
```

**A sutileza que o desenho existe para não perder:** a flag `cancelado`
sozinha não resolve. Sem o `s.remove()` no ramo cancelado, a assinatura nasce
órfã do mesmo jeito — só que agora com um `if` que dá a impressão de tratar o
caso. É por isso que a correção precisa de um teste que desmonte durante o
`await`, e não de uma inspeção de forma.

**`onLocation` vive numa ref.** Se entrasse nas dependências do efeito, um
callback inline no chamador recriaria o watcher a cada render — que é
exatamente o defeito 2, reintroduzido dentro da correção.

**`options` entra por campo, não por objeto.** Todos os cinco chamadores passam
um literal — `{ accuracy: …, timeInterval: 1000, distanceInterval: 5 }` — e um
literal nas dependências recria o watcher a cada render. As dependências do
efeito são `options.accuracy`, `options.timeInterval` e
`options.distanceInterval`, primitivas. Sem isso, o hook reintroduz o defeito 2
dentro da própria correção, e o teste da corrida passaria mesmo assim.

**`enabled: false` desliga e limpa.** O efeito não cria watcher e o cleanup do
ciclo anterior já removeu o que existia. É assim que o chamador exprime "ainda
não tenho permissão" sem precisar montar e desmontar o componente.

**Fora do hook:** obter a posição inicial (`getCurrentPositionAsync`), que dois
chamadores fazem antes de observar, continua no chamador. E o ramo **web** de
`useDriverLocationBroadcast`, que usa `navigator.geolocation` em vez de
`expo-location`, não passa por aqui — é exceção nomeada na guarda.

### Unidade 2 — `src/lib/permissoes.ts`

**O que faz:** pede uma permissão preservando a informação que hoje se perde, e
abre as Configurações do sistema.

**Como se usa:**

```ts
export type ResultadoPermissao = {
  concedida: boolean;
  podePerguntarDeNovo: boolean; // canAskAgain — hoje descartado
};

export function abrirConfiguracoesDoApp(): void;
export async function pedirPermissao(
  solicitar: () => Promise<
    Location.PermissionResponse | ImagePicker.PermissionResponse
  >,
): Promise<ResultadoPermissao>;
```

`abrirConfiguracoesDoApp` é a ramificação de plataforma que
`PreRouteChecklist.tsx:182` já acerta (`app-settings:` no iOS,
`Linking.openSettings()` no Android, nada na web), extraída para um lugar só.

`pedirPermissao` recebe a função de solicitação como parâmetro em vez de
enumerar as permissões: os chamadores usam `ImagePicker.requestCameraPermissionsAsync`,
`ImagePicker.requestMediaLibraryPermissionsAsync` e
`Location.requestForegroundPermissionsAsync`, e um enum interno só duplicaria
essa lista.

**De que depende:** `react-native` (`Platform`, `Linking`).

#### Os dois níveis de resposta

Decisão do gestor: a resposta à negação depende de quanto a permissão é
essencial naquela tela.

**Ação bloqueada** — câmera, galeria, navegação turn-by-turn. Sem a permissão o
motorista não consegue fazer o que acabou de pedir. Usa `showConfirm` do
`useAlert` (que já devolve `Promise<boolean>`) com "Abrir Configurações" e
"Cancelar". A mensagem depende de `podePerguntarDeNovo`:

- `true` — negou agora: _"Sem acesso à câmera não é possível registrar o
  comprovante desta entrega."_
- `false` — bloqueou: _"O acesso à câmera está bloqueado. Libere em
  Configurações para registrar o comprovante."_

**Ambiente** — o mapa da tela Início. Ali a permissão melhora a tela mas não
bloqueia nada, e a tela abre toda vez que o app abre: um modal viraria ruído
diário. Aviso dispensável, não-bloqueante.

Classificação por call site:

| call site                             | nível                                             |
| ------------------------------------- | ------------------------------------------------- |
| `CameraUpload` câmera e galeria       | bloqueada                                         |
| `IncidentReportWizard` foto e galeria | bloqueada                                         |
| `NavigationMode.tsx` / `.web.tsx`     | bloqueada                                         |
| `TurnByTurnNavigation.tsx`            | bloqueada                                         |
| `inicio.tsx`                          | ambiente                                          |
| `useDriverLocationBroadcast.ts`       | ambiente (é um hook sem UI; mantém `logger.warn`) |

### Correção 3 — identidade de prop em `NavigationMode.tsx`

`destination` passa a ser memoizado com dependências **primitivas**
(`currentStop.latitude`, `.longitude`, `.endereco`) e não com o objeto
`currentStop`, que também muda de identidade. `onExit` vira `useCallback`. O
padrão já existe no repo em `src/components/motorista/home/NextStopPreview.tsx:65` (que memoiza
o `destination` justamente para impedir um re-fetch) e
`src/hooks/navigation/pip/usePiPRouteInfo.ts:158` (que já usa deps primitivas,
com um `eslint-disable` explicando por quê).

Isto quebra a cadeia de 1 Hz na origem. Sem ele, corrigir a corrida elimina o
vazamento mas mantém a requisição OSRM por segundo e o TTS reiniciando.

### Correção 4 — loja

**Plugin.** `expo-image-picker` (~56.0.24) entra em `app.config.js:plugins`
com as strings pt-BR:

```js
[
  "expo-image-picker",
  {
    photosPermission: "O Rota Mestre usa suas fotos para você anexar o comprovante de entrega.",
    cameraPermission: "O Rota Mestre usa a câmera para fotografar o comprovante de entrega.",
  },
],
```

**Marcador em voo na galeria.** `openGallery` passa a chamar
`marcarConclusaoEmVoo` antes de `launchImageLibraryAsync` e
`limparConclusaoEmVoo` depois, espelhando `openCamera:179`. Idem para
`pickImage` com `salvarRascunhoIncidente` / `limparRascunhoIncidente`.

**Renomear `cameraAberta` → `seletorAberto`** em `RascunhoIncidente`
(`src/lib/motorista/rascunhoIncidente.ts:35`, lido em
`IncidentReportWizard.tsx:144`). O campo passa a valer para os dois ramos, e
`getPendingResultAsync()` recupera o resultado de qualquer um deles.

Sem camada de compatibilidade, deliberadamente: o rascunho tem
`VALIDADE_RASCUNHO_MS = 15 min`, e a escrita e a leitura acontecem com segundos
de diferença dentro da mesma execução do app. Um rascunho de formato antigo só
existiria se o app fosse atualizado entre abrir o seletor e voltar dele.

---

## Testes

**O teste que prova a correção** é o do watcher, e ele precisa exercitar a
corrida — desmontar **durante** o `await`, com uma promessa que só resolve
depois do unmount:

```
1. watchPositionAsync mockado devolve uma promessa controlada
2. render(useLocationWatcher…)
3. unmount() antes de resolver
4. resolve a promessa
5. espera: remove() FOI chamado
```

Sem o passo 3 antes do 4, o teste passa com o código quebrado. Este é o único
teste do lote que precisa de RED verificado explicitamente: neutralizar o
`s.remove()` do ramo cancelado tem de deixá-lo vermelho.

Demais: unidade para `permissoes.ts` (as duas mensagens, a ramificação de
plataforma, `canAskAgain` preservado) e para o par galeria/marcador.

## Verificação

Quatro camadas, nesta ordem:

1. **Teste de unidade da corrida** — acima. É a prova.
2. **Guardas de fonte única**, no molde de
   `src/lib/__tests__/maplibre-fonte-unica.test.ts`:
   - `Location.watchPositionAsync` só pode aparecer em `useLocationWatcher.ts`
     (exceção nomeada: o ramo `navigator.geolocation` de
     `useDriverLocationBroadcast.ts`).
   - `request*PermissionsAsync` só pode aparecer em `permissoes.ts`.

   As guardas não provam que o ciclo de vida está certo — elas impedem que o
   décimo call site nasça fora do lugar que está certo. É uma divisão de
   trabalho consciente com o teste 1.

3. **`npx expo prebuild`** e conferir `NSCameraUsageDescription` e
   `NSPhotoLibraryUsageDescription` no `Info.plist` gerado. Prova o plugin sem
   depender de um build iOS, que não existe (pendência 5).
4. **Passe no aparelho Android:** negar a câmera duas vezes em `CameraUpload` e
   confirmar que o botão leva às Configurações; abrir a navegação e verificar,
   com o app em rota, que não há requisição OSRM por segundo.

Nenhuma destas camadas sozinha fecha o caso — a 1 prova a corrida, a 2 protege
o futuro, a 3 é a única que toca o `Info.plist`, e a 4 é a única que vê o que o
motorista vê.

## Fora de escopo

- Os demais itens do sub-projeto 3 (sucesso reportado sem gravação em quatro
  lugares, três cópias do gravador de auditoria, telas de unidade com
  `unidade_id` legado).
- Sub-projetos 5 (cobertura e2e) e 6 (pt-BR).
- A ficha de Segurança de Dados do Play (pendência 10) — é ação do gestor no
  Console, não código.
- `SupportModal.tsx:64,75`, que tem `if (supported)` sem `else`: mesma classe de
  "botão que não faz nada e não avisa", mas fora da superfície de permissão.
