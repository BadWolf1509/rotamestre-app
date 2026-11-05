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
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  RAIZ_REPOSITORIO as RAIZ,
  exigirVolume,
  lerFontes,
} from '@/__tests__/helpers/fontes';
const NOME = 'useDriver' + 'LocationBroadcast(';

describe('transmissão de posição em primeiro plano', () => {
  it('é chamada num lugar só, fora das telas', () => {
    const fontes = lerFontes({ pastas: ['app', 'src'] });
    exigirVolume(fontes, 300);
    const chamadores = fontes
      // A definição do hook não conta como chamada
      .filter(
        ({ fonte }) =>
          fonte.includes(NOME) && !/export function useDriver/.test(fonte),
      )
      .map(({ arquivo }) => arquivo);

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
