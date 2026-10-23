// Guarda estática da Migration 45 (o token de push sai de `usuarios` e passa a
// viver em `push_tokens`, visível só ao dono).
// O banco único é produção e não há pgTAP: o comportamento se prova com a
// sonda transacional (`database/sondas/`), rodada no SQL Editor. Esta guarda
// impede que uma edição perca as peças que fecham o caso: a tabela com RLS do
// dono e sem escrita direta da API, a RPC gravando nela (e não mais na coluna),
// o backfill antes da CHECK que mantém a coluna vazia, o gatilho de
// compatibilidade das versões antigas, o leitor do banco trocado, o token
// mascarado nos logs e o UPDATE de `usuarios` só nas colunas que o app escreve.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024020000_push_tokens_so_do_dono.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024020000_sonda_migration45.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

// CRLF fora: com `core.autocrlf=true` (Windows) o checkout troca as quebras, e
// `--.*$` deixaria de casar o comentário (o `.` para no `\r`).
const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
// Só o que roda: o bloco ROLLBACK e o roteiro de conferência são comentados.
const executavel = semComentarios(sql);
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();
const exec = normaliza(executavel);

/** Corpo ($$ ... $$) da função `nome`. */
function corpoDaFuncao(nome: string): string {
  const i = executavel.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  if (i < 0) return '';
  const abre = executavel.indexOf('$$', i);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(abre + 2, fecha);
}

/** Cabeçalho (entre o CREATE e o $$) da função `nome`. */
function cabecalhoDaFuncao(nome: string): string {
  const i = executavel.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  if (i < 0) return '';
  return normaliza(executavel.slice(i, executavel.indexOf('$$', i)));
}

describe('Migration 45: arquivos', () => {
  it('existe em database/ e a cópia em supabase/ é idêntica', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação e tem ROLLBACK e roteiro de conferência', () => {
    expect(exec).toMatch(/^BEGIN;/);
    expect(exec).toMatch(/COMMIT;$/);
    expect(sql).toMatch(/-- ROLLBACK:/);
    expect(sql).toMatch(/CONFERÊNCIA \(só SELECT/);
  });

  it('está no MIGRATIONS.md como pendente (⏳)', () => {
    expect(ler(caminhoDoc)).toMatch(
      new RegExp(`### ⏳ Migration 45[^\\n]*\\n[\\s\\S]{0,400}${ARQUIVO}`),
    );
  });
});

describe('Migration 45: tabela push_tokens', () => {
  it('token é a chave (um aparelho, uma conta) e o dono some com o usuário', () => {
    expect(exec).toMatch(
      /CREATE TABLE public\.push_tokens \( token text PRIMARY KEY, usuario_id uuid NOT NULL REFERENCES public\.usuarios\(id\) ON DELETE CASCADE, atualizado_em timestamptz NOT NULL DEFAULT now\(\) \);/,
    );
    expect(exec).toMatch(
      /CREATE INDEX \w+ ON public\.push_tokens \(usuario_id\);/,
    );
  });

  it('RLS ligada; SELECT e DELETE só do dono; nenhuma policy de escrita', () => {
    expect(exec).toMatch(
      /ALTER TABLE public\.push_tokens ENABLE ROW LEVEL SECURITY;/,
    );
    const policies = exec.match(/CREATE POLICY [^;]+;/g) ?? [];
    expect(policies).toHaveLength(2);
    expect(policies.join(' ')).toMatch(
      /ON public\.push_tokens FOR SELECT TO authenticated USING \(usuario_id = \(SELECT auth\.uid\(\)\)\);/,
    );
    expect(policies.join(' ')).toMatch(
      /ON public\.push_tokens FOR DELETE TO authenticated USING \(usuario_id = \(SELECT auth\.uid\(\)\)\);/,
    );
  });

  it('a API não escreve direto: tira o grant padrão e devolve só SELECT e DELETE', () => {
    expect(exec).toMatch(
      /REVOKE ALL ON public\.push_tokens FROM PUBLIC, anon, authenticated;/,
    );
    expect(exec).toMatch(
      /GRANT SELECT, DELETE ON public\.push_tokens TO authenticated;/,
    );
    expect(exec).not.toMatch(
      /GRANT [^;]*(INSERT|UPDATE|ALL)[^;]* ON public\.push_tokens/,
    );
  });
});

