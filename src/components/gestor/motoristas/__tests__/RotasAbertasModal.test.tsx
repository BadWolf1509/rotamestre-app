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

  it('não promete trocar o motorista da rota em andamento: ela só pode ser cancelada', () => {
    render(<RotasAbertasModal bloqueio={bloqueio} onClose={jest.fn()} />);

    expect(
      screen.getByText(
        'João Silva tem 3 rotas abertas nesta loja. Antes de desativar, reatribua a outro motorista ou cancele as pendentes; a em andamento só pode ser cancelada.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Toque numa rota para abrir. Na pendente dá para trocar o motorista ou cancelar; na em andamento, só cancelar.',
      ),
    ).toBeTruthy();
  });

  it('só uma rota em andamento: o texto fala só em cancelar', () => {
    render(
      <RotasAbertasModal
        bloqueio={{ nomeMotorista: 'Ana', rotas: [bloqueio.rotas[0]] }}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Ana tem 1 rota em andamento nesta loja. Rota em andamento não troca de motorista: antes de desativar, cancele-a.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/reatribua/)).toBeNull();
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

  it('com uma rota só, o texto fica no singular', () => {
    render(
      <RotasAbertasModal
        bloqueio={{ nomeMotorista: 'Ana', rotas: [bloqueio.rotas[1]] }}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Ana tem 1 rota aberta nesta loja. Antes de desativar, reatribua a rota a outro motorista ou cancele-a.',
      ),
    ).toBeTruthy();
  });

  it('com várias rotas pendentes, o texto conta e fica no plural', () => {
    render(
      <RotasAbertasModal
        bloqueio={{ nomeMotorista: 'João Silva', rotas: bloqueio.rotas.slice(1) }}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'João Silva tem 2 rotas abertas nesta loja. Antes de desativar, reatribua cada rota a outro motorista ou cancele-a.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Toque numa rota para abrir e trocar o motorista ou cancelar.',
      ),
    ).toBeTruthy();
  });

  it('lista longa fica numa área rolável e mostra todas as rotas', () => {
    const muitas = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      data: `2026-11-${String(i + 1).padStart(2, '0')}`,
      status: 'pendente',
    }));
    render(
      <RotasAbertasModal
        bloqueio={{ nomeMotorista: 'Ana', rotas: muitas }}
        onClose={jest.fn()}
      />,
    );

    const lista = screen.getByTestId('rotas-abertas-lista');
    // ScrollView (no aparelho o DesktopModal não rola o corpo sozinho)
    expect(lista.type).toBe('RCTScrollView');
    expect(screen.getAllByTestId(/^rota-aberta-/)).toHaveLength(30);
    expect(screen.getByTestId('rota-aberta-r29')).toBeTruthy();
  });

  it('sem bloqueio, não mostra nada', () => {
    render(<RotasAbertasModal bloqueio={null} onClose={jest.fn()} />);
    expect(screen.queryByText(/rotas abertas/)).toBeNull();
  });
});
