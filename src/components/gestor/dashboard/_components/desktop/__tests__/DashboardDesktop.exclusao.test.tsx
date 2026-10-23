/**
 * Exclusão de rota pelo dashboard desktop — passa pela mesma porta da
 * Gestão de Rotas (`excluirRota`). Antes, o dashboard fazia
 * `delete().eq('id')` sem olhar status: apagava rota em andamento.
 *
 * Roda contra o banco falso em memória (`bancoFalsoRotas`); o Dialog é um
 * stub que expõe título, mensagem e o botão de confirmar.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  bancoFalso,
  resetarBancoFalso,
} from '@/__tests__/helpers/bancoFalsoRotas';

import { DashboardDesktop } from '../DashboardDesktop';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/bancoFalsoRotas').moduloSupabaseFalso,
);
jest.mock('@/hooks/useMotoristas', () => ({
  useMotoristas: () => ({ motoristas: [] }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/components/desktop/DesktopPageLayout', () => ({
  DesktopPageLayout: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/RouteFilters', () => ({ RouteFilters: () => null }));
jest.mock('@/components/Toast', () => ({
  Toast: ({ visible, message }: { visible: boolean; message: string }) => {
    const { Text } = require('react-native');
    return visible ? <Text testID="toast">{message}</Text> : null;
  },
}));
jest.mock('@/components/Dialog', () => ({
  Dialog: ({
    visible,
    title,
    message,
    onConfirm,
  }: {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    if (!visible) return null;
    return (
      <View>
        <Text testID="dialog-titulo">{title}</Text>
        <Text testID="dialog-mensagem">{message}</Text>
        <TouchableOpacity testID="dialog-confirmar" onPress={onConfirm}>
          <Text>Confirmar</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));
jest.mock('../RotasTable', () => ({
  RotasTable: ({
    rotas,
    onDelete,
  }: {
    rotas: { id: string }[];
    onDelete: (id: string) => void;
  }) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View>
        {rotas.map((r) => (
          <TouchableOpacity
            key={r.id}
            testID={`delete-${r.id}`}
            onPress={() => onDelete(r.id)}
          >
            <Text>Excluir</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));
jest.mock('../../shared/StatsCard', () => ({ StatsCard: () => null }));

const rotasNaTela = [
  { id: 'r-and', status: 'em_andamento', motorista_nome: 'Ana' },
  { id: 'r-conc', status: 'concluida', motorista_nome: 'Bia' },
  { id: 'r-pend', status: 'pendente', motorista_nome: 'Caio' },
];

function renderizar() {
  const props = {
    stats: {
      total: 3,
      emAndamento: 1,
      concluidas: 1,
      pendentes: 1,
      distanciaTotal: 0,
      incidentesAbertos: 0,
    },
    todayStats: { totalHoje: 3 },
    kpis: {},
    rotas: rotasNaTela,
    loading: false,
    refreshing: false,
    onRefresh: jest.fn(),
    userData: { id: 'g1', nome: 'Gestor' },
    filters: {},
    onFiltersChange: jest.fn(),
  } as unknown as React.ComponentProps<typeof DashboardDesktop>;
  return { ...render(<DashboardDesktop {...props} />), props };
}

beforeEach(() => {
  resetarBancoFalso([
    {
      id: 'r-and',
      status: 'em_andamento',
      data: '2026-10-22',
      motorista_id: 'm1',
    },
    {
      id: 'r-conc',
      status: 'concluida',
      data: '2026-10-21',
      motorista_id: 'm2',
    },
    {
      id: 'r-pend',
      status: 'pendente',
      data: '2026-10-23',
      motorista_id: 'm3',
    },
  ]);
});

describe('DashboardDesktop — exclusão de rota', () => {
  it('não apaga rota em andamento e diz por quê', async () => {
    const { getByTestId, queryByTestId } = renderizar();

    fireEvent.press(getByTestId('delete-r-and'));
    if (queryByTestId('dialog-confirmar')) {
      fireEvent.press(getByTestId('dialog-confirmar'));
    }

    await waitFor(() =>
      expect(getByTestId('toast').props.children).toMatch(/em andamento/),
    );
    expect(bancoFalso.rotas.some((r) => r.id === 'r-and')).toBe(true);
  });

  it('rota concluída: a confirmação avisa que os comprovantes serão apagados', () => {
    const { getByTestId } = renderizar();

    fireEvent.press(getByTestId('delete-r-conc'));

    expect(getByTestId('dialog-mensagem').props.children).toMatch(
      /comprovantes de entrega/,
    );
  });

  it('rota pendente: apaga e grava o log rota_excluida', async () => {
    const { getByTestId, props } = renderizar();

    fireEvent.press(getByTestId('delete-r-pend'));
    fireEvent.press(getByTestId('dialog-confirmar'));

    await waitFor(() =>
      expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(false),
    );
    expect(bancoFalso.logs.map((l) => l.evento)).toEqual(['rota_excluida']);
    expect(props.onRefresh).toHaveBeenCalled();
  });
});
