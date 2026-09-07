#!/usr/bin/env node
/**
 * Servidor estático para `dist/`, com fallback de SPA.
 *
 * POR QUE EXISTE. O `playwright.config.ts` levanta o app com
 * `expo start --web` — o servidor de DESENVOLVIMENTO, que compila sob demanda.
 * Medido em 07/09/2026 na suíte inteira: **17,5 min em série**, ~19 s por
 * teste, com a maior parte gasta recompilando o mesmo bundle. E rodar em
 * paralelo contra ele produziu 8 falhas de contenção que sumiram ao rodar
 * isolado — teste vermelho por carga, não por defeito.
 *
 * Servir o `dist/` já construído tira a compilação do caminho: cada requisição
 * é leitura de arquivo. O bundle é o MESMO que vai para a Vercel, então o que
 * o teste exercita passa a ser o artefato de produção, e não uma build de
 * desenvolvimento com outro pipeline de transformação.
 *
 * O FALLBACK É OBRIGATÓRIO: `expo export --platform web` gera SPA — só
 * `index.html` e `offline.html`. Sem devolver `index.html` para rota
 * desconhecida, qualquer `page.goto('/auth/login')` recebe 404 e o teste falha
 * por motivo que não tem nada a ver com o app.
 */
const { createServer } = require('http');
const { createReadStream, existsSync, readdirSync, statSync } = require('fs');
const { join, extname, normalize } = require('path');

const RAIZ = join(__dirname, '..', '..', 'dist');
const PORTA = Number(process.env.PORT || 8082);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Resolve o caminho pedido dentro de `dist/`, recusando qualquer coisa que
 * escape da raiz — `normalize` sozinho não basta contra `..%2f`.
 */
function caminhoSeguro(url) {
  const semQuery = decodeURIComponent(url.split('?')[0]);
  const alvo = normalize(join(RAIZ, semQuery));
  return alvo.startsWith(RAIZ) ? alvo : null;
}

/**
 * Avisa quando o `dist/` e mais velho que o codigo-fonte.
 *
 * Testar um bundle velho e a armadilha que este repo ja pagou com o worker do
 * MapLibre: artefato desatualizado, suite verde, defeito vivo. Aviso em vez de
 * recusa — reconstruir a cada rodada local mataria a ergonomia, e a decisao de
 * seguir com bundle velho pode ser deliberada.
 */
function avisarSeDesatualizado() {
  const index = join(RAIZ, 'index.html');
  if (!existsSync(index)) return;
  const construido = statSync(index).mtimeMs;

  let maisNovo = 0;
  for (const dir of ['src', 'app']) {
    const raiz = join(__dirname, '..', '..', dir);
    if (!existsSync(raiz)) continue;
    const pilha = [raiz];
    while (pilha.length) {
      const atual = pilha.pop();
      for (const e of readdirSync(atual, { withFileTypes: true })) {
        const caminho = join(atual, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__' && e.name !== 'node_modules') pilha.push(caminho);
        } else if (/\.(ts|tsx)$/.test(e.name)) {
          const m = statSync(caminho).mtimeMs;
          if (m > maisNovo) maisNovo = m;
        }
      }
    }
  }

  if (maisNovo > construido) {
    console.warn(
      '[serve-dist] AVISO: dist/ e mais antigo que src/ ou app/. ' +
        'Rode `npm run build:web` — a suite estaria testando o bundle anterior.',
    );
  }
}

avisarSeDesatualizado();

createServer((req, res) => {
  const alvo = caminhoSeguro(req.url || '/');

  if (!alvo) {
    res.writeHead(403).end('Fora da raiz');
    return;
  }

  const arquivo =
    existsSync(alvo) && statSync(alvo).isFile()
      ? alvo
      : // Fallback de SPA: rota desconhecida devolve o index, que é o que o
        // expo-router espera para resolver a navegação no cliente.
        join(RAIZ, 'index.html');

  if (!existsSync(arquivo)) {
    res.writeHead(404).end('dist/index.html não existe — rode `npm run build:web`');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream',
    // Sem cache: o Playwright reusa o servidor entre execuções, e uma resposta
    // cacheada esconderia um `dist/` reconstruído no meio do caminho.
    'Cache-Control': 'no-store',
  });
  createReadStream(arquivo).pipe(res);
}).listen(PORTA, () => {
  console.log(`[serve-dist] dist/ em http://localhost:${PORTA}`);
});
