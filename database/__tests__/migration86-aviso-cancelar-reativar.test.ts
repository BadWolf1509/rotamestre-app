// Guarda estática da Migration 86 (aviso ao motorista ao cancelar/reativar a
// rota, B-11). `cancelar_rota` e `reativar_rota` são recriadas a partir das
// versões vivas (Migrations 70 e 78, conferidas no catálogo em 08/11),
// acrescentando só um bloco que chama `criar_notificacao` para o motorista
// quando o resultado é `cancelada`/`reativada`. O bloco tem EXCEPTION próprio:
// falha do aviso não desfaz o cancelamento nem a reativação. Os tipos são dos
// que o app e o push já tratam. O comportamento se prova com a sonda.
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

const ARQUIVO = '20261108121000_aviso_cancelar_reativar.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const m70 = carregarMigration('20261026120000_cancelar_rota_rpc.sql');
const m78 = carregarMigration(
  '20261027102000_reativar_rota_motorista_indisponivel.sql',
);
const sonda = lerSonda('20261108121000_sonda_migration86.sql');

const corpoDe = (sql: string, inicio: string): string => {
  const i = sql.indexOf(inicio);
  if (i < 0) return '';
  const fim = sql.indexOf('$$;', i);
  return sql.slice(i, fim < 0 ? undefined : fim);
};

const INICIO_CANCELAR = 'CREATE OR REPLACE FUNCTION public.cancelar_rota(';
const INICIO_REATIVAR = 'CREATE OR REPLACE FUNCTION public.reativar_rota(';

const cancelar = corpoDe(executavel, INICIO_CANCELAR);
const reativar = corpoDe(executavel, INICIO_REATIVAR);
const cancelar70 = corpoDe(m70.executavel, INICIO_CANCELAR);
const reativar78 = corpoDe(m78.executavel, INICIO_REATIVAR);

// O bloco do aviso: do DECLARE próprio até o END; de dois espaços que o fecha.
const BLOCO_AVISO =
  /\n {2}DECLARE\n {4}v_aviso_[\s\S]*?\n {2}EXCEPTION WHEN OTHERS THEN\n[\s\S]*?\n {2}END;\n/;

const blocoDe = (corpo: string): string => corpo.match(BLOCO_AVISO)?.[0] ?? '';

const normalizar = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('Migration 86: aviso ao motorista ao cancelar/reativar', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });
});

