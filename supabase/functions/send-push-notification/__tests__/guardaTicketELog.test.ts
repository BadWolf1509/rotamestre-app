// Guarda estática do index.ts (a função roda em Deno, fora do Jest): ele tem de
// usar a leitura de ticket testada em expoTicket.ts, limpar o token morto e não
// mandar para o log o conteúdo da notificação (nome e endereço de cliente) nem
// o token do aparelho.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
const logs = fonte.match(/console\.(log|error|warn)\([\s\S]*?\);/g) ?? [];

describe('send-push-notification: ticket da Expo', () => {
  it('lê o ticket pela função testada, não por data[0]', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*extrairTicket[^}]*\}\s*from\s*'\.\/expoTicket\.ts'/,
    );
    expect(fonte).toMatch(/extrairTicket\(expoPushResult\)/);
    expect(fonte).not.toMatch(/data\?\.\[0\]/);
  });

  it('zera o token morto, e só se ainda for o mesmo que falhou', () => {
    const i = fonte.indexOf('tokenDeveSerLimpo(ticket)');
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 600);
    expect(trecho).toMatch(/\.update\(\{\s*push_token:\s*null\s*\}\)/);
    expect(trecho).toMatch(/\.eq\('id',\s*usuario_id\)/);
    expect(trecho).toMatch(/\.eq\('push_token',\s*usuario\.push_token\)/);
  });
});

describe('send-push-notification: log sem dado pessoal', () => {
  it('tem logs para conferir', () => {
    expect(logs.length).toBeGreaterThan(3);
  });

  it.each(logs.map((l) => [l]))('%s', (l) => {
    expect(l).not.toMatch(
      /JSON\.stringify\((body|pushMessage|expoPushResult)\)/,
    );
    expect(l).not.toMatch(/push_token(?!\s*\))/);
    expect(l).not.toMatch(/\b(titulo|mensagem|usuario\.nome)\b/);
    // token só mascarado
    expect(l.replace(/mascararToken\([^)]*\)/g, '')).not.toMatch(/push_token/);
  });
});
