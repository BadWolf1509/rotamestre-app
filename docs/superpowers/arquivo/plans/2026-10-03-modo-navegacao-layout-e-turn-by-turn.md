# Modo navegação: layout, tempo estimado e Turn-by-Turn — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os defeitos do modo navegação do motorista (o que o "Navegar" abre com o "Avanço Automático" ligado) achados na análise visual de 03/10/2026 no moto g15, e os dois defeitos do Turn-by-Turn achados na investigação seguinte.

**Architecture:** Quatro correções independentes, uma por tarefa: (1) Turn-by-Turn conclui pela chegada e roteia só até a parada atual; (2) o tempo estimado sai da duração da rota OSRM, não da velocidade instantânea; (3) o modo navegação esconde cabeçalho e abas via contexto do layout de abas; (4) o mapa enquadra a área visível com `padding` da câmera medido por `onLayout`. Fecha com validação no aparelho e PR.

**Tech Stack:** Expo / React Native, `@maplibre/maplibre-react-native` 11.3.10 (`Camera` aceita `padding: ViewPadding` e `bounds: [w,s,e,n]`), expo-router `Tabs`, Jest + `@testing-library/react-native`.

**Spec:** não há documento separado; a especificação são os achados abaixo.

| #   | Achado                                                                                                                                                                                                                                  | Prova                                                                 | Tarefa |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| A   | Chegada no Turn-by-Turn chama `showConfirm`, mas o `{AlertDialog}` não é montado nesse ramo (`NavigationMode.tsx`, `return <TurnByTurnNavigation/>` antes do JSX que o monta): promessa pendente, nada aparece, `onComplete` nunca roda | teste temporário: controle no modo mapa passou, chegada no TBT falhou | 1      |
| B   | TBT recebe as outras pendentes como `waypoints`; `getRoute` monta `origem → waypoints → destino` (`src/lib/osrm/api.ts:62`): a voz guia para a parada 3 e 4 antes da atual                                                              | props capturadas no teste temporário                                  | 1      |
| C   | "12 min / chegada" para 131 m: ETA = distância em linha reta ÷ velocidade GPS instantânea (`useNavigationModeLogic.ts`, `updateLocationFromCoords`)                                                                                     | captura no aparelho, parado (1 km/h)                                  | 2      |
| D   | Cabeçalho "Início" e barra de abas continuam visíveis; mapa fica com ~30% da tela                                                                                                                                                       | captura                                                               | 3      |
| E   | `topBar.paddingTop` fixo (30 Android / 50 iOS) para barra de status que não está lá → faixa preta sobre o mapa                                                                                                                          | captura                                                               | 3      |
| F   | Mapa com `height: SCREEN_HEIGHT`; câmera centraliza no meio do mapa inteiro, atrás do painel: motorista, destino e rota invisíveis (aparecem só arrastando)                                                                             | capturas nav0/nav1                                                    | 4      |
| G   | Botão recentralizar com `bottom: 380` fixo, encostado no painel; e recentraliza o motorista atrás do painel                                                                                                                             | captura                                                               | 4      |

## Global Constraints

- Trabalhe no branch `fix/modo-navegacao-layout-e-turn-by-turn` (já criado a partir da `main` em `df7692f`).
- `logger.warn(message, error)` (máx. 2 args); testes espiam `logger`, não `console`.
- Sem `as any` em código de produção; sem componente declarado dentro do render de outro (use `renderX()`).
- Estilos via `StyleSheet.create((theme) => …)` de `@/utils/styles`; valores dinâmicos em estilo inline no JSX.
- Teste novo tem de ser visto **falhando** no código atual antes da correção (memória "Teste que fixa o defeito": procure e substitua o teste que exige o comportamento errado).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos: `npx jest <arquivo>`; `npx tsc --noEmit`; `npx eslint <arquivos>`.
- Fora do escopo (decidido): item 7 da análise (velocímetro grande, posição do "Rastreando"); "distância" continua em linha reta (é a mesma usada para o alerta de proximidade).

---

### Task 1: Turn-by-Turn — chegada abre a conclusão com foto e rota vai só até a parada atual

**Files:**

