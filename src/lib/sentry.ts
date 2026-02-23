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

import * as Sentry from '@sentry/react';
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
    replaysSessionSampleRate: 0, // Desabilitado (privacidade)
    replaysOnErrorSampleRate: 0, // Desabilitado (privacidade)

    // Filtrar erros irrelevantes
    beforeSend(event) {
      // Ignorar erros de extensões de browser
      if (event.exception?.values?.some(
        (v) => v.stacktrace?.frames?.some(
          (f) => f.filename?.includes('chrome-extension://') ||
                 f.filename?.includes('moz-extension://') ||
                 f.filename?.includes('safari-extension://')
        )
      )) {
        return null;
      }

      // Ignorar erros de rede (usuário offline)
      if (event.exception?.values?.some(
        (v) => v.type === 'TypeError' && (
          v.value?.includes('Failed to fetch') ||
          v.value?.includes('NetworkError') ||
          v.value?.includes('Load failed') ||
          v.value?.includes('Network request failed')
        )
      )) {
        return null;
      }

      // Ignorar ResizeObserver loop (bug de browser, não da app)
      if (event.exception?.values?.some(
        (v) => v.value?.includes('ResizeObserver loop')
      )) {
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
export function captureError(error: Error, context?: Record<string, unknown>): void {
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
