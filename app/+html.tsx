import { ScrollViewStyleReset } from 'expo-router/html';

import { defaultTheme } from '@/utils/styles';

import type { PropsWithChildren } from 'react';

/**
 * Template HTML customizado para o Expo Router
 * Define meta tags SEO, Open Graph, Twitter Cards e PWA
 */

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* SEO Básico */}
        <title>Rota Mestre - Sistema de Otimização e Gestão de Rotas</title>
        <meta
          name="description"
          content="Sistema completo de otimização e gestão de rotas. Economize até 20% em combustível com rotas inteligentes, rastreamento em tempo real e gestão de motoristas."
        />
        <meta
          name="keywords"
          content="otimização de rotas, gestão de entregas, rastreamento de rotas, logística, rastreamento em tempo real, sistema de entregas, gestão de motoristas, roteirização, delivery management"
        />
        <meta name="author" content="Rota Mestre" />
        <meta name="robots" content="index, follow" />

        {/* PWA */}
        <meta name="application-name" content="Rota Mestre" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rota Mestre" />
        <meta name="theme-color" content={defaultTheme.colors.primary} />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.rotamestre.tec.br/" />
        <meta property="og:title" content="Rota Mestre - Sistema de Otimização e Gestão de Rotas" />
        <meta
          property="og:description"
          content="Sistema completo de otimização e gestão de rotas. Economize até 20% em combustível com rotas inteligentes, rastreamento em tempo real e gestão de motoristas."
        />
        <meta property="og:image" content="https://app.rotamestre.tec.br/icon-512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Rota Mestre" />

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.rotamestre.tec.br/" />
        <meta name="twitter:title" content="Rota Mestre - Sistema de Otimização e Gestão de Rotas" />
        <meta
          name="twitter:description"
          content="Sistema completo de otimização e gestão de rotas. Economize até 20% em combustível com rotas inteligentes, rastreamento em tempo real e gestão de motoristas."
        />
        <meta name="twitter:image" content="https://app.rotamestre.tec.br/icon-512.png" />

        {/* Favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Canonical URL */}
        <link rel="canonical" href="https://app.rotamestre.tec.br" />

        {/* Preconnect para otimização */}
        <link rel="preconnect" href="https://api.rotamestre.tec.br" />
        <link rel="preconnect" href="https://your-project.supabase.co" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />

        {/* Design System CSS Variables (tokens light + dark) */}
        {/* Gerado por: npm run build:tokens */}
        <link rel="stylesheet" href="/css/tokens.css" />

        {/* Expo Router reset styles */}
        <ScrollViewStyleReset />

        {/* Custom styles */}
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
            /* Loading state */
            .expo-loading {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
            }

            /* ✅ FIX: Reset z-index:0 do react-native-web para permitir stacking contexts corretos */
            /* Isso resolve o problema de Toast/Tooltips ficarem atrás de Modais */
            /* Ref: https://github.com/necolas/react-native-web/discussions/2547 */
            [class^="css-view-"] {
              z-index: auto !important;
            }

            /* Container para Toasts - z-index máximo para aparecer acima de modais */
            #toast-root {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
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
        {/* Container para Toasts - renderizado por último para ficar acima de tudo */}
        <div id="toast-root" />
      </body>
    </html>
  );
}