describe('Migration 45: gravação só por função do servidor', () => {
  const helper = corpoDaFuncao('gravar_push_token');
  const rpc = corpoDaFuncao('registrar_push_token');

  it('o helper é DEFINER, search_path vazio, sem EXECUTE para a API', () => {
    expect(cabecalhoDaFuncao('gravar_push_token')).toMatch(
      /SECURITY DEFINER SET search_path = ''/,
    );
    expect(exec).toMatch(
      /REVOKE ALL ON FUNCTION public\.gravar_push_token\(uuid, text\) FROM PUBLIC, anon, authenticated;/,
    );
  });

  it('o helper valida o formato e grava em push_tokens trocando o dono', () => {
    expect(helper).toMatch(/length\(p_token\) > 200/);
    expect(helper).toMatch(
      /p_token !~ '\^Expo\(nent\)\?PushToken\\\[\[\^\]\]\+\\\]\$'/,
    );
    expect(helper).toMatch(/pg_advisory_xact_lock\(hashtext\(p_token\)\)/);
    // clock_timestamp(): now() é o mesmo na transação inteira, e dois
    // registros na mesma transação empatariam no corte dos 5.
    expect(normaliza(helper)).toMatch(
      /INSERT INTO public\.push_tokens \(token, usuario_id, atualizado_em\) VALUES \(p_token, p_usuario, clock_timestamp\(\)\) ON CONFLICT \(token\) DO UPDATE SET usuario_id = EXCLUDED\.usuario_id, atualizado_em = EXCLUDED\.atualizado_em;/,
    );
    expect(helper).not.toMatch(/now\(\)/);
  });

  it('o helper limita os aparelhos por conta, com desempate determinístico', () => {
    expect(normaliza(helper)).toMatch(
      /DELETE FROM public\.push_tokens WHERE usuario_id = p_usuario AND token NOT IN \( SELECT token FROM public\.push_tokens WHERE usuario_id = p_usuario ORDER BY atualizado_em DESC, token LIMIT 5 \);/,
    );
  });

  it('o helper recusa gravar para outra conta quando há sessão (defesa em profundidade)', () => {
    const corpo = normaliza(helper);
    expect(corpo).toMatch(/^DECLARE v_uid uuid := auth\.uid\(\); BEGIN/);
    expect(corpo).toMatch(
      /IF v_uid IS NOT NULL AND v_uid <> p_usuario THEN RAISE EXCEPTION '[^']+' USING ERRCODE = '42501'; END IF;/,
    );
    // vem antes de qualquer escrita
    expect(corpo.indexOf('v_uid <> p_usuario')).toBeLessThan(
      corpo.indexOf('INSERT INTO'),
    );
  });

  it('a RPC exige sessão e perfil, grava pelo helper e não toca mais em usuarios.push_token', () => {
    expect(cabecalhoDaFuncao('registrar_push_token')).toMatch(
      /SECURITY DEFINER SET search_path = ''/,
    );
    expect(rpc).toMatch(/auth\.uid\(\)/);
    expect(rpc).toMatch(/ERRCODE = '42501'/);
    expect(rpc).toMatch(/public\.gravar_push_token\(v_uid, p_token\)/);
    expect(rpc).not.toMatch(/UPDATE public\.usuarios/);
    expect(exec).toMatch(
      /REVOKE ALL ON FUNCTION public\.registrar_push_token\(text\) FROM PUBLIC, anon;/,
    );
    expect(exec).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.registrar_push_token\(text\) TO authenticated;/,
    );
  });
});

describe('Migration 45: a coluna usuarios.push_token fica sempre vazia', () => {
  const posBackfillInsert = exec.indexOf(
    'INSERT INTO public.push_tokens (token, usuario_id, atualizado_em) SELECT DISTINCT ON (u.push_token)',
  );
  const posBackfillZera = exec.indexOf(
    'UPDATE public.usuarios SET push_token = NULL WHERE push_token IS NOT NULL;',
  );
  const posCheck = exec.indexOf(
    'ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_push_token_vazio CHECK (push_token IS NULL);',
  );
  const posGatilho = exec.indexOf(
    'CREATE OR REPLACE TRIGGER push_token_vai_para_push_tokens',
  );

  it('backfill move os tokens (um dono por token) e zera a coluna antes da CHECK e do gatilho', () => {
    expect(posBackfillInsert).toBeGreaterThan(-1);
    expect(posBackfillZera).toBeGreaterThan(posBackfillInsert);
    expect(posCheck).toBeGreaterThan(posBackfillZera);
    expect(posGatilho).toBeGreaterThan(posBackfillZera);
    expect(exec).toMatch(/ON CONFLICT \(token\) DO NOTHING;/);
  });

  it('o gatilho roda antes do UPDATE só quando chega token, e só para o dono da linha', () => {
    expect(exec).toMatch(
      /CREATE OR REPLACE TRIGGER push_token_vai_para_push_tokens BEFORE UPDATE ON public\.usuarios FOR EACH ROW WHEN \(NEW\.push_token IS NOT NULL\) EXECUTE FUNCTION public\.mover_push_token_para_tabela\(\);/,
    );
    const corpo = normaliza(corpoDaFuncao('mover_push_token_para_tabela'));
    expect(cabecalhoDaFuncao('mover_push_token_para_tabela')).toMatch(
      /SECURITY DEFINER SET search_path = ''/,
    );
    expect(corpo).toMatch(
      /IF v_uid IS NOT NULL AND v_uid <> OLD\.id THEN RAISE EXCEPTION/,
    );
    expect(corpo).toMatch(/ERRCODE = '42501'/);
    expect(corpo).toMatch(
      /PERFORM public\.gravar_push_token\(OLD\.id, NEW\.push_token\);/,
    );
    expect(corpo).toMatch(/NEW\.push_token := NULL;/);
    expect(exec).toMatch(
      /REVOKE ALL ON FUNCTION public\.mover_push_token_para_tabela\(\) FROM PUBLIC, anon, authenticated;/,
    );
  });
});

