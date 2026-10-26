/**
 * Editar perfil do motorista: validação Zod inline e erro do servidor mapeado.
 * O erro do postgrest-js é objeto simples (não `instanceof Error`), então o
 * telefone duplicado caía em "Não foi possível salvar as alterações.".
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { emitProfileUpdate } from '@/lib/profileEvents';
import { supabase } from '@/lib/supabase';

import EditarPerfil from '../editar';

// Router estável: um objeto novo a cada render refaria o carregamento do perfil.
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/auth', () => ({
  authService: { getSession: jest.fn(), getUsuario: jest.fn() },
}));

jest.mock('@/lib/profileEvents', () => ({ emitProfileUpdate: jest.fn() }));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

// O Dialog real não desenha no Jest; as mensagens são lidas das chamadas.
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    AlertDialog: null,
  }),
}));

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockFrom = supabase.from as jest.Mock;

let mockUpdate: jest.Mock;
let mockEq: jest.Mock;

function prepararUpdate(resultado: { error: unknown }) {
  mockEq = jest.fn().mockResolvedValue(resultado);
  mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
}

async function abrirTela() {
  render(<EditarPerfil />);
  await screen.findByPlaceholderText('Digite seu nome completo');
}

beforeEach(() => {
  jest.clearAllMocks();
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  mockAuth.getSession.mockResolvedValue({ user: { id: 'm1' } } as never);
  mockAuth.getUsuario.mockResolvedValue({
    id: 'm1',
    nome: 'Maria Souza',
    email: 'maria@rotamestre.com',
    telefone: '(11) 98888-7777',
  } as never);
  prepararUpdate({ error: null });
});

describe('editar perfil do motorista', () => {
  it('telefone já usado por outro motorista mostra a frase do errorMapping', async () => {
    prepararUpdate({
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
      },
    });
    await abrirTela();

    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    const { title, message } = mockShowError.mock.calls[0][0];
    expect(title).toBe('Telefone já cadastrado');
    expect(message).toBe(
      'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.',
    );
    expect(emitProfileUpdate).not.toHaveBeenCalled();
  });

  it('nome vazio mostra o erro no campo e não grava', async () => {
    await abrirTela();

    fireEvent.changeText(
      screen.getByPlaceholderText('Digite seu nome completo'),
      '   ',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(await screen.findByText('O nome é obrigatório.')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('telefone incompleto mostra o erro no campo e não grava', async () => {
    await abrirTela();

    fireEvent.changeText(
      screen.getByPlaceholderText('(11) 99999-9999'),
      '1199',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(
      await screen.findByText('Use o formato (11) 99999-9999.'),
    ).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('salva, avisa o app (emitProfileUpdate) e mostra o sucesso', async () => {
    await abrirTela();

    fireEvent.changeText(
      screen.getByPlaceholderText('Digite seu nome completo'),
      '  Maria Santos ',
    );
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Maria Santos',
        telefone: '(11) 98888-7777',
      }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'm1');
    expect(emitProfileUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('editar perfil do motorista: volta ao perfil que já está embaixo', () => {
  it('depois de salvar, o OK do sucesso volta (não empilha outro perfil)', async () => {
    await abrirTela();
    fireEvent.press(screen.getByText('Salvar'));
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());

    const aoFechar = mockShowSuccess.mock.calls[0][2] as () => void;
    aoFechar();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('Cancelar volta (não empilha outro perfil)', async () => {
    await abrirTela();
    fireEvent.press(screen.getByText('Cancelar'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
