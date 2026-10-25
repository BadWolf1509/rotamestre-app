// Guarda estática: toda consulta do app a `unidades` — direta
// (`.from('unidades').select(...)`) ou embutida no PostgREST (`unidades(...)`,
// `unidade:unidades(...)`) — pede só colunas de `COLUNAS_UNIDADE_APP`.
// A lista é a fonte única das colunas lidas; os testes com supabase mockado
// não percebem `*` nem coluna fora dela, por isso a guarda é estática.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import {
  COLUNAS_UNIDADE_APP,
  SELECT_UNIDADE_APP,
} from '../queries/colunasUnidade';

const raiz = join(__dirname, '..', '..', '..');

function arquivosDeProducao(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      saida.push(...arquivosDeProducao(caminho));
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

const fontes = [
  ...arquivosDeProducao(join(raiz, 'src')),
  ...arquivosDeProducao(join(raiz, 'app')),
].map((caminho) => ({
  caminho,
  texto: readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n'),
}));

// `unidades(` não precedido de letra/dígito/_ (exclui `usuario_unidades(`).
const EMBUTIDA = /(?<![\w])unidades\s*\(([^()]*)\)/g;
const DIRETA = /\.from\(\s*['"`]unidades['"`]\s*\)\s*\.select\(\s*([^)]*)\)/g;

const permitidas = new Set<string>(COLUNAS_UNIDADE_APP);

// Coluna de uma lista do PostgREST: tira alias (`apelido:coluna`) e cast.
function colunasDaLista(lista: string): string[] {
  return lista
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => c.split(':').pop()!.split('::')[0].trim());
}

interface Achado {
  caminho: string;
  conteudo: string;
}

function achados(re: RegExp): Achado[] {
  const lista: Achado[] = [];
  for (const { caminho, texto } of fontes) {
    for (const m of texto.matchAll(re)) {
      lista.push({ caminho, conteudo: m[1] });
    }
  }
  return lista;
}

describe('consultas do app a unidades pedem só colunas da lista do app', () => {
  const embutidas = achados(EMBUTIDA);
  const diretas = achados(DIRETA);

  it('a varredura encontra as consultas (sem isso, vazio seria indistinguível de limpo)', () => {
    expect(embutidas.length).toBeGreaterThanOrEqual(8);
    expect(diretas.length).toBeGreaterThanOrEqual(1);
  });

  it('nenhum `unidades(*)` embutido', () => {
    const comEstrela = embutidas.filter((a) => a.conteudo.trim() === '*');
    expect(comEstrela.map((a) => a.caminho)).toEqual([]);
  });

  it("nenhum `.from('unidades').select('*')` ou select sem colunas", () => {
    const ruins = diretas.filter((a) => {
      const arg = a.conteudo.trim();
      return arg === '' || /^['"`]\s*\*\s*['"`]$/.test(arg);
    });
    expect(ruins.map((a) => a.caminho)).toEqual([]);
  });

  it('listas literais embutidas usam só colunas da lista do app', () => {
    const fora: string[] = [];
    for (const a of embutidas) {
      if (a.conteudo.includes('${')) continue; // interpolação: conferida abaixo
      for (const c of colunasDaLista(a.conteudo)) {
        if (!permitidas.has(c)) fora.push(`${a.caminho}: ${c}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it('interpolação em lista de unidades só com SELECT_UNIDADE_APP', () => {
    const outras = embutidas.filter(
      (a) =>
        a.conteudo.includes('${') &&
        a.conteudo.trim() !== '${SELECT_UNIDADE_APP}',
    );
    expect(outras.map((a) => `${a.caminho}: ${a.conteudo}`)).toEqual([]);
  });

  it('select direto em unidades: literal com colunas da lista do app ou SELECT_UNIDADE_APP', () => {
    const fora: string[] = [];
    for (const a of diretas) {
      const arg = a.conteudo.trim();
      if (arg === 'SELECT_UNIDADE_APP') continue;
      const literal = arg.match(/^['"`]([^'"`]*)['"`]$/);
      if (!literal || literal[1].includes('${')) {
        fora.push(`${a.caminho}: ${arg}`);
        continue;
      }
      for (const c of colunasDaLista(literal[1])) {
        if (!permitidas.has(c)) fora.push(`${a.caminho}: ${c}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it('SELECT_UNIDADE_APP é a lista de COLUNAS_UNIDADE_APP', () => {
    expect(colunasDaLista(SELECT_UNIDADE_APP)).toEqual([
      ...COLUNAS_UNIDADE_APP,
    ]);
    expect(COLUNAS_UNIDADE_APP).not.toContain('cnpj');
  });
});
