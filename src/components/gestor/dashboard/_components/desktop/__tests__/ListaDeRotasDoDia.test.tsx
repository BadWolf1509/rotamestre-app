import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';

import { ListaDeRotasDoDia } from '../ListaDeRotasDoDia';

import type { RotaResumo } from '../../../_hooks/useDashboardData';

const NOME_LONGO =
  'Maria Aparecida dos Santos Albuquerque de Oliveira Figueiredo';

const rotas: RotaResumo[] = [
  {
    id: 'r1',
    data: '2026-11-07',
    status: 'em_andamento',
    motorista_nome: 'Ana Souza',
    motorista_id: 'm1',
    total_paradas: 8,
    paradas_concluidas: 3,
    distancia_total: 12.4,
    paradas_status: [
      'concluida',
      'concluida',
      'concluida',
      'em_andamento',
      'pendente',
      'pendente',
      'pendente',
      'pendente',
    ],
  },
  {
    id: 'r2',
    data: '2026-11-07',
    status: 'pendente',
    motorista_nome: NOME_LONGO,
    motorista_id: 'm2',
    total_paradas: 0,
    paradas_concluidas: 0,
    distancia_total: 0,
    paradas_status: [],
  },
];

describe('ListaDeRotasDoDia', () => {
  it('uma linha por rota com nome, contagem, status e distância', () => {
    const { getByText, getByTestId } = render(
      <ListaDeRotasDoDia
        rotas={rotas}
        onAbrirRota={jest.fn()}
        onExcluirRota={jest.fn()}
      />,
    );

    expect(getByTestId('rotas-table')).toBeTruthy();
    expect(getByText('Ana Souza')).toBeTruthy();
    expect(getByText('3 de 8')).toBeTruthy();
    expect(getByText('Em andamento')).toBeTruthy();
    expect(getByText('12,4 km')).toBeTruthy();
    expect(getByText('Pendente')).toBeTruthy();
    expect(getByText('Sem paradas')).toBeTruthy();
    expect(getByText('0 de 0')).toBeTruthy();
  });

  it('o nome longo fica numa linha, e o nome inteiro vai no rótulo da linha', () => {
    const { getByText, getByTestId } = render(
      <ListaDeRotasDoDia
        rotas={rotas}
        onAbrirRota={jest.fn()}
        onExcluirRota={jest.fn()}
      />,
    );

    expect(getByText(NOME_LONGO).props.numberOfLines).toBe(1);
    expect(getByTestId('rota-dia-r2').props.accessibilityLabel).toContain(
      NOME_LONGO,
    );
  });

  it('a data da rota aparece na linha e no rótulo acessível', () => {
    const { getAllByText, getByTestId } = render(
      <ListaDeRotasDoDia
        rotas={[{ ...rotas[0], data: '2026-11-05' }]}
        onAbrirRota={jest.fn()}
        onExcluirRota={jest.fn()}
      />,
    );

    // Coluna date: dia do calendário local, sem voltar um dia em UTC-3.
    expect(getAllByText('05/11/2026')).toHaveLength(1);
    expect(getByTestId('rota-dia-r1').props.accessibilityLabel).toContain(
      '05/11/2026',
    );
  });

  it('o rótulo acessível concorda o plural das paradas feitas', () => {
    const { getByTestId } = render(
      <ListaDeRotasDoDia
        rotas={[
          { ...rotas[0], id: 'um', total_paradas: 1, paradas_concluidas: 0 },
          rotas[0],
        ]}
        onAbrirRota={jest.fn()}
        onExcluirRota={jest.fn()}
      />,
    );

    expect(getByTestId('rota-dia-um').props.accessibilityLabel).toContain(
      '0 de 1 parada feita',
    );
    expect(getByTestId('rota-dia-r1').props.accessibilityLabel).toContain(
      '3 de 8 paradas feitas',
    );
  });

  it('tocar na linha abre a rota', () => {
    const onAbrirRota = jest.fn();
    const { getByTestId } = render(
      <ListaDeRotasDoDia
        rotas={rotas}
        onAbrirRota={onAbrirRota}
        onExcluirRota={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('rota-dia-r1'));
    expect(onAbrirRota).toHaveBeenCalledWith('r1');
  });

  it('"Excluir rota" fica no menu "⋯" e não abre a rota junto', () => {
    const onAbrirRota = jest.fn();
    const onExcluirRota = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <ListaDeRotasDoDia
        rotas={rotas}
        onAbrirRota={onAbrirRota}
        onExcluirRota={onExcluirRota}
      />,
    );

    expect(queryByText('Excluir rota')).toBeNull();
    fireEvent.press(getByTestId('rota-dia-acoes-r1'), {
      stopPropagation: jest.fn(),
    });
    fireEvent.press(getByText('Excluir rota'), { stopPropagation: jest.fn() });

    expect(onExcluirRota).toHaveBeenCalledWith('r1');
    expect(onAbrirRota).not.toHaveBeenCalled();
  });

  it('nenhum botão fica dentro de outro botão; o nome abre a rota e o "Mais ações" é alcançável', () => {
    const onAbrirRota = jest.fn();
    render(
      <ListaDeRotasDoDia
        rotas={rotas}
        onAbrirRota={onAbrirRota}
        onExcluirRota={jest.fn()}
      />,
    );

    const botoes = screen.getAllByRole('button');
    botoes.forEach((botao) => {
      const internos = within(botao)
        .queryAllByRole('button')
        .filter((interno) => interno !== botao);
      expect(internos).toHaveLength(0);
    });
    expect(screen.getAllByRole('button', { name: 'Mais ações' })).toHaveLength(
      rotas.length,
    );
    // A linha segue anunciada, como grupo com o rótulo inteiro.
    expect(screen.getByTestId('rota-dia-r1').props.role).toBe('group');

    fireEvent.press(screen.getByRole('button', { name: 'Abrir Ana Souza' }));
    expect(onAbrirRota).toHaveBeenCalledWith('r1');
  });
});
