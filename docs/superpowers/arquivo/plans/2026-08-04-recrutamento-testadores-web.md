# Recrutamento de testadores na plataforma web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à plataforma web um caminho público para uma pessoa virar testadora do teste fechado Android, para aumentar o número de testadores com opt-in e destravar a produção da Play.

**Architecture:** Uma rota pública `/testar` (hub de recrutamento com passo a passo e detecção de plataforma) mais um link discreto na tela de login que aponta para ela. Os links do teste (grupo, opt-in, Play) vêm de env vars `EXPO_PUBLIC_*` lidas por um módulo único; a feature inteira é gated pela presença do link de opt-in (sem ela, some) e o link no login é gated para web.

**Tech Stack:** React Native + Expo Router (TypeScript), Unistyles (`@/utils/styles`), design system (`@/design-system`), Jest + `@testing-library/react-native`.

## Global Constraints

- **Sem dependência nativa nova.** Nada que force rebuild EAS. Tudo é JS/TSX puro sobre libs já presentes. QR code fica **fora** deste plano (enhancement futuro; no desktop mostramos a URL em destaque).
- **Links nunca no Git.** Só via `process.env.EXPO_PUBLIC_*`. Nenhum link de opt-in/grupo hardcodado em código versionado. Valores reais moram no Vercel.
- **Sem `as any`** em código de produção (exceto o caso documentado de Unistyles web).
- **Logging:** `logger.warn(msg, err)` no máximo 2 args, se precisar logar.
- **Copy honesta:** nada de preço, prazo ou recurso indisponível (regra de `docs/GOOGLE_PLAY_DEPLOYMENT.md`).
- **Commits:** cada commit termina com a trailer, em linha própria:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  (omitida nos exemplos abaixo por brevidade — sempre adicione).
- **Comando de teste único:** `npx jest <caminho>`. Validação final: `npm run validate` (= `type-check` + `lint` + `test`) e `npm run build:web`.
- **Gate de plataforma mora no ponto de uso** (`login.tsx` usa `Platform.OS === 'web'`); os componentes novos não leem `Platform` (mantém testes simples).

---

## File Structure

| Arquivo                                             | Responsabilidade                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `src/utils/detectWebPlatform.ts`                    | Função pura: userAgent → `'android' \| 'ios' \| 'desktop'`       |
| `src/lib/testerLinks.ts`                            | Lê env vars; expõe `isRecruitmentEnabled()` + `getTesterLinks()` |
| `src/components/testar/TesterRecruitmentScreen.tsx` | Screen do hub: casca + 3 modos de plataforma + estado neutro     |
| `src/components/testar/TesterLoginLink.tsx`         | Link "Seja um testador" (gate de env + navegação)                |
| `app/testar.tsx`                                    | Rota pública fina: `ErrorBoundary` + a screen                    |
| `app/auth/login.tsx`                                | (editar) monta `<TesterLoginLink/>` gated por web nos 2 layouts  |
| `.env.example`                                      | (editar) documenta as 3 variáveis                                |

---

## Task 1: Util de detecção de plataforma web

**Files:**

- Create: `src/utils/detectWebPlatform.ts`
- Test: `src/utils/__tests__/detectWebPlatform.test.ts`

**Interfaces:**

- Produces: `type WebPlatform = 'android' | 'ios' | 'desktop'` e `detectWebPlatform(userAgent?: string): WebPlatform`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/utils/__tests__/detectWebPlatform.test.ts`:

```ts
import { detectWebPlatform } from '../detectWebPlatform';

