/**
 * Perfil do motorista: editar nome e telefone com o motoristaEdicaoSchema —
 * erro no campo (não toast) e nada gravado quando inválido.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import MotoristaPerfil from '../motorista-perfil';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'motorista-1' }),
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
jest.mock('@/lib/gestor/performanceMotorista', () => ({
  buscarPerformanceMotorista: jest.fn().mockResolvedValue(null),
}));

const MOTORISTA = {
  id: 'motorista-1',
  nome: 'João Silva',
  email: 'joao@exemplo.com',
  telefone: null,
  foto_url: null,
  ativo: true,
  created_at: '2026-08-01T00:00:00Z',
};

const mockUpdate = jest.fn();

const mockUpdateUsuario = jest.fn();
const mockLog = jest.fn();
jest.mock('@/lib/queries', () => ({
  ...jest.requireActual('@/lib/queries'),
  updateUsuario: (...a: unknown[]) => mockUpdateUsuario(...a),
  logUserAction: (...a: unknown[]) => mockLog(...a),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        limit: () => Promise.resolve({ data: [], error: null }),
        single: () =>
          Promise.resolve(
            tabela === 'usuarios'
              ? { data: MOTORISTA, error: null }
              : { data: null, error: null },
          ),
        update: (dados: unknown) => {
          mockUpdate(tabela, dados);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return consulta;
    },
    rpc: jest.fn(),
  },
}));

async function abrirEdicao() {
  render(<MotoristaPerfil />);
  fireEvent.press(await screen.findByText('Editar'));
  await screen.findByText('Editar Motorista');
}

describe('MotoristaPerfil: editar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUsuario.mockResolvedValue({ success: true, data: {} });
  });

  it('telefone incompleto: erro no campo e nada gravado', async () => {
    await abrirEdicao();

    fireEvent.changeText(
      screen.getByLabelText('Campo de telefone do motorista'),
      '1199',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(
      await screen.findByText('Telefone deve ter 10 ou 11 dígitos'),
    ).toBeTruthy();
    expect(mockUpdateUsuario).not.toHaveBeenCalled();
  });

  it('nome com menos de 3 letras: erro no campo e nada gravado', async () => {
    await abrirEdicao();

    fireEvent.changeText(
      screen.getByLabelText('Campo de nome do motorista'),
      'Jo',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(
      await screen.findByText('Nome deve ter no mínimo 3 caracteres'),
    ).toBeTruthy();
    expect(mockUpdateUsuario).not.toHaveBeenCalled();
  });

  it('nome com parênteses (já cadastrado) trocando só o telefone grava', async () => {
    // 1 dos 7 motoristas em produção tem parênteses no nome; a regra do
    // cadastro do gestor (só letras) recusaria a edição dele.
    const nomeOriginal = MOTORISTA.nome;
    MOTORISTA.nome = 'Carlos (Moto)';
    try {
      await abrirEdicao();

      fireEvent.changeText(
        screen.getByLabelText('Campo de telefone do motorista'),
        '11999887766',
      );
      fireEvent.press(screen.getByText('Salvar'));

      await waitFor(() =>
        expect(mockUpdateUsuario).toHaveBeenCalledWith('motorista-1', {
          nome: 'Carlos (Moto)',
          telefone: '(11) 99988-7766',
        }),
      );
    } finally {
      MOTORISTA.nome = nomeOriginal;
    }
  });

  it('válido: grava nome e telefone mascarado', async () => {
    await abrirEdicao();

    fireEvent.changeText(
      screen.getByLabelText('Campo de telefone do motorista'),
      '11999887766',
    );
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() =>
      expect(mockUpdateUsuario).toHaveBeenCalledWith('motorista-1', {
        nome: 'João Silva',
        telefone: '(11) 99988-7766',
      }),
    );
    expect(
      await screen.findByText('Motorista atualizado com sucesso'),
    ).toBeTruthy();
  });

  it('telefone de outro motorista ativo mostra a mensagem específica, não "Não foi possível salvar"', async () => {
    mockUpdateUsuario.mockResolvedValue({
      success: false,
      error: {
        originalError: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
        },
      },
    });
    await abrirEdicao();

    fireEvent.changeText(
      screen.getByLabelText('Campo de telefone do motorista'),
      '11999887766',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(
      await screen.findByText(
        'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.',
      ),
    ).toBeTruthy();
  });

  it('editar grava motorista_editado', async () => {
    await abrirEdicao();

    fireEvent.changeText(
      screen.getByLabelText('Campo de telefone do motorista'),
      '11999887766',
    );
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() =>
      expect(mockLog).toHaveBeenCalledWith(
        'gestor-1',
        'motorista_editado',
        expect.objectContaining({ motorista_id: 'motorista-1' }),
      ),
    );
  });
});