- Modify: `src/components/motorista/NavigationMode.tsx` (bloco `if (navigationMode === 'turn-by-turn' && userLocation)`, ~linha 372)
- Modify: `src/hooks/navigation/useNavigationModeLogic.ts` (remover `remainingWaypoints`, ~linhas 120-125 e o retorno)
- Modify: `src/hooks/navigation/types.ts:79` (remover `remainingWaypoints`)
- Test: `src/components/motorista/__tests__/NavigationMode.test.tsx`

**Interfaces:**

- Consumes: `onComplete` de `NavigationModeProps` (a Início o liga a `handleCompleteStop`, que abre o `StopCompletionFlow`).
- Produces: nada usado por outras tarefas.

- [ ] **Step 1: Escreva os testes que falham**

No `NavigationMode.test.tsx`, troque o mock fixo do TBT (`TurnByTurnNavigation: () => null`) por um que capture as props:

```tsx
// Mock TurnByTurnNavigation — captura as props para os testes de chegada
const mockTbtProps: {
  current: null | {
    onArrive: () => void;
    waypoints?: unknown[];
    destination: { latitude: number; longitude: number };
  };
} = { current: null };
jest.mock('../TurnByTurnNavigation', () => ({
  TurnByTurnNavigation: (props: never) => {
    mockTbtProps.current = props;
    return null;
  },
}));
```

E acrescente ao fim do arquivo:

```tsx
/**
 * Até 03/10/2026 a chegada no Turn-by-Turn chamava a confirmação "Confirmar
 * Entrega", mas este ramo retorna antes do `{AlertDialog}`: a promessa ficava
 * pendente, nada aparecia e a parada não concluía. A rota também levava as
 * outras paradas como pontos intermediários — o OSRM monta
 * origem → intermediários → destino, e a voz guiava primeiro para elas.
 */
describe('Turn-by-Turn', () => {
  const Location = jest.requireMock('expo-location');
  const LocationTracking = jest.requireMock(
    '@/services/locationTracking',
  ).default;

  const paradaReal = (id: string, ordem: number, latitude: number) => ({
    id,
    endereco: `Rua ${ordem}`,
    latitude,
    longitude: -46.64,
    ordem,
    status: 'pendente',
    tipo: 'entrega',
    is_checkpoint: true,
  });

  const propsTbt = {
    currentStop: paradaReal('p2', 2, -23.56),
    nextStop: paradaReal('p3', 3, -23.57),
    paradas: [
      paradaReal('p2', 2, -23.56),
      paradaReal('p3', 3, -23.57),
      paradaReal('p4', 4, -23.58),
    ],
    rotaId: 'rota-1',
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    onExit: jest.fn(),
  };

  beforeEach(() => {
    mockTbtProps.current = null;
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      internalNavigation: true,
      autoAdvance: true,
      proximityRadius: 50,
    });
    Location.watchPositionAsync.mockImplementation(
      (_opcoes: unknown, cb: (l: unknown) => void) => {
        cb({
          coords: {
            latitude: -23.55,
            longitude: -46.63,
            heading: 0,
            speed: 0,
            accuracy: 5,
          },
        });
        return Promise.resolve({ remove: jest.fn() });
      },
    );
  });

  afterEach(() => {
    LocationTracking.getNavigationPreferences.mockResolvedValue({
      internalNavigation: false,
      autoAdvance: true,
      proximityRadius: 50,
    });
    Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
  });

  it('a chegada conclui pelo fluxo da Início (foto), sem diálogo no meio', async () => {
    render(<NavigationMode {...propsTbt} />);
    await waitFor(() => expect(mockTbtProps.current).not.toBeNull());

    await act(async () => {
      mockTbtProps.current!.onArrive();
    });

    expect(propsTbt.onComplete).toHaveBeenCalledTimes(1);
  });

  it('a rota vai só até a parada atual, sem as outras como intermediárias', async () => {
    render(<NavigationMode {...propsTbt} />);
    await waitFor(() => expect(mockTbtProps.current).not.toBeNull());

    expect(mockTbtProps.current!.destination).toEqual(
      expect.objectContaining({ latitude: -23.56 }),
    );
    expect(mockTbtProps.current!.waypoints ?? []).toEqual([]);
  });
});
```

Acrescente `act` ao import de `@testing-library/react-native` no topo do arquivo.

