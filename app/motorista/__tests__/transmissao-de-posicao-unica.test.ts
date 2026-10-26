/**
 * Guarda: a transmissão de posição em primeiro plano tem UM dono.
 *
 * As abas do motorista ficam montadas depois de visitadas, e cada uma chamava
 * `useDriverLocationBroadcast`: com Início + Paradas + Mapa abertas eram três
 * watchers de GPS gravando a mesma posição (86 linhas repetidas por
 * `(rota_id, timestamp)` em 7 dias, medido em 26/10/2026). O hook agora é
 * montado uma vez, no layout do motorista, junto do `RouteStatusProvider`.
 *
 * Estática porque o defeito é "quantos lugares montam", não o que o hook faz.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const NOME = 'useDriver' + 'LocationBroadcast(';

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' || nome === 'node_modules'
        ? []
        : listar(caminho);
    }
    return ['.ts', '.tsx'].includes(extname(caminho)) ? [caminho] : [];
  });
}

describe('transmissão de posição em primeiro plano', () => {
  it('é chamada num lugar só, fora das telas', () => {
    const chamadores = ['app', 'src']
      .flatMap((d) => listar(join(RAIZ, d)))
      .filter((arquivo) => {
        const fonte = readFileSync(arquivo, 'utf8');
        // A definição do hook não conta como chamada
        return fonte.includes(NOME) && !/export function useDriver/.test(fonte);
      })
      .map((arquivo) => relative(RAIZ, arquivo).replace(/\\/g, '/'));

    expect(chamadores).toEqual([
      'src/components/motorista/TransmissaoDePosicao.tsx',
    ]);
  });

  it('o componente que a chama está montado nos dois ramos do layout', () => {
    const layout = readFileSync(
      join(RAIZ, 'app', 'motorista', '_layout.tsx'),
      'utf8',
    );
    expect(layout.match(/<TransmissaoDePosicao \/>/g)).toHaveLength(2);
  });
});