describe('Migration 45: ninguém mais lê o token da coluna', () => {
  it('notify_push_on_insert olha push_tokens', () => {
    const corpo = corpoDaFuncao('notify_push_on_insert');
    expect(corpo).toMatch(/FROM public\.push_tokens/);
    expect(corpo).not.toMatch(/SELECT push_token/);
  });

  it('nenhum SELECT da coluna no que roda', () => {
    expect(exec).not.toMatch(/SELECT push_token INTO/);
  });
});

describe('Migration 45: logs de push sem o token inteiro', () => {
  it('mascara os tokens já gravados (só os 6 últimos, como mascararToken)', () => {
    expect(exec).toMatch(
      /UPDATE public\.push_notification_logs SET push_token = '…' \|\| right\(push_token, 6\) WHERE push_token IS NOT NULL AND push_token NOT LIKE '…%';/,
    );
  });

  // Os ~1.656 UPDATEs dos logs não podem rodar segurando o lock que o
  // CREATE TABLE (FK para usuarios) e o ALTER TABLE usuarios pegam.
  it('a máscara dos logs roda antes de tocar em usuarios', () => {
    const mascara = exec.indexOf('UPDATE public.push_notification_logs');
    const tabela = exec.indexOf('CREATE TABLE public.push_tokens');
    expect(mascara).toBeGreaterThan(-1);
    expect(tabela).toBeGreaterThan(-1);
    const ultimaMascara = exec.lastIndexOf(
      'UPDATE public.push_notification_logs',
    );
    expect(ultimaMascara).toBeLessThan(tabela);
  });
});

describe('Migration 45: lock em usuarios', () => {
  it('lock_timeout local logo no começo: não fila a API atrás da migration', () => {
    expect(exec).toMatch(/^BEGIN; SET LOCAL lock_timeout = '5s';/);
  });
});

describe('Migration 45: UPDATE de usuarios só nas colunas que o app escreve', () => {
  it('tira o grant de tabela e reconcede a lista sem id, created_at e ativo', () => {
    expect(exec).toMatch(
      /REVOKE UPDATE ON public\.usuarios FROM authenticated, anon;/,
    );
    const m = exec.match(
      /GRANT UPDATE \(([^)]+)\) ON public\.usuarios TO authenticated;/,
    );
    expect(m).not.toBeNull();
    const colunas = (m?.[1] ?? '').split(',').map((c) => c.trim());
    expect(colunas.sort()).toEqual(
      [
        'email',
        'foto_url',
        'nome',
        'primeira_senha',
        'push_token',
        'telefone',
        'ultimo_login',
        'unidade_id',
        'updated_at',
      ].sort(),
    );
  });
});

describe('Migration 45: sonda', () => {
  const sonda = ler(caminhoSonda);
  const sondaExec = normaliza(semComentarios(sonda));

  it('existe e termina sempre em RAISE EXCEPTION', () => {
    expect(sondaExec).toMatch(
      /RAISE EXCEPTION 'SONDA M45 \(desfeita\):%', r; END \$\$;$/,
    );
  });

  it('o caso 7 (gestor grava token na linha do motorista) EXIGE 42501', () => {
    const i = sondaExec.indexOf(
      'UPDATE public.usuarios SET push_token = v_tok_g WHERE id = v_m;',
    );
    expect(i).toBeGreaterThan(-1);
    const bloco = sondaExec.slice(i, sondaExec.indexOf('END;', i));
    expect(bloco).toMatch(
      /WHEN insufficient_privilege THEN r := r \|\| ' \| 7 OK/,
    );
    expect(bloco).not.toMatch(/7 OK: G não alcança/);
  });

  it('o limite confere QUAIS ficaram (lotes 3 a 7), não só a contagem', () => {
    expect(sondaExec).toMatch(
      /array_agg\(token ORDER BY token\) INTO v_restantes FROM public\.push_tokens WHERE usuario_id = v_m/,
    );
    expect(sondaExec).toMatch(/generate_series\(3, 7\)/);
  });

  it.each([
    ['A1', 'gravar_push_token chamado por authenticated'],
    ['A2', 'mover_push_token_para_tabela chamado direto'],
    ['B', 'UPDATEs legítimos do próprio usuário'],
    ['C1', 'UPDATE de id'],
    ['C2', 'UPDATE de created_at'],
    ['D', 'gestor atualiza nome/telefone/email do motorista'],
    ['E', 'service_role grava token na linha de M'],
    ['F', 'RPC de conta sem linha em usuarios'],
  ])('cobre o caso %s (%s)', (caso) => {
    expect(sondaExec).toContain(`' | ${caso} OK`);
  });

  it('só apaga o que ela mesma cria (o token próprio, pela policy do dono)', () => {
    const deletes = sondaExec.match(/DELETE FROM [^;]+;/g) ?? [];
    for (const d of deletes) {
      expect(d).toMatch(/DELETE FROM public\.push_tokens WHERE token = v_tok_/);
    }
  });
});
