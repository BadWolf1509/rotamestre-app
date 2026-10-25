// Decisão da remind-routes que não depende de Deno/rede: qual urgência o corpo
// da requisição pede e quais números a resposta devolve. Quem lembrar e quando
// é decidido na função SQL `remind_pending_routes`; aqui se testa só o que a
// Edge Function decide antes e depois dela.
import { readFileSync } from 'fs';
import { join } from 'path';

import { estatisticasDoLembrete, urgenciaDoCorpo } from '../lembreteRotas';

describe('remind-routes: urgenciaDoCorpo', () => {
  it('só "final" vira urgência final', () => {
    expect(urgenciaDoCorpo({ urgency: 'final' })).toBe('final');
  });

  it('"normal" e ausência de urgência ficam em normal', () => {
    expect(urgenciaDoCorpo({ urgency: 'normal' })).toBe('normal');
    expect(urgenciaDoCorpo({})).toBe('normal');
  });

  it('valor desconhecido não escala para final', () => {
    expect(urgenciaDoCorpo({ urgency: 'FINAL' })).toBe('normal');
    expect(urgenciaDoCorpo({ urgency: true })).toBe('normal');
    expect(urgenciaDoCorpo({ urgency: null })).toBe('normal');
  });

  it('corpo que não é objeto cai em normal (null, número, texto, ausente)', () => {
    expect(urgenciaDoCorpo(null)).toBe('normal');
    expect(urgenciaDoCorpo(undefined)).toBe('normal');
    expect(urgenciaDoCorpo(5)).toBe('normal');
    expect(urgenciaDoCorpo('final')).toBe('normal');
  });
});

describe('remind-routes: estatisticasDoLembrete', () => {
  it('lê a primeira linha devolvida pela RPC', () => {
    expect(
      estatisticasDoLembrete([
        { routes_found: 3, reminders_sent: 2 },
        { routes_found: 9, reminders_sent: 9 },
      ]),
    ).toEqual({ routes_found: 3, reminders_sent: 2 });
  });

  it('sem linhas (null, vazio, indefinido) zera os dois números', () => {
    const zero = { routes_found: 0, reminders_sent: 0 };
    expect(estatisticasDoLembrete(null)).toEqual(zero);
    expect(estatisticasDoLembrete(undefined)).toEqual(zero);
    expect(estatisticasDoLembrete([])).toEqual(zero);
  });
});

describe('remind-routes: index.ts usa as funções testadas', () => {
  const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

  it('importa e chama a decisão em vez de repeti-la', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*urgenciaDoCorpo[^}]*\}\s*from\s*'\.\/lembreteRotas\.ts'/,
    );
    expect(fonte).toMatch(/urgenciaDoCorpo\(/);
    expect(fonte).toMatch(/estatisticasDoLembrete\(/);
    expect(fonte).not.toMatch(/body\.urgency/);
  });

  it('segue exigindo o segredo do cron antes de ler o corpo', () => {
    const guarda = fonte.indexOf('requireCronSecret(req)');
    const corpo = fonte.indexOf('req.json()');
    expect(guarda).toBeGreaterThan(-1);
    expect(corpo).toBeGreaterThan(guarda);
  });

  it('abre o banco pela chave secreta compartilhada, não pela variável antiga', () => {
    expect(fonte).toMatch(/chaveSecreta\(\)/);
    expect(fonte).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY['"]/);
  });
});
