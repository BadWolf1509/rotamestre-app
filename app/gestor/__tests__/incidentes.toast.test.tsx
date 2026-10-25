/**
 * Tela de incidentes do gestor: o toast que o hook dos modais dispara tem de
 * chegar ao toast que a TELA renderiza.
 *
 * `useToast` é estado local de cada instância, sem provider. `useIncidentesModals`
 * criava a instância dele e chamava `showToast` nela, enquanto a tela renderiza
 * a do `useIncidentesGestor`: "Status atualizado", "Erro ao atualizar status",
 * a recusa por RLS e "Erro ao carregar histórico" nunca apareciam. Aqui o hook
 * real recusa o UPDATE (zero linhas, como a RLS faz) e a mensagem tem de estar
 * na tela.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import Incidentes from '../incidentes';

const mockIncidente = {
  id: 'inc-1',
  categoria: 'outro',
  descricao: 'Pneu furado',
  endereco: 'Rua A, 1',
  status: 'aberto',
  foto_url: null,
  created_at: '2026-10-24T10:00:00Z',
  motorista_nome: 'João',
  motorista_id: 'm1',
  unidade_nome: 'Loja A',
  rota_id: null,
  rota_data: null,
  parada_endereco: null,
  observacoes_gestao: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 390,
  }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'g1', nome: 'Gestor', unidades: { nome: 'Loja A' } },
  }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// Qualquer consulta resolve sem linhas e sem erro: a lista vem vazia, e o
// UPDATE do status "afeta zero linhas", que é como a RLS recusa em silêncio.
jest.mock('@/lib/supabase', () => {
  const cadeia: unknown = new Proxy(() => undefined, {
    get: (_alvo, prop) =>
      prop === 'then'
        ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
        : () => cadeia,
    apply: () => cadeia,
  });
  return { supabase: { from: () => cadeia, rpc: () => cadeia } };
});
jest.mock('@/lib/queries/incidentes', () => ({
  fetchIncidentesForGestor: jest
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}));

// Os modais viram botões que disparam as props que a tela passa, como o toque.
jest.mock('@/components/gestor/incidentes', () => {
  const { Pressable, Text } = require('react-native');
  return {
    IncidenteDetalhesModal: ({
      onAlterarStatus,
    }: {
      onAlterarStatus: (i: unknown) => void;
    }) => (
      <Pressable
        testID="abrir-alterar-status"
        onPress={() => onAlterarStatus(mockIncidente)}
      >
        <Text>Alterar</Text>
      </Pressable>
    ),
    AlterarStatusModal: ({ onConfirmar }: { onConfirmar: () => void }) => (
      <Pressable testID="confirmar-status" onPress={onConfirmar}>
        <Text>Confirmar</Text>
      </Pressable>
    ),
    HistoricoMotoristaModal: () => null,
  };
});


describe('Incidentes (mobile): toast do hook dos modais', () => {
  it('UPDATE recusado pela RLS (zero linhas): o motivo aparece na tela', async () => {
    render(<Incidentes />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('abrir-alterar-status'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirmar-status'));
    });

    expect(
      screen.getByText(/O status não foi atualizado: este incidente não pode/),
    ).toBeTruthy();
  });
});
