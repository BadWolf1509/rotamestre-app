// Guarda estática do index.ts (roda em Deno, fora do Jest): o supabase-js NÃO
// lança em erro de PostgREST (RLS, CHECK, coluna), devolve `{ error }`. Um
// `await supabase.from(...).insert/update(...)` sem ler o `error` perde o rastro
// em silêncio, e o try/catch em volta só pega falha de rede.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

/** Escritas no banco cujo resultado é descartado: `await supabase.from(..)...insert|update(..)` sem `const {`. */
const ESCRITA_SEM_CONFERIR =
  /(?<!=\s)\bawait\s+supabase\s*\.from\('[^']+'\)\s*\.(?:insert|update)\(/g;

describe('send-push-notification: escritas conferem o erro', () => {
  it('nenhuma escrita descarta o { error }', () => {
    const soltas = fonte.match(ESCRITA_SEM_CONFERIR) ?? [];
    expect(soltas).toEqual([]);
  });

  it('o log da tentativa e a marcação push_enviado deixam rastro quando o banco recusa', () => {
    expect(fonte).toMatch(
      /error:\s*\w*[lL]og\w*Error[\s\S]*?=\s*await\s+supabase\s*\.from\('push_notification_logs'\)/,
    );
    expect(fonte).toMatch(
      /error:\s*\w*Error[\s\S]*?=\s*await\s+supabase\s*\.from\('notificacoes'\)\s*\.update/,
    );
  });

  it('a regra pega a forma antiga', () => {
    const antiga = "await supabase.from('push_notification_logs').insert({";
    expect(antiga.match(ESCRITA_SEM_CONFERIR)).toHaveLength(1);
    const nova =
      "const { error: logError } = await supabase.from('push_notification_logs').insert({";
    expect(nova.match(ESCRITA_SEM_CONFERIR)).toBeNull();
  });
});
