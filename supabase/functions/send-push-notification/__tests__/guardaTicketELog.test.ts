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

  it('apaga o token morto de push_tokens, e só se ainda for do mesmo dono', () => {
    const i = fonte.indexOf('tokenDeveSerLimpo(ticket)');
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 600);
    expect(trecho).toMatch(/\.from\('push_tokens'\)\s*\.delete\(\)/);
    expect(trecho).toMatch(/\.eq\('token',\s*token\)/);
    expect(trecho).toMatch(/\.eq\('usuario_id',\s*usuario_id\)/);
  });
});

// Migration 45: o token mora em push_tokens (vários por conta, um por
// aparelho); a coluna usuarios.push_token fica sempre vazia.
describe('send-push-notification: tokens de push_tokens', () => {
  it('lê os tokens da tabela do dono, não da coluna de usuarios', () => {
    expect(fonte).toMatch(
      /\.from\('push_tokens'\)\s*\.select\('token'\)\s*\.eq\('usuario_id',\s*usuario_id\)/,
    );
    expect(fonte).not.toMatch(/select\('push_token/);
    expect(fonte).not.toMatch(/usuario\.push_token/);
  });

  it('envia para cada aparelho da conta', () => {
    expect(fonte).toMatch(/for \(const token of tokens\)/);
  });

  // No DeviceNotRegistered a `message` da Expo (e a resposta crua) trazem o
  // token inteiro: o log guarda o resumo e o código de erro.
  it('o log de push não guarda a resposta crua nem a mensagem da Expo', () => {
    expect(fonte).not.toMatch(/response:\s*expoPushResult/);
    expect(fonte).toMatch(/response:\s*resumoDoTicket\(ticket\)/);
    expect(fonte).not.toMatch(/error_message:\s*ticket\.message/);
  });

  it('o log de push guarda só o token mascarado', () => {
    const i = fonte.indexOf("from('push_notification_logs').insert(");
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 300);
    expect(trecho).toMatch(
      /push_token:\s*data\.push_token \? mascararToken\(data\.push_token\) : null/,
    );
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
