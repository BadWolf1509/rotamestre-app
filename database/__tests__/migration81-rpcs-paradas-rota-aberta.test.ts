// Guarda estática da Migration 81 (`inserir_parada` e `reordenar_paradas` só
// em rota `pendente`/`em_andamento`, com a linha da rota travada; o reordenar
// confere que todos os ids são distintos e da mesma rota antes de escrever; e
// toda recusa volta como `{ success:false, code, error }` com texto fixo, sem
// o texto do Postgres). O comportamento se prova com a sonda, desfeita pelo
// RAISE. Esta guarda impede que o `SQLERRM` volte para a resposta, que a
// trava vire `FOR UPDATE` (conflita com o KEY SHARE dos INSERTs com FK para
// `rotas`) ou saia de antes da primeira escrita, que um código suma, que a
// ACL mude e que as cópias divirjam.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  semComentarios,
} from './_helpers/migration';

const ARQUIVO = '20261107100000_rpcs_paradas_rota_aberta_e_codigos.sql';

const m = carregarMigration(ARQUIVO);
const { sql, executavel, rollback } = m;
const sonda = lerSonda('20261107100000_sonda_migration81.sql');

const ASSINATURA_INSERIR =
  'public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text)';
const ASSINATURA_REORDENAR = 'public.reordenar_paradas(uuid[], integer[])';

const corpoDe = (inicio: string): string => {
  const i = executavel.indexOf(inicio);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
};

const inserir = corpoDe('CREATE OR REPLACE FUNCTION public.inserir_parada(');
const reordenar = corpoDe(
  'CREATE OR REPLACE FUNCTION public.reordenar_paradas(',
);

/** Posição da primeira escrita (UPDATE/INSERT) depois do `BEGIN` do corpo. */
const primeiraEscrita = (corpo: string): number => {
  const inicio = corpo.indexOf('\nBEGIN\n');
  const resto = corpo.slice(inicio);
  const i = resto.search(/\b(UPDATE public\.|INSERT INTO public\.)/);
  return i < 0 ? -1 : inicio + i;
};

const CODIGOS_INSERIR = [
  'SEM_PERMISSAO',
  'ROTA_ENCERRADA',
  'ORDEM_DUPLICADA',
  'ERRO',
];
const CODIGOS_REORDENAR = [
  ...CODIGOS_INSERIR,
  'PARADA_NAO_ENCONTRADA',
  'PARADAS_DE_OUTRA_ROTA',
  'ENTRADA_INVALIDA',
];

