/**
 * Tela Motoristas: o formulário de criar valida pelo motoristaSchema — a
 * senha segue a regra única do passwordSchema (o placeholder a descreve), e
 * o erro aparece no campo, sem chamar a Edge Function.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import { supabase } from '@/lib/supabase';

import MotoristasGestor from '../motoristas';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'gestor-1', nome: 'Gestor' } }),
}));
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-ativa' }),
}));
jest.mock('@/hooks/useDesktopHeaderMenu', () => ({
  useDesktopHeaderMenu: () => ({
    userMenuTrigger: null,
    userMenuItems: [],
    logoutModal: null,
  }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

async function abrirCriacao() {
  render(<MotoristasGestor />);
  fireEvent.press(await screen.findByText('+ Novo Motorista'));
}

function preencher(campo: string, valor: string) {
  fireEvent.changeText(screen.getByLabelText(campo), valor);
}

describe('Motoristas: criar com Zod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('o placeholder da senha descreve a regra real (não "Mínimo 6")', async () => {
    await abrirCriacao();

    const senha = screen.getByLabelText('Campo de senha do motorista');
    expect(senha.props.placeholder).toBe(
      'Mín. 8 caracteres: maiúscula, minúscula, número e especial',
    );
    expect(screen.queryByPlaceholderText('Mínimo 6 caracteres')).toBeNull();
  });

  it('senha fraca: erro no campo e a Edge Function não é chamada', async () => {
    await abrirCriacao();

    preencher('Campo de nome do motorista', 'Carlos Eduardo');
    preencher('Campo de email do motorista', 'carlos@exemplo.com');
    preencher('Campo de senha do motorista', '123456');
    fireEvent.press(screen.getByText('Adicionar'));

    expect(
      await screen.findByText('Senha deve ter no mínimo 8 caracteres'),
    ).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('telefone recebe a máscara ao digitar', async () => {
    await abrirCriacao();

    preencher('Campo de telefone do motorista', '11999887766');

    await waitFor(() =>
      expect(
        screen.getByLabelText('Campo de telefone do motorista').props.value,
      ).toBe('(11) 99988-7766'),
    );
  });
});