- [ ] **Step 2: Rode e veja falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx -t "Turn-by-Turn"`
Expected: os 2 FAIL — `onComplete` chamado 0 vezes; `waypoints` com 2 itens.

- [ ] **Step 3: Implemente**

Em `NavigationMode.tsx`, logo depois do `useNavigationActions(...)`, crie o handler de chegada:

```tsx
// Chegada no Turn-by-Turn: vai direto ao fluxo de conclusão da Início
// (StopCompletionFlow, que pede a foto e já é a confirmação). Passar por
// `handleCompleteStop` exigiria o `{AlertDialog}`, que este ramo não monta.
const concluirNaChegada = useCallback(async () => {
  await playNotificationSound();
  onComplete();
}, [playNotificationSound, onComplete]);
```

E troque o bloco do Turn-by-Turn por:

```tsx
if (navigationMode === 'turn-by-turn' && userLocation) {
  return (
    <TurnByTurnNavigation
      origin={userLocation}
      destination={destinoDaNavegacao}
      onArrive={concluirNaChegada}
      onExit={sairDaNavegacao}
    />
  );
}
```

Remova `remainingWaypoints` da desestruturação de `useNavigationModeLogic` em `NavigationMode.tsx` e a menção no comentário (~linha 340). Em `useNavigationModeLogic.ts` remova o `useMemo` `remainingWaypoints` e a chave do objeto retornado; em `types.ts` remova `remainingWaypoints: Coordinate[];` (e o import de `Coordinate` se ficar sem uso).

- [ ] **Step 4: Rode os testes**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx src/hooks/navigation app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx`
Expected: PASS. Se algum teste do hook citar `remainingWaypoints`, apague esse caso (a propriedade deixou de existir).

- [ ] **Step 5: Tipos, lint e commit**

```bash
npx tsc --noEmit
npx eslint src/components/motorista/NavigationMode.tsx src/hooks/navigation/useNavigationModeLogic.ts src/hooks/navigation/types.ts src/components/motorista/__tests__/NavigationMode.test.tsx
git add -A src/components/motorista src/hooks/navigation
git commit -m "fix(motorista): Turn-by-Turn conclui na chegada e roteia só até a parada atual"
```

---

### Task 2: Tempo estimado pela duração da rota, não pela velocidade instantânea

**Files:**

- Modify: `src/hooks/navigation/useNavigationModeLogic.ts` (estado `eta`, `updateLocationFromCoords`, efeito do `fetchRoute`)
- Modify: `src/hooks/navigation/types.ts` (remover `setEta`)
- Modify: `src/components/motorista/NavigationInfoPanel.tsx:130` (rótulo)
- Test: `src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts`

**Interfaces:**

- Produces: `eta: string | null` continua no retorno (mesmo nome e tipo); `setEta` sai.

- [ ] **Step 1: Substitua o teste que fixa o defeito e escreva os novos**

Apague o caso `it('should estimate ETA based on speed', …)` (exige `500 m / 10 m/s = '1 min'`, a fórmula errada). No lugar, dentro do mesmo `describe('updateLocationFromCoords')`:

```ts
// Parado num semáforo o GPS marca ~1 km/h: dividir a distância por isso
// dava "13 min" para 131 m. O tempo vem da duração da rota OSRM.
it('usa a duração da rota OSRM, não a velocidade instantânea', async () => {
  const { getRoute } = jest.requireMock('@/lib/osrm');
  getRoute.mockResolvedValueOnce({
    polyline: 'mock_polyline',
    distance: 900,
    duration: 180,
  });
  const { result } = renderHook(() =>
    useNavigationModeLogic({
      currentStop: mockCurrentStop,
      paradas: mockParadas,
      rotaId: 'rota-123',
    }),
  );

  act(() => {
    result.current.updateLocationFromCoords(
      { latitude: -23.55, longitude: -46.63 },
      0.3, // ~1 km/h, parado
    );
  });

  await waitFor(() => expect(result.current.eta).toBe('3 min'));
});

it('sem rota, estima pela velocidade média urbana', () => {
  const { result } = renderHook(() =>
    useNavigationModeLogic({
      currentStop: mockCurrentStop,
      paradas: mockParadas,
      rotaId: 'rota-123',
    }),
  );

  act(() => {
    result.current.updateLocationFromCoords(
      { latitude: -23.55, longitude: -46.63 },
      0.3,
    );
  });

  // 500 m (mock) a 30 km/h = 60 s
  expect(result.current.eta).toBe('1 min');
});
```