describe('detectWebPlatform', () => {
  it('detecta Android', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
      ),
    ).toBe('android');
  });

  it('detecta iOS (iPhone)', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe('ios');
  });

  it('trata desktop como padrão', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ),
    ).toBe('desktop');
  });

  it('retorna desktop quando o userAgent está vazio ou ausente', () => {
    expect(detectWebPlatform('')).toBe('desktop');
    expect(detectWebPlatform(undefined)).toBe('desktop');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx jest src/utils/__tests__/detectWebPlatform.test.ts`
Expected: FAIL — "Cannot find module '../detectWebPlatform'".

- [ ] **Step 3: Implementar o mínimo**

Create `src/utils/detectWebPlatform.ts`:

```ts
/**
 * Detecta a plataforma do visitante da web a partir do userAgent.
 *
 * Usado pela página /testar para adaptar o passo a passo de instalação.
 * iPad moderno (iPadOS 13+) reporta como "Macintosh" → cai em 'desktop',
 * o que é aceitável: só precisamos distinguir o fluxo Android dos demais.
 */
export type WebPlatform = 'android' | 'ios' | 'desktop';

export function detectWebPlatform(userAgent?: string): WebPlatform {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '') ??
    '';

  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx jest src/utils/__tests__/detectWebPlatform.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/detectWebPlatform.ts src/utils/__tests__/detectWebPlatform.test.ts
git commit -m "feat: util detectWebPlatform para a pagina de testadores"
```

---

## Task 2: Módulo de configuração dos links (env)

**Files:**

- Create: `src/lib/testerLinks.ts`
- Test: `src/lib/__tests__/testerLinks.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `interface TesterLinks { optInUrl: string; groupUrl: string; storeUrl: string }`
  - `isRecruitmentEnabled(): boolean` — true sse `EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL` está definida (não vazia).
  - `getTesterLinks(): TesterLinks` — `storeUrl` cai no default da Play quando a env não existe.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/__tests__/testerLinks.test.ts`:

```ts
describe('testerLinks', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('isRecruitmentEnabled é false sem o link de opt-in', () => {
    delete process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL;
    const { isRecruitmentEnabled } = require('../testerLinks');
    expect(isRecruitmentEnabled()).toBe(false);
  });

  it('isRecruitmentEnabled é true com o link de opt-in', () => {
    process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL =
      'https://play.google.com/apps/testing/br.tec.rotamestre.app';
    const { isRecruitmentEnabled } = require('../testerLinks');
    expect(isRecruitmentEnabled()).toBe(true);
  });

  it('getTesterLinks usa o default da Play Store quando a env não está definida', () => {
    delete process.env.EXPO_PUBLIC_PLAY_STORE_URL;
    const { getTesterLinks } = require('../testerLinks');
    expect(getTesterLinks().storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app',
    );
  });

  it('getTesterLinks reflete as envs definidas', () => {
    process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL = 'https://optin.example';
    process.env.EXPO_PUBLIC_PLAY_TESTER_GROUP_URL = 'https://group.example';
    process.env.EXPO_PUBLIC_PLAY_STORE_URL = 'https://store.example';
    const { getTesterLinks } = require('../testerLinks');
    expect(getTesterLinks()).toEqual({
      optInUrl: 'https://optin.example',
      groupUrl: 'https://group.example',
      storeUrl: 'https://store.example',
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx jest src/lib/__tests__/testerLinks.test.ts`
Expected: FAIL — "Cannot find module '../testerLinks'".

- [ ] **Step 3: Implementar o mínimo**

Create `src/lib/testerLinks.ts`:

```ts
/**
 * Configuração dos links de recrutamento de testadores (teste fechado Android).
 *
 * Os links são operacionais e NUNCA ficam no Git — vêm de env vars
 * EXPO_PUBLIC_* (valores reais no Vercel). A presença do link de opt-in
 * funciona como interruptor da feature em toda a plataforma web.
 *
 * process.env é lido dentro das funções de propósito, para refletir o
 * ambiente em runtime e permitir teste direto.
 */
const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app';

export interface TesterLinks {
  optInUrl: string;
  groupUrl: string;
  storeUrl: string;
}

export function isRecruitmentEnabled(): boolean {
  return (
    (process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL || '').trim().length > 0
  );
}

export function getTesterLinks(): TesterLinks {
  return {
    optInUrl: process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL || '',
    groupUrl: process.env.EXPO_PUBLIC_PLAY_TESTER_GROUP_URL || '',
    storeUrl: process.env.EXPO_PUBLIC_PLAY_STORE_URL || DEFAULT_STORE_URL,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx jest src/lib/__tests__/testerLinks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Documentar as env vars**

Edit `.env.example` — adicionar ao final:

```bash
# Tester Recruitment (web only — valores reais no Vercel, nunca commitados)
# A presença de OPTIN_URL liga a pagina /testar e o link na tela de login.
# EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL=https://play.google.com/apps/testing/br.tec.rotamestre.app
# EXPO_PUBLIC_PLAY_TESTER_GROUP_URL=https://groups.google.com/g/seu-grupo-de-testadores
# EXPO_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=br.tec.rotamestre.app
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/testerLinks.ts src/lib/__tests__/testerLinks.test.ts .env.example
git commit -m "feat: modulo testerLinks lendo env vars com gate de recrutamento"
```

---

## Task 3: Screen do hub de recrutamento

**Files:**

- Create: `src/components/testar/TesterRecruitmentScreen.tsx`
- Test: `src/components/testar/__tests__/TesterRecruitmentScreen.test.tsx`

**Interfaces:**

- Consumes: `detectWebPlatform()` (Task 1); `isRecruitmentEnabled()`, `getTesterLinks()` (Task 2).
- Produces: `export function TesterRecruitmentScreen(): JSX.Element`.

**Comportamento:**

- `!isRecruitmentEnabled()` → estado neutro ("indisponível no momento").
- `detectWebPlatform() === 'ios'` → aviso honesto (só Android).
- `'android' | 'desktop'` → 3 passos (grupo → opt-in → Play), cada um abre o link via `Linking.openURL`; aviso "mesma Conta Google"; no `desktop`, mostra também a URL de compartilhamento em destaque.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/testar/__tests__/TesterRecruitmentScreen.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { TesterRecruitmentScreen } from '../TesterRecruitmentScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => false,
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

const mockIsEnabled = jest.fn();
const mockGetLinks = jest.fn();
jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => mockIsEnabled(),
  getTesterLinks: () => mockGetLinks(),
}));

const mockDetect = jest.fn();
jest.mock('@/utils/detectWebPlatform', () => ({
  detectWebPlatform: () => mockDetect(),
}));

const LINKS = {
  optInUrl: 'https://play.google.com/apps/testing/br.tec.rotamestre.app',
  groupUrl: 'https://groups.google.com/g/testadores-rotamestre',
  storeUrl:
    'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app',
};

describe('TesterRecruitmentScreen', () => {
  let openURLSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLinks.mockReturnValue(LINKS);
    openURLSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => openURLSpy.mockRestore());

  it('mostra estado neutro quando o recrutamento está desativado', () => {
    mockIsEnabled.mockReturnValue(false);
    mockDetect.mockReturnValue('android');
    const { getByText, queryByText } = render(<TesterRecruitmentScreen />);
    expect(getByText(/indisponível no momento/i)).toBeTruthy();
    expect(queryByText('Entre no grupo de testadores')).toBeNull();
  });

  it('mostra os 3 passos e o aviso de Conta Google no Android', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    const { getByText } = render(<TesterRecruitmentScreen />);
    expect(getByText('Entre no grupo de testadores')).toBeTruthy();
    expect(getByText('Aceite o teste')).toBeTruthy();
    expect(getByText('Instale o app')).toBeTruthy();
    expect(getByText(/mesma Conta Google/i)).toBeTruthy();
  });

  it('abre o link de opt-in ao tocar no CTA do passo 2', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    const { getByText } = render(<TesterRecruitmentScreen />);
    fireEvent.press(getByText('Abrir convite de teste'));
    expect(openURLSpy).toHaveBeenCalledWith(LINKS.optInUrl);
  });

  it('mostra aviso de Android-only no iPhone', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('ios');
    const { getByText, queryByText } = render(<TesterRecruitmentScreen />);
    expect(getByText(/só para Android/i)).toBeTruthy();
    expect(queryByText('Entre no grupo de testadores')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx jest src/components/testar/__tests__/TesterRecruitmentScreen.test.tsx`
Expected: FAIL — "Cannot find module '../TesterRecruitmentScreen'".

- [ ] **Step 3: Implementar a screen**

Create `src/components/testar/TesterRecruitmentScreen.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system';
import { getTesterLinks, isRecruitmentEnabled } from '@/lib/testerLinks';
import { detectWebPlatform } from '@/utils/detectWebPlatform';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StepData {
  n: number;
  title: string;
  description: string;
  cta: string;
  url: string;
}

const SHARE_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/testar`
    : 'https://app.rotamestre.tec.br/testar';

export function TesterRecruitmentScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const enabled = isRecruitmentEnabled();
  const platform = detectWebPlatform();
  const links = getTesterLinks();

  const steps: StepData[] = [
    {
      n: 1,
      title: 'Entre no grupo de testadores',
      description:
        'Participe com sua Conta Google. É esse cadastro que libera o app de teste para você.',
      cta: 'Entrar no grupo',
      url: links.groupUrl,
    },
    {
      n: 2,
      title: 'Aceite o teste',
      description:
        "Abra o convite e toque em 'Tornar-se testador'. Use a mesma Conta Google do passo anterior.",
      cta: 'Abrir convite de teste',
      url: links.optInUrl,
    },
    {
      n: 3,
      title: 'Instale o app',
      description:
        'Abra a Play Store e instale o Rota Mestre. Pode levar alguns minutos até o app de teste aparecer.',
      cta: 'Abrir na Play Store',
      url: links.storeUrl,
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(32, insets.bottom + 24) },
      ]}
    >
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/auth/login')
          }
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Rota Mestre</Text>
      </View>

      <View style={styles.document}>
        {!enabled ? (
          <View>
            <Text style={styles.title}>Programa de testadores</Text>
            <Text style={styles.paragraph}>
              O recrutamento de testadores está indisponível no momento. Tente
              novamente mais tarde.
            </Text>
          </View>
        ) : platform === 'ios' ? (
          <View>
            <Text style={styles.title}>Ainda não disponível para iPhone</Text>
            <Text style={styles.paragraph}>
              O app de teste ainda é só para Android. A versão para iPhone está
              a caminho — por enquanto, você pode usar o Rota Mestre pelo
              navegador.
            </Text>
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => router.replace('/auth/login')}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryCtaText}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.title}>Seja um testador do app</Text>
            <Text style={styles.paragraph}>
              Ajude a testar o app de motorista do Rota Mestre no Android. São
              três passos rápidos:
            </Text>

            <View style={styles.warning}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.secondary}
              />
              <Text style={styles.warningText}>
                Use a mesma Conta Google (e-mail) nos três passos. Com contas
                diferentes, a Play não reconhece você como testador.
              </Text>
            </View>

            {steps.map((step) => (
              <View key={step.n} style={styles.step}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.n}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <TouchableOpacity
                    style={[
                      styles.stepCta,
                      !step.url && styles.stepCtaDisabled,
                    ]}
                    disabled={!step.url}
                    onPress={() => step.url && Linking.openURL(step.url)}
                    accessibilityRole="link"
                    accessibilityLabel={step.cta}
                  >
                    <Text style={styles.stepCtaText}>{step.cta}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {platform === 'desktop' && (
              <View style={styles.desktopHint}>
                <Text style={styles.desktopHintTitle}>Está no computador?</Text>
                <Text style={styles.paragraph}>
                  Abra este endereço no seu celular Android para continuar:
                </Text>
                <Text
                  style={styles.shareUrl}
                  accessibilityRole="text"
                  selectable
                >
                  {SHARE_URL}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  topbar: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  backText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  brand: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.lg,
  },
  document: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  title: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography['2xl'],
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.base,
    lineHeight: 25,
    marginBottom: theme.spacing.md,
  },
  warning: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  warningText: {
    flex: 1,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.sm,
    lineHeight: 21,
  },
  step: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.lg,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.base,
    lineHeight: 23,
    marginBottom: theme.spacing.sm,
  },
  stepCta: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  stepCtaDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  stepCtaText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  secondaryCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
  },
  secondaryCtaText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  desktopHint: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  desktopHintTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.xs,
  },
  shareUrl: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.lg,
  },
}));
```

> **Nota sobre tokens de tema:** os nomes usados (`theme.colors.gray50/gray200/gray300/gray700/gray900/primary/secondary/white`, `theme.typography.fontDisplay/fontSans/fontSansMedium/fontSansSemiBold/fontSansBold`, `theme.typography['2xl'|lg|base|sm]`, `theme.spacing.*`, `theme.borderRadius.lg/xl`) são os mesmos de `src/components/legal/LegalPage.tsx` e `app/auth/login.tsx`. Se `type-check` acusar algum token inexistente, troque pelo vizinho usado nesses dois arquivos.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx jest src/components/testar/__tests__/TesterRecruitmentScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: sem erros. (Se acusar token de tema, ajuste conforme a nota acima.)

- [ ] **Step 6: Commit**

```bash
git add src/components/testar/TesterRecruitmentScreen.tsx src/components/testar/__tests__/TesterRecruitmentScreen.test.tsx
git commit -m "feat: screen de recrutamento de testadores com passo a passo"
```

---

## Task 4: Rota pública `/testar`

**Files:**

- Create: `app/testar.tsx`
- Test: `app/__tests__/testar.test.tsx`

**Interfaces:**

- Consumes: `TesterRecruitmentScreen` (Task 3); `ErrorBoundary` de `@/components/ErrorBoundary`.
- Produces: rota Expo Router `/testar` (default export).

- [ ] **Step 1: Escrever o teste que falha**

Create `app/__tests__/testar.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import React from 'react';

import Testar from '../testar';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => false,
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => false,
  getTesterLinks: () => ({ optInUrl: '', groupUrl: '', storeUrl: '' }),
}));

jest.mock('@/utils/detectWebPlatform', () => ({
  detectWebPlatform: () => 'desktop',
}));

describe('rota /testar', () => {
  it('renderiza sem quebrar (estado neutro)', () => {
    const { getByText } = render(<Testar />);
    expect(getByText(/indisponível no momento/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx jest app/__tests__/testar.test.tsx`
Expected: FAIL — "Cannot find module '../testar'".

- [ ] **Step 3: Implementar a rota**

Create `app/testar.tsx`:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TesterRecruitmentScreen } from '@/components/testar/TesterRecruitmentScreen';

/**
 * Rota pública /testar — hub de recrutamento de testadores do teste fechado
 * Android. Acessível sem login (mesmo padrão das páginas legais).
 */
export default function Testar() {
  return (
    <ErrorBoundary>
      <TesterRecruitmentScreen />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx jest app/__tests__/testar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/testar.tsx app/__tests__/testar.test.tsx
git commit -m "feat: rota publica /testar para recrutamento de testadores"
```

---

## Task 5: Link "Seja um testador" na tela de login

**Files:**

- Create: `src/components/testar/TesterLoginLink.tsx`
- Test: `src/components/testar/__tests__/TesterLoginLink.test.tsx`
- Modify: `app/auth/login.tsx`

**Interfaces:**

- Consumes: `isRecruitmentEnabled()` (Task 2); `useRouter` de expo-router.
- Produces: `export function TesterLoginLink(): JSX.Element | null` — retorna `null` quando o recrutamento está desativado; senão um link que navega para `/testar`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/testar/__tests__/TesterLoginLink.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { TesterLoginLink } from '../TesterLoginLink';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockIsEnabled = jest.fn();
jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => mockIsEnabled(),
}));

describe('TesterLoginLink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza o link quando o recrutamento está ativo', () => {
    mockIsEnabled.mockReturnValue(true);
    const { getByText } = render(<TesterLoginLink />);
    expect(getByText('📱 Seja um testador do app')).toBeTruthy();
  });

  it('não renderiza nada quando o recrutamento está desativado', () => {
    mockIsEnabled.mockReturnValue(false);
    const { queryByText } = render(<TesterLoginLink />);
    expect(queryByText('📱 Seja um testador do app')).toBeNull();
  });

  it('navega para /testar ao tocar', () => {
    mockIsEnabled.mockReturnValue(true);
    const { getByText } = render(<TesterLoginLink />);
    fireEvent.press(getByText('📱 Seja um testador do app'));
    expect(mockPush).toHaveBeenCalledWith('/testar');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx jest src/components/testar/__tests__/TesterLoginLink.test.tsx`
Expected: FAIL — "Cannot find module '../TesterLoginLink'".

- [ ] **Step 3: Implementar o componente**

Create `src/components/testar/TesterLoginLink.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { Text } from '@/design-system';
import { isRecruitmentEnabled } from '@/lib/testerLinks';
import { StyleSheet, type Theme } from '@/utils/styles';

/**
 * Link discreto na tela de login que leva ao hub /testar.
 * Só renderiza quando o recrutamento está ativo (env de opt-in presente).
 * O gate de plataforma (web only) é aplicado por quem monta este componente.
 */
export function TesterLoginLink() {
  const router = useRouter();

  if (!isRecruitmentEnabled()) return null;

  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => router.push('/testar')}
      accessibilityRole="link"
      accessibilityLabel="Seja um testador do app"
    >
      <Text style={styles.linkText}>📱 Seja um testador do app</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  link: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  linkText: {
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx jest src/components/testar/__tests__/TesterLoginLink.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Montar no login (2 layouts), gated por web**

Edit `app/auth/login.tsx`:

(a) Adicionar o import junto aos outros de componentes (perto da linha 22, com os imports de `@/components/auth/...`):

```tsx
import { TesterLoginLink } from '@/components/testar/TesterLoginLink';
```

(b) No render **desktop**, logo após o bloco `<View style={styles.footer}>…</View>` que contém "Ainda não tem conta?" (por volta da linha 287), adicionar:

```tsx
{
  Platform.OS === 'web' && <TesterLoginLink />;
}
```

(c) No render **mobile**, logo após o bloco `<View style={styles.footer}>…</View>` equivalente (por volta da linha 432), adicionar a mesma linha:

```tsx
{
  Platform.OS === 'web' && <TesterLoginLink />;
}
```

`Platform` já está importado em `login.tsx` (linha 10). Não há novo estilo a criar.

- [ ] **Step 6: Rodar os testes do login e o type-check**

Run: `npx jest app/auth/login.tsx` (se não houver teste dedicado, rode o type-check abaixo)
Run: `npm run type-check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/testar/TesterLoginLink.tsx src/components/testar/__tests__/TesterLoginLink.test.tsx app/auth/login.tsx
git commit -m "feat: link 'seja um testador' na tela de login (web, gated por env)"
```

---

## Task 6: Validação de integração e preview

**Files:** nenhum novo — verificação de ponta a ponta.

- [ ] **Step 1: Validação completa**

Run: `npm run validate`
Expected: `type-check`, `lint` e `test` passam (exit 0). Corrija qualquer falha antes de seguir.

- [ ] **Step 2: Build web**

Run: `npm run build:web`
Expected: build conclui sem erro.

- [ ] **Step 3: Smoke no preview — feature desligada (sem env)**

Sem `EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL` no ambiente:

- Suba o preview (Browser pane / dev server).
- Na tela de login, confirme que **não** há o link "Seja um testador".
- Navegue manualmente para `/testar`: deve mostrar o estado neutro ("indisponível no momento").
- Verifique o console do preview sem novos erros.

- [ ] **Step 4: Smoke no preview — feature ligada**

Com `EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL` definida (valor de teste) no ambiente do dev server:

- Recarregue. Na tela de login, o link "📱 Seja um testador do app" aparece; clicar leva a `/testar`.
- Em `/testar`, confirme os 3 passos, o aviso de Conta Google, e (redimensionando para desktop) o bloco "Está no computador?" com a URL.
- Simule iPhone (userAgent) e confirme o aviso "só para Android".
- Tire um screenshot da `/testar` para registro.

- [ ] **Step 5: Commit (se algum ajuste foi necessário)**

```bash
git add -A
git commit -m "chore: ajustes de integracao do recrutamento de testadores"
```

---

## Self-Review (preenchido pelo autor do plano)

**1. Cobertura do spec:**

- Passo 0 (Play Console) → fora de código, documentado no spec e reforçado na Task 6 (smoke liga/desliga). ✓
- Rota `/testar` → Tasks 3+4. ✓
- Link no login → Task 5. ✓
- Detecção de plataforma → Task 1, consumida na Task 3. ✓
- Gate por env → Task 2 (`isRecruitmentEnabled`), aplicado nas Tasks 3 e 5. ✓
- Gate por plataforma web → Task 5 (no ponto de uso do login). ✓
- Env vars + `.env.example` → Task 2. ✓
- Copy honesta dos 3 passos + aviso Conta Google + iPhone → Task 3. ✓
- Testes (unit + integração) → Tasks 1–5; validação Task 6. ✓
- QR: conscientemente **fora** do MVP (Global Constraints) — desktop usa URL destacada. Divergência intencional do spec, registrada.

**2. Placeholders:** nenhum "TBD/TODO"; todo passo tem código ou comando concreto. ✓

**3. Consistência de tipos:** `WebPlatform`, `TesterLinks`, `isRecruitmentEnabled()`, `getTesterLinks()`, `TesterRecruitmentScreen`, `TesterLoginLink` usados com os mesmos nomes/assinaturas entre as tasks. ✓
