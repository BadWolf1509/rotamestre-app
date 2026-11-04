/**
 * Guarda estática: o menu lateral do motorista precisa montar DENTRO do
 * `RouteStatusProvider`, nos dois layouts (desktop e mobile).
 *
 * O layout é pesado demais para renderizar aqui. Fora do provider, o menu
 * recebe `useRouteStatusSeHouver() === null` e a mensagem "Contatar gestor"
 * sai sem a rota e sem o endereço atual, sem erro e com o CI verde.
 *
 * Por que varredura de tokens e não uma regex da forma
 * `<RouteStatusProvider>\s*<DrawerMenuProvider>`: a regex exige a ordem
 * adjacente e quebra com props, comentários ou um wrapper no meio, que são
 * mudanças legítimas; a varredura mede o que importa (profundidade de
 * `RouteStatusProvider` aberta no ponto de cada `<DrawerMenuProvider`).
 */
import * as fs from 'fs';
import * as path from 'path';

const LAYOUT = path.join(__dirname, '..', 'motorista', '_layout.tsx');

function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('layout do motorista: ordem dos providers', () => {
  it('o menu lateral do motorista fica dentro do RouteStatusProvider, nos dois layouts', () => {
    const codigo = semComentarios(fs.readFileSync(LAYOUT, 'utf8'));
    const token =
      /<\/RouteStatusProvider\s*>|<RouteStatusProvider(?=[\s>/])|<DrawerMenuProvider(?=[\s>/])/g;

    let profundidade = 0;
    let totalDeDrawerMenuProvider = 0;
    const ocorrenciasForaDoProvider: number[] = [];

    for (const m of codigo.matchAll(token)) {
      if (m[0].startsWith('</')) {
        profundidade -= 1;
      } else if (m[0].startsWith('<RouteStatusProvider')) {
        profundidade += 1;
      } else {
        totalDeDrawerMenuProvider += 1;
        if (profundidade <= 0) {
          const linha = codigo.slice(0, m.index).split('\n').length;
          ocorrenciasForaDoProvider.push(linha);
        }
      }
    }

    expect(ocorrenciasForaDoProvider).toEqual([]);
    expect(totalDeDrawerMenuProvider).toBe(2);
  });
});