Acrescente `waitFor` ao import de `@testing-library/react-native`.

- [ ] **Step 2: Rode e veja falhar**

Run: `npx jest src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts -t "rota OSRM|velocidade média"`
Expected: FAIL — os dois dão `'28 min'` (500 m ÷ 0,3 m/s).

- [ ] **Step 3: Implemente**

Em `useNavigationModeLogic.ts`:

1. Troque `const [eta, setEta] = useState<string | null>(null);` por:

```ts
// Duração (s) da rota OSRM até a parada atual; null sem rota viária.
const [duracaoRotaSeg, setDuracaoRotaSeg] = useState<number | null>(null);
```

2. Em `updateLocationFromCoords`, apague todo o bloco `// Estimate time of arrival` (o `if (speedMs && speedMs > 0) … else …`). Mantenha `setDistance(dist)`.

3. No `fetchRoute`, dentro de `if (routeData?.polyline) {`, depois de `setRoutePath(...)`:

```ts
setDuracaoRotaSeg(
  typeof routeData.duration === 'number' && !routeData.is_estimated
    ? routeData.duration
    : null,
);
```

e nos dois `setRoutePath([])` de falha (o `else` e o `catch`), acrescente `setDuracaoRotaSeg(null);`. No efeito `// Reset route path when current stop changes`, acrescente `setDuracaoRotaSeg(null);`.

4. Logo antes do `return {` do hook:

```ts
// Tempo até a parada: duração da rota viária (OSRM, refeita a cada 50 m);
// sem ela, distância em linha reta à velocidade média urbana. Nunca a
// velocidade instantânea do GPS — parado, ela leva o tempo ao infinito.
const eta = useMemo(() => {
  const segundos =
    duracaoRotaSeg ??
    (distance !== null ? distance / (AVERAGE_URBAN_SPEED_KMH / 3.6) : null);
  if (segundos === null) return null;
  const minutos = Math.ceil(segundos / 60);
  return minutos > 0 ? `${minutos} min` : '< 1 min';
}, [duracaoRotaSeg, distance]);
```

5. Remova `setEta,` do objeto retornado e `setEta: (eta: string | null) => void;` de `types.ts`.

Em `NavigationInfoPanel.tsx:130`, troque `chegada` por `tempo` (é duração, não horário).

- [ ] **Step 4: Rode os testes**

Run: `npx jest src/hooks/navigation src/components/motorista`
Expected: PASS. Se algum teste procurar o texto `chegada` no painel de navegação, troque para `tempo`.

- [ ] **Step 5: Tipos, lint e commit**

```bash
npx tsc --noEmit
npx eslint src/hooks/navigation src/components/motorista/NavigationInfoPanel.tsx
git add -A src/hooks/navigation src/components/motorista
git commit -m "fix(motorista): tempo até a parada vem da rota, não da velocidade instantânea"
```

---

### Task 3: Modo navegação em tela cheia (sem cabeçalho e sem abas) e barra superior no lugar certo

**Files:**

- Create: `src/context/NavegacaoTelaCheiaContext.tsx`
- Modify: `app/motorista/(tabs)/_layout.tsx` (estado + provider + `headerShown`/`tabBarStyle`)
- Modify: `app/motorista/_screens/inicio.tsx` (efeito que liga/desliga)
- Modify: `src/components/motorista/NavigationMode.tsx` (`topBar.paddingTop`)
- Test: `app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx`

**Interfaces:**

- Produces: `NavegacaoTelaCheiaContext` (React context `{ setTelaCheia: (ativa: boolean) => void }`, default no-op) e `useNavegacaoTelaCheia()`.

- [ ] **Step 1: Crie o contexto**

`src/context/NavegacaoTelaCheiaContext.tsx`:

