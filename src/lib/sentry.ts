/**
 * Sentry Error Monitoring
 *
 * Inicializa o Sentry para captura de erros em produção.
 * Configurado para ambiente web (React).
 *
 * Uso:
 * - Chamado uma vez no app root (_layout.tsx)
 * - Erros são capturados automaticamente pelo ErrorBoundary
 * - Breadcrumbs manuais via Sentry.addBreadcrumb()
 */

// `@sentry/browser`, não `@sentry/react`: o projeto usa exatamente cinco APIs
// — init, captureException, addBreadcrumb, setUser, withScope — e as cinco
// vivem aqui. Nada específico de React (ErrorBoundary do Sentry, withProfiler,
// hooks) é usado em lugar nenhum.
//
// POR QUE ISSO IMPORTA: `@sentry/react` fixa `@sentry/browser` em versão EXATA,
// e esse acoplamento custou caro. Quando o Dependabot abria os dois em PRs
// separados, o npm aninhava uma segunda árvore inteira do Sentry e o bundle
// estourava — 3,37 → 3,88 MB no #521, 3,39 → 3,9 MB no #537, contra o limite de
// 3,5 MB. Foram oito rodadas assim desde 27/07/2026. Com um pacote só, a
// dessincronização deixa de ser possível.
import * as Sentry from '@sentry/browser';
import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let initialized = false;

/**
 * Inicializa o Sentry. Deve ser chamado uma vez no boot do app.
 * Só ativa em produção e na web (mobile usa sentry-expo separado).
 */
export function initSentry(): void {
  if (initialized) return;
  if (__DEV__) return;
  if (Platform.OS !== 'web') return;
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1, // 10% das transações (performance)

    // NÃO existe replay aqui, e não é por causa de sample rate. `replayIntegration`
    // não está entre as integrations padrão do `@sentry/browser` 10 (conferido em
    // 21/09/2026 via `getDefaultIntegrations`), então o Session Replay só entra se
    // alguém o adicionar explicitamente em `integrations`. Até 21/09 havia aqui um
    // par `replaysSessionSampleRate: 0` / `replaysOnErrorSampleRate: 0` comentado
    // como "desabilitado (privacidade)" — eram campos inertes, e davam a impressão
    // falsa de que o replay estava ativo e contido por amostragem.
    //
    // Se um dia o replay for desejado: adicione `Sentry.replayIntegration()` E os
    // sample rates. Antes disso, pese a privacidade — o app grava tela de
    // motorista em rota, com endereço de cliente visível.

    // Filtrar erros irrelevantes
    beforeSend(event) {
      // Ignorar erros de extensões de browser
      if (
        event.exception?.values?.some((v) =>
          v.stacktrace?.frames?.some(
            (f) =>
              f.filename?.includes('chrome-extension://') ||
              f.filename?.includes('moz-extension://') ||
              f.filename?.includes('safari-extension://'),
          ),
        )
      ) {
        return null;
      }

      // Ignorar erros de rede (usuário offline)
      if (
        event.exception?.values?.some(
          (v) =>
            v.type === 'TypeError' &&
            (v.value?.includes('Failed to fetch') ||
              v.value?.includes('NetworkError') ||
              v.value?.includes('Load failed') ||
              v.value?.includes('Network request failed')),
        )
      ) {
        return null;
      }

      // Ignorar ResizeObserver loop (bug de browser, não da app)
      if (
        event.exception?.values?.some((v) =>
          v.value?.includes('ResizeObserver loop'),
        )
      ) {
        return null;
      }

      return event;
    },

    // Tags globais
    initialScope: {
      tags: {
        platform: 'web',
        app: 'rotamestre',
      },
    },
  });

  initialized = true;
}

/**
 * Captura um erro manualmente no Sentry.
 * Usado pelo ErrorBoundary.
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (__DEV__ || !initialized) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Adiciona breadcrumb manual para debugging.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (__DEV__ || !initialized) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Define o usuário atual para contexto nos erros.
 */
export function setUser(userId: string, email?: string, role?: string): void {
  if (__DEV__ || !initialized) return;

  Sentry.setUser({
    id: userId,
    email,
    ...(role ? { role } : {}),
  });
}

/**
 * Limpa o usuário (logout).
 */
export function clearUser(): void {
  if (__DEV__ || !initialized) return;
  Sentry.setUser(null);
}
