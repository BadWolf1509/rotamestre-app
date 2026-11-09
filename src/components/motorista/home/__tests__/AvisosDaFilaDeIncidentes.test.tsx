import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AvisosDaFilaDeIncidentes } from '../AvisosDaFilaDeIncidentes';

const mockFila = jest.fn();
const mockDescartes = jest.fn();
const mockDispensar = jest.fn();
const mockOuvintes = new Set<() => void>();
jest.mock('@/lib/motorista/filaIncidentes', () => ({
  lerFilaIncidentes: () => mockFila(),
  lerDescartesDeIncidentes: (m: string) => mockDescartes(m),
  dispensarDescartesDeIncidentes: (m: string) => mockDispensar(m),
  ouvirFilaIncidentes: (o: () => void) => {
    mockOuvintes.add(o);
    return () => mockOuvintes.delete(o);
  },
}));

const incidente = (id: string, motoristaId: string, descricao = 'Portão') => ({
  id,
  motoristaId,
  rotaId: 'r1',
  paradaId: 'p1',
  categoria: 'blocked',
  descricao,
  endereco: 'Rua A',
  em: '2026-11-08T12:00:00.000Z',
  tentativas: 0,
});

beforeEach(() => {
  mockOuvintes.clear();
  mockFila.mockResolvedValue([]);
  mockDescartes.mockResolvedValue([]);
  mockDispensar.mockResolvedValue(undefined);
});

describe('AvisosDaFilaDeIncidentes', () => {
  it('sem nada guardado: não mostra nada', async () => {
    const { toJSON } = render(<AvisosDaFilaDeIncidentes motoristaId="m1" />);
    await waitFor(() => expect(mockFila).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  it('conta só os reportes desta conta que aguardam envio', async () => {
    mockFila.mockResolvedValue([
      incidente('i1', 'm1'),
      incidente('i2', 'm1'),
      incidente('i3', 'outra'),
    ]);
    const { findByText, getByTestId } = render(
      <AvisosDaFilaDeIncidentes motoristaId="m1" />,
    );
    expect(
      await findByText('2 reportes de problema aguardando envio'),
    ).toBeTruthy();
    expect(getByTestId('aviso-incidente-pendente')).toBeTruthy();
  });

  it('a fila mudou (enviou): o aviso some', async () => {
    mockFila.mockResolvedValue([incidente('i1', 'm1')]);
    const { findByTestId, queryByTestId } = render(
      <AvisosDaFilaDeIncidentes motoristaId="m1" />,
    );
    await findByTestId('aviso-incidente-pendente');

    mockFila.mockResolvedValue([]);
    await act(async () => {
      mockOuvintes.forEach((o) => o());
    });

    expect(queryByTestId('aviso-incidente-pendente')).toBeNull();
  });

  it('reporte recusado pelo servidor: avisa qual e pode ser dispensado', async () => {
    mockDescartes.mockResolvedValue([
      {
        incidente: incidente('i9', 'm1', 'Portão fechado'),
        motivo: 'recusado',
        em: '2026-11-08T13:00:00.000Z',
      },
    ]);
    const { findByTestId, getByText, getByLabelText } = render(
      <AvisosDaFilaDeIncidentes motoristaId="m1" />,
    );
    await findByTestId('aviso-incidente-descartado');
    expect(getByText(/Portão fechado/)).toBeTruthy();
    expect(mockDescartes).toHaveBeenCalledWith('m1');

    fireEvent.press(getByLabelText('Fechar alerta'));
    expect(mockDispensar).toHaveBeenCalledWith('m1');
  });
});