```tsx
/**
 * Liga a "tela cheia" do modo navegação: o layout de abas do motorista
 * esconde cabeçalho e barra de abas enquanto a Início mostra a navegação.
 *
 * O estado mora no layout (`app/motorista/(tabs)/_layout.tsx`), que é quem
 * desenha as duas barras; a tela só avisa. Fora do layout (testes, web
 * sem abas) o default não faz nada.
 */
import { createContext, useContext } from 'react';

interface NavegacaoTelaCheia {
  setTelaCheia: (ativa: boolean) => void;
}

export const NavegacaoTelaCheiaContext = createContext<NavegacaoTelaCheia>({
  setTelaCheia: () => {},
});

export function useNavegacaoTelaCheia(): NavegacaoTelaCheia {
  return useContext(NavegacaoTelaCheiaContext);
}
```

- [ ] **Step 2: Escreva os testes que falham**

Em `inicio-modo-navegacao.test.tsx`:

1. No mock de `NavigationMode`, acrescente `onExit` às props e um terceiro botão:

```tsx
    NavigationMode: (props: {
      onComplete: () => void;
      onSkip: () => void;
      onExit: () => void;
    }) => (
      <>
        <T>modo-navegacao</T>
        <P onPress={props.onComplete}>
          <T>nav-concluir</T>
        </P>
        <P onPress={props.onSkip}>
          <T>nav-pular</T>
        </P>
        <P onPress={props.onExit}>
          <T>nav-sair</T>
        </P>
      </>
    ),
```

2. Acrescente ao fim do arquivo:

```tsx
/**
 * Com cabeçalho e abas visíveis, o mapa da navegação ficava com ~30% da tela
 * e o motorista podia trocar de aba no meio da rota (análise de 03/10/2026).
 */
describe('Início do motorista — modo navegação em tela cheia', () => {
  const { NavegacaoTelaCheiaContext } = jest.requireActual(
    '@/context/NavegacaoTelaCheiaContext',
  );

  function renderComTelaCheia(setTelaCheia: jest.Mock) {
    return render(
      <NavegacaoTelaCheiaContext.Provider value={{ setTelaCheia }}>
        <MotoristaInicio />
      </NavegacaoTelaCheiaContext.Provider>,
    );
  }

  it('esconde cabeçalho e abas ao entrar e devolve ao sair', async () => {
    const setTelaCheia = jest.fn();
    const { getByText, findByText } = renderComTelaCheia(setTelaCheia);

    await entrarNoModoNavegacao(getByText, findByText);
    await waitFor(() => expect(setTelaCheia).toHaveBeenLastCalledWith(true));

    fireEvent.press(getByText('nav-sair'));
    await waitFor(() => expect(setTelaCheia).toHaveBeenLastCalledWith(false));
  });

  it('devolve cabeçalho e abas se a tela desmontar em navegação', async () => {
    const setTelaCheia = jest.fn();
    const { getByText, findByText, unmount } = renderComTelaCheia(setTelaCheia);

    await entrarNoModoNavegacao(getByText, findByText);
    unmount();

    expect(setTelaCheia).toHaveBeenLastCalledWith(false);
  });
});
```

- [ ] **Step 3: Rode e veja falhar**

Run: `npx jest app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx -t "tela cheia"`
Expected: FAIL — `setTelaCheia` nunca chamado.

- [ ] **Step 4: Implemente na Início**

Em `app/motorista/_screens/inicio.tsx`, importe `useNavegacaoTelaCheia` de `@/context/NavegacaoTelaCheiaContext` e, junto dos outros efeitos do componente (antes de qualquer `return`):

```tsx
// Navegação em tela cheia: o layout de abas esconde cabeçalho e abas.
const { setTelaCheia } = useNavegacaoTelaCheia();
const emNavegacao = modals.navigationMode && !!currentStop;
useEffect(() => {
  setTelaCheia(emNavegacao);
}, [emNavegacao, setTelaCheia]);
// Sair da Início no meio da navegação não pode deixar as abas sumidas.
useEffect(() => () => setTelaCheia(false), [setTelaCheia]);
```

- [ ] **Step 5: Rode e veja passar**

Run: `npx jest app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx`
Expected: PASS (os 6).

- [ ] **Step 6: Implemente no layout de abas**

Em `app/motorista/(tabs)/_layout.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { NavegacaoTelaCheiaContext } from '@/context/NavegacaoTelaCheiaContext';
```

(ajuste o import de `react` existente para incluir `useMemo` e `useState`). Dentro de `TabLayout`, no topo:

