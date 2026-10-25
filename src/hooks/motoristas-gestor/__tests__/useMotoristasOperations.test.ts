/**
 * useMotoristasOperations - Tests
 *
 * Tests CRUD operations, loading, error handling, and toast feedback.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

import { useMotoristasOperations } from '../useMotoristasOperations';

import type { MotoristaDetalhado } from '../../useMotoristasGestor';

// ==========================================================================
// Mocks
// ==========================================================================

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: jest.fn(() => ({
    unidadeAtiva: 'unidade-123',
  })),
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({
    userData: { id: 'user-123', nome: 'Gestor Teste' },
  })),
}));

jest.mock('@/hooks/useToast', () => ({
  useToast: jest.fn(() => ({
    toast: { visible: false, message: '', type: 'success', duration: 3000 },
    showToast: jest.fn(),
    hideToast: jest.fn(),
    withToast: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  })),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUpdateUsuario = jest.fn();
const mockLogUserAction = jest.fn();

jest.mock('@/lib/queries', () => ({
  updateUsuario: (...args: unknown[]) => mockUpdateUsuario(...args),
  logUserAction: (...args: unknown[]) => mockLogUserAction(...args),
}));

jest.mock('@/lib/phone', () => ({
  maskPhone: jest.fn((text: string) => text),
  validatePhone: jest.fn(
    (phone: string) => phone.replace(/\D/g, '').length >= 10,
  ),
  getPhoneErrorMessage: jest.fn(() => null),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// RPCs da tela Motoristas: a lista e o toggle
const mockListar = jest.fn();
const mockAlternar = jest.fn();

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ==========================================================================
// Helpers
// ==========================================================================

const criarMotoristaMock = (
  overrides: Partial<MotoristaDetalhado> = {},
): MotoristaDetalhado => ({
  id: 'motorista-1',
  nome: 'João Silva',
  email: 'joao@example.com',
  telefone: '(11) 99999-9999',
  ativo: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const criarMockQueryBuilder = (data: unknown = [], error: unknown = null) => {
  const builder: Record<string, jest.Mock> = {} as Record<string, jest.Mock>;

  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'order',
    'limit',
    'range',
  ];
  chainMethods.forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });

  builder.returns = jest.fn().mockResolvedValue({ data, error });
  builder.single = jest.fn().mockResolvedValue({ data, error });
  builder.maybeSingle = jest.fn().mockResolvedValue({ data, error });

  return builder;
};

describe('useMotoristasOperations', () => {
  let mockQueryBuilder: ReturnType<typeof criarMockQueryBuilder>;
  let mockShowToast: jest.Mock;
  let mockWithToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-set hook mocks (clearAllMocks removes mockReturnValue implementations)
    (useUnidadeAtiva as jest.Mock).mockReturnValue({
      unidadeAtiva: 'unidade-123',
    });
    (useUser as jest.Mock).mockReturnValue({
      userData: { id: 'user-123', nome: 'Gestor Teste' },
    });

    mockQueryBuilder = criarMockQueryBuilder();
    (supabase.from as jest.Mock).mockImplementation(() => mockQueryBuilder);

    mockListar.mockResolvedValue({ data: [], error: null });
    mockAlternar.mockResolvedValue({ data: 'pessoa', error: null });
    (supabase.rpc as jest.Mock).mockImplementation(
      (fn: string, args: Record<string, unknown>) =>
        fn === 'listar_motoristas_unidade'
          ? mockListar(args)
          : mockAlternar(fn, args),
    );

    mockUpdateUsuario.mockResolvedValue({ success: true, data: {} });
    mockLogUserAction.mockResolvedValue(undefined);

    mockShowToast = jest.fn();
    mockWithToast = jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    });

    (useToast as jest.Mock).mockReturnValue({
      toast: { visible: false, message: '', type: 'success', duration: 3000 },
      showToast: mockShowToast,
      hideToast: jest.fn(),
      withToast: mockWithToast,
    });

    // Default: valid session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: { email: 'gestor@test.com' },
        },
      },
      error: null,
    });

    // Default: successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ id: 'new-motorista-1' })),
    });

    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  // ==========================================================================
  // Initialization and loading
  // ==========================================================================

  describe('initialization', () => {
    it('initializes with loading state', () => {
      const { result } = renderHook(() => useMotoristasOperations());

      expect(result.current.loading).toBe(true);
      expect(result.current.motoristas).toEqual([]);
      expect(result.current.totalMotoristas).toBe(0);
      expect(result.current.ativosMotoristas).toBe(0);
      expect(result.current.salvando).toBe(false);
    });

    it('loads motoristas on mount', async () => {
      const motoristas = [
        criarMotoristaMock({ id: 'mot-1', nome: 'Ana' }),
        criarMotoristaMock({ id: 'mot-2', nome: 'Carlos' }),
      ];

      mockListar.mockResolvedValue({ data: motoristas, error: null });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(2);
      // Sorted alphabetically
      expect(result.current.motoristas[0].nome).toBe('Ana');
      expect(result.current.motoristas[1].nome).toBe('Carlos');
    });

    it('computes totalMotoristas and ativosMotoristas', async () => {
      const motoristas = [
        criarMotoristaMock({ id: 'mot-1', ativo: true }),
        criarMotoristaMock({ id: 'mot-2', ativo: false }),
        criarMotoristaMock({ id: 'mot-3', ativo: true }),
      ];

      mockListar.mockResolvedValue({ data: motoristas, error: null });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalMotoristas).toBe(3);
      expect(result.current.ativosMotoristas).toBe(2);
    });

    it('does not load if unidadeAtiva is null', async () => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: null });

      renderHook(() => useMotoristasOperations());

      // Wait a tick to confirm the list was not requested
      await new Promise((r) => setTimeout(r, 50));

      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('shows error toast on load failure', async () => {
      mockListar.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Não foi possível carregar os motoristas',
        'error',
      );
    });

    it('loads from the RPC of the active unit (includes inactive links)', async () => {
      mockListar.mockResolvedValue({
        data: [criarMotoristaMock({ id: 'mot-1', ativo: false })],
        error: null,
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(supabase.rpc).toHaveBeenCalledWith('listar_motoristas_unidade', {
        p_unidade_id: 'unidade-123',
      });
      expect(supabase.from).not.toHaveBeenCalledWith('usuario_unidades');
      expect(result.current.motoristas).toHaveLength(1);
      expect(result.current.ativosMotoristas).toBe(0);
    });
  });

  // ==========================================================================
  // adicionarMotorista
  // ==========================================================================

  describe('adicionarMotorista', () => {
    const validFormData = {
      nome: 'Novo Motorista',
      email: 'novo@test.com',
      telefone: '',
      senha: 'senha123',
    };

    it('validates required fields - empty nome', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(
          { ...validFormData, nome: '' },
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error',
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('validates required fields - empty email', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(
          { ...validFormData, email: '' },
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error',
      );
    });

    it('validates required fields - empty senha', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(
          { ...validFormData, senha: '' },
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error',
      );
    });

    it('validates email format', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(
          { ...validFormData, email: 'invalid-email' },
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Digite um email válido',
        'error',
      );
    });

    it('validates phone when provided', async () => {
      const { validatePhone } = require('@/lib/phone');
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(
          { ...validFormData, telefone: '123' },
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith('Telefone inválido', 'error');
    });

    it('creates motorista via edge function on success', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(validFormData, onSuccess);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/criar-motorista',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
          body: JSON.stringify({
            nome: 'Novo Motorista',
            email: 'novo@test.com',
            senha: 'senha123',
            telefone: null,
            // a loja aberta na tela, não a principal do gestor
            unidade_id: 'unidade-123',
          }),
        }),
      );

      expect(onSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista adicionado com sucesso!',
        'success',
      );
    });

    it('logs user action after successful creation', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adicionarMotorista(validFormData, jest.fn());
      });

      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_criado',
        {
          motorista_nome: 'Novo Motorista',
          motorista_email: 'novo@test.com',
        },
      );
    });

    it('handles session error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adicionarMotorista(validFormData, jest.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao obter sessão'),
        'error',
      );
    });

    it('handles missing session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adicionarMotorista(validFormData, jest.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('sessão expirou'),
        'error',
      );
    });

    it('handles network error on fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adicionarMotorista(validFormData, jest.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Erro de conexão'),
        'error',
      );
    });

    it('shows the edge function text when the email already has an account (409)', async () => {
      const msg =
        'Este e-mail já tem uma conta no RotaMestre. Para usar o mesmo motorista em mais de uma loja, fale com o suporte.';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: jest
          .fn()
          .mockResolvedValue(
            JSON.stringify({ error: msg, codigo: 'email_ja_cadastrado' }),
          ),
      });

      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(validFormData, onSuccess);
      });

      expect(mockShowToast).toHaveBeenCalledWith(msg, 'error');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('shows the edge function error text on duplicate phone (409)', async () => {
      const texto =
        'Este motorista já usa o RotaMestre em outra loja. Cadastre-o com o e-mail da conta dele para vinculá-lo à sua loja.';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: jest
          .fn()
          .mockResolvedValue(
            JSON.stringify({ error: texto, codigo: 'telefone_ja_cadastrado' }),
          ),
      });

      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(validFormData, onSuccess);
      });

      expect(mockShowToast).toHaveBeenCalledWith(texto, 'error');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('handles non-ok response from edge function', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: jest
          .fn()
          .mockResolvedValue(JSON.stringify({ error: 'Email já existe' })),
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.adicionarMotorista(validFormData, onSuccess);
      });

      expect(mockShowToast).toHaveBeenCalledWith('Email já existe', 'error');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('handles invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('not json {{{'),
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.adicionarMotorista(validFormData, jest.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('resposta inválida'),
        'error',
      );
    });

    it('sets salvando during operation', async () => {
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      mockFetch.mockReturnValue(fetchPromise);

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Start operation (don't await)
      let addPromise: Promise<void>;
      act(() => {
        addPromise = result.current.adicionarMotorista(
          validFormData,
          jest.fn(),
        );
      });

      // salvando should be true while waiting
      expect(result.current.salvando).toBe(true);

      // Resolve fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify({ id: 'new-1' })),
        });
        await addPromise!;
      });

      expect(result.current.salvando).toBe(false);
    });
  });

  // ==========================================================================
  // editarMotorista
  // ==========================================================================

  describe('editarMotorista', () => {
    const validEditData = {
      nome: 'João Atualizado',
      email: 'joao.updated@test.com',
      telefone: '',
      senha: '',
    };

    it('validates required fields - empty nome', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.editarMotorista(
          { ...validEditData, nome: '' },
          'motorista-1',
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error',
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.editarMotorista(
          { ...validEditData, email: 'bad-email' },
          'motorista-1',
          jest.fn(),
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Digite um email válido',
        'error',
      );
    });

    it('validates phone when provided', async () => {
      const { validatePhone } = require('@/lib/phone');
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.editarMotorista(
          { ...validEditData, telefone: '123' },
          'motorista-1',
          jest.fn(),
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith('Telefone inválido', 'error');
    });

    it('updates motorista via updateUsuario on success', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.editarMotorista(
          validEditData,
          'motorista-1',
          onSuccess,
        );
      });

      expect(mockUpdateUsuario).toHaveBeenCalledWith('motorista-1', {
        nome: 'João Atualizado',
        email: 'joao.updated@test.com',
        telefone: null,
      });

      expect(onSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista atualizado com sucesso!',
        'success',
      );
    });

    it('logs user action after successful edit', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.editarMotorista(
          validEditData,
          'motorista-1',
          jest.fn(),
        );
      });

      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_editado',
        {
          motorista_id: 'motorista-1',
          motorista_nome: 'João Atualizado',
        },
      );
    });

    it('maps the unique-phone index violation to a friendly toast', async () => {
      mockUpdateUsuario.mockResolvedValue({
        success: false,
        error: {
          type: 'validation',
          code: '23505',
          message:
            'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
          originalError: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
          },
        },
      });

      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.editarMotorista(
          validEditData,
          'motorista-1',
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.',
        'error',
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('handles updateUsuario failure', async () => {
      mockUpdateUsuario.mockResolvedValue({
        success: false,
        error: { message: 'Email duplicado' },
      });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.editarMotorista(
          validEditData,
          'motorista-1',
          onSuccess,
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith('Email duplicado', 'error');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('sets salvando during edit operation', async () => {
      let resolveUpdate: (value: unknown) => void;
      mockUpdateUsuario.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      let editPromise: Promise<void>;
      act(() => {
        editPromise = result.current.editarMotorista(
          validEditData,
          'motorista-1',
          jest.fn(),
        );
      });

      expect(result.current.salvando).toBe(true);

      await act(async () => {
        resolveUpdate!({ success: true, data: {} });
        await editPromise!;
      });

      expect(result.current.salvando).toBe(false);
    });

    it('does not log action when userData is null', async () => {
      (useUser as jest.Mock).mockReturnValue({ userData: null });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.editarMotorista(
          validEditData,
          'motorista-1',
          jest.fn(),
        );
      });

      expect(mockLogUserAction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // confirmarToggleAtivo
  // ==========================================================================

  describe('confirmarToggleAtivo', () => {
    it('deactivates an active motorista', async () => {
      const motorista = criarMotoristaMock({ ativo: true });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, onSuccess);
      });

      expect(mockAlternar).toHaveBeenCalledWith(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: 'motorista-1',
          p_unidade_id: 'unidade-123',
          p_ativo: false,
        },
      );
      expect(mockUpdateUsuario).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    it('activates an inactive motorista', async () => {
      const motorista = criarMotoristaMock({ ativo: false });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, onSuccess);
      });

      expect(mockAlternar).toHaveBeenCalledWith(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: 'motorista-1',
          p_unidade_id: 'unidade-123',
          p_ativo: true,
        },
      );
      expect(onSuccess).toHaveBeenCalled();
    });

    it('uses withToast for feedback messages', async () => {
      const motorista = criarMotoristaMock({ ativo: true });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, jest.fn());
      });

      expect(mockWithToast).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          loading: 'Desativando motorista...',
          success: 'Motorista desativado com sucesso!',
          error: expect.any(Function),
        }),
      );
    });

    it('uses activation messages for inactive motorista', async () => {
      const motorista = criarMotoristaMock({ ativo: false });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, jest.fn());
      });

      expect(mockWithToast).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          loading: 'Ativando motorista...',
          success: 'Motorista ativado com sucesso!',
        }),
      );
    });

    it('logs action after successful toggle', async () => {
      const motorista = criarMotoristaMock({ ativo: true, nome: 'João' });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, jest.fn());
      });

      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_desativado',
        { motorista_id: 'motorista-1', motorista_nome: 'João' },
      );
    });

    it('maps the unique-phone error through withToast (single toast)', async () => {
      const erroTelefone = {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"',
      };
      mockAlternar.mockResolvedValue({ data: null, error: erroTelefone });
      mockWithToast.mockImplementation(async (fn: () => Promise<void>) => {
        await fn();
      });
      mockShowToast.mockClear();

      const motorista = criarMotoristaMock({ ativo: false });
      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, onSuccess);
      });

      const opcoes = mockWithToast.mock.calls.at(-1)?.[1] as {
        error: (e: unknown) => string;
      };
      expect(opcoes.error(erroTelefone)).toBe(
        'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.',
      );
      expect(opcoes.error(new Error('outro'))).toBe(
        'Não foi possível alterar o status do motorista',
      );
      // regra de negócio do banco (P0001) chega ao gestor como foi escrita
      expect(
        opcoes.error({
          code: 'P0001',
          message:
            'Este motorista também atende outra loja e está desativado. Para reativá-lo, fale com o suporte.',
        }),
      ).toBe(
        'Este motorista também atende outra loja e está desativado. Para reativá-lo, fale com o suporte.',
      );
      // o catch não mostra um segundo toast
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('desativação recusada por rota aberta abre a lista de rotas, sem sucesso', async () => {
      const erroRotaAberta = {
        code: 'P0001',
        message:
          'Não dá para desativar: este motorista tem 3 rotas abertas nesta loja. Reatribua a outro motorista ou cancele antes de desativar.',
        details: JSON.stringify([
          { id: 'r-and', data: '2026-10-24', status: 'em_andamento' },
          { id: 'r-p1', data: '2026-10-25', status: 'pendente' },
          { id: 'r-p2', data: '2026-10-26', status: 'pendente' },
        ]),
        hint: 'MOTORISTA_COM_ROTA_ABERTA',
      };
      mockAlternar.mockResolvedValue({ data: null, error: erroRotaAberta });
      const mockHideToast = jest.fn();
      (useToast as jest.Mock).mockReturnValue({
        toast: { visible: false, message: '', type: 'success', duration: 3000 },
        showToast: mockShowToast,
        hideToast: mockHideToast,
        withToast: mockWithToast,
      });

      const motorista = criarMotoristaMock({ ativo: true, nome: 'João' });
      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.confirmarToggleAtivo(motorista, onSuccess);
      });

      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockLogUserAction).not.toHaveBeenCalled();
      expect(result.current.bloqueioDesativacao).toEqual({
        nomeMotorista: 'João',
        rotas: [
          { id: 'r-and', data: '2026-10-24', status: 'em_andamento' },
          { id: 'r-p1', data: '2026-10-25', status: 'pendente' },
          { id: 'r-p2', data: '2026-10-26', status: 'pendente' },
        ],
      });
      // o aviso com a lista substitui o toast de erro
      expect(mockHideToast).toHaveBeenCalled();

      act(() => result.current.fecharBloqueioDesativacao());
      expect(result.current.bloqueioDesativacao).toBeNull();
    });

    it('erro comum não abre a lista de rotas', async () => {
      mockAlternar.mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'outra regra' },
      });
      const { result } = renderHook(() => useMotoristasOperations());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.confirmarToggleAtivo(
          criarMotoristaMock(),
          jest.fn(),
        );
      });

      expect(result.current.bloqueioDesativacao).toBeNull();
    });

    it('does nothing without an active unit', async () => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: null });
      const { result } = renderHook(() => useMotoristasOperations());

      const onSuccess = jest.fn();
      await act(async () => {
        await result.current.confirmarToggleAtivo(
          criarMotoristaMock(),
          onSuccess,
        );
      });

      expect(mockAlternar).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('handles RPC failure in toggle', async () => {
      mockAlternar.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      // withToast should propagate the error
      mockWithToast.mockImplementation(async (fn: () => Promise<void>) => {
        await fn();
      });

      const motorista = criarMotoristaMock({ ativo: true });

      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const onSuccess = jest.fn();

      // The error is caught inside the hook, so it won't throw
      await act(async () => {
        try {
          await result.current.confirmarToggleAtivo(motorista, onSuccess);
        } catch {
          // Expected - withToast may throw
        }
      });

      // onSuccess should not be called since the RPC failed
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Toast state
  // ==========================================================================

  describe('toast state', () => {
    it('exposes toastState from useToast', () => {
      const { result } = renderHook(() => useMotoristasOperations());

      expect(result.current.toastState).toEqual({
        visible: false,
        message: '',
        type: 'success',
        duration: 3000,
      });
    });

    it('exposes showToast and hideToast', () => {
      const { result } = renderHook(() => useMotoristasOperations());

      expect(typeof result.current.showToast).toBe('function');
      expect(typeof result.current.hideToast).toBe('function');
    });
  });

  // ==========================================================================
  // loadMotoristas manual call
  // ==========================================================================

  describe('loadMotoristas', () => {
    it('can be called manually to refresh data', async () => {
      const { result } = renderHook(() => useMotoristasOperations());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Reset call count after initial load
      (supabase.rpc as jest.Mock).mockClear();
      mockListar.mockResolvedValue({
        data: [criarMotoristaMock({ id: 'mot-new', nome: 'Novo' })],
        error: null,
      });

      await act(async () => {
        await result.current.loadMotoristas();
      });

      expect(supabase.rpc).toHaveBeenCalledWith('listar_motoristas_unidade', {
        p_unidade_id: 'unidade-123',
      });
      expect(result.current.motoristas).toHaveLength(1);
    });
  });
});
