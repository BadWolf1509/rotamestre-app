import { ScrollViewStyleReset } from 'expo-router/html';
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
        <title>Rota Mestre - Gestão Inteligente de Entregas e Rastreamento em Tempo Real</title>
        <meta
          name="description"
          content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize logística, acompanhe motoristas, gerencie paradas e melhore a eficiência operacional da sua empresa."
        />
        <meta
          name="keywords"
          content="gestão de entregas, rastreamento de rotas, logística, rastreamento em tempo real, sistema de entregas, gestão de motoristas, otimização de rotas, roteirização, delivery management"
        />
        <meta name="author" content="Rota Mestre" />
        <meta name="robots" content="index, follow" />

        {/* PWA */}
        <meta name="application-name" content="Rota Mestre" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rota Mestre" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.rotamestre.tec.br" />
        <meta property="og:title" content="Rota Mestre - Gestão Inteligente de Entregas" />
        <meta
          property="og:description"
          content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize sua logística e melhore a eficiência operacional."
        />
        <meta property="og:image" content="https://app.rotamestre.tec.br/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Rota Mestre" />

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.rotamestre.tec.br" />
        <meta name="twitter:title" content="Rota Mestre - Gestão Inteligente de Entregas" />
        <meta
          name="twitter:description"
          content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize sua logística."
        />
        <meta name="twitter:image" content="https://app.rotamestre.tec.br/twitter-image.png" />

        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Canonical URL */}
        <link rel="canonical" href="https://app.rotamestre.tec.br" />

        {/* Preconnect para otimização */}
        <link rel="preconnect" href="https://api.rotamestre.tec.br" />
        <link rel="preconnect" href="https://your-project.supabase.co" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />

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
              background-color: #ffffff;
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
      </body>
    </html>
  );
}
