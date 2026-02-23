/**
 * Web Vitals Tracking
 *
 * Captura métricas Core Web Vitals (CLS, FCP, LCP, TTFB, INP)
 * e envia como custom events para o Sentry.
 *
 * Apenas web, apenas produção.
 */

import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

/**
 * Reporta Web Vitals para Sentry como custom measurements.
 * Deve ser chamado uma vez no mount do app (web only).
 */
export function reportWebVitals(): void {
  if (__DEV__) return;
  if (Platform.OS !== 'web') return;

  // Importar dinamicamente para não afetar o bundle em mobile
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    const sendToSentry = (metric: { name: string; value: number; rating: string }) => {
      // Log localmente para debugging
      logger.info(`Web Vital: ${metric.name} = ${metric.value} (${metric.rating})`);

      // Enviar como breadcrumb para o Sentry
      try {
        const Sentry = require('@sentry/browser');
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `${metric.name}: ${metric.value}`,
          data: {
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
          },
          level: 'info',
        });
      } catch {
        // Sentry não disponível, ignorar
      }
    };

    onCLS(sendToSentry);
    onFCP(sendToSentry);
    onLCP(sendToSentry);
    onTTFB(sendToSentry);
    onINP(sendToSentry);
  }).catch(() => {
    // web-vitals não disponível, ignorar silenciosamente
  });
}
