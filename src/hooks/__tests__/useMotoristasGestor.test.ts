import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

import {
  useMotoristasGestor,
  MotoristaDetalhado,
} from '../useMotoristasGestor';

// Mock dependencies
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

// RPCs da tela Motoristas: a lista e o toggle
const mockListar = jest.fn();
const mockAlternar = jest.fn();

// Mock centralized queries
const mockUpdateUsuario = jest.fn();
const mockLogUserAction = jest.fn();

jest.mock('@/lib/queries', () => ({
  updateUsuario: (...args: unknown[]) => mockUpdateUsuario(...args),
  logUserAction: (...args: unknown[]) => mockLogUserAction(...args),
}));

// Telefone sem mock: a validação é a do schema real (motoristaSchema).

/** Erro do campo lido do estado do form (o formState é proxy de render). */
function erroDe<C extends string>(
  form: { getFieldState: (nome: C) => { error?: { message?: string } } },
  campo: C,
) {
  return form.getFieldState(campo).error?.message;
}

// Helper para criar motorista mock
const criarMotoristaMock = (
  overrides: Partial<MotoristaDetalhado> = {},
): MotoristaDetalhado => ({
  id: 'motorista-1',
  nome: 'João Silva',
  email: 'joao@example.com',
  telefone: '(11) 99999-9999',
  foto_url: undefined,
  ativo: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Helper para criar mock do query builder do Supabase
const criarMockQueryBuilder = () => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  return builder;
};

describe('useMotoristasGestor Hook', () => {
  let mockQueryBuilder: ReturnType<typeof criarMockQueryBuilder>;
  let mockShowToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder = criarMockQueryBuilder();
    (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

    mockListar.mockResolvedValue({ data: [], error: null });
    mockAlternar.mockResolvedValue({ data: 'pessoa', error: null });
    // O mock global do supabase não traz `rpc`
    (supabase as unknown as { rpc: jest.Mock }).rpc = jest.fn(
      (fn: string, args: Record<string, unknown>) =>
        fn === 'listar_motoristas_unidade'
          ? mockListar(args)
          : mockAlternar(fn, args),
    );

    // Reset centralized query mocks
    mockUpdateUsuario.mockReset();
    mockUpdateUsuario.mockResolvedValue({ success: true, data: {} });
    mockLogUserAction.mockReset();
    mockLogUserAction.mockResolvedValue(undefined);

    // Recapturar mockShowToast
    mockShowToast = jest.fn();
    (useToast as jest.Mock).mockReturnValue({
      toast: { visible: false, message: '', type: 'success', duration: 3000 },
      showToast: mockShowToast,
      hideToast: jest.fn(),
      withToast: jest.fn(async (fn: () => Promise<void>, _messages: any) => {
        await fn();
      }),
    });
  });

  // ============================================================================
  // Testes de Inicializacao
  // ============================================================================

  describe('Inicializacao', () => {
    it('deve inicializar com estado de loading', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      expect(result.current.loading).toBe(true);
      expect(result.current.motoristas).toEqual([]);
      expect(result.current.totalMotoristas).toBe(0);
      expect(result.current.ativosMotoristas).toBe(0);
    });

    it('deve inicializar com modais fechados', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      expect(result.current.showAddModal).toBe(false);
      expect(result.current.showEditModal).toBe(false);
      expect(result.current.showConfirmModal).toBe(false);
      expect(result.current.motoristaEditando).toBeNull();
      expect(result.current.motoristaParaToggle).toBeNull();
    });

    it('deve inicializar com formulario vazio', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      expect(result.current.formCriar.getValues()).toEqual({
        nome: '',
        email: '',
        telefone: '',
        senha: '',
      });
      expect(result.current.formEditar.getValues()).toEqual({
        nome: '',
        telefone: '',
      });
    });

    it('deve exportar todas as funcoes necessarias', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      expect(typeof result.current.loadMotoristas).toBe('function');
      expect(typeof result.current.abrirModalAdicionar).toBe('function');
      expect(typeof result.current.abrirModalEditar).toBe('function');
      expect(typeof result.current.adicionarMotorista).toBe('function');
      expect(typeof result.current.editarMotorista).toBe('function');
      expect(typeof result.current.toggleAtivo).toBe('function');
      expect(typeof result.current.confirmarToggleAtivo).toBe('function');
      expect(typeof result.current.resetFormulario).toBe('function');
      expect(result.current.formCriar).toBeDefined();
      expect(result.current.formEditar).toBeDefined();
    });
  });

  // ============================================================================
  // Testes de Carregamento de Motoristas
  // ============================================================================

  describe('Carregamento de Motoristas', () => {
    it('deve carregar motoristas automaticamente ao montar', async () => {
      const motoristas = [
        criarMotoristaMock({ id: '1', nome: 'Ana' }),
        criarMotoristaMock({ id: '2', nome: 'Bruno' }),
      ];

      mockListar.mockResolvedValue({ data: motoristas, error: null });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(2);
      expect(result.current.totalMotoristas).toBe(2);
    });

    it('deve ordenar motoristas por nome', async () => {
      const motoristas = [
        criarMotoristaMock({ id: '1', nome: 'Zeca' }),
        criarMotoristaMock({ id: '2', nome: 'Ana' }),
        criarMotoristaMock({ id: '3', nome: 'Maria' }),
      ];

      mockListar.mockResolvedValue({ data: motoristas, error: null });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas[0].nome).toBe('Ana');
      expect(result.current.motoristas[1].nome).toBe('Maria');
      expect(result.current.motoristas[2].nome).toBe('Zeca');
    });

    it('deve calcular motoristas ativos corretamente', async () => {
      const motoristas = [
        criarMotoristaMock({ id: '1', nome: 'Ana', ativo: true }),
        criarMotoristaMock({ id: '2', nome: 'Bruno', ativo: false }),
        criarMotoristaMock({ id: '3', nome: 'Carlos', ativo: true }),
      ];

      mockListar.mockResolvedValue({ data: motoristas, error: null });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalMotoristas).toBe(3);
      expect(result.current.ativosMotoristas).toBe(2);
    });

    it('deve exibir toast de erro quando falha ao carregar', async () => {
      mockListar.mockResolvedValue({
        data: null,
        error: { message: 'Erro de conexao' },
      });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Não foi possível carregar os motoristas',
        'error',
      );
    });

    it('nao deve carregar se nao houver unidade ativa', async () => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: null });

      const { result: _result } = renderHook(() => useMotoristasGestor());

      // Aguardar um tick para garantir que o useEffect foi executado
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Testes de Controle de Modais
  // ============================================================================

  describe('Controle de Modais', () => {
    // Vínculo inativo nesta loja (motorista que atende outra): a RLS de
    // usuarios o esconde, então perfil e edição falhariam com erro genérico.
    const MSG_VINCULO_INATIVO =
      'Este motorista está desativado nesta loja. Ative-o para ver o perfil ou editar.';

    it('nao abre a edicao de motorista com vinculo inativo nesta loja', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(
          criarMotoristaMock({ ativo: false, vinculo_ativo: false }),
        );
      });

      expect(result.current.showEditModal).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(MSG_VINCULO_INATIVO, 'info');
    });

    it('avisarSeVinculoInativo bloqueia so o vinculo inativo', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      let bloqueado = false;
      act(() => {
        bloqueado = result.current.avisarSeVinculoInativo(
          criarMotoristaMock({ vinculo_ativo: false }),
        );
      });
      expect(bloqueado).toBe(true);
      expect(mockShowToast).toHaveBeenCalledWith(MSG_VINCULO_INATIVO, 'info');

      mockShowToast.mockClear();
      act(() => {
        bloqueado = result.current.avisarSeVinculoInativo(
          criarMotoristaMock({ ativo: false, vinculo_ativo: true }),
        );
      });
      expect(bloqueado).toBe(false);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('deve abrir modal de adicionar e resetar formulario', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      // Preencher formulario primeiro
      act(() => {
        result.current.formCriar.setValue('nome', 'Teste');
        result.current.formCriar.setValue('email', 'teste@test.com');
      });

      // Abrir modal
      act(() => {
        result.current.abrirModalAdicionar();
      });

      expect(result.current.showAddModal).toBe(true);
      expect(result.current.formCriar.getValues('nome')).toBe('');
      expect(result.current.formCriar.getValues('email')).toBe('');
    });

    it('deve abrir modal de editar e preencher formulario com dados do motorista', () => {
      const motorista = criarMotoristaMock({
        id: 'motorista-1',
        nome: 'Joao',
        email: 'joao@test.com',
        telefone: '(11) 99999-9999',
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(motorista);
      });

      expect(result.current.showEditModal).toBe(true);
      expect(result.current.motoristaEditando).toEqual(motorista);
      // E-mail não entra no form de edição (não é editável).
      expect(result.current.formEditar.getValues()).toEqual({
        nome: 'Joao',
        telefone: '(11) 99999-9999',
      });
    });

    it('deve controlar setShowAddModal', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setShowAddModal(true);
      });

      expect(result.current.showAddModal).toBe(true);

      act(() => {
        result.current.setShowAddModal(false);
      });

      expect(result.current.showAddModal).toBe(false);
    });

    it('deve controlar setShowEditModal', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setShowEditModal(true);
      });

      expect(result.current.showEditModal).toBe(true);
    });

    it('deve controlar setShowConfirmModal', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setShowConfirmModal(true);
      });

      expect(result.current.showConfirmModal).toBe(true);
    });
  });

  // ============================================================================
  // Testes de Formulario
  // ============================================================================

  describe('Formulario', () => {
    it('deve resetar formulario corretamente', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      // Preencher campos
      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@test.com');
        result.current.formCriar.setValue('telefone', '11999999999');
        result.current.formCriar.setValue('senha', 'senha');
      });

      // Resetar
      act(() => {
        result.current.resetFormulario();
      });

      expect(result.current.formCriar.getValues()).toEqual({
        nome: '',
        email: '',
        telefone: '',
        senha: '',
      });
    });
  });

  // ============================================================================
  // Testes de Adicionar Motorista
  // ============================================================================

  describe('Adicionar Motorista', () => {
    beforeEach(() => {
      // Reset do mock de unidade ativa
      (useUnidadeAtiva as jest.Mock).mockReturnValue({
        unidadeAtiva: 'unidade-123',
      });
      (useUser as jest.Mock).mockReturnValue({
        userData: { id: 'user-123', nome: 'Gestor Teste' },
      });
    });

    it('campos vazios: erro em cada campo, sem toast e sem Edge Function', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(erroDe(result.current.formCriar, 'nome')).toBeDefined();
      expect(erroDe(result.current.formCriar, 'email')).toBe(
        'E-mail é obrigatório',
      );
      expect(erroDe(result.current.formCriar, 'senha')).toBeDefined();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('senha fraca: não chama a Edge Function e o erro fica no campo (não toast)', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Novo Motorista');
        result.current.formCriar.setValue('email', 'motorista@teste.com');
        result.current.formCriar.setValue('senha', '123456');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(erroDe(result.current.formCriar, 'senha')).toBe(
        'Senha deve ter no mínimo 8 caracteres',
      );
      expect(global.fetch).not.toHaveBeenCalled();
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('deve exibir erro quando sessao nao existe', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sua sessão expirou. Por favor, faça login novamente.',
        'error',
      );
    });

    it('deve exibir erro quando getSession falha', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' },
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao obter sessão'),
        'error',
      );
    });

    it('deve chamar Edge Function com dados corretos', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { email: 'gestor@test.com' },
          },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Novo Motorista');
        result.current.formCriar.setValue('email', 'motorista@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
        result.current.formCriar.setValue('telefone', '(11) 99999-9999');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/criar-motorista'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({
            nome: 'Novo Motorista',
            email: 'motorista@teste.com',
            senha: 'Abcdef1!',
            telefone: '(11) 99999-9999',
            unidade_id: 'unidade-123',
          }),
        }),
      );
    });

    it('deve exibir toast de sucesso e fechar modal ao criar motorista', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
        result.current.setShowAddModal(true);
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista adicionado com sucesso!',
        'success',
      );
      expect(result.current.showAddModal).toBe(false);
    });

    it('deve exibir erro quando fetch falha', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch'),
      );

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sem conexão. Tente de novo.',
        'error',
      );
    });

    it('deve exibir erro quando resposta nao e ok', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest
          .fn()
          .mockResolvedValue(JSON.stringify({ error: 'Email ja existe' })),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Email ja existe', 'error');
    });

    it('deve gerenciar estado de salvando durante adicao', async () => {
      let resolveSession: any;
      (supabase.auth.getSession as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
      );

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      // Iniciar adicao
      let addPromise: Promise<void>;
      act(() => {
        addPromise = result.current.adicionarMotorista();
      });

      // Verificar que esta salvando (o handleSubmit valida antes, assíncrono)
      await waitFor(() => expect(result.current.salvando).toBe(true));

      // Resolver session (sem sessao para terminar o fluxo)
      await act(async () => {
        resolveSession({ data: { session: null }, error: null });
        await addPromise;
      });

      expect(result.current.salvando).toBe(false);
    });
  });

  // ============================================================================
  // Testes de Editar Motorista
  // ============================================================================

  describe('Editar Motorista', () => {
    beforeEach(() => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({
        unidadeAtiva: 'unidade-123',
      });
      (useUser as jest.Mock).mockReturnValue({
        userData: { id: 'user-123', nome: 'Gestor Teste' },
      });
    });

    it('deve exibir erro quando campos obrigatorios estao vazios', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
      });
      act(() => {
        result.current.formEditar.setValue('nome', '');
        result.current.formEditar.setValue('telefone', '(11) 9');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      expect(erroDe(result.current.formEditar, 'nome')).toBeDefined();
      expect(erroDe(result.current.formEditar, 'telefone')).toBe(
        'Telefone deve ter 10 ou 11 dígitos',
      );
      expect(mockUpdateUsuario).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('deve atualizar motorista com sucesso', async () => {
      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const motorista = criarMotoristaMock({ id: 'motorista-edit' });

      act(() => {
        result.current.abrirModalEditar(motorista);
      });
      act(() => {
        result.current.formEditar.setValue('nome', 'Nome Atualizado');
        result.current.formEditar.setValue('telefone', '');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      // Now uses centralized updateUsuario
      // E-mail não é editável: não vai no update.
      expect(mockUpdateUsuario).toHaveBeenCalledWith('motorista-edit', {
        nome: 'Nome Atualizado',
        telefone: null,
      });
      // And logs via centralized logUserAction
      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_editado',
        expect.objectContaining({
          motorista_id: 'motorista-edit',
          motorista_nome: 'Nome Atualizado',
        }),
      );
      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista atualizado com sucesso!',
        'success',
      );
      expect(result.current.showEditModal).toBe(false);
      expect(result.current.motoristaEditando).toBeNull();
    });

    it('deve exibir erro quando atualizacao falha', async () => {
      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Configure centralized update to fail
      mockUpdateUsuario.mockResolvedValue({
        success: false,
        error: { message: 'Update failed' },
      });

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      // O hook mostra a mensagem do erro se disponivel, ou a mensagem generica
      expect(mockShowToast).toHaveBeenCalledWith('Update failed', 'error');
    });

    it('deve gerenciar estado de salvando durante edicao', async () => {
      // Configure centralized update to return pending promise
      let resolveUpdate: (value: any) => void;
      mockUpdateUsuario.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );

      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
      });

      let editPromise: Promise<void>;
      act(() => {
        editPromise = result.current.editarMotorista();
      });

      await waitFor(() => expect(result.current.salvando).toBe(true));

      await act(async () => {
        resolveUpdate!({ success: false, error: { message: 'Error' } });
        await editPromise;
      });

      expect(result.current.salvando).toBe(false);
    });
  });

  // ============================================================================
  // Testes de Toggle Ativo
  // ============================================================================

  describe('Toggle Ativo', () => {
    beforeEach(() => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({
        unidadeAtiva: 'unidade-123',
      });
      (useUser as jest.Mock).mockReturnValue({
        userData: { id: 'user-123', nome: 'Gestor Teste' },
      });
    });

    it('deve abrir modal de confirmacao ao chamar toggleAtivo', () => {
      const { result } = renderHook(() => useMotoristasGestor());
      const motorista = criarMotoristaMock();

      act(() => {
        result.current.toggleAtivo(motorista);
      });

      expect(result.current.showConfirmModal).toBe(true);
      expect(result.current.motoristaParaToggle).toEqual(motorista);
    });

    it('deve desativar motorista ao confirmar', async () => {
      const mockWithToast = jest.fn(async (fn: () => Promise<void>) => {
        await fn();
      });

      (useToast as jest.Mock).mockReturnValue({
        toast: { visible: false, message: '', type: 'success', duration: 3000 },
        showToast: mockShowToast,
        hideToast: jest.fn(),
        withToast: mockWithToast,
      });

      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const motorista = criarMotoristaMock({ ativo: true });

      act(() => {
        result.current.toggleAtivo(motorista);
      });

      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      expect(mockAlternar).toHaveBeenCalledWith(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: motorista.id,
          p_unidade_id: 'unidade-123',
          p_ativo: false,
        },
      );
      expect(result.current.showConfirmModal).toBe(false);
      expect(result.current.motoristaParaToggle).toBeNull();
    });

    it('deve ativar motorista ao confirmar', async () => {
      const mockWithToast = jest.fn(async (fn: () => Promise<void>) => {
        await fn();
      });

      (useToast as jest.Mock).mockReturnValue({
        toast: { visible: false, message: '', type: 'success', duration: 3000 },
        showToast: mockShowToast,
        hideToast: jest.fn(),
        withToast: mockWithToast,
      });

      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const motorista = criarMotoristaMock({ ativo: false });

      act(() => {
        result.current.toggleAtivo(motorista);
      });

      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      expect(mockAlternar).toHaveBeenCalledWith(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: motorista.id,
          p_unidade_id: 'unidade-123',
          p_ativo: true,
        },
      );
    });

    it('desativar com rota aberta expõe a lista para a tela, e fechar limpa', async () => {
      mockAlternar.mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message:
            'Não dá para desativar: este motorista tem 1 rota aberta nesta loja.',
          details: '[{"id":"r1","data":"2026-10-24","status":"em_andamento"}]',
          hint: 'MOTORISTA_COM_ROTA_ABERTA',
        },
      });
      const { result } = renderHook(() => useMotoristasGestor());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.toggleAtivo(
          criarMotoristaMock({ ativo: true, nome: 'Joao' }),
        );
      });
      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      expect(result.current.bloqueioDesativacao).toEqual({
        nomeMotorista: 'Joao',
        rotas: [{ id: 'r1', data: '2026-10-24', status: 'em_andamento' }],
      });
      act(() => result.current.fecharBloqueioDesativacao());
      expect(result.current.bloqueioDesativacao).toBeNull();
    });

    it('nao deve fazer nada se nao houver motoristaParaToggle', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      // nada é gravado quando não há motorista selecionado
      expect(mockUpdateUsuario).not.toHaveBeenCalled();
      expect(mockAlternar).not.toHaveBeenCalled();
    });

    it('deve criar log ao alterar status do motorista', async () => {
      const mockWithToast = jest.fn(async (fn: () => Promise<void>) => {
        await fn();
      });

      (useToast as jest.Mock).mockReturnValue({
        toast: { visible: false, message: '', type: 'success', duration: 3000 },
        showToast: mockShowToast,
        hideToast: jest.fn(),
        withToast: mockWithToast,
      });

      // Primeiro deixar carregar motoristas inicialmente
      const initialBuilder = criarMockQueryBuilder();
      initialBuilder.returns.mockResolvedValue({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(initialBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const motorista = criarMotoristaMock({ ativo: true, nome: 'Joao' });

      act(() => {
        result.current.toggleAtivo(motorista);
      });

      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      // Now uses centralized logUserAction
      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_desativado',
        expect.objectContaining({
          motorista_id: motorista.id,
          motorista_nome: 'Joao',
        }),
      );
    });
  });

  // ============================================================================
  // Testes de Estado do Toast
  // ============================================================================

  describe('Estado do Toast', () => {
    it('deve expor toastState e hideToast', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      expect(result.current.toastState).toBeDefined();
      expect(typeof result.current.hideToast).toBe('function');
    });
  });

  // ============================================================================
  // Testes de Setters de Modal
  // ============================================================================

  describe('Setters de Modal', () => {
    it('deve permitir setar motoristaEditando', () => {
      const { result } = renderHook(() => useMotoristasGestor());
      const motorista = criarMotoristaMock();

      act(() => {
        result.current.setMotoristaEditando(motorista);
      });

      expect(result.current.motoristaEditando).toEqual(motorista);

      act(() => {
        result.current.setMotoristaEditando(null);
      });

      expect(result.current.motoristaEditando).toBeNull();
    });

    it('deve permitir setar motoristaParaToggle', () => {
      const { result } = renderHook(() => useMotoristasGestor());
      const motorista = criarMotoristaMock();

      act(() => {
        result.current.setMotoristaParaToggle(motorista);
      });

      expect(result.current.motoristaParaToggle).toEqual(motorista);

      act(() => {
        result.current.setMotoristaParaToggle(null);
      });

      expect(result.current.motoristaParaToggle).toBeNull();
    });
  });

  // ============================================================================
  // Testes de Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('deve tratar motorista sem telefone na edicao', () => {
      const { result } = renderHook(() => useMotoristasGestor());
      const motorista = criarMotoristaMock({ telefone: undefined });

      act(() => {
        result.current.abrirModalEditar(motorista);
      });

      expect(result.current.formEditar.getValues('telefone')).toBe('');
    });

    it('deve tratar response vazia do Edge Function', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(''),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista adicionado com sucesso!',
        'success',
      );
    });

    it('deve tratar response JSON invalida do Edge Function', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('invalid json {'),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Não foi possível criar o motorista. Tente de novo.',
        'error',
      );
    });

    it('deve recarregar motoristas apos adicionar com sucesso', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      });

      const insertBuilder = {
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(insertBuilder);

      // Mock inicial para loadMotoristas
      mockQueryBuilder.returns.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Limpar chamadas anteriores
      jest.clearAllMocks();
      (supabase.from as jest.Mock)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValue(mockQueryBuilder);

      act(() => {
        result.current.formCriar.setValue('nome', 'Nome');
        result.current.formCriar.setValue('email', 'email@teste.com');
        result.current.formCriar.setValue('senha', 'Abcdef1!');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      // Deve ter recarregado a lista pela RPC
      expect(supabase.rpc).toHaveBeenCalledWith('listar_motoristas_unidade', {
        p_unidade_id: 'unidade-123',
      });
    });
  });
});
