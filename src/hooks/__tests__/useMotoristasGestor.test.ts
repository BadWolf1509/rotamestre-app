import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { validatePhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

import { useMotoristasGestor, MotoristaDetalhado } from '../useMotoristasGestor';

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

// Mock centralized queries
const mockUpdateUsuario = jest.fn();
const mockLogUserAction = jest.fn();

jest.mock('@/lib/queries', () => ({
  updateUsuario: (...args: unknown[]) => mockUpdateUsuario(...args),
  logUserAction: (...args: unknown[]) => mockLogUserAction(...args),
}));

// Mocks de utilitarios de telefone
jest.mock('@/lib/phone', () => ({
  maskPhone: jest.fn((text: string) => text),
  validatePhone: jest.fn((phone: string) => phone.length >= 10),
  getPhoneErrorMessage: jest.fn((phone: string) => (phone.length < 10 ? 'Telefone incompleto' : null)),
}));

// Helper para criar motorista mock
const criarMotoristaMock = (overrides: Partial<MotoristaDetalhado> = {}): MotoristaDetalhado => ({
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

      expect(result.current.formNome).toBe('');
      expect(result.current.formEmail).toBe('');
      expect(result.current.formTelefone).toBe('');
      expect(result.current.formSenha).toBe('');
      expect(result.current.emailError).toBe('');
      expect(result.current.telefoneError).toBe('');
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
      expect(typeof result.current.validateEmail).toBe('function');
      expect(typeof result.current.handleTelefoneChange).toBe('function');
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

      mockQueryBuilder.returns.mockResolvedValue({
        data: motoristas.map(m => ({ usuario_id: m.id, usuarios: m })),
        error: null,
      });

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

      mockQueryBuilder.returns.mockResolvedValue({
        data: motoristas.map(m => ({ usuario_id: m.id, usuarios: m })),
        error: null,
      });

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

      mockQueryBuilder.returns.mockResolvedValue({
        data: motoristas.map(m => ({ usuario_id: m.id, usuarios: m })),
        error: null,
      });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalMotoristas).toBe(3);
      expect(result.current.ativosMotoristas).toBe(2);
    });

    it('deve exibir toast de erro quando falha ao carregar', async () => {
      mockQueryBuilder.returns.mockResolvedValue({
        data: null,
        error: { message: 'Erro de conexao' },
      });

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Não foi possível carregar os motoristas',
        'error'
      );
    });

    it('nao deve carregar se nao houver unidade ativa', async () => {
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: null });

      const { result: _result } = renderHook(() => useMotoristasGestor());

      // Aguardar um tick para garantir que o useEffect foi executado
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('deve filtrar usuarios nulos da resposta', async () => {
      // Reset mocks antes de configurar
      jest.clearAllMocks();
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: 'unidade-123' });

      const localBuilder = criarMockQueryBuilder();
      localBuilder.returns.mockResolvedValue({
        data: [
          { usuario_id: '1', usuarios: criarMotoristaMock({ id: '1', nome: 'Ana' }) },
          { usuario_id: '2', usuarios: null },
          { usuario_id: '3', usuarios: criarMotoristaMock({ id: '3', nome: 'Carlos' }) },
        ],
        error: null,
      });
      (supabase.from as jest.Mock).mockReturnValue(localBuilder);

      const { result } = renderHook(() => useMotoristasGestor());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.motoristas).toHaveLength(2);
    });
  });

  // ============================================================================
  // Testes de Controle de Modais
  // ============================================================================

  describe('Controle de Modais', () => {
    it('deve abrir modal de adicionar e resetar formulario', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      // Preencher formulario primeiro
      act(() => {
        result.current.setFormNome('Teste');
        result.current.setFormEmail('teste@test.com');
      });

      // Abrir modal
      act(() => {
        result.current.abrirModalAdicionar();
      });

      expect(result.current.showAddModal).toBe(true);
      expect(result.current.formNome).toBe('');
      expect(result.current.formEmail).toBe('');
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
      expect(result.current.formNome).toBe('Joao');
      expect(result.current.formEmail).toBe('joao@test.com');
      expect(result.current.formTelefone).toBe('(11) 99999-9999');
    });

    it('deve limpar erros ao abrir modal de editar', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      // Simular erro anterior
      act(() => {
        result.current.validateEmail('email-invalido');
      });

      expect(result.current.emailError).not.toBe('');

      // Abrir modal de editar
      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
      });

      expect(result.current.emailError).toBe('');
      expect(result.current.telefoneError).toBe('');
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
    it('deve atualizar formNome', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Novo Nome');
      });

      expect(result.current.formNome).toBe('Novo Nome');
    });

    it('deve atualizar formEmail', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormEmail('novo@email.com');
      });

      expect(result.current.formEmail).toBe('novo@email.com');
    });

    it('deve atualizar formSenha', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormSenha('senha123');
      });

      expect(result.current.formSenha).toBe('senha123');
    });

    it('deve resetar formulario corretamente', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      // Preencher campos
      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@test.com');
        result.current.setFormTelefone('11999999999');
        result.current.setFormSenha('senha');
      });

      // Resetar
      act(() => {
        result.current.resetFormulario();
      });

      expect(result.current.formNome).toBe('');
      expect(result.current.formEmail).toBe('');
      expect(result.current.formTelefone).toBe('');
      expect(result.current.formSenha).toBe('');
      expect(result.current.emailError).toBe('');
      expect(result.current.telefoneError).toBe('');
    });
  });

  // ============================================================================
  // Testes de Validacao
  // ============================================================================

  describe('Validacao', () => {
    it('deve validar email vazio como valido', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      let isValid;
      act(() => {
        isValid = result.current.validateEmail('');
      });

      expect(isValid).toBe(true);
      expect(result.current.emailError).toBe('');
    });

    it('deve validar email correto', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      let isValid;
      act(() => {
        isValid = result.current.validateEmail('usuario@exemplo.com');
      });

      expect(isValid).toBe(true);
      expect(result.current.emailError).toBe('');
    });

    it('deve invalidar email incorreto', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      let isValid;
      act(() => {
        isValid = result.current.validateEmail('email-invalido');
      });

      expect(isValid).toBe(false);
      expect(result.current.emailError).toBe('Digite um email válido');
    });

    it('deve formatar telefone ao digitar', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.handleTelefoneChange('11999999999');
      });

      // O mock de maskPhone retorna o mesmo valor
      expect(result.current.formTelefone).toBe('11999999999');
    });

    it('deve validar telefone incompleto', () => {
      // Configurar mock para retornar erro
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.handleTelefoneChange('1199');
      });

      expect(result.current.telefoneError).toBe('Telefone incompleto');
    });

    it('deve limpar erro de telefone quando vazio', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.handleTelefoneChange('');
      });

      expect(result.current.telefoneError).toBe('');
    });
  });

  // ============================================================================
  // Testes de Adicionar Motorista
  // ============================================================================

  describe('Adicionar Motorista', () => {
    beforeEach(() => {
      // Reset do mock de unidade ativa
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: 'unidade-123' });
      (useUser as jest.Mock).mockReturnValue({
        userData: { id: 'user-123', nome: 'Gestor Teste' },
      });
    });

    it('deve exibir erro quando campos obrigatorios estao vazios', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error'
      );
    });

    it('deve exibir erro quando email e invalido', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email-invalido');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Digite um email válido', 'error');
    });

    it('deve exibir erro quando telefone e invalido', async () => {
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
        result.current.setFormTelefone('123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Telefone inválido', 'error');
    });

    it('deve exibir erro quando sessao nao existe', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sua sessão expirou. Por favor, faça login novamente.',
        'error'
      );
    });

    it('deve exibir erro quando getSession falha', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' },
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao obter sessão'),
        'error'
      );
    });

    it('deve chamar Edge Function com dados corretos', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
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
        result.current.setFormNome('Novo Motorista');
        result.current.setFormEmail('motorista@teste.com');
        result.current.setFormSenha('senha123');
        result.current.setFormTelefone('(11) 99999-9999');
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
            senha: 'senha123',
            telefone: '(11) 99999-9999',
          }),
        })
      );
    });

    it('deve exibir toast de sucesso e fechar modal ao criar motorista', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
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
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
        result.current.setShowAddModal(true);
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista adicionado com sucesso!',
        'success'
      );
      expect(result.current.showAddModal).toBe(false);
    });

    it('deve exibir erro quando fetch falha', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Erro de conexão'),
        'error'
      );
    });

    it('deve exibir erro quando resposta nao e ok', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: { access_token: 'token', user: { email: 'g@test.com' } },
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Email ja existe' })),
      });

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Email ja existe', 'error');
    });

    it('deve gerenciar estado de salvando durante adicao', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

      let resolveSession: any;
      (supabase.auth.getSession as jest.Mock).mockReturnValue(
        new Promise(resolve => {
          resolveSession = resolve;
        })
      );

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      // Iniciar adicao
      let addPromise: Promise<void>;
      act(() => {
        addPromise = result.current.adicionarMotorista();
      });

      // Verificar que esta salvando
      expect(result.current.salvando).toBe(true);

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
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: 'unidade-123' });
      (useUser as jest.Mock).mockReturnValue({
        userData: { id: 'user-123', nome: 'Gestor Teste' },
      });
    });

    it('deve exibir erro quando campos obrigatorios estao vazios', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
        result.current.setFormNome('');
        result.current.setFormEmail('');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Preencha todos os campos obrigatórios',
        'error'
      );
    });

    it('deve exibir erro quando email e invalido', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
        result.current.setFormEmail('email-invalido');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Digite um email válido', 'error');
    });

    it('deve exibir erro quando telefone e invalido', async () => {
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.abrirModalEditar(criarMotoristaMock());
        result.current.setFormTelefone('123');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith('Telefone inválido', 'error');
    });

    it('deve atualizar motorista com sucesso', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

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
        result.current.setFormNome('Nome Atualizado');
        result.current.setFormEmail('novo@email.com');
        result.current.setFormTelefone('');
      });

      await act(async () => {
        await result.current.editarMotorista();
      });

      // Now uses centralized updateUsuario
      expect(mockUpdateUsuario).toHaveBeenCalledWith('motorista-edit', {
        nome: 'Nome Atualizado',
        email: 'novo@email.com',
        telefone: null,
      });
      // And logs via centralized logUserAction
      expect(mockLogUserAction).toHaveBeenCalledWith(
        'user-123',
        'motorista_editado',
        expect.objectContaining({
          motorista_id: 'motorista-edit',
          motorista_nome: 'Nome Atualizado',
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista atualizado com sucesso!',
        'success'
      );
      expect(result.current.showEditModal).toBe(false);
      expect(result.current.motoristaEditando).toBeNull();
    });

    it('deve exibir erro quando atualizacao falha', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

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
      (validatePhone as jest.Mock).mockReturnValue(true);

      // Configure centralized update to return pending promise
      let resolveUpdate: (value: any) => void;
      mockUpdateUsuario.mockReturnValue(
        new Promise(resolve => {
          resolveUpdate = resolve;
        })
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

      expect(result.current.salvando).toBe(true);

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
      (useUnidadeAtiva as jest.Mock).mockReturnValue({ unidadeAtiva: 'unidade-123' });
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

      // Now uses centralized updateUsuario
      expect(mockUpdateUsuario).toHaveBeenCalledWith(motorista.id, { ativo: false });
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

      // Now uses centralized updateUsuario
      expect(mockUpdateUsuario).toHaveBeenCalledWith(motorista.id, { ativo: true });
    });

    it('nao deve fazer nada se nao houver motoristaParaToggle', async () => {
      const { result } = renderHook(() => useMotoristasGestor());

      await act(async () => {
        await result.current.confirmarToggleAtivo();
      });

      // updateUsuario should not be called when no motorista is selected
      expect(mockUpdateUsuario).not.toHaveBeenCalled();
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
        })
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

    it('deve permitir setar formTelefone diretamente', () => {
      const { result } = renderHook(() => useMotoristasGestor());

      act(() => {
        result.current.setFormTelefone('(11) 98765-4321');
      });

      expect(result.current.formTelefone).toBe('(11) 98765-4321');
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

      expect(result.current.formTelefone).toBe('');
    });

    it('deve tratar response vazia do Edge Function', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
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
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Motorista adicionado com sucesso!',
        'success'
      );
    });

    it('deve tratar response JSON invalida do Edge Function', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
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
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Edge Function retornou uma resposta inválida'),
        'error'
      );
    });

    it('deve recarregar motoristas apos adicionar com sucesso', async () => {
      (validatePhone as jest.Mock).mockReturnValue(true);
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
        result.current.setFormNome('Nome');
        result.current.setFormEmail('email@teste.com');
        result.current.setFormSenha('senha123');
      });

      await act(async () => {
        await result.current.adicionarMotorista();
      });

      // Deve ter chamado loadMotoristas (select em usuario_unidades)
      expect(supabase.from).toHaveBeenCalledWith('usuario_unidades');
    });
  });
});
