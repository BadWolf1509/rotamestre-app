/**
 * Service Worker - Rota Mestre
 *
 * Estratégia de cache:
 * - App Shell (HTML, CSS, JS): Cache First (assets com hash são imutáveis)
 * - index.html: Network First (sempre buscar a versão mais recente)
 * - API (Supabase): Network First com fallback offline
 * - Tiles de mapa (OpenFreeMap): Cache First (imutáveis por natureza)
 * - Fontes: Cache First (imutáveis)
 * - Fallback offline para requests que falham
 */

const CACHE_NAME = 'rotamestre-v1';
const OFFLINE_URL = '/offline.html';

// Assets para pré-cache (app shell mínimo)
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/css/tokens.css',
  '/favicon.ico',
  '/icon-192.png',
  '/manifest.json',
];

// Instalar: pré-cachear app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Ativar imediatamente sem esperar tabs fecharem
  self.skipWaiting();
});

// Ativar: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Tomar controle de todas as tabs imediatamente
  self.clients.claim();
});

// Fetch: estratégia baseada no tipo de request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests não-GET
  if (request.method !== 'GET') return;

  // Ignorar chrome-extension, etc
  if (!url.protocol.startsWith('http')) return;

  // Estratégia por tipo de recurso
  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isMapTile(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
  } else if (isFont(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    // Default: network first para tudo mais
    event.respondWith(networkFirst(request));
  }
});

// --- Classificadores de request ---

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  );
}

function isMapTile(url) {
  return (
    url.hostname.includes('tiles.openfreemap.org') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.pathname.includes('/tiles/')
  );
}

function isApiRequest(url) {
  return (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('router.project-osrm.org') ||
    url.hostname.includes('photon.komoot.io') ||
    url.hostname.includes('viacep.com.br')
  );
}

function isFont(url) {
  return (
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

// --- Estratégias de cache ---

/**
 * Cache First: busca no cache, se não tiver vai na rede.
 * Ideal para assets estáticos com hash (imutáveis).
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Se offline e não tiver cache, retorna erro genérico
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First: tenta a rede, se falhar usa o cache.
 * Ideal para API calls e conteúdo dinâmico.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First com fallback para página offline.
 * Usado para navegação (HTML).
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Tentar cache do index.html
    const cached = await caches.match('/');
    if (cached) return cached;

    // Fallback para página offline
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
