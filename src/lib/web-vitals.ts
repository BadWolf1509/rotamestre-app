/**
 * Web Vitals Tracking
 *
 * Captura métricas Core Web Vitals (CLS, FCP, LCP, TTFB, INP)
 * e envia como custom events para o Sentry.
 *
 * Apenas web, apenas produção.
 */

import { Platform } from "react-native";

import { logger } from "@/lib/logger";

/**
 * Reporta Web Vitals para Sentry como custom measurements.
 * Deve ser chamado uma vez no mount do app (web only).
 */
export function reportWebVitals(): void {
  if (__DEV__) return;
  if (Platform.OS !== "web") return;

  try {
    // Usar require para compatibilidade com Metro bundler.
    // Dynamic import('web-vitals') falha em runtime porque Metro
    // resolve o ESM package como UMD e a desestruturação quebra.

    const webVitals = require("web-vitals");
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = webVitals;

    if (typeof onCLS !== "function") {
      logger.warn("web-vitals: exports not available");
      return;
    }

    const sendToSentry = (metric: {
      name: string;
      value: number;
      rating: string;
    }) => {
      logger.info(
        `Web Vital: ${metric.name} = ${metric.value} (${metric.rating})`,
      );

      try {
        const Sentry = require("@sentry/browser");
        Sentry.addBreadcrumb({
          category: "web-vital",
          message: `${metric.name}: ${metric.value}`,
          data: {
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
          },
          level: "info",
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
  } catch (error) {
    // web-vitals não disponível, ignorar silenciosamente
    logger.warn("web-vitals: failed to initialize", error);
  }
}
