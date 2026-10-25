// Guarda estática da Migration 59 (incidente só muda de rota pelo gestor das
// lojas de origem e de destino). O banco único é produção e não há pgTAP: o
// comportamento se prova com a sonda transacional (`database/sondas/`). Esta
// guarda impede que uma edição tire a isenção de quem não tem sessão, aceite
// o gestor de uma loja só, abra um ramo para o motorista, passe a ler a loja
// de destino do NEW.unidade_id (que depende da ordem dos gatilhos), tire a
// cláusula WHEN (que deixa de fora o desligar da rota, inclusive o ON DELETE
// SET NULL), exponha a função de gatilho ou deixe as duas cópias divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024220000_incidente_muda_de_rota_pelo_gestor.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024220000_sonda_migration59.sql',
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

const FUNCAO = 'incidentes_troca_de_rota_pelo_gestor';
const GATILHO = 'trg_incidentes_troca_de_rota_pelo_gestor';

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
  const marcas = [...sonda.matchAll(/^ {2}-- (\d+[a-z]?)\. /gm)];
  marcas.forEach((m, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : sonda.length;
    mapa.set(m[1], sonda.slice(m.index, fim));
  });
  return mapa;
})();

describe('Migration 59: incidente só muda de rota pelo gestor das duas lojas', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função DEFINER com search_path vazio e dono postgres; sem sessão passa', () => {
    expect(corpo).toMatch(
      /RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    expect(corpo).toMatch(/IF auth\.uid\(\) IS NULL THEN\s+RETURN NEW;/);
    expect(executavel).toMatch(
      new RegExp(`ALTER FUNCTION public\\.${FUNCAO}\\(\\) OWNER TO postgres;`),
    );
  });

  it('loja de origem vem de OLD (gravada no incidente, ou da rota antiga)', () => {
    expect(corpo).toMatch(/v_loja_origem := OLD\.unidade_id;/);
    expect(corpo).toMatch(
      /IF v_loja_origem IS NULL THEN\s+SELECT r\.unidade_id INTO v_loja_origem\s+FROM public\.rotas r\s+WHERE r\.id = OLD\.rota_id;/,
    );
    expect(corpo).toMatch(
      /FROM public\.usuario_unidades uu\s+WHERE uu\.unidade_id = v_loja_origem\s+AND uu\.usuario_id = auth\.uid\(\)\s+AND uu\.ativo = true\s+AND uu\.papel::text = 'gestor'/,
    );
  });

  it('loja de destino vem da rota nova, não do NEW.unidade_id recalculado', () => {
    expect(corpo).toMatch(
      /FROM public\.rotas r\s+JOIN public\.usuario_unidades uu ON uu\.unidade_id = r\.unidade_id\s+WHERE r\.id = NEW\.rota_id\s+AND uu\.usuario_id = auth\.uid\(\)\s+AND uu\.ativo = true\s+AND uu\.papel::text = 'gestor'/,
    );
    expect(corpo).not.toMatch(/NEW\.unidade_id/);
  });

  it('exige as duas lojas juntas, não uma ou outra', () => {
    expect(corpo).toMatch(/\)\s+AND EXISTS \(/);
    expect(corpo).not.toMatch(/\)\s+OR EXISTS \(/);
  });

  it('não abre ramo para o motorista e recusa com 42501', () => {
    expect(corpo).not.toMatch(/motorista/i);
    expect(corpo).toMatch(/RAISE EXCEPTION '[^']+'\s+USING ERRCODE = '42501'/);
    expect(corpo.match(/RAISE EXCEPTION/g)).toHaveLength(1);
  });

  it('gatilho BEFORE UPDATE OF rota_id, só quando vai para outra rota não nula', () => {
    expect(gatilho).toMatch(
      /BEFORE UPDATE OF rota_id ON public\.incidentes\s+FOR EACH ROW\s+WHEN \(OLD\.rota_id IS DISTINCT FROM NEW\.rota_id AND NEW\.rota_id IS NOT NULL\)\s+EXECUTE FUNCTION public\.incidentes_troca_de_rota_pelo_gestor\(\);/,
    );
    expect(executavel).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.incidentes;`),
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

  it('não reescreve os gatilhos que já existem em incidentes', () => {
    expect(executavel).not.toMatch(
      /FUNCTION public\.incidentes_define_unidade|FUNCTION public\.incidentes_confere_rota_parada/,
    );
  });

  it('rollback colável desfaz gatilho e função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.incidentes;`),
    );
    expect(rollback).toMatch(
      new RegExp(`DROP FUNCTION IF EXISTS public\\.${FUNCAO}\\(\\);`),
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários pedidos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M59 \(desfeita\)/);
    const casos = [
      '1 OK', // motorista com vínculo nas duas lojas
      '1b OK', // o incidente continua na rota e na loja de origem
      '1c OK', // motorista, na mesma loja
      '1e OK', // motorista, incidente sem rota para rota de outra loja
      '1f OK',
      '2 OK', // gestor de uma loja só
      '2b OK', // gestor de uma loja só, entre rotas da mesma loja
      '2c OK', // vínculo de gestor inativo no destino
      '3 OK', // gestor das duas lojas
      '4 OK', // UPDATE comum do motorista (descrição, foto NULL → valor)
      '5 OK', // desligar a rota
      '6 OK', // unidade_id direto
      '7 OK', // SET com a mesma rota
      '8 OK', // sem sessão
      '9 OK', // INSERT segue passando
      '10a OK',
      '10b OK',
    ];
    for (const caso of casos) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(ultimoRaise).toBeGreaterThan(-1);
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M59 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
  });

  it('os casos recusados exigem o SQLSTATE 42501 e a mensagem do gatilho', () => {
    for (const caso of ['1', '1c', '1e', '2', '2c']) {
      expect(sonda).toMatch(
        new RegExp(
          `CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'\\s+` +
            `THEN ' \\| ${caso} OK:`,
        ),
      );
    }
    expect(sonda).not.toMatch(
      /WHEN OTHERS THEN\s+r := r \|\| ' \| \d+[a-z]? OK/,
    );
  });

  it('cada caso da sonda monta o próprio incidente, sem depender de outro', () => {
    for (const caso of [
      '1',
      '1c',
      '1e',
      '2',
      '2b',
      '2c',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]) {
      const secao = secoesDaSonda.get(caso) ?? '';
      expect(secao).toContain('INSERT INTO public.rotas');
      expect(secao).toContain('INSERT INTO public.incidentes');
    }
  });

  it('a sonda afirma o dono postgres da função', () => {
    expect(secoesDaSonda.get('10') ?? '').toMatch(
      /pg_get_userbyid\(proowner\) = 'postgres'/,
    );
  });

  it('MIGRATIONS.md registra a Migration 59 com o arquivo, depois da 58', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 59: /);
    expect(doc).toContain(ARQUIVO);
    expect(doc.indexOf('Migration 59: ')).toBeGreaterThan(
      doc.indexOf('Migration 58: '),
    );
  });

  it('texto neutro nos arquivos públicos', () => {
    const publicos = [sql, sonda].join('\n').toLowerCase();
    for (const termo of ['vaza', 'ataque', 'atacante', 'brecha', 'explor']) {
      expect(publicos).not.toContain(termo);
    }
  });
});