```tsx
const [telaCheia, setTelaCheia] = useState(false);
const valorTelaCheia = useMemo(() => ({ setTelaCheia }), []);
```

Envolva o `<Tabs …>…</Tabs>` em `<NavegacaoTelaCheiaContext.Provider value={valorTelaCheia}>…</NavegacaoTelaCheiaContext.Provider>`. Em `screenOptions`, acrescente `headerShown: !telaCheia,` e troque `tabBarStyle: { … }` por:

```tsx
        tabBarStyle: telaCheia
          ? { display: 'none' }
          : {
              // (o objeto atual, sem mudança)
            },
```

copiando o objeto atual inteiro para o ramo `:`.

- [ ] **Step 7: Barra superior do modo navegação sob a barra de status**

Agora o modo navegação começa no topo da tela. Em `NavigationMode.tsx`, no `<View style={styles.topBar}>`, troque por:

```tsx
      <View
        style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}
      >
```

e em `styles.topBar` apague a linha `paddingTop: Platform.OS === 'ios' ? 50 : 30,`. Se `Platform` ficar sem uso no arquivo, remova do import.

- [ ] **Step 8: Testes, tipos, lint e commit**

```bash
npx jest app/motorista src/components/motorista
npx tsc --noEmit
npx eslint "app/motorista/(tabs)/_layout.tsx" app/motorista/_screens/inicio.tsx src/context/NavegacaoTelaCheiaContext.tsx src/components/motorista/NavigationMode.tsx
git add -A app/motorista src/context src/components/motorista
git commit -m "fix(motorista): modo navegação em tela cheia, sem cabeçalho e abas"
```

---

### Task 4: Mapa enquadra a área visível (padding da câmera) e botão de recentralizar acima do painel

**Files:**

- Modify: `src/components/motorista/NavigationMode.tsx` (`getRegion`/`region`/`cameraSettings`, `recenterMap`, `styles.map`, `styles.recenterButton`, JSX da `topBar` e do `infoPanel`)
- Test: `src/components/motorista/__tests__/NavigationMode.test.tsx`

**Interfaces:**

- Consumes: nada das tarefas anteriores além do `paddingTop` da Task 3 (mesmo `View`).

- [ ] **Step 1: Escreva os testes que falham**

Acrescente ao fim de `NavigationMode.test.tsx` (o mock global da `Camera` em `jest.setup.js` repassa as props para um `View` com `testID="map-camera"`):

```tsx
/**
 * O mapa tinha a altura da tela inteira e a câmera centralizava no meio
 * dele — atrás do painel de baixo. Motorista, destino e rota só apareciam
 * arrastando o mapa (análise de 03/10/2026). A câmera precisa saber quanto
 * do mapa está coberto.
 */
describe('Enquadramento do mapa', () => {
  const Location = jest.requireMock('expo-location');

  const layout = (height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
  });

  beforeEach(() => {
    Location.watchPositionAsync.mockImplementation(
      (_opcoes: unknown, cb: (l: unknown) => void) => {
        // ~600 m da parada (-23.56, -46.64): enquadra os dois
        cb({
          coords: {
            latitude: -23.555,
            longitude: -46.638,
            heading: 0,
            speed: 0,
            accuracy: 5,
          },
        });
        return Promise.resolve({ remove: jest.fn() });
      },
    );
  });

  afterEach(() => {
    Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
  });

  it('reserva o painel e a barra superior no padding da câmera', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);
    await waitFor(() => expect(getByTestId('map-camera')).toBeTruthy());

    fireEvent(getByTestId('nav-barra-superior'), 'layout', layout(90));
    fireEvent(getByTestId('nav-painel'), 'layout', layout(370));

    await waitFor(() => {
      const { padding } = getByTestId('map-camera').props;
      expect(padding.top).toBeGreaterThanOrEqual(90);
      expect(padding.bottom).toBeGreaterThanOrEqual(370);
    });
  });

  it('perto da parada, enquadra motorista e parada juntos', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);

    await waitFor(() => {
      const { bounds } = getByTestId('map-camera').props;
      // [oeste, sul, leste, norte]
      expect(bounds).toEqual([-46.64, -23.56, -46.638, -23.555]);
    });
  });

  it('o botão de recentralizar fica acima do painel medido', async () => {
    const { getByTestId } = render(<NavigationMode {...defaultProps} />);
    await waitFor(() => expect(getByTestId('nav-recentralizar')).toBeTruthy());

    fireEvent(getByTestId('nav-painel'), 'layout', layout(370));

    await waitFor(() => {
      const estilo = StyleSheet.flatten(
        getByTestId('nav-recentralizar').props.style,
      );
      expect(estilo.bottom).toBeGreaterThan(370);
    });
  });
});
```

