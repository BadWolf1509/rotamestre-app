// Guarda estática da Migration 47 (preferências de push por conta, em tabela
// própria, que só o dono lê e grava).
// O banco único é produção e não há pgTAP: o comportamento se prova com a
// sonda transacional (`database/sondas/`), rodada no SQL Editor. Esta guarda
// impede que uma edição perca as peças que fecham o caso: a tabela fora de
// `usuarios` (cuja RLS deixa o gestor ler e alterar a linha do motorista), o
// default ligado, a RLS só do dono nas três operações e os grants sem DELETE.
import {
  CAMINHO_DOC,
  carregarMigration,
  ler,
  lerSonda,
  semComentarios,
} from './_helpers/migration';

const ARQUIVO = '20261024200000_preferencias_notificacao.sql';

const m = carregarMigration(ARQUIVO);
const { sql } = m;
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();
const exec = normaliza(semComentarios(sql));

describe('Migration 47: arquivos', () => {
  it('existe em database/ e a cópia em supabase/ é idêntica', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(ler(m.caminhoSupa)).toBe(sql);
  });

  it('roda numa transação e tem ROLLBACK e roteiro de conferência', () => {
    expect(exec).toMatch(/^BEGIN;/);
    expect(exec).toMatch(/COMMIT;$/);
    expect(sql).toMatch(/-- ROLLBACK:/);
    expect(sql).toMatch(/CONFERÊNCIA \(só SELECT/);
  });

  it('está no MIGRATIONS.md', () => {
    expect(ler(CAMINHO_DOC)).toMatch(
      new RegExp(
        `### (?:⏳|✅) Migration 47[^\\n]*\\n[\\s\\S]{0,400}${ARQUIVO}`,
      ),
    );
  });
});

describe('Migration 47: tabela', () => {
  it('uma linha por conta (PK usuario_id), que some com o usuário', () => {
    expect(exec).toMatch(
      /CREATE TABLE public\.preferencias_notificacao \( usuario_id uuid PRIMARY KEY REFERENCES public\.usuarios\(id\) ON DELETE CASCADE,/,
    );
  });

  it.each(['push_ativo', 'incidentes', 'rotas', 'resumo_diario'])(
    '%s é boolean NOT NULL DEFAULT true (default ligado)',
    (coluna) => {
      expect(exec).toContain(`${coluna} boolean NOT NULL DEFAULT true`);
    },
  );

  it('não mexe em usuarios (a RLS de lá vaza ao gestor e às fotos)', () => {
    expect(exec).not.toMatch(/ALTER TABLE public\.usuarios/i);
  });
});

describe('Migration 47: RLS e grants', () => {
  it('liga a RLS', () => {
    expect(exec).toContain(
      'ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;',
    );
  });

  it('tira tudo da API e devolve só SELECT, INSERT e UPDATE a authenticated', () => {
    expect(exec).toContain(
      'REVOKE ALL ON public.preferencias_notificacao FROM PUBLIC, anon, authenticated;',
    );
    expect(exec).toContain(
      'GRANT SELECT, INSERT, UPDATE ON public.preferencias_notificacao TO authenticated;',
    );
    expect(exec).not.toMatch(
      /GRANT [^;]*\b(DELETE|ALL)\b[^;]*ON public\.preferencias_notificacao/,
    );
    expect(exec).not.toMatch(
      /GRANT [^;]*ON public\.preferencias_notificacao TO [^;]*\banon\b/,
    );
  });

  const DONO = 'usuario_id = (SELECT auth.uid())';

  it('SELECT só do dono', () => {
    expect(exec).toContain(
      `CREATE POLICY preferencias_notificacao_select_dono ON public.preferencias_notificacao FOR SELECT TO authenticated USING (${DONO});`,
    );
  });

  it('INSERT só para si', () => {
    expect(exec).toContain(
      `CREATE POLICY preferencias_notificacao_insert_dono ON public.preferencias_notificacao FOR INSERT TO authenticated WITH CHECK (${DONO});`,
    );
  });

  it('UPDATE só da própria linha, e sem passá-la a outra conta', () => {
    expect(exec).toContain(
      `CREATE POLICY preferencias_notificacao_update_dono ON public.preferencias_notificacao FOR UPDATE TO authenticated USING (${DONO}) WITH CHECK (${DONO});`,
    );
  });

  it('nenhuma policy de DELETE nem por unidade', () => {
    expect(exec).not.toMatch(/FOR DELETE/);
    expect(exec).not.toMatch(/get_my_unidade_ids|usuario_unidades/);
  });
});

describe('Migration 47: sonda', () => {
  const sonda = lerSonda('20261024200000_sonda_migration47.sql');

  it('termina em RAISE e cobre os casos do brief', () => {
    expect(sonda).not.toBe('');
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M47 \(desfeita\):%', r;/);
    // default ligado; outro usuário não lê nem altera
    expect(sonda).toMatch(/1 OK/);
    expect(sonda).toMatch(/3 OK/);
    expect(sonda).toMatch(/4 OK/);
    expect(sonda).toMatch(/5 OK/);
  });

  it('não usa DELETE nem DROP fora de comentário', () => {
    const codigo = semComentarios(sonda);
    expect(codigo).not.toMatch(/\bDROP\b/i);
    // DELETE só como tentativa recusada de M (sem grant), nunca contra dado real
    const deletes = codigo.match(/\bDELETE\b/gi) ?? [];
    expect(deletes.length).toBeLessThanOrEqual(1);
  });
});
