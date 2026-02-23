import { ScrollViewStyleReset } from 'expo-router/html';

import type { PropsWithChildren } from 'react';

/**
 * Template HTML para o Expo Router (DEV SERVER ONLY).
 *
 * IMPORTANTE: Este template é usado APENAS pelo dev server do Expo.
 * Em produção (expo export), o HTML é gerado pelo Expo e pós-processado
 * por tools/scripts/inject-meta-tags.js que é a FONTE ÚNICA DE VERDADE
 * para meta tags, CSS tokens, z-index fix e toast-root.
 *
 * NÃO duplique meta tags aqui - edite inject-meta-tags.js para produção.
 */

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Rota Mestre - Gestão Inteligente de Entregas</title>
        <meta name="theme-color" content="#284093" />

        {/* Design System CSS Variables (tokens light + dark) */}
        <link rel="stylesheet" href="/css/tokens.css" />

        {/* Expo Router reset styles */}
        <ScrollViewStyleReset />

        {/* Custom styles - dev server only */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }
            body {
              overflow: hidden;
              background-color: var(--color-background, white);
            }
            #root {
              display: flex;
              height: 100%;
              flex: 1;
            }
            .expo-loading {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
            }
            /* z-index fix: React Native Web sets z-index:0 on all views */
            [class^="css-view-"] {
              z-index: auto !important;
            }
            #toast-root {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              pointer-events: none;
              z-index: 2147483647;
            }
          `
        }} />
      </head>
      <body>
        <noscript>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '20px'
          }}>
            <div>
              <h1>JavaScript Necessário</h1>
              <p>O Rota Mestre requer JavaScript para funcionar.</p>
              <p>Por favor, habilite JavaScript no seu navegador.</p>
            </div>
          </div>
        </noscript>
        {children}
        <div id="toast-root" />
      </body>
    </html>
  );
}
