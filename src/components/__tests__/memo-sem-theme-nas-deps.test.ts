/**
 * Guarda estática (R-UI-7): `theme` do `useUnistyles()` muda de identidade a
 * cada render no aparelho (o mock do Jest não reproduz isso), então um
 * `useMemo/useCallback/useEffect` com `[theme]` nas dependências recalcula
 * SEMPRE — e, se alimentar efeito de câmera/mapa, re-dispara a cada render.
 * Use as cores/tokens primitivos como dependência, ou nenhum memo.
 *
 * Escopo: `src/components` sem `gestor/` e `motorista/` (outras trilhas).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..');
const FORA = new Set(['gestor', 'motorista', '__tests__']);
// Lista de dependências: começa a linha, ou vem depois de `}, ` / `), ` / `], `,
// e fecha no fim da linha. Não pega `style={[...]}` nem tipos como `['theme']`.
const PADRAO =
  /(?:^\s*|[}\])]\s*,\s*)\[[^\]]*(?<![.\w'])theme(?![.\w:'])[^\]]*\]\s*\)?;?,?\s*$/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return FORA.has(nome) ? [] : arquivos(caminho);
    }
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe('theme fora das dependências de hooks', () => {
  it('nenhum arquivo de src/components usa [theme] como dependência', () => {
    const achados = arquivos(RAIZ).flatMap((arq) =>
      readFileSync(arq, 'utf8')
        .split(/\r?\n/)
        .map((linha, i) => ({ linha, n: i + 1 }))
        .filter(({ linha }) => PADRAO.test(linha))
        .map(({ n }) => `${relative(RAIZ, arq)}:${n}`),
    );
    expect(achados).toEqual([]);
  });
});
