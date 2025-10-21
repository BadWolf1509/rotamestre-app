// Script para gerar todos os favicons a partir do icon.png usando sharp
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFavicons() {
  console.log('🎨 Gerando favicons com sharp...\n');

  // Caminhos corretos (raiz do projeto)
  const rootDir = path.join(__dirname, '..', '..', '..');
  const sourceIcon = path.join(rootDir, 'assets', 'icon.png');
  const publicDir = path.join(rootDir, 'public');

  console.log(`📂 Diretório raiz: ${rootDir}`);
  console.log(`📄 Arquivo fonte: ${sourceIcon}`);
  console.log(`📁 Destino: ${publicDir}\n`);

  // Verificar se o arquivo fonte existe
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Arquivo assets/icon.png não encontrado!');
    console.error(`   Procurado em: ${sourceIcon}`);
    process.exit(1);
  }

  // Criar pasta public se não existir
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Lista de favicons com tamanhos específicos
  const favicons = [
    { size: 180, dest: 'apple-touch-icon.png', info: '180x180 (iOS)' },
    { size: 192, dest: 'icon-192.png', info: '192x192 (Android PWA)' },
    { size: 512, dest: 'icon-512.png', info: '512x512 (PWA Splash)' },
    { size: 16, dest: 'favicon-16x16.png', info: '16x16' },
    { size: 32, dest: 'favicon-32x32.png', info: '32x32' },
    { size: 96, dest: 'favicon-96x96.png', info: '96x96' },
  ];

  console.log('📋 Favicons que serão gerados:\n');

  for (const favicon of favicons) {
    const destPath = path.join(publicDir, favicon.dest);

    try {
      // Redimensionar usando sharp
      await sharp(sourceIcon)
        .resize(favicon.size, favicon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(destPath);

      const stats = fs.statSync(destPath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      console.log(`✅ ${favicon.dest.padEnd(25)} ${sizeKB.padStart(6)} KB  ${favicon.info}`);
    } catch (error) {
      console.error(`❌ Erro ao gerar ${favicon.dest}:`, error.message);
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
