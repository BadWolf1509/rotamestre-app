# "Navegar com" no lugar do "Avanço Automático" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a chave "Avanço Automático" — que não avança nada desde 02/10/2026 e só decide o destino do botão "Navegar" — por uma escolha explícita "Navegar com: Mapa do RotaMestre | Waze / Google Maps", sem perder a escolha de quem já mexeu nela.

**Architecture:** A preferência nova `navegarCom: 'mapa' | 'externo'` mora em `LocationTrackingService` (fonte única de padrões, `PREFERENCIAS_PADRAO`). A leitura converte a chave antiga `autoAdvance` salva no aparelho (`false` → `'externo'`, qualquer outra coisa → `'mapa'`) e a escrita apaga a chave antiga. `autoAdvance` some do código. A tela de configurações troca o switch por duas opções; `handleNavigateToStop` (a única porta do modo navegação) passa a ler `navegarCom`. O botão "Abrir no Maps" do painel ganha rótulo com o nome do app que ele abre de fato.

**Tech Stack:** React Native + Expo, TypeScript, Jest + @testing-library/react-native, AsyncStorage.

**Spec:** sem documento separado — a decisão foi tomada na conversa de 04–05/10/2026 e está resumida em "Decisões" abaixo; a seção é a autoridade.

## Decisões (a "spec")

1. **Medido em 05/10/2026** (`motorista_locations`, últimos 30 dias, cadência entre posições — o modo navegação grava a cada 5 s, o mapa da Início no máximo a cada 10 s): dos 3 motoristas reais, **2 usam o modo navegação todo dia** (~55–64% dos intervalos entre 2 e 8 s) e **1 praticamente nunca** (47 de 2.057). O padrão continua **`'mapa'`**: é o que a maioria usa, e só o mapa do app tem aviso de chegada e tela acesa.
2. A navegação por voz (Turn-by-Turn) vinha **desligada por padrão** (`internalNavigation: false`) até sair na 1.12.8 — trocar o nome da chave não tira nada de quem não mexeu.
3. O painel do modo navegação **já tem** o botão de app externo (`handleOpenInMaps` → `abrirNavegacao`, que respeita `preferredNavApp`). Não criar botão novo; só trocar o rótulo genérico "Abrir no Maps" pelo app real.
4. Concluir parada continua só pelo `StopCompletionFlow`; nada aqui toca conclusão.

## Global Constraints

- Textos de interface em pt-BR, exatamente como escritos neste plano.
- Nenhum `as any` em código de produção.
- Padrões de preferência só em `PREFERENCIAS_PADRAO` (`src/services/locationTracking.ts`); as tabelas locais (`DEFAULT_SETTINGS`, `DEFAULT_PREFERENCES`) espelham, nunca divergem.
- O modo navegação só é aberto por `handleNavigateToStop` (`app/motorista/_screens/inicio.tsx`).
- Testes espiam `logger`, não `console`, quando novos.
- Comandos: `npx jest <caminho>`, `npm run type-check`, `npm run lint`.

---

### Task 1: Preferência `navegarCom` com conversão da chave antiga

**Files:**

- Modify: `src/services/locationTracking.ts` (interface `NavigationState` ~l.45, `PREFERENCIAS_PADRAO` ~l.82, `startTracking` ~l.142, `getNavigationPreferences` ~l.408, `updateNavigationPreferences` ~l.422, docblock de `handleArrival` ~l.271 e de preferências ~l.383)
- Modify: `src/hooks/navigation/types.ts` (`NavigationPreferences` ~l.22)
- Modify: `src/hooks/navigation/useNavigationModeLogic.ts` (`DEFAULT_PREFERENCES` ~l.31)
- Test: `src/services/__tests__/locationTracking.test.ts`

**Interfaces:**

