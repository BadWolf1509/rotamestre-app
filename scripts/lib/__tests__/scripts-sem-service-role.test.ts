// Guarda estática: a chave JWT `service_role` foi desligada em 22/10/2026.
// Script que ainda a lê de `SUPABASE_SERVICE_ROLE_KEY` falha na primeira
// chamada ao banco, e ninguém percebe porque o CI não executa `scripts/` nem
// `tools/`. Quem precisa de acesso privilegiado usa a chave secreta
// (`sb_secret_`) — nas Edge Functions, via `supabase/functions/_shared/chaves.ts`.
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const EXTENSOES = /\.(js|cjs|mjs|ts|sh|bat)$/;
// Montada por concatenação para este arquivo não acusar a si mesmo.
const PROIBIDA = 'SUPABASE_SERVICE_' + 'ROLE_KEY';

function arquivosVersionados(): string[] {
  return execSync('git ls-files scripts tools', { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((f) => EXTENSOES.test(f));
}

describe('scripts/ e tools/ sem a service_role desligada', () => {
  const arquivos = arquivosVersionados();

  it('varre os scripts (não está cega)', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(20);
  });

  it('nenhum lê SUPABASE_SERVICE_ROLE_KEY', () => {
    const achados = arquivos.filter((f) =>
      readFileSync(join(RAIZ, f), 'utf8').includes(PROIBIDA),
    );
    // Se falhar: o arquivo listado depende de uma chave desligada em 22/10/2026
    // e está quebrado. Remova-o ou migre para a chave secreta
    // (ver supabase/functions/_shared/chaves.ts).
    expect(achados).toEqual([]);
  });
});
