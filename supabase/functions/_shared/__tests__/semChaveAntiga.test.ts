// Guarda estática: depois de desligadas as chaves antigas (22/10/2026), função
// que lê `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY` está quebrada em
// produção — e o CI não percebe, porque as funções rodam em Deno, fora do Jest.
// Toda chave passa por `_shared/chaves.ts`.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..');
const PROIBIDAS = ['SUPABASE_SERVICE_' + 'ROLE_KEY', 'SUPABASE_' + 'ANON_KEY'];

function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' ? [] : fontes(caminho);
    }
    return nome.endsWith('.ts') ? [caminho] : [];
  });
}

describe('Edge Functions sem chave antiga', () => {
  const arquivos = fontes(RAIZ);

  it('varre as funções (não está cega)', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(8);
  });

  it('nenhuma lê SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY', () => {
    const achados = arquivos.flatMap((f) => {
      const texto = readFileSync(f, 'utf8');
      return PROIBIDAS.filter((v) =>
        new RegExp(`Deno\\.env\\.get\\(\\s*'${v}'`).test(texto),
      ).map((v) => `${relative(RAIZ, f)}: ${v}`);
    });
    expect(achados).toEqual([]);
  });
});
