/**
 * Monta o objeto `release` das requisições de trilha da Play.
 *
 * POR QUE SEPARADO DA CLI: `play-promote.mjs` valida argumentos e chama
 * `process.exit` no topo do módulo, então importá-lo num teste executaria a
 * CLI. Aqui não há efeito colateral — dá para testar a única parte com regra de
 * negócio sem tocar na Play.
 *
 * POR QUE `.js` (CommonJS) E NÃO `.mjs`, ao contrário do `play-api.mjs` ao
 * lado: o `testMatch` do Jest só aceita testes `.ts`/`.tsx`, e o `transform`
 * vem do preset `jest-expo`, que não cobre `.mjs` — importar um daqui falha com
 * `SyntaxError: Unexpected token 'export'`. Declarar `transform` na
 * `jest.config.js` **substituiria** o do preset, arriscando as 335 suítes por
 * causa de um arquivo. CommonJS o Jest lê nativamente, e o ESM da CLI importa
 * sem cerimônia (o lexer do Node reconhece `module.exports = { ... }`).
 *
 * As regras abaixo são da Play API, não escolhas nossas:
 *   - `userFraction` só vale com `inProgress` (ou `halted`);
 *   - `completed` NÃO pode carregar `userFraction` — a requisição é recusada;
 *   - a fração é estritamente entre 0 e 1.
 */

/**
 * @param {object} params
 * @param {string} params.versionCode  versionCode já enviado à Play
 * @param {string} [params.releaseName] nome visível da release (ex.: "1.12.5")
 * @param {number} [params.percentual]  1-99 para rollout gradual; ausente = 100%
 */
function montarRelease({ versionCode, releaseName, percentual }) {
  const base = {
    versionCodes: [versionCode],
    ...(releaseName ? { name: releaseName } : {}),
  };

  if (percentual === undefined) {
    return { ...base, status: 'completed' };
  }

  return {
    ...base,
    status: 'inProgress',
    userFraction: percentual / 100,
  };
}

module.exports = { montarRelease };
