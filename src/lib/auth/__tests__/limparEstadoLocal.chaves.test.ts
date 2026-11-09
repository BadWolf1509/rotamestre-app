/**
 * Guarda estática: cada chave/prefixo que o logout apaga ainda existe no
 * código. Se alguém renomear a chave na origem, o logout passaria a deixar o
 * dado para trás em silêncio — este teste é quem avisa.
 *
 * Chave legada é a exceção: sem escritor no código, ela só existe aqui para
 * limpar instalações antigas, então não há origem a conferir.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

import {
  CHAVES_DA_CONTA,
  CHAVES_PENDENCIAS_POR_CONTA,
  PREFIXOS_DA_CONTA,
} from '../limparEstadoLocal';

const CHAVES_LEGADAS = ['@rotamestre:offline_data'];

const RAIZ = join(__dirname, '..', '..', '..', '..');
const PROPRIO = join(__dirname, '..', 'limparEstadoLocal.ts');

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' || nome === 'node_modules'
        ? []
        : listar(caminho);
    }
    return ['.ts', '.tsx'].includes(extname(nome)) ? [caminho] : [];
  });
}

const fontes = ['src', 'app']
  .flatMap((d) => listar(join(RAIZ, d)))
  .filter((f) => f !== PROPRIO)
  .map((f) => readFileSync(f, 'utf8'));

describe('limparEstadoLocal: as chaves ainda existem na origem', () => {
  it.each([
    ...CHAVES_DA_CONTA.filter((c) => !CHAVES_LEGADAS.includes(c)),
    ...PREFIXOS_DA_CONTA,
  ])('%s', (chave) => {
    const aspas = [`'${chave}'`, `"${chave}"`, `'${chave}`, `"${chave}`];
    expect(fontes.some((f) => aspas.some((a) => f.includes(a)))).toBe(true);
  });
});

describe('exclusão de conta: as chaves de pendências por conta ainda existem na origem', () => {
  it.each([...CHAVES_PENDENCIAS_POR_CONTA])('%s', (chave) => {
    const aspas = [`'${chave}'`, `"${chave}"`];
    expect(fontes.some((f) => aspas.some((a) => f.includes(a)))).toBe(true);
  });
});
