// Guarda estática da Migration 58 (parada só muda de rota pelo gestor das
// lojas das duas rotas). O banco único é produção e não há pgTAP: o
// comportamento se prova com a sonda transacional (`database/sondas/`). Esta
// guarda impede que uma edição tire a isenção de quem não tem sessão, aceite
// o gestor de uma loja só, abra um ramo para o motorista, tire a cláusula WHEN
// (que deixa as RPCs que só mexem em `ordem` de fora), exponha a função de
// gatilho ou deixe as duas cópias divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024210000_parada_muda_de_rota_pelo_gestor.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024210000_sonda_migration58.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

// CRLF fora: com `core.autocrlf=true` (Windows) o checkout troca as quebras.
const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const sonda = ler(caminhoSonda);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
const executavel = semComentarios(sql);
const rollback = (() => {
  const i = sql.indexOf('-- ROLLBACK:');
  if (i < 0) return '';
  return sql
    .slice(i)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n');
})();

const FUNCAO = 'paradas_troca_de_rota_pelo_gestor';
const GATILHO = 'trg_paradas_troca_de_rota_pelo_gestor';

const corpo = (() => {
  const inicio = executavel.indexOf(
    `CREATE OR REPLACE FUNCTION public.${FUNCAO}()`,
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
})();

const gatilho = (() => {
  const inicio = executavel.indexOf(`CREATE TRIGGER ${GATILHO}`);
  if (inicio < 0) return '';
  return executavel.slice(inicio, executavel.indexOf(';', inicio) + 1);
})();

// Seções do corpo da sonda, pelo cabeçalho de cada caso (`  -- 2c. ...`).
const secoesDaSonda = (() => {
  const mapa = new Map<string, string>();
  const re = /^ {2}-- (\d+[a-z]?)\. /gm;
  const marcas = [...sonda.matchAll(re)];
  marcas.forEach((m, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : sonda.length;
    mapa.set(m[1], sonda.slice(m.index, fim));
  });
  return mapa;
})();

const gestorAtivoDaRota = (lado: 'OLD' | 'NEW') =>
  new RegExp(
    `FROM public\\.rotas r\\s+JOIN public\\.usuario_unidades uu ON uu\\.unidade_id = r\\.unidade_id\\s+` +
      `WHERE r\\.id = ${lado}\\.rota_id\\s+AND uu\\.usuario_id = auth\\.uid\\(\\)\\s+` +
      `AND uu\\.ativo = true\\s+AND uu\\.papel::text = 'gestor'`,
  );

describe('Migration 58: parada só muda de rota pelo gestor das duas lojas', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função DEFINER com search_path vazio; sem sessão passa', () => {
    expect(corpo).toMatch(
      /RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    expect(corpo).toMatch(/IF auth\.uid\(\) IS NULL THEN\s+RETURN NEW;/);
  });

  it('exige gestor ativo da loja da rota de origem E da de destino', () => {
    expect(corpo).toMatch(gestorAtivoDaRota('OLD'));
    expect(corpo).toMatch(gestorAtivoDaRota('NEW'));
    // as duas conferências juntas, não uma ou outra
    expect(corpo).toMatch(/\)\s+AND EXISTS \(/);
    expect(corpo).not.toMatch(/\)\s+OR EXISTS \(/);
  });

  it('não abre ramo para o motorista e recusa com 42501', () => {
    expect(corpo).not.toMatch(/motorista/i);
    expect(corpo).toMatch(/RAISE EXCEPTION '[^']+'\s+USING ERRCODE = '42501'/);
    expect(corpo.match(/RAISE EXCEPTION/g)).toHaveLength(1);
  });

  it('gatilho BEFORE UPDATE OF rota_id, só quando a rota muda de fato', () => {
    expect(gatilho).toMatch(
      /BEFORE UPDATE OF rota_id ON public\.paradas\s+FOR EACH ROW\s+WHEN \(OLD\.rota_id IS DISTINCT FROM NEW\.rota_id\)\s+EXECUTE FUNCTION public\.paradas_troca_de_rota_pelo_gestor\(\);/,
    );
    expect(executavel).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.paradas;`),
    );
  });

  it('a função de gatilho não é executável por PUBLIC, anon nem authenticated', () => {
    expect(executavel).toMatch(
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${FUNCAO}\\(\\) FROM PUBLIC, anon, authenticated;`,
      ),
    );
    expect(executavel).not.toMatch(/GRANT\s+EXECUTE/i);
  });

  it('rollback colável desfaz gatilho e função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.paradas;`),
    );
    expect(rollback).toMatch(
      new RegExp(`DROP FUNCTION IF EXISTS public\\.${FUNCAO}\\(\\);`),
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários pedidos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M58 \(desfeita\)/);
    const casos = [
      '1 OK', // motorista com vínculo nas duas lojas
      '1b OK', // a parada do motorista continua na rota de origem
      '2 OK', // gestor de uma loja só
      '2b OK', // a parada continua na rota de origem
      '2c OK', // gestor de uma loja só, entre rotas da mesma loja
      '2d OK', // vínculo de gestor inativo no destino
      '3 OK', // gestor das duas lojas
      '4a OK', // inserir_parada
      '4b OK', // reordenar_paradas
      '5 OK', // UPDATE comum do motorista
      '6 OK', // SET com a mesma rota
      '7 OK', // sem sessão
      '8a OK',
      '8b OK',
    ];
    for (const caso of casos) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(ultimoRaise).toBeGreaterThan(-1);
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M58 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
  });

  it('os casos recusados exigem o SQLSTATE 42501 e a mensagem do gatilho', () => {
    for (const caso of ['1', '2', '2d']) {
      expect(sonda).toMatch(
        new RegExp(
          `CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'A parada só muda de rota%'\\s+` +
            `THEN ' \\| ${caso} OK:`,
        ),
      );
    }
    // nenhum caso aceita qualquer erro como OK
    expect(sonda).not.toMatch(
      /WHEN OTHERS THEN\s+r := r \|\| ' \| \d+[a-z]? OK/,
    );
  });

  it('cada caso da sonda monta as próprias rotas, sem depender de outro', () => {
    const casosComEstado = [
      '1',
      '2',
      '2c',
      '2d',
      '3',
      '4a',
      '4b',
      '5',
      '6',
      '7',
    ];
    for (const caso of casosComEstado) {
      const secao = secoesDaSonda.get(caso) ?? '';
      expect(secao).toContain('INSERT INTO public.rotas');
    }
  });

  it('a sonda afirma o dono postgres da função', () => {
    expect(secoesDaSonda.get('8') ?? '').toMatch(
      /pg_get_userbyid\(proowner\) = 'postgres'/,
    );
  });

  it('MIGRATIONS.md registra a Migration 58 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 58: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const publicos = [sql, sonda].join('\n').toLowerCase();
    for (const termo of ['vaza', 'ataque', 'atacante', 'brecha', 'explor']) {
      expect(publicos).not.toContain(termo);
    }
  });
});
