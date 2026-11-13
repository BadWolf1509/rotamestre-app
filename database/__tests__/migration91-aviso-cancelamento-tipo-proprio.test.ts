// Guarda estática da Migration 91: o aviso de cancelamento ao motorista ganha
// tipo próprio, `rota_cancelada`. Na Migration 86 ele reaproveitava
// `rota_nao_executada` (o da rota que expirou sem ser feita), e o banco
// misturava as duas coisas. `cancelar_rota` é recriada a partir da versão viva
// (a da Migration 86, conferida no catálogo por md5 em 12/11), trocando só o
// tipo. O tipo novo precisa existir no push (sem ele, a Edge Function descarta
// o push calada), no destino do toque, nos tipos e no ícone do app. O
// comportamento se prova com a sonda.
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  RAIZ,
} from './_helpers/migration';

const ARQUIVO = '20261112120000_aviso_cancelamento_tipo_proprio.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const m86 = carregarMigration('20261108121000_aviso_cancelar_reativar.sql');
const sonda = lerSonda('20261112120000_sonda_migration91.sql');

const INICIO_CANCELAR = 'CREATE OR REPLACE FUNCTION public.cancelar_rota(';

const corpoDe = (sql: string, inicio: string): string => {
  const i = sql.indexOf(inicio);
  if (i < 0) return '';
  const fim = sql.indexOf('$$;', i);
  return sql.slice(i, fim < 0 ? undefined : fim);
};

const normalizar = (s: string) => s.replace(/\s+/g, ' ').trim();

const cancelar = corpoDe(executavel, INICIO_CANCELAR);
const cancelar86 = corpoDe(m86.executavel, INICIO_CANCELAR);

const CHAMADA = (tipo: string) =>
  new RegExp(
    `PERFORM public\\.criar_notificacao\\(\\s*v_aviso_motorista,\\s*'${tipo}',\\s*'Rota cancelada pelo gestor',`,
  );

describe('Migration 91: cancelar_rota avisa com o tipo rota_cancelada', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('o aviso chama criar_notificacao com rota_cancelada', () => {
    expect(cancelar).toMatch(CHAMADA('rota_cancelada'));
    expect(cancelar).not.toContain('rota_nao_executada');
    expect((cancelar.match(/criar_notificacao/g) ?? []).length).toBe(1);
  });

  it('fora o tipo, o corpo é o da Migration 86 (a versão viva)', () => {
    expect(cancelar86).toMatch(CHAMADA('rota_nao_executada'));
    expect(normalizar(cancelar.replace("'rota_cancelada'", "'X'"))).toBe(
      normalizar(cancelar86.replace("'rota_nao_executada'", "'X'")),
    );
  });

  it('reativar_rota não é tocada', () => {
    expect(executavel).not.toContain('FUNCTION public.reativar_rota(');
  });

  it('ACL refeita: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role', () => {
    expect(executavel).toContain(
      'ALTER FUNCTION public.cancelar_rota(uuid) OWNER TO postgres;',
    );
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.cancelar_rota(uuid) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.cancelar_rota(uuid) TO authenticated, service_role;',
    );
  });

  it('COMMENT da Migration 91 citando o tipo rota_cancelada', () => {
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.cancelar_rota\(uuid\) IS\s+'Migration 91[^']*tipo rota_cancelada/,
    );
  });

  it('corrige só os avisos de cancelamento já gravados com o tipo antigo', () => {
    expect(normalizar(executavel)).toContain(
      normalizar(`UPDATE public.notificacoes
         SET tipo = 'rota_cancelada'
       WHERE tipo = 'rota_nao_executada'
         AND titulo = 'Rota cancelada pelo gestor';`),
    );
    // Fora o corpo da função, nenhum outro UPDATE/DELETE de dados.
    const foraDaFuncao = executavel.replace(cancelar, '');
    expect((foraDaFuncao.match(/\bUPDATE public\./g) ?? []).length).toBe(1);
    expect(executavel).not.toMatch(/\bDELETE\b/);
  });
});

describe('Migration 91: o tipo novo existe no push e no app', () => {
  const push = readFileSync(
    join(RAIZ, 'supabase', 'functions', 'send-push-notification', 'index.ts'),
    'utf8',
  );
  const listaPush =
    push.match(/const PUSH_NOTIFICATION_TYPES = \[([\s\S]*?)\];/)?.[1] ?? '';
  const prioridade =
    push.match(/const NOTIFICATION_PRIORITY[^=]*= \{([\s\S]*?)\};/)?.[1] ?? '';
  const destino = ler(
    join(RAIZ, 'src', 'lib', 'notificacoes', 'destinoDaNotificacao.ts'),
  );
  const tipos = ler(join(RAIZ, 'src', 'types', 'notifications.ts'));
  const lista = ler(join(RAIZ, 'src', 'components', 'NotificationList.tsx'));

  it('vira push, com prioridade alta', () => {
    expect(listaPush).toContain("'rota_cancelada'");
    expect(prioridade).toMatch(/rota_cancelada: 'high'/);
  });

  it('é tipo só do motorista no destino do toque', () => {
    const soMotorista =
      destino.match(/const SO_MOTORISTA = new Set\(\[([\s\S]*?)\]\);/)?.[1] ??
      '';
    expect(soMotorista).toContain("'rota_cancelada'");
  });

  it('está no tipo NotificationType e tem ícone e cor próprios na lista', () => {
    expect(tipos).toContain("'rota_cancelada'");
    expect(lista).toMatch(/case 'rota_cancelada':\s*return 'ban';/);
    expect(lista).toMatch(
      /case 'rota_cancelada':\s*return theme\.colors\.gray500;/,
    );
  });
});

describe('Migration 91: rollback, sonda e documentação', () => {
  it('rollback colável: volta o corpo da Migration 86 e o tipo das linhas', () => {
    expect(rollback).toContain(INICIO_CANCELAR);
    expect(rollback).toMatch(CHAMADA('rota_nao_executada'));
    expect(rollback).toMatch(/'Migration 86 \(sobre a 70\):/);
    expect(normalizar(rollback)).toContain(
      normalizar(`UPDATE public.notificacoes
         SET tipo = 'rota_nao_executada'
       WHERE tipo = 'rota_cancelada'
         AND titulo = 'Rota cancelada pelo gestor';`),
    );
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M91 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'public.cancelar_rota(',
      "'rota_cancelada'",
      "'Rota cancelada pelo gestor'",
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('entrada no MIGRATIONS.md', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### .*Migration 91:/);
    expect(doc).toContain(ARQUIVO);
  });
});
