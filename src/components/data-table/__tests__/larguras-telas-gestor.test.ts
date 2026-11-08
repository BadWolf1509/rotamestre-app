/**
 * Guarda estática: a soma dos mínimos das tabelas desktop do gestor cabe no
 * cartão a 1280 px (~910 px úteis em Incidentes, que é a mais apertada) sem
 * rolagem horizontal. Lê as colunas e ações direto do código das telas e
 * mede com as funções reais de `larguras.ts`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { larguraMinimaDaTabela } from '../larguras';

import type { DataTableAction } from '../types';

type Item = { id: string };

const RAIZ = join(__dirname, '..', '..', '..', '..');

function bloco(fonte: string, inicio: RegExp, fim: RegExp): string {
  const i = fonte.search(inicio);
  expect(i).toBeGreaterThanOrEqual(0);
  const resto = fonte.slice(i);
  const f = resto.search(fim);
  expect(f).toBeGreaterThan(0);
  return resto.slice(0, f);
}

function medir(arquivo: string): number {
  const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');

  const colunasTexto = bloco(
    fonte,
    /columns(?:: | = useMemo<)DataTableColumn</,
    /actions(?:: | = useMemo<)DataTableAction</,
  );
  const colunas = colunasTexto
    .split(/\bkey: '/)
    .slice(1)
    .map((trecho) => ({
      width: Number(/(?<![A-Za-z])width: (\d+),/.exec(trecho)?.[1]),
      minWidth: Number(/\bminWidth: (\d+),/.exec(trecho)?.[1]),
    }));
  expect(colunas.length).toBeGreaterThan(0);
  colunas.forEach((c) => {
    expect(Number.isFinite(c.width)).toBe(true);
    expect(Number.isFinite(c.minWidth)).toBe(true);
  });

  const acoesTexto = bloco(
    fonte,
    /actions(?:: | = useMemo<)DataTableAction</,
    /\n {2,4}\][;,]/,
  );
  const acoes = acoesTexto
    .split(/\n {4,6}\{\r?\n/)
    .slice(1)
    .map((trecho): DataTableAction<Item> => {
      const literal = /\blabel: '([^']*)'/.exec(trecho)?.[1];
      return {
        label: literal ?? (() => 'rótulo dinâmico'),
        type: /\btype: '(\w+)'/.exec(trecho)?.[1] as 'danger' | 'secondary',
        emMenu: /\bemMenu: true/.test(trecho),
        onPress: () => undefined,
      };
    });
  expect(acoes.length).toBeGreaterThan(0);

  return larguraMinimaDaTabela(colunas, acoes);
}

describe('tabelas desktop do gestor cabem sem rolagem horizontal', () => {
  it('Incidentes: soma dos mínimos <= 880', () => {
    expect(medir('app/gestor/incidentes.tsx')).toBeLessThanOrEqual(880);
  });

  it('Motoristas: soma dos mínimos <= 950', () => {
    expect(medir('app/gestor/motoristas.tsx')).toBeLessThanOrEqual(950);
  });

  it('Gestão de Rotas: soma dos mínimos <= 950', () => {
    expect(medir('app/gestor/gestao-rotas.tsx')).toBeLessThanOrEqual(950);
  });
});
