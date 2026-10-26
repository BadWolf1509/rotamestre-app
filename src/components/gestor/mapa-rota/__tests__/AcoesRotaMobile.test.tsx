/**
 * Barra de ações da rota no celular e no tablet (< 1024 px): as mesmas ações
 * do cabeçalho do desktop, pela mesma regra (`permissoesRota`).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { StatusRota } from '@/types/rota';

import { AcoesRotaMobile } from '../AcoesRotaMobile';

import type { Rota } from '../types';

function rotaCom(status: StatusRota): Rota {
  return { id: 'rota-1', data: '2026-10-25', status };
}

function montar(status: StatusRota) {
  const callbacks = {
    onCancelPress: jest.fn(),
    onReactivatePress: jest.fn(),
    onChangeDriverPress: jest.fn(),
    onAddStopPress: jest.fn(),
    onReorderPress: jest.fn(),
  };
  render(<AcoesRotaMobile rota={rotaCom(status)} {...callbacks} />);
  return callbacks;
}

describe('AcoesRotaMobile', () => {
  it('rota pendente mostra trocar, adicionar, reordenar e cancelar', () => {
    montar('pendente');

    expect(screen.getByText('Trocar motorista')).toBeTruthy();
    expect(screen.getByText('Adicionar parada')).toBeTruthy();
    expect(screen.getByText('Reordenar')).toBeTruthy();
    expect(screen.getByText('Cancelar rota')).toBeTruthy();
    expect(screen.queryByText('Reativar rota')).toBeNull();
  });

  it('rota não executada mostra só reativar', () => {
    montar('nao_executada');

    expect(screen.getByText('Reativar rota')).toBeTruthy();
    expect(screen.queryByText('Trocar motorista')).toBeNull();
    expect(screen.queryByText('Adicionar parada')).toBeNull();
    expect(screen.queryByText('Reordenar')).toBeNull();
    expect(screen.queryByText('Cancelar rota')).toBeNull();
  });

  it('rota concluída não mostra nenhuma ação', () => {
    montar('concluida');

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('cada botão chama o seu callback', () => {
    const cb = montar('pendente');

    fireEvent.press(screen.getByRole('button', { name: 'Trocar motorista' }));
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar parada' }));
    fireEvent.press(screen.getByRole('button', { name: 'Reordenar' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar rota' }));

    expect(cb.onChangeDriverPress).toHaveBeenCalledTimes(1);
    expect(cb.onAddStopPress).toHaveBeenCalledTimes(1);
    expect(cb.onReorderPress).toHaveBeenCalledTimes(1);
    expect(cb.onCancelPress).toHaveBeenCalledTimes(1);
  });

  it('reativar chama o seu callback', () => {
    const cb = montar('nao_executada');

    fireEvent.press(screen.getByRole('button', { name: 'Reativar rota' }));

    expect(cb.onReactivatePress).toHaveBeenCalledTimes(1);
  });
});
