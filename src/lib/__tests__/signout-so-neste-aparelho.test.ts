/**
 * Guarda: "Sair" desconecta só este aparelho.
 *
 * `supabase.auth.signOut()` sem argumento usa `scope: 'global'` e revoga
 * **todas** as sessões da conta. Em 21/10/2026 isso apareceu de dois jeitos:
 * o e2e testa "Sair" com a conta demo e derrubava o moto g15 de teste no meio
 * de uma medição de memória; e, em uso real, o gestor que saía no celular era
 * desconectado também na web (e o motorista, em qualquer outro aparelho).
 *
 * POR QUE ESTÁTICA: são cinco chamadores diretos espalhados (drawer, useAuth,
 * authService, onboarding); um teste por componente deixaria o sexto passar.
 *
 * O QUE ELA NÃO PEGA: chamada indireta via variável
 * (`const sair = supabase.auth.signOut; sair()`).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const EXTENSOES = new Set(['.ts', '.tsx']);
// Montado em pedaços para o próprio arquivo não casar com a regra.
const CHAMADA = new RegExp('auth\\.' + 'signOut\\(([^)]*)\\)', 'g');

function listarFontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' || nome === 'node_modules'
        ? []
        : listarFontes(caminho);
    }
    return EXTENSOES.has(extname(nome)) ? [caminho] : [];
  });
}

describe('signOut só neste aparelho', () => {
  const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

  it('acha os chamadores (a varredura não está cega)', () => {
    const total = fontes.reduce(
      (n, f) => n + [...readFileSync(f, 'utf8').matchAll(CHAMADA)].length,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it("toda chamada a auth.signOut passa scope: 'local'", () => {
    const sem_escopo = fontes.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(CHAMADA)]
        .filter((m) => !/scope:\s*'local'/.test(m[1]))
        .map((m) => `${relative(RAIZ, f)}: ${m[0]}`),
    );
    expect(sem_escopo).toEqual([]);
  });
});
