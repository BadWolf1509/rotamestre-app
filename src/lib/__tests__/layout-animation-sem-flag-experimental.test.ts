/**
 * `UIManager.setLayoutAnimationEnabledExperimental` não é chamado no app.
 *
 * Na nova arquitetura (o app é Fabric/bridgeless desde o SDK 57) a chamada não
 * faz nada: o Android já anima o `LayoutAnimation.configureNext` sem ela, e o
 * RN 0.88 só avisa no Metro ("is currently a no-op in the New Architecture",
 * visto no dev client do moto g15 em 04/11/2026). Era código morto em três
 * telas (timeline da rota e a prévia da próxima parada).
 */
import { readFileSync } from 'fs';
import { join, relative } from 'path';

import { exigirVolume, listarFontes } from '@/__tests__/helpers/fontes';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
// Em pedaços, para o próprio teste não casar com a regra.
const PROIBIDO = 'setLayoutAnimation' + 'EnabledExperimental';

describe('LayoutAnimation sem a flag experimental', () => {
  const fontes = listarFontes({ pastas: DIRETORIOS });

  it('acha os arquivos de fonte (senão a varredura passaria vazia)', () => {
    expect(() => exigirVolume(fontes, 100)).not.toThrow();
  });

  it('nenhum arquivo chama a flag experimental do LayoutAnimation', () => {
    const infratores = fontes
      .filter((caminho) => readFileSync(caminho, 'utf8').includes(PROIBIDO))
      .map((caminho) => relative(RAIZ, caminho).replace(/\\/g, '/'));

    expect(infratores).toEqual([]);
  });
});