Importe `StyleSheet` de `react-native` no topo do arquivo de teste (`import { StyleSheet } from 'react-native';` — o `@/utils/styles` está mockado, o do RN não).

- [ ] **Step 2: Rode e veja falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx -t "Enquadramento"`
Expected: FAIL — `testID` `nav-barra-superior`/`nav-painel`/`nav-recentralizar` inexistentes; `padding` e `bounds` indefinidos.

- [ ] **Step 3: Implemente a medição**

Em `NavigationMode.tsx`, depois de `const cameraRef = useRef<CameraRef>(null);`:

```tsx
// Altura (dp) do que cobre o mapa: barra superior e painel de baixo.
// A câmera desconta isso para centralizar na parte VISÍVEL do mapa.
const [alturaBarraSuperior, setAlturaBarraSuperior] = useState(0);
const [alturaPainel, setAlturaPainel] = useState(0);
const MARGEM_ENQUADRAMENTO = 48;
```

No JSX: `<View testID="nav-barra-superior" onLayout={(e) => setAlturaBarraSuperior(e.nativeEvent.layout.height)} style={[styles.topBar, …]}>` (o `style` da Task 3 continua), `<View testID="nav-painel" onLayout={(e) => setAlturaPainel(e.nativeEvent.layout.height)} style={[styles.infoPanel, …]}>`, e no botão:

```tsx
        <TouchableOpacity
          testID="nav-recentralizar"
          style={[
            styles.recenterButton,
            { bottom: alturaPainel + theme.spacing.md },
          ]}
          onPress={recenterMap}
          activeOpacity={0.8}
        >
```

Em `styles.recenterButton`, apague `bottom: 380, // Above info panel`.

- [ ] **Step 4: Implemente a câmera**

Substitua `getRegion`, `const region = getRegion();` e o `cameraSettings` atual por:

```tsx
// Enquadramento da navegação. Perto (< 1 km): motorista e parada juntos,
// por `bounds`. Longe: centrado no motorista, zoom pela distância. Em
// ambos, o padding desconta barra superior e painel — sem ele o centro
// caía atrás do painel e nada da rota aparecia.
const cameraSettings = useMemo<MapLibreGL.CameraStop | null>(() => {
  if (!currentStop) return null;
  const paddingVisivel = {
    top: alturaBarraSuperior,
    bottom: alturaPainel,
    left: 0,
    right: 0,
  };

  if (!userLocation) {
    return {
      center: toLngLat(currentStop),
      zoom: zoomFromLongitudeDelta(0.01),
      padding: paddingVisivel,
      duration: 500,
    };
  }

  const distanciaAteParada = calculateHaversineDistance(
    userLocation.latitude,
    userLocation.longitude,
    currentStop.latitude,
    currentStop.longitude,
  );

  if (distanciaAteParada < 1000 && distanciaAteParada >= 30) {
    return {
      bounds: [
        Math.min(userLocation.longitude, currentStop.longitude),
        Math.min(userLocation.latitude, currentStop.latitude),
        Math.max(userLocation.longitude, currentStop.longitude),
        Math.max(userLocation.latitude, currentStop.latitude),
      ],
      padding: {
        top: alturaBarraSuperior + MARGEM_ENQUADRAMENTO,
        bottom: alturaPainel + MARGEM_ENQUADRAMENTO,
        left: MARGEM_ENQUADRAMENTO,
        right: MARGEM_ENQUADRAMENTO,
      },
      duration: 500,
    };
  }

  let delta = 0.005; // < 30 m: chegando, zoom de rua
  if (distanciaAteParada > 10000) delta = 0.05;
  else if (distanciaAteParada > 5000) delta = 0.03;
  else if (distanciaAteParada > 2000) delta = 0.02;
  else if (distanciaAteParada >= 1000) delta = 0.01;

  return {
    center: toLngLat(userLocation),
    zoom: zoomFromLongitudeDelta(delta),
    padding: paddingVisivel,
    duration: 500,
  };
}, [userLocation, currentStop, alturaBarraSuperior, alturaPainel]);
```

