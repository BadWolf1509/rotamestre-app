/**
 * O contato de suporte tem uma fonte só (`src/constants/suporte.ts`): telefone
 * e e-mail copiados em cada tela divergiam sem ninguém notar.
 */
import fs from 'fs';
import path from 'path';

import {
  SUPORTE_EMAIL,
  SUPORTE_TELEFONE,
  SUPORTE_TELEFONE_LOCAL,
} from '../suporte';

const RAIZ = path.resolve(__dirname, '../../..');

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) {
      return e.name === '__tests__' || e.name === 'node_modules'
        ? []
        : arquivos(caminho);
    }
    return /\.(ts|tsx)$/.test(e.name) ? [caminho] : [];
  });
}

describe('contato de suporte: fonte única', () => {
  it('as constantes derivam do número esperado', () => {
    expect(SUPORTE_TELEFONE).toBe('5583987156206');
    expect(SUPORTE_TELEFONE_LOCAL).toBe('83987156206');
    expect(SUPORTE_EMAIL).toBe('contato@rotamestre.tec.br');
  });

  it('nenhum arquivo de produção repete o telefone ou o e-mail de contato', () => {
    const proibidos = [SUPORTE_TELEFONE, SUPORTE_TELEFONE_LOCAL, SUPORTE_EMAIL];
    const repetidos = [
      ...arquivos(path.join(RAIZ, 'app')),
      ...arquivos(path.join(RAIZ, 'src')),
    ]
      .filter((f) => !f.endsWith(path.join('constants', 'suporte.ts')))
      .filter((f) => {
        const texto = fs.readFileSync(f, 'utf8');
        return proibidos.some((p) => texto.includes(p));
      })
      .map((f) => path.relative(RAIZ, f));

    expect(repetidos).toEqual([]);
  });
});
