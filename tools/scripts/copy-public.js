#!/usr/bin/env node

/**
 * Script para copiar arquivos públicos (favicons, manifest, etc) para dist/
 */

import { copyFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..', '..');
const publicDir = join(projectRoot, 'public');
const distDir = join(projectRoot, 'dist');

function copyPublicFiles() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Copiar Arquivos Públicos para Dist         ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Verificar se dist existe
  if (!existsSync(distDir)) {
    console.error('❌ Erro: Pasta dist/ não existe!');
    console.error('   Execute: npx expo export --platform web\n');
    process.exit(1);
  }

  // Verificar se public existe
  if (!existsSync(publicDir)) {
    console.error('❌ Erro: Pasta public/ não existe!\n');
    process.exit(1);
  }

  console.log(`📂 Origem: ${publicDir}`);
  console.log(`📂 Destino: ${distDir}\n`);

  let copiedCount = 0;
  let errorCount = 0;

  // Listar arquivos em public/
  const files = readdirSync(publicDir);

  console.log('🔄 Copiando arquivos...\n');

  // Função recursiva para copiar diretórios
  function copyDirectory(sourceDir, destDir) {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const items = readdirSync(sourceDir);
    items.forEach(item => {
      const sourcePath = join(sourceDir, item);
      const destPath = join(destDir, item);

      if (statSync(sourcePath).isDirectory()) {
        copyDirectory(sourcePath, destPath);
      } else {
        try {
          copyFileSync(sourcePath, destPath);
          console.log(`   ${sourcePath.replace(publicDir, '')}... ✅`);
          copiedCount++;
        } catch (error) {
          console.log(`   ${sourcePath.replace(publicDir, '')}... ❌`);
          console.error(`      Erro: ${error.message}`);
          errorCount++;
        }
      }
    });
  }

  files.forEach(file => {
    const sourcePath = join(publicDir, file);
    const destPath = join(distDir, file);

    // Copiar diretórios recursivamente (especificamente o diretório assets)
    if (statSync(sourcePath).isDirectory()) {
      if (file === 'assets') {
        copyDirectory(sourcePath, destPath);
      }
      return;
    }

    try {
      process.stdout.write(`   ${file}... `);
      copyFileSync(sourcePath, destPath);
      console.log('✅');
      copiedCount++;
    } catch (error) {
      console.log('❌');
      console.error(`      Erro: ${error.message}`);
      errorCount++;
    }
  });

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║  Resultado: ${copiedCount} OK | ${errorCount} erros              ║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  if (copiedCount > 0) {
    console.log('✅ Arquivos públicos copiados com sucesso!\n');
    console.log('📋 Arquivos copiados para dist/:\n');
    files.filter(f => !statSync(join(publicDir, f)).isDirectory()).forEach(file => {
      console.log(`   - ${file}`);
    });
    console.log('');
  }

  if (errorCount > 0) {
    console.log('⚠️  Alguns arquivos falharam ao copiar.\n');
    process.exit(1);
  }
}

copyPublicFiles();
