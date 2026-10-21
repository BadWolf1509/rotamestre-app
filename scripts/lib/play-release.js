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
 *   - a fração é estritamente entre 0 e 1;
 *   - notas da versão têm no máximo 500 caracteres por idioma.
 *
 * NOTAS SÃO PARTE DA RELEASE, NÃO DA FAIXA: o `PUT /tracks/{faixa}` substitui
 * a release inteira. Promover sem `releaseNotes` apaga as notas que estavam
 * lá — foi por isso que 1.12.8, 1.12.9 e 1.13.0 precisaram de script
 * temporário para reaplicá-las.
 */

const TRILHAS = ['internal', 'alpha', 'beta', 'production'];

const LIMITE_NOTAS = 500;
const IDIOMA_NOTAS = 'pt-BR';

/**
 * @param {object} params
 * @param {string} params.versionCode  versionCode já enviado à Play
 * @param {string} [params.releaseName] nome visível da release (ex.: "1.12.5")
 * @param {number} [params.percentual]  1-99 para rollout gradual; ausente = 100%
 * @param {string} [params.notas]       texto pt-BR já validado (`validarNotas`)
 */
function montarRelease({ versionCode, releaseName, percentual, notas }) {
  const base = {
    versionCodes: [versionCode],
    ...(releaseName ? { name: releaseName } : {}),
    // Ausente, e não lista vazia: sem notas, o corpo fica igual ao de antes
    // desta opção existir.
    ...(notas
      ? { releaseNotes: [{ language: IDIOMA_NOTAS, text: notas }] }
      : {}),
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

/**
 * Valida o texto das notas e devolve como será enviado.
 *
 * Conta caracteres (code points), não unidades UTF-16: `'🚚'.length` é 2, e
 * contar assim recusaria notas que a Play aceita. CRLF vira LF antes de contar
 * — arquivo salvo no Windows gastaria dois caracteres por quebra de linha.
 *
 * @param {string} texto
 * @returns {string}
 */
function validarNotas(texto) {
  const normalizado = texto.replace(/\r\n/g, '\n').trim();
  if (!normalizado) {
    throw new Error('Notas da versão vazias. Confira o arquivo de --notas.');
  }
  const tamanho = [...normalizado].length;
  if (tamanho > LIMITE_NOTAS) {
    throw new Error(
      `Notas da versão com ${tamanho} caracteres; a Play aceita até ${LIMITE_NOTAS}.`,
    );
  }
  return normalizado;
}

/**
 * Lê a lista de trilhas do argumento posicional (`internal` ou
 * `internal,alpha`). Várias trilhas vão na MESMA edição, num único commit:
 * ou todas mudam, ou nenhuma.
 *
 * @param {string} arg
 * @returns {string[]}
 */
function lerTrilhas(arg) {
  const trilhas = arg.split(',').map((t) => t.trim());
  for (const trilha of trilhas) {
    if (!TRILHAS.includes(trilha)) {
      throw new Error(
        `Trilha inválida: "${trilha}". Use uma de: ${TRILHAS.join(', ')}`,
      );
    }
  }
  const repetida = trilhas.find((t, i) => trilhas.indexOf(t) !== i);
  if (repetida) {
    throw new Error(`Trilha repetida: ${repetida}`);
  }
  return trilhas;
}

module.exports = {
  LIMITE_NOTAS,
  TRILHAS,
  lerTrilhas,
  montarRelease,
  validarNotas,
};
