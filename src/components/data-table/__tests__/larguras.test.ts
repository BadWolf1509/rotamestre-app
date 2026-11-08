/**
 * Larguras do DataTable desktop: as colunas encolhem até um mínimo, para a
 * tabela caber no cartão sem rolagem horizontal, e a coluna de ações se mede
 * pelos rótulos dos botões que ficam na linha.
 */
import {
  larguraDaColuna,
  larguraDaColunaDeAcoes,
  larguraMinimaDaTabela,
  separarAcoes,
} from '../larguras';

import type { DataTableAction } from '../types';

type Item = { id: string };
const acao = (
  label: DataTableAction<Item>['label'],
  extra: Partial<DataTableAction<Item>> = {},
): DataTableAction<Item> => ({ label, onPress: jest.fn(), ...extra });

describe('larguraDaColuna', () => {
  it('parte da base, cresce e encolhe na proporção dela, até o mínimo', () => {
    expect(larguraDaColuna(200, 140)).toEqual({
      width: 200,
      flexGrow: 200,
      flexShrink: 200,
      minWidth: 140,
    });
  });

  it('sem mínimo, não encolhe abaixo da base', () => {
    expect(larguraDaColuna(120).minWidth).toBe(120);
  });

  it('mínimo maior que a base fica na base', () => {
    expect(larguraDaColuna(100, 180).minWidth).toBe(100);
  });
});

describe('coluna de ações', () => {
  it('emMenu manda a ação ao menu "⋯", como danger', () => {
    const { acoesNaLinha, acoesNoMenu } = separarAcoes([
      acao('Ver perfil'),
      acao('Desativar', { emMenu: true }),
      acao('Excluir', { type: 'danger' }),
    ]);
    expect(acoesNaLinha.map((a) => a.label)).toEqual(['Ver perfil']);
    expect(acoesNoMenu.map((a) => a.label)).toEqual(['Desativar', 'Excluir']);
  });

  it('a largura cresce com o rótulo do botão (não é fixa por botão)', () => {
    const curta = larguraDaColunaDeAcoes([acao('Editar')]).flexBasis as number;
    const longa = larguraDaColunaDeAcoes([acao('Alterar status')])
      .flexBasis as number;
    expect(longa).toBeGreaterThan(curta);
    // "Editar" cabe bem abaixo dos 130 fixos de antes.
    expect(curta).toBeLessThan(110);
  });

  it('o menu soma só o botão "⋯"', () => {
    const sem = larguraDaColunaDeAcoes([acao('Editar')]).flexBasis as number;
    const com = larguraDaColunaDeAcoes([
      acao('Editar'),
      acao('Excluir', { type: 'danger' }),
    ]).flexBasis as number;
    expect(com - sem).toBeLessThanOrEqual(40);
  });
});

describe('larguraMinimaDaTabela', () => {
  it('soma os mínimos das colunas, a coluna de ações e o recuo da linha', () => {
    const colunas = [
      { key: 'a', label: 'A', width: 200, minWidth: 150 },
      { key: 'b', label: 'B', width: 100 },
    ];
    const acoes = [acao('Editar')];
    const flexAcoes = larguraDaColunaDeAcoes(acoes).flexBasis as number;

    expect(larguraMinimaDaTabela(colunas, acoes)).toBe(
      150 + 100 + flexAcoes + 24,
    );
    expect(larguraMinimaDaTabela(colunas, [])).toBe(150 + 100 + 24);
  });
});
