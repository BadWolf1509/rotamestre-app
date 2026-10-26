/**
 * Editar perfil do gestor: Zod com erro inline, UPDATE conferido (a RLS
 * recusa com zero linhas e sem erro), erro do servidor pelo errorMapping, e
 * Salvar/Cancelar voltam à tela anterior em vez de empilhar outro perfil.
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

import EditarPerfilGestor from '../editar';

// Router estável: um objeto novo a cada render refaria o carregamento do perfil.
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockIsDesktop = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockIsDesktop }),
}));

jest.mock('@/lib/auth', () => ({
  authService: { getSession: jest.fn(), getUsuario: jest.fn() },
}));

jest.mock('@/lib/profileEvents', () => ({ emitProfileUpdate: jest.fn() }));

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

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

function prepararUpdate(resultado: { data: unknown; error: unknown }) {
  const select = jest.fn().mockResolvedValue(resultado);
  const eq = jest.fn().mockReturnValue({ select });
  mockUpdate = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ update: mockUpdate });
}

async function abrirTela() {
  render(<EditarPerfilGestor />);
  await screen.findByPlaceholderText('Digite seu nome completo');
}

function salvar() {
  const botoes = screen.getAllByText(
    mockIsDesktop ? 'Salvar Alterações' : 'Salvar',
  );
  fireEvent.press(botoes[botoes.length - 1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDesktop = false;
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  mockAuth.getSession.mockResolvedValue({ user: { id: 'g1' } } as never);
  mockAuth.getUsuario.mockResolvedValue({
    id: 'g1',
    nome: 'Gestora Lima',
    email: 'gestora@rotamestre.com',
    telefone: '(11) 98888-7777',
  } as never);
  prepararUpdate({ data: [{ id: 'g1' }], error: null });
});

describe.each([false, true])(
  'editar perfil do gestor (desktop=%s)',
  (desktop) => {
    beforeEach(() => {
      mockIsDesktop = desktop;
    });

    it('nome vazio mostra o erro no campo e não grava', async () => {
      await abrirTela();
      fireEvent.changeText(
        screen.getByPlaceholderText('Digite seu nome completo'),
        '   ',
      );
      salvar();

      expect(await screen.findByText('O nome é obrigatório.')).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('telefone incompleto mostra o erro no campo e não grava', async () => {
      await abrirTela();
      fireEvent.changeText(
        screen.getByPlaceholderText('(11) 99999-9999'),
        '1199',
      );
      salvar();

      expect(
        await screen.findByText('Use o formato (11) 99999-9999.'),
      ).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('salva, avisa o app e, ao confirmar, volta à tela anterior', async () => {
      await abrirTela();
      salvar();

      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
      expect(emitProfileUpdate).toHaveBeenCalledTimes(1);
      const aoConfirmar = mockShowSuccess.mock.calls[0][2] as () => void;
      aoConfirmar();
      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('UPDATE sem linha alterada (RLS) mostra erro, não sucesso', async () => {
      prepararUpdate({ data: [], error: null });
      await abrirTela();
      salvar();

      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
      expect(mockShowSuccess).not.toHaveBeenCalled();
      expect(emitProfileUpdate).not.toHaveBeenCalled();
    });

    it('Cancelar volta à tela anterior, sem empilhar outro perfil', async () => {
      await abrirTela();
      fireEvent.press(screen.getByText('Cancelar'));

      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  },
);

it('erro do servidor não aparece cru ao gestor', async () => {
  prepararUpdate({
    data: null,
    error: { code: 'XX000', message: 'relation "usuarios" internal detail' },
  });
  await abrirTela();
  salvar();

  await waitFor(() => expect(mockShowError).toHaveBeenCalled());
  const { message } = mockShowError.mock.calls[0][0];
  expect(message).not.toMatch(/internal detail/);
});
