import fs from 'fs';
import path from 'path';

const { AVISOS_CONHECIDOS } = require('../consoleAvisos');

const RAIZ = path.resolve(__dirname, '..', '..');

// Entrada obsoleta (arquivo renomeado ou apagado) seguiria aceitando um aviso
// que ninguém mais vê: a lista só deve encolher, e o nome tem de existir.
describe('AVISOS_CONHECIDOS', () => {
  const arquivos: string[] = AVISOS_CONHECIDOS.flatMap(
    (c: { arquivos: string[] }) => c.arquivos,
  );

  it('tem entradas', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it('todo arquivo listado existe', () => {
    const inexistentes = arquivos.filter(
      (a) => !fs.existsSync(path.join(RAIZ, a)),
    );
    expect(inexistentes).toEqual([]);
  });
});
