import * as maplibregl from 'maplibre-gl';

/**
 * Configuração do web worker do MapLibre GL JS v6 no Expo Web (Metro).
 *
 * O maplibre-gl v6 é ESM-only e resolve seu web worker via `import.meta.url`
 * (o worker `maplibre-gl-worker.mjs` importa o sibling `maplibre-gl-shared.mjs`).
 * O bundler do Expo (Metro) NÃO empacota esse worker, então por padrão ele nunca
 * inicializa: `isStyleLoaded()` fica `false`, o evento `load` nunca dispara e o
 * mapa web trava eternamente em "Carregando mapa...".
 *
 * A correção é servir os dois arquivos `.mjs` a partir de `public/` (copiados de
 * node_modules por `tools/scripts/copy-maplibre-worker.cjs`) e apontar o
 * `workerUrl` explicitamente para o caminho servido. O worker é criado como ES
 * module (`{ type: 'module' }`) e importa `./maplibre-gl-shared.mjs` do mesmo
 * diretório (`/maplibre-gl-shared.mjs`).
 *
 * Chame `configureMaplibreWorker()` no topo de cada componente de mapa web, antes
 * de instanciar `new maplibregl.Map()`. É idempotente e no-op fora do browser.
 */
let configured = false;

export function configureMaplibreWorker(): void {
  if (configured || typeof window === 'undefined') return;
  // Guarda de tipo mantém o ambiente de teste seguro (stubs/mocks do maplibre
  // podem não expor setWorkerUrl); em produção o v6 sempre a expõe.
  if (typeof maplibregl.setWorkerUrl === 'function') {
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
  }
  configured = true;
}
