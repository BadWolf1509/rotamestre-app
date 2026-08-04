#!/usr/bin/env node
/**
 * Copia o web worker do maplibre-gl v6 (ESM-only) de node_modules para public/.
 *
 * O maplibre-gl v6 resolve seu worker via `import.meta.url`, que o bundler do
 * Expo (Metro) não empacota — sem o worker o mapa web trava em "Carregando...".
 * Servimos os dois `.mjs` de public/, de onde o Expo Web os expõe na raiz:
 *   - dev: Metro serve public/ diretamente;
 *   - produção: copy-public.js leva public/ -> dist/.
 * O código aponta o workerUrl para `/maplibre-gl-worker.mjs` em
 * src/lib/maplibreWorker.ts. O worker importa o sibling
 * `./maplibre-gl-shared.mjs`, por isso ambos são copiados.
 *
 * Idempotente. Rodado no postinstall e no início do build:web.
 */
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..', '..');
const srcDir = join(root, 'node_modules', 'maplibre-gl', 'dist');
const destDir = join(root, 'public');
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

if (!existsSync(join(srcDir, files[0]))) {
  // node_modules ainda não instalado (ou maplibre removido): não é erro fatal.
  console.warn(
    '[copy-maplibre-worker] maplibre-gl não encontrado em node_modules — pulando.',
  );
  process.exit(0);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

for (const file of files) {
  copyFileSync(join(srcDir, file), join(destDir, file));
  console.log(`[copy-maplibre-worker] ${file} -> public/`);
}
