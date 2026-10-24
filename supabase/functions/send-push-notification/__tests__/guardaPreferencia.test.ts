// Guarda estática do index.ts (a função roda em Deno, fora do Jest): a
// preferência de push da conta (Migration 47) é lida e decidida pelo módulo
// testado `preferenciaDePush.ts`, ANTES de buscar os tokens, e quem é calado
// pela preferência fica registrado no log de push (sem enviar nada).
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
// A chamada pode vir quebrada em linhas (prettier).
const LEITURA = /await lerPreferenciaDePush\(\s*supabase,\s*usuario_id,?\s*\)/;

describe('send-push-notification: preferência de push', () => {
  it('importa a leitura e a decisão do módulo testado', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*decidirEnvio[^}]*\}\s*from\s*'\.\/preferenciaDePush\.ts'/,
    );
    expect(fonte).toMatch(
      /import\s*\{[^}]*lerPreferenciaDePush[^}]*\}\s*from\s*'\.\/preferenciaDePush\.ts'/,
    );
  });

  it('não consulta a tabela por fora do módulo', () => {
    expect(fonte).not.toMatch(/\.from\('preferencias_notificacao'\)/);
  });

  it('lê a preferência da conta e decide pelo tipo, antes dos tokens', () => {
    const leitura = fonte.search(LEITURA);
    const decisao = fonte.search(/decidirEnvio\(\{\s*tipo,/);
    const tokens = fonte.indexOf(
      'await lerTokensDaConta(supabase, usuario_id)',
    );
    expect(leitura).toBeGreaterThan(-1);
    expect(decisao).toBeGreaterThan(leitura);
    expect(tokens).toBeGreaterThan(decisao);
  });

  it('calado pela preferência: registra no log e responde sem enviar', () => {
    const i = fonte.indexOf('if (!decisao.envia)');
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 900);
    expect(trecho).toMatch(/status:\s*'skipped'/);
    expect(trecho).toMatch(/reason:\s*'preferencia_do_usuario'/);
    expect(trecho).toMatch(/return new Response/);
    expect(trecho).not.toMatch(/fetch\(EXPO_PUSH_URL/);
  });

  it('a falha da consulta é só registrada no console, e o envio segue', () => {
    const i = fonte.search(LEITURA);
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 600);
    expect(trecho).toMatch(/console\.(warn|error)\(/);
    // nenhum return entre a leitura e a decisão: o erro não interrompe o envio
    const ateDecisao = trecho.slice(0, trecho.search(/decidirEnvio\(/));
    expect(ateDecisao).not.toMatch(/return\b/);
  });

  // Revisão (Minor 1): o SOS não espera a consulta da preferência, que não
  // tem prazo próprio — decide pelo tipo antes de consultar.
  it('o SOS pula a leitura da preferência', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*categoriaDoTipo[^}]*\}\s*from\s*'\.\/preferenciaDePush\.ts'/,
    );
    expect(fonte).toMatch(/const ehSos = categoriaDoTipo\(tipo\) === 'sos';/);
    expect(fonte).toMatch(
      /ehSos\s*\?\s*\{\s*preferencia:\s*null,\s*erro:\s*null\s*\}\s*:\s*await lerPreferenciaDePush\(/,
    );
  });

  // Revisão (Minor 2): a policy `push_notification_logs_select_scoped` mostra
  // ao gestor da loja as linhas COM notificacao_id. A linha do push calado
  // sai sem ele (o id vai em `response`, para o admin), e o gestor não
  // descobre pelo log que o motorista desligou o push.
  it('a linha do push calado não fica visível ao gestor', () => {
    const i = fonte.indexOf('if (!decisao.envia)');
    const trecho = fonte.slice(i, i + 900);
    const log = trecho.slice(trecho.indexOf('logPushAttempt('));
    expect(log).toMatch(/notificacao_id:\s*null,/);
    expect(log).toMatch(
      /response:\s*\{\s*notificacao_id,\s*motivo:\s*decisao\.motivo\s*\}/,
    );
    expect(log).not.toMatch(/error_message:/);
  });

  it('o status do log aceita "skipped"', () => {
    expect(fonte).toMatch(
      /status:\s*'sent'\s*\|\s*'failed'\s*\|\s*'no_token'\s*\|\s*'skipped'/,
    );
  });
});
