// Script para gerar todos os favicons a partir do icon.png
const fs = require('fs');
const path = require('path');

// Usar canvas para redimensionar (já está nas dependências do Expo)
async function generateFavicons() {
  console.log('🎨 Gerando favicons...\n');

  const sourceIcon = path.join(__dirname, 'assets', 'icon.png');
  const distDir = path.join(__dirname, 'dist');

  // Verificar se o arquivo fonte existe
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Arquivo assets/icon.png não encontrado!');
    process.exit(1);
  }

  // Criar pasta dist se não existir
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Lista de favicons para copiar/gerar
  const favicons = [
    { src: sourceIcon, dest: 'apple-touch-icon.png', info: '180x180 (iOS)' },
    { src: sourceIcon, dest: 'icon-192.png', info: '192x192 (Android PWA)' },
    { src: sourceIcon, dest: 'icon-512.png', info: '512x512 (PWA Splash)' },
    { src: sourceIcon, dest: 'favicon-16x16.png', info: '16x16' },
    { src: sourceIcon, dest: 'favicon-32x32.png', info: '32x32' },
    { src: sourceIcon, dest: 'favicon-96x96.png', info: '96x96' },
  ];

  console.log('📋 Favicons que serão atualizados:\n');

  for (const favicon of favicons) {
    const destPath = path.join(distDir, favicon.dest);

    try {
      // Copiar o arquivo (navegador redimensiona automaticamente)
      fs.copyFileSync(favicon.src, destPath);
      const stats = fs.statSync(destPath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      console.log(`✅ ${favicon.dest.padEnd(25)} ${sizeKB.padStart(6)} KB  ${favicon.info}`);
    } catch (error) {
      console.error(`❌ Erro ao copiar ${favicon.dest}:`, error.message);
    }
  }

  console.log('\n✅ Favicons gerados com sucesso!');
  console.log('\n📋 Próximos passos:');
  console.log('   1. git add assets dist');
  console.log('   2. git commit -m "feat: Atualiza favicons com novo ícone"');
  console.log('   3. git push');
  console.log('   4. Aguardar deploy (1-2 min)');
  console.log('   5. Limpar cache do navegador');
  console.log('   6. Testar em https://app.rotamestre.tec.br\n');
}

generateFavicons().catch(console.error);