describe('Migration 81: inserir_parada e reordenar_paradas só em rota aberta, com code', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('mesmas assinaturas, retorno jsonb, DEFINER e search_path vazio', () => {
    expect(inserir).toMatch(
      /inserir_parada\(\s*p_rota_id uuid,\s*p_tipo text,\s*p_endereco text,\s*p_latitude double precision,\s*p_longitude double precision,\s*p_posicao_insercao integer DEFAULT NULL,\s*p_destinatario text DEFAULT NULL,\s*p_telefone text DEFAULT NULL,\s*p_observacoes text DEFAULT NULL\s*\)/,
    );
    expect(reordenar).toMatch(
      /reordenar_paradas\(p_parada_ids uuid\[\], p_novas_ordens integer\[\]\)/,
    );
    for (const corpo of [inserir, reordenar]) {
      expect(corpo).toMatch(/RETURNS jsonb/);
      expect(corpo).toMatch(/LANGUAGE plpgsql/);
      expect(corpo).toMatch(/SECURITY DEFINER/);
      expect(corpo).toMatch(/SET search_path = ''/);
    }
  });

  it('guardas de autorização de antes', () => {
    expect(inserir).toMatch(
      /WHERE r\.id = p_rota_id\s+AND uu\.usuario_id = auth\.uid\(\)\s+AND uu\.papel = 'gestor'\s+AND uu\.ativo = true/,
    );
    expect(reordenar).toMatch(
      /WHERE r\.id = v_rota_id\s+AND uu\.usuario_id = auth\.uid\(\)\s+AND uu\.ativo = true\s+AND \(\s+uu\.papel = 'gestor'\s+OR \(\s+r\.motorista_id = auth\.uid\(\)\s+AND \(SELECT public\.usuario_atual_ativo\(\)\)/,
    );
  });

  it('trava a rota com FOR NO KEY UPDATE depois da autorização e antes da primeira escrita', () => {
    for (const corpo of [inserir, reordenar]) {
      const guarda = corpo.indexOf("'SEM_PERMISSAO'");
      const trava = corpo.search(
        /SELECT r\.status INTO v_status_rota\s+FROM public\.rotas r\s+WHERE r\.id = (p_rota_id|v_rota_id)\s+FOR NO KEY UPDATE;/,
      );
      const recusa = corpo.search(
        /IF v_status_rota IS NULL OR v_status_rota NOT IN \('pendente', 'em_andamento'\) THEN\s+RETURN jsonb_build_object\('success', false, 'code', 'ROTA_ENCERRADA'/,
      );
      const escrita = primeiraEscrita(corpo);
      expect(guarda).toBeGreaterThan(-1);
      expect(trava).toBeGreaterThan(guarda);
      expect(recusa).toBeGreaterThan(trava);
      expect(escrita).toBeGreaterThan(recusa);
      // FOR UPDATE conflita com o FOR KEY SHARE dos INSERTs com FK para rotas.
      expect(corpo).not.toMatch(/FOR UPDATE/);
    }
  });

  it('reordenar confere entrada, existência e mesma rota antes de qualquer UPDATE', () => {
    const escrita = primeiraEscrita(reordenar);
    const pontos = [
      reordenar.search(
        /coalesce\(cardinality\(p_parada_ids\), 0\) <> coalesce\(cardinality\(p_novas_ordens\), 0\)/,
      ),
      reordenar.search(/array_position\(p_parada_ids, NULL\) IS NOT NULL/),
      reordenar.search(/array_position\(p_novas_ordens, NULL\) IS NOT NULL/),
      reordenar.search(
        /\(SELECT count\(DISTINCT x\) FROM unnest\(p_parada_ids\) AS x\) <> v_count/,
      ),
      reordenar.indexOf("'PARADA_NAO_ENCONTRADA'"),
      reordenar.search(
        /PERFORM 1\s+FROM public\.paradas p\s+WHERE p\.id = ANY \(p_parada_ids\)\s+AND p\.rota_id = v_rota_id\s+FOR NO KEY UPDATE;/,
      ),
      reordenar.search(
        /IF v_da_rota <> v_count THEN\s+RETURN jsonb_build_object\('success', false, 'code', 'PARADAS_DE_OUTRA_ROTA'/,
      ),
    ];
    for (const p of pontos) {
      expect(p).toBeGreaterThan(-1);
      expect(escrita).toBeGreaterThan(p);
    }
  });

  it('mantém a lógica de ordem (chegada +2000, deslocamento +1000, normalização, chegada no fim)', () => {
    expect(inserir).toMatch(/SET ordem = v_chegada\.ordem \+ 2000/);
    expect(inserir).toMatch(/SET ordem = ordem \+ 1000/);
    expect(inserir).toMatch(/SET ordem = ordem - 1000 \+ 1/);
    expect(inserir).toMatch(
      /ROW_NUMBER\(\) OVER \(ORDER BY ordem\) AS new_ordem/,
    );
    expect(inserir).toMatch(
      /SET ordem = v_parada_count \+ 1\s+WHERE id = v_chegada\.id/,
    );
    expect(inserir).toMatch(
      /RETURN jsonb_build_object\('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem\);/,
    );
    expect(reordenar).toMatch(/SET ordem = 1000 \+ v_i/);
    expect(reordenar).toMatch(/SET ordem = p_novas_ordens\[v_i\]/);
    expect(reordenar).toMatch(
      /RETURN jsonb_build_object\('success', true, 'updated', v_count\);/,
    );
  });

  it('nenhum SQLERRM na resposta: só no RAISE LOG', () => {
    for (const corpo of [inserir, reordenar]) {
      expect(corpo).not.toMatch(/'error',\s*SQLERRM/);
      expect(corpo).not.toMatch(/'error',\s*v_mensagem/);
      const linhasComSqlerrm = corpo
        .split('\n')
        .filter((l) => /SQLERRM/.test(l));
      expect(linhasComSqlerrm.length).toBe(1);
      expect(linhasComSqlerrm[0]).toMatch(
        /^\s*RAISE LOG '[^']*', [^;]*SQLSTATE, SQLERRM;$/,
      );
      expect(corpo).toMatch(
        /GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_mensagem = MESSAGE_TEXT;/,
      );
      // Toda resposta de recusa leva code e error.
      const recusas = corpo.match(
        /jsonb_build_object\('success', false[^;]*;/g,
      );
      expect(recusas).not.toBeNull();
      for (const rec of recusas ?? []) {
        expect(rec).toMatch(/'code', /);
        expect(rec).toMatch(/'error', /);
      }
    }
  });

  it('mapeia 23505 e P0001 de rota encerrada; o resto vira ERRO', () => {
    for (const corpo of [inserir, reordenar]) {
      expect(corpo).toMatch(/WHEN v_estado = '23505' THEN 'ORDEM_DUPLICADA'/);
      expect(corpo).toMatch(
        /WHEN v_estado = 'P0001' AND v_mensagem IN \('PARADA_DE_ROTA_ENCERRADA', 'ROTA_ENCERRADA'\) THEN 'ROTA_ENCERRADA'/,
      );
      expect(corpo).toMatch(/ELSE 'ERRO'/);
    }
  });

  it('todos os códigos presentes em cada RPC', () => {
    for (const c of CODIGOS_INSERIR) expect(inserir).toContain(`'${c}'`);
    for (const c of CODIGOS_REORDENAR) expect(reordenar).toContain(`'${c}'`);
  });

  it('ACL de antes: sem PUBLIC e anon, EXECUTE para authenticated e service_role', () => {
    for (const a of [ASSINATURA_INSERIR, ASSINATURA_REORDENAR]) {
      expect(executavel).toContain(`ALTER FUNCTION ${a} OWNER TO postgres;`);
      expect(executavel).toContain(
        `REVOKE ALL ON FUNCTION ${a} FROM PUBLIC, anon;`,
      );
      expect(executavel).toContain(
        `GRANT EXECUTE ON FUNCTION ${a} TO authenticated, service_role;`,
      );
    }
    expect(executavel).not.toMatch(/GRANT[^;]*\bTO\b[^;]*\b(anon|PUBLIC)\b/);
  });

  it('COMMENT ON FUNCTION cita a Migration 81 e os códigos', () => {
    for (const [a, codigos] of [
      [ASSINATURA_INSERIR, CODIGOS_INSERIR],
      [ASSINATURA_REORDENAR, CODIGOS_REORDENAR],
    ] as const) {
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        `COMMENT ON FUNCTION ${esc} IS\\s+'(Migration 81:[^']*)'`,
      );
      const achado = executavel.match(re);
      expect(achado).not.toBeNull();
      for (const c of codigos) expect(achado?.[1]).toContain(c);
    }
  });

  it('não mexe em policy, gatilho nem privilégio de tabela', () => {
    expect(executavel).not.toMatch(/\b(CREATE|ALTER|DROP) POLICY\b/);
    expect(executavel).not.toMatch(/\b(CREATE|DROP) TRIGGER\b/);
    expect(executavel).not.toMatch(
      /ON (TABLE )?public\.(paradas|rotas)\s+(TO|FROM)/,
    );
  });

  it('rollback colável: corpos de antes, ACL e COMMENT', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'CREATE OR REPLACE FUNCTION public.inserir_parada(',
    );
    expect(rollback).toContain(
      'CREATE OR REPLACE FUNCTION public.reordenar_paradas(',
    );
    expect(rollback.match(/'error', SQLERRM/g)).toHaveLength(2);
    expect(rollback).toContain("'Arrays must have same length'");
    for (const a of [ASSINATURA_INSERIR, ASSINATURA_REORDENAR]) {
      expect(rollback).toContain(
        `REVOKE ALL ON FUNCTION ${a} FROM PUBLIC, anon;`,
      );
      expect(rollback).toContain(
        `GRANT EXECUTE ON FUNCTION ${a} TO authenticated, service_role;`,
      );
      expect(rollback).toContain(`COMMENT ON FUNCTION ${a} IS`);
    }
  });

  it('a sonda cobre os 11 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M81 \(desfeita\)/);
    for (let caso = 1; caso <= 11; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    for (const c of CODIGOS_REORDENAR.filter((c) => c !== 'ERRO')) {
      expect(sonda).toContain(`'${c}'`);
    }
    expect(sonda).toMatch(/ARRAY\['cancelada', 'concluida', 'nao_executada'\]/);
    expect(sonda).toMatch(/duplicate key/);
    expect(sonda).toMatch(/violates/);
    expect(sonda).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sonda).toMatch(/sonda-m81-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M81 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 81 com o arquivo', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### .*Migration 81: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(CAMINHO_DOC);
    const i = doc.search(/### .*Migration 81: /);
    const fim = i < 0 ? -1 : doc.indexOf('\n---', i);
    const entrada = i < 0 ? '' : doc.slice(i, fim < 0 ? undefined : fim);
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
    for (const termo of [
      'vaza',
      'ataque',
      'atacante',
      'brecha',
      'explor',
      'vulnerab',
      'falha',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
