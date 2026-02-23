#!/usr/bin/env node

/**
 * Script para injetar meta tags SEO, CSS e scripts no index.html após o build.
 *
 * FONTE ÚNICA DE VERDADE para o HTML de produção.
 * - +html.tsx serve apenas ao dev server do Expo (NÃO é aplicado na build de produção)
 * - _layout.tsx NÃO deve manipular meta tags via JS runtime
 * - Este script é a ÚNICA injeção de tags no HTML final
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..', '..');
const indexPath = join(projectRoot, 'dist', 'index.html');

const headTags = `
    <!-- SEO Básico -->
    <meta name="description" content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize logística, acompanhe motoristas e melhore a eficiência operacional da sua empresa." />
    <meta name="keywords" content="gestão de entregas, rastreamento de rotas, logística, rastreamento em tempo real, sistema de entregas, gestão de motoristas, otimização de rotas, roteirização, delivery management" />
    <meta name="author" content="Rota Mestre" />
    <meta name="robots" content="index, follow" />

    <!-- PWA -->
    <meta name="application-name" content="Rota Mestre" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Rota Mestre" />
    <meta name="mobile-web-app-capable" content="yes" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://app.rotamestre.tec.br/" />
    <meta property="og:title" content="Rota Mestre - Gestão Inteligente de Entregas" />
    <meta property="og:description" content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize sua logística e melhore a eficiência operacional." />
    <meta property="og:image" content="https://app.rotamestre.tec.br/icon-512.png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="Rota Mestre" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://app.rotamestre.tec.br/" />
    <meta name="twitter:title" content="Rota Mestre - Gestão Inteligente de Entregas" />
    <meta name="twitter:description" content="Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize sua logística." />
    <meta name="twitter:image" content="https://app.rotamestre.tec.br/icon-512.png" />

    <!-- Favicons -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />

    <!-- Canonical URL -->
    <link rel="canonical" href="https://app.rotamestre.tec.br/" />

    <!-- Design System CSS Variables (tokens light + dark) -->
    <link rel="stylesheet" href="/css/tokens.css" />

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Rota Mestre",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Android",
      "description": "Sistema completo de gestão de rotas de entrega com rastreamento em tempo real. Otimize logística, acompanhe motoristas e melhore a eficiência operacional.",
      "url": "https://app.rotamestre.tec.br/",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "BRL",
        "description": "Teste grátis por 7 dias"
      },
      "author": {
        "@type": "Organization",
        "name": "Rota Mestre",
        "url": "https://rotamestre.tec.br"
      },
      "inLanguage": "pt-BR"
    }
    </script>
`;

const bodyStartTags = `
    <!-- z-index fix: React Native Web sets z-index:0 on all views, breaking stacking contexts -->
    <!-- Ref: https://github.com/necolas/react-native-web/discussions/2547 -->
    <style>
      [class^="css-view-"] { z-index: auto !important; }
      #toast-root {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        z-index: 2147483647;
      }
    </style>
`;

const bodyEndTags = `
    <!-- Container para Toasts - renderizado por último para ficar acima de tudo -->
    <div id="toast-root"></div>

    <!-- Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').catch(function() {});
        });
      }
    </script>
`;

function injectMetaTags() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║      Injetar Meta Tags SEO no HTML           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Ler index.html
    console.log(`📄 Lendo: ${indexPath}`);
    let html = readFileSync(indexPath, 'utf8');

    // Atualizar título
    html = html.replace(
      /<title>.*?<\/title>/,
      '<title>Rota Mestre - Gestão Inteligente de Entregas e Rastreamento em Tempo Real</title>'
    );

    // Injetar meta tags antes do </head>
    html = html.replace('</head>', `${headTags}\n  </head>`);

    // Injetar z-index fix e toast style após <body> (antes do conteúdo)
    html = html.replace(/<body[^>]*>/, (match) => `${match}\n${bodyStartTags}`);

    // Injetar toast-root div antes do </body>
    html = html.replace('</body>', `${bodyEndTags}\n  </body>`);

    // Salvar
    writeFileSync(indexPath, html, 'utf8');

    console.log('✅ Meta tags injetadas com sucesso!\n');

    console.log('📋 Tags adicionadas:');
    console.log('   - SEO básico (description, keywords, robots)');
    console.log('   - Open Graph (Facebook, LinkedIn, WhatsApp)');
    console.log('   - Twitter Cards');
    console.log('   - PWA meta tags');
    console.log('   - Favicons (5 tamanhos)');
    console.log('   - Canonical URL');
    console.log('   - Design System CSS tokens');
    console.log('   - JSON-LD structured data (SoftwareApplication)');
    console.log('   - z-index fix + toast-root container');
    console.log('   - Service Worker registration\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

injectMetaTags();
