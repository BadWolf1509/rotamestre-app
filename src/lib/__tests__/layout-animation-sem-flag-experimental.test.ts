/**
 * `UIManager.setLayoutAnimationEnabledExperimental` não é chamado no app.
 *
 * Na nova arquitetura (o app é Fabric/bridgeless desde o SDK 57) a chamada não
 * faz nada: o Android já anima o `LayoutAnimation.configureNext` sem ela, e o
 * RN 0.88 só avisa no Metro ("is currently a no-op in the New Architecture",
 * visto no dev client do moto g15 em 04/11/2026). Era código morto em três
 * telas (timeline da rota e a prévia da próxima parada).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const EXTENSOES = new Set(['.ts', '.tsx']);
// Em pedaços, para o próprio teste não casar com a regra.
const PROIBIDO = 'setLayoutAnimation' + 'EnabledExperimental';

function listarFontes(dir: string): string[] {
  const encontrados: string[] = [];

  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '__tests__') continue;

    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarFontes(caminho));
    } else if (EXTENSOES.has(extname(nome)) && !nome.includes('.test.')) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

describe('LayoutAnimation sem a flag experimental', () => {
  const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

  it('acha os arquivos de fonte (senão a varredura passaria vazia)', () => {
    expect(fontes.length).toBeGreaterThan(100);
  });

  it('nenhum arquivo chama a flag experimental do LayoutAnimation', () => {
    const infratores = fontes
      .filter((caminho) => readFileSync(caminho, 'utf8').includes(PROIBIDO))
      .map((caminho) => relative(RAIZ, caminho).replace(/\\/g, '/'));

    expect(infratores).toEqual([]);
  });
});
