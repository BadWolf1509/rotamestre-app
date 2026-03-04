import { ScrollViewStyleReset } from "expo-router/html";

import type { PropsWithChildren } from "react";

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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <title>Rota Mestre - Gestão Inteligente de Entregas</title>
        <meta name="theme-color" content="#284093" />

        {/* Design System CSS Variables (tokens light + dark) */}
        <link rel="stylesheet" href="/css/tokens.css" />

        {/* Expo Router reset styles */}
        <ScrollViewStyleReset />

        {/* Custom styles - dev server only */}
        <style
          dangerouslySetInnerHTML={{
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
            /* Skip-to-content link for keyboard accessibility */
            .skip-nav {
              position: absolute;
              top: -100px;
              left: 50%;
              transform: translateX(-50%);
              background-color: #284093;
              color: #ffffff;
              padding: 12px 24px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              font-weight: 600;
              text-decoration: none;
              border-radius: 0 0 8px 8px;
              z-index: 2147483647;
              transition: top 0.2s ease;
            }
            .skip-nav:focus {
              top: 0;
              outline: none;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
          `,
          }}
        />
      </head>
      <body>
        <noscript>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              fontFamily: "sans-serif",
              textAlign: "center",
              padding: "20px",
            }}
          >
            <div>
              <h1>JavaScript Necessário</h1>
              <p>O Rota Mestre requer JavaScript para funcionar.</p>
              <p>Por favor, habilite JavaScript no seu navegador.</p>
            </div>
          </div>
        </noscript>
        <a href="#main-content" className="skip-nav">
          Pular para o conteúdo principal
        </a>
        <div id="main-content">{children}</div>
        <div id="toast-root" />
      </body>
    </html>
  );
}
