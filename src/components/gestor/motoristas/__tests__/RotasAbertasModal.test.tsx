import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import { RotasAbertasModal } from '../RotasAbertasModal';

const bloqueio = {
  nomeMotorista: 'João Silva',
  rotas: [
    { id: 'r-and', data: '2026-10-24', status: 'em_andamento' },
    { id: 'r-p1', data: '2026-10-25', status: 'pendente' },
    { id: 'r-p2', data: '2026-10-26', status: 'pendente' },
  ],
};

describe('RotasAbertasModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista as três rotas com data (dia local) e status', () => {
    render(<RotasAbertasModal bloqueio={bloqueio} onClose={jest.fn()} />);

    expect(screen.getByText(/João Silva/)).toBeTruthy();
    expect(screen.getByText('24/10/2026')).toBeTruthy();
    expect(screen.getByText('25/10/2026')).toBeTruthy();
    expect(screen.getByText('26/10/2026')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.getAllByText('Pendente')).toHaveLength(2);
    expect(screen.getByText(/reatribua.*ou cancele/i)).toBeTruthy();
  });

  it('tocar numa rota fecha o aviso e abre a tela da rota', () => {
    const onClose = jest.fn();
    render(<RotasAbertasModal bloqueio={bloqueio} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('rota-aberta-r-p1'));

    expect(onClose).toHaveBeenCalled();
    expect(useRouter().push).toHaveBeenCalledWith('/gestor/mapa-rota?id=r-p1');
  });

  it('sem lista legível, explica o bloqueio sem linhas de rota', () => {
    render(
      <RotasAbertasModal
        bloqueio={{ nomeMotorista: 'Ana', rotas: [] }}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/Ana tem rotas abertas/)).toBeTruthy();
    expect(screen.queryByTestId(/^rota-aberta-/)).toBeNull();
  });

  it('sem bloqueio, não mostra nada', () => {
    render(<RotasAbertasModal bloqueio={null} onClose={jest.fn()} />);
    expect(screen.queryByText(/rotas abertas/)).toBeNull();
  });
});
