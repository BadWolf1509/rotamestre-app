// Guarda estrutural dos SQL novos (sem banco e sem dependência).
//
// Em 23/10/2026 uma edição da Migration 38 trocou o `AS $$` de uma função por
// `DECLARE`: o `$$;` de fechamento ficou sem abertura e a migration inteira
// falharia no SQL Editor — e todas as guardas de texto passaram, porque
// procuravam trechos, não estrutura. Esta guarda confere o que um parser
// pegaria nessa classe de erro: cada dollar-quote abre depois de `AS` ou `DO`,
// fecha com a mesma tag, e o fechamento termina a instrução.
//
// Vale para as migrations a partir de 20261023000000 e para todas as sondas
// (as antigas não são reescritas; o histórico já foi aplicado).
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const raiz = join(__dirname, '..', '..');
const PRIMEIRA = '20261023000000';

type Problema = string;

/** Tira comentários de linha `--` (inclusive dentro de corpos de função). */
function semComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('--');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

function problemasDeDollarQuote(sql: string): Problema[] {
  const texto = semComentarios(sql);
  const problemas: Problema[] = [];
  const token = /\$([A-Za-z_]\w*)?\$/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(texto)) !== null) {
    const abre = m.index;
    const tag = m[0];
    const antes = texto.slice(0, abre).trimEnd();
    if (!/\b(AS|DO)$/i.test(antes)) {
      const linha = texto.slice(0, abre).split('\n').length;
      problemas.push(
        `linha ${linha}: ${tag} abre sem AS/DO antes (corpo sem abertura?)`,
      );
    }
    const fecha = texto.indexOf(tag, abre + tag.length);
    if (fecha === -1) {
      const linha = texto.slice(0, abre).split('\n').length;
      problemas.push(`linha ${linha}: ${tag} sem fechamento`);
      break;
    }
    const depois = texto.slice(fecha + tag.length).trimStart();
    if (!/^(;|LANGUAGE\b)/i.test(depois)) {
      const linha = texto.slice(0, fecha).split('\n').length;
      problemas.push(
        `linha ${linha}: ${tag} fecha sem ';' (ou LANGUAGE) em seguida`,
      );
    }
    token.lastIndex = fecha + tag.length;
  }
  return problemas;
}

function problemasDeFuncao(sql: string): Problema[] {
  const texto = semComentarios(sql);
  const problemas: Problema[] = [];
  const cabecalho = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = cabecalho.exec(texto)) !== null) {
    const resto = texto.slice(m.index);
    const corpo = resto.search(/\$([A-Za-z_]\w*)?\$/);
    const fim = resto.indexOf(';');
    if (corpo === -1 || (fim !== -1 && fim < corpo)) {
      problemas.push(`${m[1]}: termina antes de abrir o corpo ($$)`);
      continue;
    }
    if (!/\bAS\s*$/i.test(resto.slice(0, corpo))) {
      problemas.push(`${m[1]}: corpo não é aberto por AS $$`);
    }
  }
  return problemas;
}

function arquivosDaGuarda(): string[] {
  const migrations = join(raiz, 'database', 'migrations');
  const sondas = join(raiz, 'database', 'sondas');
  const lista = readdirSync(migrations)
    .filter((f) => /^\d{14}_.*\.sql$/.test(f) && f.slice(0, 14) >= PRIMEIRA)
    .filter((f) => !f.startsWith('99999999999999'))
    .map((f) => join(migrations, f));
  if (existsSync(sondas)) {
    lista.push(
      ...readdirSync(sondas)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => join(sondas, f)),
    );
  }
  return lista;
}

describe('estrutura dos SQL novos', () => {
  const arquivos = arquivosDaGuarda();

  it('acha a Migration 38 e a sonda dela', () => {
    expect(arquivos.some((f) => f.includes(PRIMEIRA))).toBe(true);
    expect(arquivos.some((f) => f.includes('sondas'))).toBe(true);
  });

  it.each(arquivos.map((f) => [f.slice(raiz.length + 1), f]))(
    '%s: dollar-quotes e corpos de função bem formados',
    (_nome, caminho) => {
      const sql = readFileSync(caminho, 'utf8');
      expect([
        ...problemasDeDollarQuote(sql),
        ...problemasDeFuncao(sql),
      ]).toEqual([]);
    },
  );
});

describe('a própria guarda', () => {
  const quebrada = `CREATE OR REPLACE FUNCTION public.f()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
DECLARE
  x boolean := true;
BEGIN
  RETURN NEW;
END;
$$;`;

  it('pega o AS $$ trocado por DECLARE (o defeito de 23/10)', () => {
    expect(problemasDeDollarQuote(quebrada).length).toBeGreaterThan(0);
    expect(problemasDeFuncao(quebrada).length).toBeGreaterThan(0);
  });

  it('pega $$ sem fechamento', () => {
    expect(problemasDeDollarQuote('DO $$ BEGIN NULL; END')).toEqual([
      'linha 1: $$ sem fechamento',
    ]);
  });

  it('aceita função e DO bem formados', () => {
    const ok = `CREATE OR REPLACE FUNCTION public.f()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE x int := 1; -- comentário com $$ não conta
BEGIN RETURN NEW; END;
$$;
DO $$ BEGIN RAISE NOTICE 'x'; END $$;
CREATE FUNCTION g() RETURNS int AS $f$ SELECT 1 $f$ LANGUAGE sql;`;
    expect(problemasDeDollarQuote(ok)).toEqual([]);
    expect(problemasDeFuncao(ok)).toEqual([]);
  });
});
