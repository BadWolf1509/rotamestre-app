// Guarda estática: a chave JWT `service_role` foi desligada em 22/10/2026.
// Script que ainda lê a variável dessa chave falha na primeira
// chamada ao banco, e ninguém percebe porque o CI não executa `scripts/`, `tools/`
// nem os `database/*.js`. Quem precisa de acesso privilegiado usa a chave secreta
// (`sb_secret_`) — nas Edge Functions, via `supabase/functions/_shared/chaves.ts`.
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const EXTENSOES = /\.(js|cjs|mjs|ts|mts|cts|sh|bat|ps1|py)$/;
// Montada por concatenação para este arquivo não acusar a si mesmo.
const PROIBIDA = 'SUPABASE_SERVICE_' + 'ROLE_KEY';

function arquivosVersionados(): string[] {
  let saida: string;
  try {
    saida = execSync('git ls-files scripts tools database', {
      cwd: RAIZ,
      encoding: 'utf8',
    });
  } catch (erro) {
    throw new Error(
      'A guarda precisa do git para listar scripts/, tools/ e database/ (git ls-files falhou): ' +
        String(erro),
    );
  }
  return saida.split(/\r?\n/).filter((f) => EXTENSOES.test(f));
}

describe('scripts/, tools/ e database/ sem a service_role desligada', () => {
  const arquivos = arquivosVersionados();

  it('varre os scripts (não está cega)', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(20);
  });

  it('nenhum lê a variável da chave service_role', () => {
    const achados = arquivos.filter((f) =>
      readFileSync(join(RAIZ, f), 'utf8').includes(PROIBIDA),
    );
    // Se falhar: o arquivo listado depende de uma chave desligada em 22/10/2026
    // e está quebrado. Remova-o ou migre para a chave secreta
    // (ver supabase/functions/_shared/chaves.ts).
    expect(achados).toEqual([]);
  });
});
