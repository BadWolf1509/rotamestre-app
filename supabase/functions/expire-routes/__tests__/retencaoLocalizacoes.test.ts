// Guarda estática do index.ts (a função roda em Deno, fora do Jest). Sem
// pg_cron no projeto, a limpeza de `motorista_locations` (90 dias, Migration 37)
// pega carona no job noturno da expiração. Ela não pode derrubar a expiração:
// falha na limpeza vira log, nunca 500.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

describe('expire-routes: retenção de motorista_locations', () => {
  it('chama a limpeza depois da expiração', () => {
    const expira = fonte.indexOf("rpc('expire_old_pending_routes')");
    const limpa = fonte.indexOf("rpc('limpar_localizacoes_antigas')");
    expect(expira).toBeGreaterThan(-1);
    expect(limpa).toBeGreaterThan(expira);
  });

  it('não devolve erro quando só a limpeza falha', () => {
    const limpa = fonte.indexOf("rpc('limpar_localizacoes_antigas')");
    const trecho = fonte.slice(
      limpa,
      fonte.indexOf('return new Response', limpa),
    );
    expect(trecho).not.toMatch(/status:\s*500/);
  });

  it('informa quantas posições apagou', () => {
    expect(fonte).toMatch(/localizacoes_apagadas/);
  });
});