describe.each([
  {
    nome: 'cancelar_rota',
    corpo: () => cancelar,
    anterior: () => cancelar70,
    resultado: 'cancelada',
    tipo: 'rota_nao_executada',
    titulo: 'Rota cancelada pelo gestor',
  },
  {
    nome: 'reativar_rota',
    corpo: () => reativar,
    anterior: () => reativar78,
    resultado: 'reativada',
    tipo: 'nova_rota_atribuida',
    titulo: 'Rota reativada',
  },
])('$nome (recriada a partir da versão viva)', (caso) => {
  it('tem o bloco do aviso, com EXCEPTION próprio que só registra WARNING', () => {
    const bloco = blocoDe(caso.corpo());
    expect(bloco).not.toBe('');
    expect(bloco).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING/);
    expect(bloco).not.toMatch(/RAISE EXCEPTION/);
  });

  it('o aviso chama criar_notificacao com o tipo e o título combinados', () => {
    const bloco = blocoDe(caso.corpo());
    expect(bloco).toMatch(
      new RegExp(
        `PERFORM public\\.criar_notificacao\\(\\s*v_aviso_motorista,\\s*'${caso.tipo}',\\s*'${caso.titulo}',`,
      ),
    );
    // Data nula não pode deixar um buraco no lugar da data na mensagem.
    expect(bloco).toMatch(
      /coalesce\(\s*to_char\([^)]*'DD\/MM\/YYYY'\),\s*'data não definida'\s*\)/,
    );
    expect(bloco).toMatch(/p_rota_id\s*\);/);
    expect(bloco).toMatch(/IF v_aviso_motorista IS NOT NULL THEN/);
  });

  it(`o aviso só roda no caminho de '${caso.resultado}', logo antes do RETURN dele`, () => {
    const corpo = caso.corpo();
    const bloco = blocoDe(corpo);
    const posBloco = corpo.indexOf(bloco);
    const posRetorno = corpo.indexOf(`RETURN '${caso.resultado}';`);
    expect(posBloco).toBeGreaterThan(-1);
    expect(posRetorno).toBeGreaterThan(posBloco);
    expect(corpo.slice(posBloco + bloco.length, posRetorno).trim()).toBe('');
    // Nenhum outro RETURN depois do bloco (ja_cancelada, situacao_mudou,
    // sem_permissao e motorista_indisponivel saem antes dele).
    expect(corpo.slice(0, posBloco)).not.toContain(
      `RETURN '${caso.resultado}';`,
    );
    expect((corpo.match(/criar_notificacao/g) ?? []).length).toBe(1);
  });

  it('fora o bloco do aviso, o corpo é o da versão anterior', () => {
    expect(caso.anterior()).not.toBe('');
    expect(normalizar(caso.corpo().replace(BLOCO_AVISO, '\n'))).toBe(
      normalizar(caso.anterior()),
    );
  });

  it('ACL refeita: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role', () => {
    expect(executavel).toContain(
      `ALTER FUNCTION public.${caso.nome}(uuid) OWNER TO postgres;`,
    );
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION public.${caso.nome}(uuid) FROM PUBLIC, anon;`,
    );
    expect(executavel).toContain(
      `GRANT EXECUTE ON FUNCTION public.${caso.nome}(uuid) TO authenticated, service_role;`,
    );
  });

  it('COMMENT da Migration 86 citando o aviso', () => {
    expect(executavel).toMatch(
      new RegExp(
        `COMMENT ON FUNCTION public\\.${caso.nome}\\(uuid\\) IS\\s+'Migration 86[^']*avisa o motorista`,
      ),
    );
  });
});

describe('Migration 86: os tipos são dos que o app e o push já tratam', () => {
  const push = readFileSync(
    join(RAIZ, 'supabase', 'functions', 'send-push-notification', 'index.ts'),
    'utf8',
  );
  const listaPush =
    push.match(/const PUSH_NOTIFICATION_TYPES = \[([\s\S]*?)\];/)?.[1] ?? '';
  const destino = ler(
    join(RAIZ, 'src', 'lib', 'notificacoes', 'destinoDaNotificacao.ts'),
  );
  const tipos = ler(join(RAIZ, 'src', 'types', 'notifications.ts'));
  const lista = ler(join(RAIZ, 'src', 'components', 'NotificationList.tsx'));

  it.each(['rota_nao_executada', 'nova_rota_atribuida'])(
    '%s vira push, tem destino para o motorista, tipo e ícone no app',
    (tipo) => {
      expect(listaPush).toContain(`'${tipo}'`);
      expect(destino).toContain(`'${tipo}'`);
      expect(tipos).toContain(`'${tipo}'`);
      expect(lista).toContain(`case '${tipo}':`);
    },
  );
});

describe('Migration 86: rollback, sonda e documentação', () => {
  it('rollback colável: volta os corpos das Migrations 70 e 78, sem aviso', () => {
    expect(rollback).toContain(INICIO_CANCELAR);
    expect(rollback).toContain(INICIO_REATIVAR);
    expect(rollback).not.toMatch(/criar_notificacao/);
    expect(rollback).toMatch(/'Migration 70:/);
    expect(rollback).toMatch(/'Migration 78 \(sobre a 71\):/);
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M86 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'public.cancelar_rota(',
      'public.reativar_rota(',
      "'ja_cancelada'",
      "'situacao_mudou'",
      "'sem_permissao'",
      "'motorista_indisponivel'",
      'public.push_tokens',
      "'Rota cancelada pelo gestor'",
      "'Rota reativada'",
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 86', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 86:/);
    expect(doc).toContain(ARQUIVO);
  });
});