Troque o guard `if (!currentStop || !region) return null;` por `if (!currentStop) return null;`.

Em `recenterMap`, acrescente o padding ao `setStop` e as dependências:

```tsx
      cameraRef.current.setStop({
        center: toLngLat(userLocation),
        zoom: zoomFromLongitudeDelta(0.005),
        padding: {
          top: alturaBarraSuperior,
          bottom: alturaPainel,
          left: 0,
          right: 0,
        },
        duration: 500,
      });
    }
  }, [userLocation, triggerHaptic, alturaBarraSuperior, alturaPainel]);
```

Em `styles.map`, troque `width: SCREEN_WIDTH, height: SCREEN_HEIGHT,` por `flex: 1,`. Apague `const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');` e `Dimensions` do import.

- [ ] **Step 5: Rode os testes**

Run: `npx jest src/components/motorista app/motorista`
Expected: PASS.

- [ ] **Step 6: Tipos, lint e commit**

```bash
npx tsc --noEmit
npx eslint src/components/motorista/NavigationMode.tsx src/components/motorista/__tests__/NavigationMode.test.tsx
git add -A src/components/motorista
git commit -m "fix(motorista): mapa da navegação enquadra a área visível acima do painel"
```

---

### Task 5: Validação no aparelho, documentação e PR

**Files:**

- Modify: `CLAUDE.md` (linha "Concluir parada: só pelo `StopCompletionFlow`" — acrescentar o Turn-by-Turn)
- Modify: `docs/HISTORICO.md` (entrada de 03/10/2026)

- [ ] **Step 1: Suíte completa**

```bash
npx tsc --noEmit
npm run lint
npx jest
```

Expected: tudo verde.

- [ ] **Step 2: Build preview e instalação** (layout nativo não é testável no CI)

```bash
npx --yes eas-cli@latest build --platform android --profile preview --non-interactive --no-wait
```

Acompanhe com `npx --yes eas-cli@latest build:list --platform android --limit 1`. Baixe o APK e instale com `adb install -r` (o aparelho já tem APK do EAS; `-r` preserva o login do motorista de teste). Confira o md5 instalado contra o baixado.

- [ ] **Step 3: Cenários no aparelho** (`export MSYS_NO_PATHCONV=1`; capture com `adb exec-out screencap -p`)

1. Início → "Navegar" com Avanço Automático ligado: sem cabeçalho "Início", sem abas; barra superior logo abaixo da barra de status; motorista (ponto azul), parada e linha da rota visíveis **sem arrastar**.
2. Botão recentralizar acima do painel; ao tocar, o ponto azul fica na área visível.
3. Rótulo "tempo"; parado, o tempo é da rota (não dezenas de minutos para ~130 m).
4. X → confirmar → cabeçalho e abas voltam.
5. Engrenagem → ligar "Navegação Turn-by-Turn" → "Navegar": a linha da rota vai **direto** à parada atual. Desligue a opção ao terminar.

Chegada real no Turn-by-Turn exige deslocamento: fica para o teste de rua (pendência 12).

- [ ] **Step 4: Documentação**

Em `CLAUDE.md`, no item "Concluir parada: só pelo `StopCompletionFlow`", acrescente ao fim: "A chegada do Turn-by-Turn chama `onComplete` direto (`concluirNaChegada` em `NavigationMode.tsx`): o ramo do Turn-by-Turn não monta `{AlertDialog}`, então nada ali pode depender de `showConfirm`." Em `docs/HISTORICO.md`, uma entrada curta com os achados A–G e o PR.

- [ ] **Step 5: Commit, push e PR**

```bash
git add CLAUDE.md docs/HISTORICO.md
git commit -m "docs: modo navegação e Turn-by-Turn"
git push -u origin fix/modo-navegacao-layout-e-turn-by-turn
gh pr create --title "fix(motorista): modo navegação em tela cheia, enquadramento, tempo estimado e Turn-by-Turn" --body-file <arquivo com resumo A–G, provas e capturas>
```

Merge só com o OK do usuário (`gh pr merge N --squash --admin --delete-branch`).
