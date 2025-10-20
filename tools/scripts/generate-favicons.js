#!/usr/bin/env node

/**
 * Script para gerar favicons em múltiplos tamanhos
 * Usa a biblioteca sharp para redimensionar imagens
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..', '..');
const sourceIcon = join(projectRoot, 'assets', 'icon.png');
const publicDir = join(projectRoot, 'public');

// Criar diretório public se não existir
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Configuração dos tamanhos de favicon
const faviconSizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 96, name: 'favicon-96x96.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

async function generateFavicons() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║      Gerador de Favicons - Rota Mestre       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`📄 Imagem fonte: ${sourceIcon}`);
  console.log(`📁 Diretório destino: ${publicDir}\n`);

  // Verificar se imagem fonte existe
  if (!existsSync(sourceIcon)) {
    console.error('❌ Erro: Imagem fonte não encontrada!');
    console.error(`   Esperado: ${sourceIcon}\n`);
    process.exit(1);
  }

  console.log('🔄 Gerando favicons...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const { size, name } of faviconSizes) {
    const outputPath = join(publicDir, name);

    try {
      process.stdout.write(`   [${size}x${size}] ${name}... `);

      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      console.error(`      Erro: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║  Resultado: ${successCount} OK | ${errorCount} erros                 ║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  if (successCount > 0) {
    console.log('✅ Favicons gerados com sucesso!\n');
    console.log('📋 Arquivos criados em public/:\n');
    faviconSizes.forEach(({ name }) => {
      console.log(`   - ${name}`);
    });
    console.log('');
  }

  if (errorCount > 0) {
    console.log('⚠️  Alguns favicons falharam ao gerar.\n');
    process.exit(1);
  }

  console.log('🎯 Próximos passos:\n');
  console.log('   1. Verificar favicons gerados em public/');
  console.log('   2. Criar og-image.png (1200x630) para redes sociais');
  console.log('   3. Criar twitter-image.png (1200x600)');
  console.log('   4. Fazer rebuild do projeto: npx expo export --platform web\n');
}

// Executar
generateFavicons().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  process.exit(1);
});
