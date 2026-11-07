/**
 * Resolução do caminho pedido ao servidor estático de `dist/` (ver
 * `serve-dist.cjs`). Separada para ser testada sem subir servidor.
 *
 * Devolve uma de três coisas:
 * - `{ tipo: 'arquivo', caminho }`: serve o arquivo;
 * - `{ tipo: 'spa' }`: rota do app sem arquivo — o chamador devolve o
 *   `index.html` (fallback de SPA do expo-router);
 * - `{ tipo: 'erro', status, motivo }`: 400 (URI malformada), 403 (fora da
 *   raiz) ou 404 (asset com extensão que não existe).
 */
const { existsSync, statSync } = require('fs');
const { extname, join, normalize, sep } = require('path');

function resolverRequisicao(raiz, url) {
  let semQuery;
  try {
    semQuery = decodeURIComponent(url.split('?')[0]);
  } catch {
    // `/%E0%A4%A` lança URIError; sem isto um GET malformado derrubava o
    // processo e, com ele, a suíte e2e inteira.
    return { tipo: 'erro', status: 400, motivo: 'URI malformada' };
  }

  const alvo = normalize(join(raiz, semQuery));
  // `raiz + sep`: `startsWith(raiz)` sozinho deixa passar um irmão cujo nome
  // começa com o da raiz (`dist-extra/` para a raiz `dist/`).
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) {
    return { tipo: 'erro', status: 403, motivo: 'Fora da raiz' };
  }

  if (existsSync(alvo) && statSync(alvo).isFile()) {
    return { tipo: 'arquivo', caminho: alvo };
  }

  // Fallback de SPA só para rota (sem extensão). Asset com extensão que falta
  // é 404: devolver o index.html com 200 faz o navegador executar HTML como
  // script e o erro aparece longe da causa.
  if (extname(alvo) !== '') {
    return { tipo: 'erro', status: 404, motivo: 'Arquivo não encontrado' };
  }
  return { tipo: 'spa' };
}

module.exports = { resolverRequisicao };