- Produces: `export type ModoNavegar = 'mapa' | 'externo';` exportado de `src/services/locationTracking.ts`; `PreferenciasDeNavegacao.navegarCom: ModoNavegar` (sempre preenchido); `NavigationPreferences.navegarCom?: ModoNavegar` e `NavigationPreferences.preferredNavApp?: 'waze' | 'google_maps' | 'apple_maps' | 'default'`. `autoAdvance` deixa de existir em todos esses tipos.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/services/__tests__/locationTracking.test.ts`, no `describe` das preferências (onde estão "aplica os defaults quando nao ha nada salvo" etc.), troque toda asserção `prefs.autoAdvance` / `lido.autoAdvance` por `navegarCom`, e acrescente o bloco de conversão:

```ts
it('aplica os defaults quando nao ha nada salvo', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

  const prefs = await locationTrackingService.getNavigationPreferences();

  // O caso exato do bug de 2026-09: um consumidor que decide o destino do
  // "Navegar" precisa receber um valor, nao `undefined`.
  expect(prefs.navegarCom).toBe('mapa');
  expect(prefs.soundAlerts).toBe(true);
  expect(prefs.vibrationAlerts).toBe(true);
  expect(prefs.proximityRadius).toBe(50);
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('navigationPreferences');
});
```

No teste "o que esta salvo vence o default", troque `autoAdvance: false` por `navegarCom: 'externo'`. Nos testes "preenche so o que falta…", "…JSON salvo esta corrompido" e "grava só o que foi escolhido…", troque `expect(x.autoAdvance).toBe(true)` por `expect(x.navegarCom).toBe('mapa')`. No `describe('updateNavigationPreferences')`, troque `autoAdvance: true` por `navegarCom: 'mapa'` e `autoAdvance: false` por `navegarCom: 'externo'` (inclusive no JSON esperado). Em `setUpNavigationState({ autoAdvance: … })` e nos objetos de estado que levam `autoAdvance` (~l.504, 568, 584, 597, 648, 694), **remova** a chave — o estado de rastreamento não a tem mais.

Acrescente, dentro do mesmo `describe` de preferências:

```ts
describe('conversão da chave antiga "Avanço Automático"', () => {
  /**
   * Até a 1.12.8 a escolha do destino do "Navegar" era gravada como
   * `autoAdvance`. Quem a desligou escolheu o app externo; perder isso
   * na atualização mandaria essa pessoa de volta ao mapa do app.
   */
  it('autoAdvance:false salvo vira navegarCom:externo', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ autoAdvance: false }),
    );

    const prefs = await locationTrackingService.getNavigationPreferences();

    expect(prefs.navegarCom).toBe('externo');
    expect(prefs).not.toHaveProperty('autoAdvance');
  });

  it('autoAdvance:true salvo vira navegarCom:mapa', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ autoAdvance: true }),
    );

    const prefs = await locationTrackingService.getNavigationPreferences();

    expect(prefs.navegarCom).toBe('mapa');
    expect(prefs).not.toHaveProperty('autoAdvance');
  });

  it('navegarCom salvo vence a chave antiga', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ autoAdvance: false, navegarCom: 'mapa' }),
    );

    const prefs = await locationTrackingService.getNavigationPreferences();

    expect(prefs.navegarCom).toBe('mapa');
  });

  it('gravar qualquer ajuste converte e apaga a chave antiga', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ autoAdvance: false, soundAlerts: false }),
    );

    await locationTrackingService.updateNavigationPreferences({
      vibrationAlerts: false,
    });

    const gravado = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      (c) => c[0] === 'navigationPreferences',
    )?.[1];
    expect(JSON.parse(gravado)).toEqual({
      navegarCom: 'externo',
      soundAlerts: false,
      vibrationAlerts: false,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/services/__tests__/locationTracking.test.ts`
Expected: FAIL — `navegarCom` é `undefined`; o type-check do ts-jest pode acusar `navegarCom` inexistente em `NavigationState`.

- [ ] **Step 3: Implementar**

Em `src/services/locationTracking.ts`:

```ts
/** Para onde o botão "Navegar" leva: o mapa do app ou o app externo. */
export type ModoNavegar = 'mapa' | 'externo';

interface NavigationState {
  enabled: boolean;
  /**
   * Destino do botão "Navegar". Substituiu `autoAdvance` ("Avanço
   * Automático") em 05/10/2026: desde 02/10 nada avança sozinho, e o nome
   * prometia exatamente o comportamento que gerou entregas sem foto.
   */
  navegarCom: ModoNavegar;
  soundAlerts: boolean;
  // ...demais campos inalterados
}
```

Em `PREFERENCIAS_PADRAO`, troque `autoAdvance: true,` por `navegarCom: 'mapa',`.

Em `startTracking`, troque `autoAdvance: prefs.autoAdvance ?? true,` por `navegarCom: prefs.navegarCom,`.

Acrescente, logo acima de `lerPreferenciasCruas`, a conversão:

```ts
  /**
   * Converte a chave antiga `autoAdvance` (até a 1.12.8) em `navegarCom`.
   * Desligada significava "abrir o app externo"; qualquer outro valor, o
   * mapa do app. `navegarCom` já salvo vence. A chave antiga nunca sai daqui.
   */
  private converterChaveAntiga(
    salvas: Partial<NavigationState> & { autoAdvance?: unknown },
  ): Partial<NavigationState> {
    const { autoAdvance, ...resto } = salvas;
    if (resto.navegarCom || autoAdvance === undefined) return resto;
    return {
      ...resto,
      navegarCom: autoAdvance === false ? 'externo' : 'mapa',
    };
  }
```

Em `lerPreferenciasCruas`, devolva `prefs ? this.converterChaveAntiga(JSON.parse(prefs)) : {}`.
Em `getNavigationPreferences`, troque `const salvas = prefs ? JSON.parse(prefs) : {};` por `const salvas = prefs ? this.converterChaveAntiga(JSON.parse(prefs)) : {};`.
(`updateNavigationPreferences` já mescla sobre `lerPreferenciasCruas`, então grava convertido e sem a chave antiga.)

Atualize os docblocks: no de `handleArrival`, troque o último parágrafo por
"`navegarCom` (antes `autoAdvance`, "Avanço Automático") é a preferência que leva o botão Navegar para o modo navegação interno ou para o app externo." No de `getNavigationPreferences`, mantenha a história, mas troque a menção `prefs.autoAdvance` por "`prefs.autoAdvance` (hoje `navegarCom`)".

Em `src/hooks/navigation/types.ts`:

```ts
export interface NavigationPreferences {
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  showSpeedometer: boolean;
  preventScreenSleep?: boolean;
  navegarCom?: 'mapa' | 'externo';
  preferredNavApp?: 'waze' | 'google_maps' | 'apple_maps' | 'default';
  proximityRadius?: number;
}
```

Em `src/hooks/navigation/useNavigationModeLogic.ts`, em `DEFAULT_PREFERENCES`, troque `autoAdvance: true,` por `navegarCom: 'mapa',` e acrescente `preferredNavApp: 'default',`. Em `src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts` (~l.28 e ~l.108), troque `autoAdvance: true` por `navegarCom: 'mapa'` e, no objeto de defaults esperado, acrescente `preferredNavApp: 'default'`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/services/__tests__/locationTracking.test.ts src/hooks/navigation`
Expected: PASS. `npm run type-check` vai acusar os consumidores de `autoAdvance` (NavigationSettings, inicio, NavigationMode.web) — eles são as Tasks 2 e 3; anote os erros e siga.

- [ ] **Step 5: Commit**

```bash
git add src/services/locationTracking.ts src/services/__tests__/locationTracking.test.ts src/hooks/navigation
git commit -m "feat(motorista): preferência navegarCom substitui autoAdvance, com conversão"
```

---

### Task 2: Tela de configurações — "Navegar com"

**Files:**

- Modify: `src/components/motorista/NavigationSettings.tsx` (`NavigationSettingsState` ~l.35, `DEFAULT_SETTINGS` ~l.48, seção "Modo Automático" ~l.200–253, Dicas ~l.362)
- Test: `src/components/motorista/__tests__/NavigationSettings.test.tsx`

**Interfaces:**

- Consumes: `ModoNavegar` de `@/services/locationTracking` (Task 1).
- Produces: testIDs `navegar-com-mapa` e `navegar-com-externo` (com `accessibilityState.selected`).

- [ ] **Step 1: Escrever os testes que falham**

No mock de `getNavigationPreferences` do arquivo de teste, troque `autoAdvance: true` por `navegarCom: 'mapa'`. Substitua os testes "deve mostrar seção de Modo Automático", "deve mostrar descrição do Avanço Automático", "deve ter switch para Avanço Automático" e "deve mostrar dica sobre modo automático" por:

```ts
  describe('Navegar com', () => {
    it('mostra as duas opções, com o mapa do app marcado por padrão', async () => {
      const { getByText, getByTestId } = render(
        <NavigationSettings {...defaultProps} />,
      );

      expect(getByText('Navegar com')).toBeTruthy();
      expect(getByText('Mapa do RotaMestre')).toBeTruthy();
      expect(getByText('Waze / Google Maps')).toBeTruthy();
      await waitFor(() => {
        expect(
          getByTestId('navegar-com-mapa').props.accessibilityState,
        ).toEqual(expect.objectContaining({ selected: true }));
      });
    });

    it('escolher o app externo grava navegarCom:externo e esconde o raio', async () => {
      const LocationTrackingService =
        jest.requireMock('@/services/locationTracking').default;
      const { getByTestId, queryByText } = render(
        <NavigationSettings {...defaultProps} />,
      );
      await waitFor(() => expect(queryByText(/Raio de Proximidade/)).toBeTruthy());

      fireEvent.press(getByTestId('navegar-com-externo'));

      await waitFor(() => {
        expect(
          LocationTrackingService.updateNavigationPreferences,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ navegarCom: 'externo' }),
        );
      });
      expect(queryByText(/Raio de Proximidade/)).toBeNull();
    });

    it('não promete mais avanço automático', () => {
      const { queryByText } = render(<NavigationSettings {...defaultProps} />);

      // A dica antiga dizia que o modo "economiza tempo ao não precisar
      // confirmar cada parada" — o comportamento que gerou entregas sem foto.
      expect(queryByText(/Avanço Automático/)).toBeNull();
      expect(queryByText(/modo automático/i)).toBeNull();
    });
  });
```

(Antes de escrever, confira como `handleSettingChange` repassa ao serviço: se ele chama `updateNavigationPreferences(newSettings)` com o objeto inteiro, o `objectContaining` acima cobre; se chama com `{ [key]: value }`, também.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationSettings.test.tsx`
Expected: FAIL — "Unable to find an element with text: Navegar com".

- [ ] **Step 3: Implementar**

Em `NavigationSettings.tsx`: importe `type ModoNavegar` junto com `LocationTrackingService` (`import LocationTrackingService, { type ModoNavegar } from '@/services/locationTracking';`). Em `NavigationSettingsState` troque `autoAdvance: boolean;` por `navegarCom: ModoNavegar;`; em `DEFAULT_SETTINGS`, `autoAdvance: true,` por `navegarCom: 'mapa',`. Acrescente, ao lado de `NAV_APP_OPTIONS`:

```ts
const OPCOES_NAVEGAR_COM: {
  value: ModoNavegar;
  label: string;
  descricao: string;
}[] = [
  {
    value: 'mapa',
    label: 'Mapa do RotaMestre',
    descricao:
      'Avisa quando você chega e mantém a tela acesa. Sem instruções por voz.',
  },
  {
    value: 'externo',
    label: 'Waze / Google Maps',
    descricao: 'Instruções por voz e trânsito, no app escolhido acima.',
  },
];
```

Substitua a seção inteira `{/* Auto-advance Section */}` (título "Modo Automático", o switch e o slider condicional) por:

```tsx
      {/* Destino do botão "Navegar" */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navegar com</Text>
        <Text style={styles.settingDescription}>
          O que abre quando você toca em &quot;Navegar&quot;
        </Text>
        <View style={styles.navOptions}>
          {OPCOES_NAVEGAR_COM.map((opcao) => {
            const marcada = settings.navegarCom === opcao.value;
            return (
              <TouchableOpacity
                key={opcao.value}
                testID={`navegar-com-${opcao.value}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: marcada }}
                style={[styles.navOption, marcada && styles.navOptionActive]}
                onPress={() => handleSettingChange('navegarCom', opcao.value)}
              >
                <View style={styles.settingInfo}>
                  <Text
                    style={[
                      styles.navOptionLabel,
                      marcada && styles.navOptionLabelActive,
                    ]}
                  >
                    {opcao.label}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {opcao.descricao}
                  </Text>
                </View>
                {marcada && <Text style={styles.navOptionCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {settings.navegarCom === 'mapa' && (
          /* o bloco <View style={styles.sliderSetting}>…</View> do raio,
             exatamente como estava, sem alteração */
        )}
      </View>
```

(O bloco do slider é movido sem mudança — só a condição passa de `settings.autoAdvance` para `settings.navegarCom === 'mapa'`. **Não** declare componente dentro do render; mantenha o `.map` inline como acima — ver CLAUDE.md.) Se `navOption` tiver `flexDirection: 'row'` com ícone, a `View` interna com `settingInfo` ocupa o lugar do ícone; ajuste só se o layout quebrar.

Nas Dicas, apague o parágrafo "• O modo automático economiza tempo ao não precisar confirmar cada parada manualmente".

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/components/motorista/__tests__/NavigationSettings.test.tsx`
Expected: PASS (inclusive "não remonta o conteúdo ao alterar uma configuração").

- [ ] **Step 5: Commit**

```bash
git add src/components/motorista/NavigationSettings.tsx src/components/motorista/__tests__/NavigationSettings.test.tsx
git commit -m "feat(motorista): configurações trocam o Avanço Automático por Navegar com"
```

---

### Task 3: "Navegar" decide por `navegarCom` (nativo e web)

**Files:**

- Modify: `app/motorista/_screens/inicio.tsx` (`handleNavigateToStop` ~l.275–293, comentário ~l.683)
- Modify: `src/components/motorista/NavigationMode.web.tsx` (~l.106–108 e `checkProximityAndAutoAdvance` ~l.455–462)
- Test: `app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx`

**Interfaces:**

- Consumes: `PreferenciasDeNavegacao.navegarCom` (Task 1).

- [ ] **Step 1: Escrever os testes que falham**

Em `inicio-modo-navegacao.test.tsx`: troque `let mockAutoAdvance = true;` por `let mockNavegarCom: 'mapa' | 'externo' = 'mapa';`, o mock por `Promise.resolve({ navegarCom: mockNavegarCom })`, o `afterEach` por `mockNavegarCom = 'mapa';`, e o `describe('Início do motorista — mapa flutuante respeita o Avanço Automático'` por `describe('Início do motorista — mapa flutuante respeita o "Navegar com"'`. Nos dois testes:

```ts
it('externo: abre o app externo e NÃO entra no modo navegação', async () => {
  mockNavegarCom = 'externo';
  // ...corpo inalterado
});

it('mapa: entra no modo navegação', async () => {
  mockNavegarCom = 'mapa';
  // ...corpo inalterado
});
```

Acrescente um teste pelo botão principal (o `MainCard` mockado renderiza "navegar"):

```ts
  it('externo pelo botão Navegar: abre o app externo', async () => {
    mockNavegarCom = 'externo';
    const { getByText, queryByText } = render(<MotoristaInicio />);

    fireEvent.press(getByText('navegar'));

    await waitFor(() => {
      expect(mockAbrirNavegacao).toHaveBeenCalledWith(
        expect.objectContaining({ endereco: 'Rua A, 1' }),
      );
    });
    expect(queryByText('modo-navegacao')).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx`
Expected: FAIL — com `navegarCom: 'externo'`, `prefs.autoAdvance` é `undefined` e a Início… abre o app externo por acaso; o caso que falha é **"mapa: entra no modo navegação"** (`autoAdvance` undefined → app externo). Se algum outro teste do arquivo passar a falhar, é porque dependia de `autoAdvance: true` — ajuste o mock, não o código.

- [ ] **Step 3: Implementar**

Em `inicio.tsx`:

```ts
// Navigate to current stop
const handleNavigateToStop = async () => {
  if (!currentStop) return;

  // "Navegar com" (Configurações): o mapa do app ou o app externo.
  const prefs = await LocationTrackingService.getNavigationPreferences();

  if (prefs.navegarCom === 'mapa') {
    modals.setNavigationMode(true);
  } else {
    abrirNavegacao({
      latitude: currentStop.latitude,
      longitude: currentStop.longitude,
      endereco: currentStop.endereco,
    });
  }
};
```

No comentário do `onExpand` (~l.683), troque `o "Avanço Automático" escolhe entre` por `o "Navegar com" escolhe entre`.

Em `NavigationMode.web.tsx`: tire `autoAdvance` do objeto desestruturado de `preferences` (~l.106–108) e da condição/deps de `checkProximityAndAutoAdvance`:

```ts
const checkProximityAndAutoAdvance = useCallback(
  (distance: number) => {
    // Só se chega aqui com "Navegar com: Mapa do RotaMestre" — o aviso de
    // chegada é parte do modo, não de uma chave à parte.
    if (distance < proximityRadius) {
      handleArrival();
    }
  },
  [handleArrival, proximityRadius],
);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx src/components/motorista && npm run type-check`
Expected: PASS e type-check limpo **exceto** referências a `autoAdvance` em `src/components/motorista/__tests__/NavigationMode.test.tsx` (~l.62, 532, 540, 572, 619, 627, 643): troque cada `autoAdvance: true` por `navegarCom: 'mapa'` e rode de novo até limpar.

- [ ] **Step 5: Commit**

```bash
git add app/motorista/_screens src/components/motorista/NavigationMode.web.tsx src/components/motorista/__tests__/NavigationMode.test.tsx
git commit -m "feat(motorista): botão Navegar decide pelo Navegar com"
```

---

### Task 4: Rótulo do botão de app externo diz qual app abre

**Files:**

- Create: `src/lib/motorista/rotuloAppExterno.ts`
- Test: `src/lib/motorista/__tests__/rotuloAppExterno.test.ts`
- Modify: `src/components/motorista/NavigationInfoPanel.tsx` (props ~l.41, texto ~l.251)
- Modify: `src/components/motorista/NavigationInfoPanelWeb.tsx` (props, texto ~l.265)
- Modify: `src/components/motorista/NavigationMode.tsx` (~l.560–578) e `NavigationMode.web.tsx` (onde renderiza `NavigationInfoPanelWeb`)
- Test: `src/components/motorista/__tests__/NavigationMode.test.tsx`

**Interfaces:**

- Consumes: `NavigationPreferences.preferredNavApp` (Task 1).
- Produces: `export function rotuloAppExterno(app: 'waze' | 'google_maps' | 'apple_maps' | 'default' | undefined): string`; prop `rotuloAppExterno: string` nos dois painéis.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/motorista/__tests__/rotuloAppExterno.test.ts`:

```ts
import { rotuloAppExterno } from '../rotuloAppExterno';

describe('rotuloAppExterno', () => {
  it.each([
    ['waze', 'Abrir no Waze'],
    ['google_maps', 'Abrir no Google Maps'],
    ['apple_maps', 'Abrir no Apple Maps'],
    ['default', 'Abrir no GPS'],
    [undefined, 'Abrir no GPS'],
  ] as const)('%s → %s', (app, rotulo) => {
    expect(rotuloAppExterno(app)).toBe(rotulo);
  });
});
```

Em `NavigationMode.test.tsx`, no mock de preferências do topo (~l.62), acrescente `preferredNavApp: 'waze'`, e um teste:

```ts
  it('o botão de app externo diz qual app abre', async () => {
    const { findByText, queryByText } = render(<NavigationMode {...defaultProps} />);

    expect(await findByText('Abrir no Waze')).toBeTruthy();
    expect(queryByText('Abrir no Maps')).toBeNull();
  });
```

(Use o nome do objeto de props que o arquivo já usa — confira no topo do arquivo; se for outro, adapte só o nome.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/motorista/__tests__/rotuloAppExterno.test.ts src/components/motorista/__tests__/NavigationMode.test.tsx`
Expected: FAIL — módulo inexistente; "Unable to find an element with text: Abrir no Waze".

- [ ] **Step 3: Implementar**

`src/lib/motorista/rotuloAppExterno.ts`:

```ts
type AppDeNavegacao = 'waze' | 'google_maps' | 'apple_maps' | 'default';

/**
 * Rótulo do botão que entrega a rota ao app externo. "Abrir no Maps" não
 * dizia qual app abriria — e quem tem o Waze como preferido abria o Waze.
 * Sem preferência, `abrirNavegacao` mostra um menu de escolha: "GPS".
 */
export function rotuloAppExterno(app: AppDeNavegacao | undefined): string {
  switch (app) {
    case 'waze':
      return 'Abrir no Waze';
    case 'google_maps':
      return 'Abrir no Google Maps';
    case 'apple_maps':
      return 'Abrir no Apple Maps';
    default:
      return 'Abrir no GPS';
  }
}
```

Nos dois painéis, acrescente às props `rotuloAppExterno: string;` (com doc de uma linha: `/** Texto do botão que abre o app externo (ver rotuloAppExterno). */`), desestruture e troque `Abrir no Maps` por `{rotuloAppExterno}`. Em `NavigationMode.tsx`, importe `import { rotuloAppExterno } from '@/lib/motorista/rotuloAppExterno';` e passe `rotuloAppExterno={rotuloAppExterno(preferences.preferredNavApp)}` ao `NavigationInfoPanel`. Faça o mesmo em `NavigationMode.web.tsx` para o `NavigationInfoPanelWeb` (`preferences` já existe ali, vindo de `useNavigationModeLogic`). Se houver teste do painel web que procure "Abrir no Maps", troque pelo rótulo correspondente ao mock.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/motorista src/components/motorista && npm run type-check && npm run lint`
Expected: PASS, type-check e lint limpos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/motorista/rotuloAppExterno.ts src/lib/motorista/__tests__/rotuloAppExterno.test.ts src/components/motorista
git commit -m "feat(motorista): botão de app externo diz qual app abre"
```

---

### Task 5: Ajuda, documentação e varredura final

**Files:**

- Modify: `app/motorista/ajuda.tsx` (respostas ~l.75–84)
- Modify: `CLAUDE.md` (Phonebook, item "Concluir parada", trecho `que decide pelo "Avanço Automático"`)
- Modify: `docs/HISTORICO.md` (entrada nova no topo, no formato das demais)

- [ ] **Step 1: Ajuda**

Em `ajuda.tsx`, na resposta "São dois:", troque `"Pular", "Abrir no Maps" e "Concluir"` por `"Pular", "Abrir no GPS" (ou o nome do seu app) e "Concluir"` e `toque em "Abrir no Maps" dentro do mapa do app` por `toque no botão do seu app (por exemplo, "Abrir no Waze") dentro do mapa do app`. Substitua a resposta da pergunta id '10' por:

```ts
      'O que o botão "Navegar" abre depende do ajuste "Navegar com", em Configurações (no menu lateral). "Mapa do RotaMestre" (o padrão) abre o mapa do app, que avisa quando você chega e mantém a tela acesa. "Waze / Google Maps" abre direto o seu app de navegação, com instruções por voz. Nos dois casos, a parada só é concluída quando você toca em "Concluir" e envia a foto.',
```

Se existir teste da tela de ajuda que fixe o texto antigo, atualize-o (`grep -rn "Avanço Automático" app src`).

- [ ] **Step 2: Varredura da forma antiga**

Run: `grep -rn "autoAdvance\|Avanço Automático\|Abrir no Maps" app src --include=*.ts --include=*.tsx`
Expected: nenhuma ocorrência fora de `src/services/locationTracking.ts` (só no `converterChaveAntiga` e nos docblocks históricos) e do teste de conversão. Qualquer outra é consumidor esquecido — corrija.

- [ ] **Step 3: Documentação**

`CLAUDE.md`: troque `que decide pelo "Avanço Automático" entre ele e o app externo` por `que decide pelo "Navegar com" (\`navegarCom\`, antes \`autoAdvance\`) entre ele e o app externo`.

`docs/HISTORICO.md`: entrada nova no topo, curta, no estilo das vizinhas — título "\"Navegar com\" substitui o \"Avanço Automático\" (05/10/2026, para a 1.12.9)"; conteúdo: a chave não avançava nada desde 02/10 e o nome prometia o comportamento das entregas sem foto; medição da cadência (2 de 3 motoristas usam o mapa do app todo dia, por isso o padrão ficou); conversão `autoAdvance:false → externo`; dica enganosa removida; botão "Abrir no Maps" agora diz o app.

- [ ] **Step 4: Verificação completa**

Run: `npm run type-check && npm run lint && npx jest`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add app/motorista/ajuda.tsx CLAUDE.md docs/HISTORICO.md
git commit -m "docs: Navegar com no lugar do Avanço Automático"
```

---

## Validação fora do CI (depois do merge, antes da 1.12.9)

1. **Navegador** (`validar-no-navegador-antes-de-fechar`): Configurações → "Navegar com" alterna, o raio some com "Waze / Google Maps", e o "Navegar" da Início obedece, e o rótulo do botão de app externo no painel web (ex.: "Abrir no Waze") — essa fiação não tem teste. Sem digitar credencial de teste — a web local fala com produção.
2. **Aparelho** (build preview): instalar **por cima** de uma 1.12.8 com a chave antiga desligada e conferir que a escolha virou "Waze / Google Maps" — a conversão é o único ponto que nenhum teste de unidade prova no AsyncStorage real — e o rótulo mais longo ("Abrir no Google Maps") cabe no painel num aparelho de ~360 dp, sem cortar nem quebrar feio.
