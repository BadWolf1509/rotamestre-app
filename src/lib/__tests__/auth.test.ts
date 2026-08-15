import { Platform } from 'react-native';

import { authService } from '../auth';
import { logger } from '../logger';
import { supabase } from '../supabase';

// Mock the logger module
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock expo-constants para baseUrl determinístico (mesmo valor de app.config.js)
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: { baseUrl: 'https://app.rotamestre.tec.br' },
  },
}));

// O mock do supabase já está configurado globalmente no jest.setup.js
// (inclui isSupabaseConfigured: true para que os testes usem o path do Supabase mockado)
// Apenas fazemos o cast para usar com TypeScript
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('AuthService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GRUPO 1: signIn - Login
  // ============================================
  describe('signIn', () => {
    it('deve fazer login com sucesso e retornar sessão e usuário', async () => {
      const mockSession = {
        access_token: 'mock-token-123',
        user: { id: 'user-123', email: 'teste@rotamestre.com' },
      };

      const mockUsuario = {
        id: 'user-123',
        email: 'teste@rotamestre.com',
        nome: 'Usuário Teste',
        papel: 'gestor' as const,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user } as any,
        error: null,
      });

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUsuario,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await authService.signIn(
        'teste@rotamestre.com',
        'senha123',
      );

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'teste@rotamestre.com',
        password: 'senha123',
      });
      expect(result.session).toEqual(mockSession);
      expect(result.usuario).toEqual(mockUsuario);
    });

    it('deve lançar erro quando credenciais são inválidas', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('E-mail ou senha inválidos'),
      } as any);

      await expect(
        authService.signIn('erro@rotamestre.com', 'senhaerrada'),
      ).rejects.toThrow('E-mail ou senha inválidos');

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'erro@rotamestre.com',
        password: 'senhaerrada',
      });
    });

    it('deve retornar usuario null quando usuário não existe na tabela', async () => {
      const mockSession = {
        access_token: 'mock-token-123',
        user: { id: 'user-999', email: 'teste@rotamestre.com' },
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user } as any,
        error: null,
      });

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Usuário não encontrado'),
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await authService.signIn(
        'teste@rotamestre.com',
        'senha123',
      );

      expect(result.session).toEqual(mockSession);
      expect(result.usuario).toBeNull();
    });

    it('deve atualizar ultimo_login após login bem-sucedido', async () => {
      const mockSession = {
        access_token: 'mock-token-123',
        user: { id: 'user-123', email: 'teste@rotamestre.com' },
      };

      const mockUsuario = {
        id: 'user-123',
        email: 'teste@rotamestre.com',
        nome: 'Usuário Teste',
        papel: 'gestor' as const,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user } as any,
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: mockUpdate,
        eq: mockEq,
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUsuario,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await authService.signIn('teste@rotamestre.com', 'senha123');

      // Verificar que update foi chamado com campo ultimo_login
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ultimo_login: expect.any(String),
        }),
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('deve retornar usuario null quando data.user é null', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'token' } as any, user: null } as any,
        error: null,
      });

      const result = await authService.signIn(
        'teste@rotamestre.com',
        'senha123',
      );

      expect(result.session).toBeDefined();
      expect(result.usuario).toBeNull();
    });
  });

  // ============================================
  // GRUPO 2: signUp - Registro
  // ============================================
  describe('signUp', () => {
    it('deve criar apenas a conta no Auth e retornar os dados', async () => {
      const mockUser = {
        id: 'new-user-123',
        email: 'novo@rotamestre.com',
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null } as any,
        error: null,
      });

      const result = await authService.signUp(
        'novo@rotamestre.com',
        'senha123',
        'Novo Usuário',
      );

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'novo@rotamestre.com',
        password: 'senha123',
        options: { data: { nome: 'Novo Usuário' } },
      });
      expect(result.user).toEqual(mockUser);
    });

    it('deve lançar erro quando email já existe', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Este email já está cadastrado'),
      } as any);

      await expect(
        authService.signUp('existente@rotamestre.com', 'senha123', 'Teste'),
      ).rejects.toThrow('Este email já está cadastrado');
    });

    it('NÃO insere em usuarios — o perfil nasce na RPC de onboarding', async () => {
      const mockFrom = jest.fn();
      mockSupabase.from = mockFrom;
      mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: { id: 'novo-1' }, session: null },
        error: null,
      });

      await authService.signUp(
        'novo@teste.com',
        'SenhaForte123',
        'Novo Gestor',
      );

      // Regressão do bug que deixou 5 contas órfãs: o insert é bloqueado pelo
      // RLS e acontece DEPOIS da conta no Auth já existir.
      expect(mockFrom).not.toHaveBeenCalledWith('usuarios');
    });

    it('envia o nome em options.data para o onboarding pré-preencher', async () => {
      mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: { id: 'novo-2' }, session: null },
        error: null,
      });

      await authService.signUp('novo2@teste.com', 'SenhaForte123', 'Ana Lima');

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'novo2@teste.com',
          options: expect.objectContaining({
            data: expect.objectContaining({ nome: 'Ana Lima' }),
          }),
        }),
      );
    });
  });

  // ============================================
  // GRUPO 3: signOut - Logout
  // ============================================
  describe('signOut', () => {
    it('deve fazer logout com sucesso', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      });

      await authService.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('deve lançar erro quando logout falha', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: new Error('Erro ao fazer logout'),
      });

      await expect(authService.signOut()).rejects.toThrow(
        'Erro ao fazer logout',
      );
    });
  });

  // ============================================
  // GRUPO 4: resetPassword - Recuperar Senha
  // ============================================
  describe('resetPassword', () => {
    it('deve enviar email de recuperação com sucesso', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {} as any,
        error: null,
      });

      await authService.resetPassword('usuario@rotamestre.com');

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'usuario@rotamestre.com',
        {
          redirectTo: 'https://app.rotamestre.tec.br/auth/reset-password',
        },
      );
    });

    it('deve lançar erro quando email não existe', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {} as any,
        error: new Error('Usuário não encontrado'),
      });

      await expect(
        authService.resetPassword('naoexiste@rotamestre.com'),
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('deve usar a URL web no redirectTo em plataformas nativas', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {} as any,
        error: null,
      });

      await authService.resetPassword('test@rotamestre.com');

      const callArgs = mockSupabase.auth.resetPasswordForEmail.mock.calls[0];
      expect(callArgs[1]).toEqual({
        redirectTo: 'https://app.rotamestre.tec.br/auth/reset-password',
      });
    });

    it('deve usar window.location.origin como redirectTo no web', async () => {
      const platformSpy = jest.replaceProperty(Platform, 'OS', 'web');
      const originalLocation = Object.getOwnPropertyDescriptor(
        window,
        'location',
      );
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://preview.vercel.app' },
        configurable: true,
        writable: true,
      });

      try {
        mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
          data: {} as any,
          error: null,
        });

        await authService.resetPassword('test@rotamestre.com');

        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@rotamestre.com',
          {
            redirectTo: 'https://preview.vercel.app/auth/reset-password',
          },
        );
      } finally {
        platformSpy.restore();
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });
  });

  // ============================================
  // GRUPO 5: updatePassword - Atualizar Senha
  // ============================================
  describe('updatePassword', () => {
    it('deve atualizar senha com sucesso', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: {} } as any,
        error: null,
      });

      await authService.updatePassword('novaSenha123');

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'novaSenha123',
      });
    });

    it('deve lançar erro quando token é inválido ou expirado', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Token de recuperação inválido ou expirado'),
      });

      await expect(authService.updatePassword('novaSenha123')).rejects.toThrow(
        'Token de recuperação inválido ou expirado',
      );
    });

    it('deve aceitar senhas com caracteres especiais', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: {} } as any,
        error: null,
      });

      const complexPassword = 'S3nh@C0mpl3x@#$%';
      await authService.updatePassword(complexPassword);

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: complexPassword,
      });
    });
  });

  // ============================================
  // GRUPO 5b: marcarPrimeiraSenhaConcluida
  // ============================================
  describe('marcarPrimeiraSenhaConcluida', () => {
    it('deve marcar primeira_senha como false para o usuário autenticado', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } } as any,
        error: null,
      });

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ update: mockUpdate } as any);

      await authService.marcarPrimeiraSenhaConcluida();

      expect(mockSupabase.from).toHaveBeenCalledWith('usuarios');
      expect(mockUpdate).toHaveBeenCalledWith({ primeira_senha: false });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('deve resolver sem efeito quando não há usuário autenticado', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(
        authService.marcarPrimeiraSenhaConcluida(),
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('deve logar warning e não lançar quando o update falha', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } } as any,
        error: null,
      });

      const mockEq = jest
        .fn()
        .mockResolvedValue({ error: new Error('RLS negou o update') });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ update: mockUpdate } as any);

      await expect(
        authService.marcarPrimeiraSenhaConcluida(),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('não deve lançar quando getUser rejeita', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(
        new Error('Falha de rede inesperada'),
      );

      await expect(
        authService.marcarPrimeiraSenhaConcluida(),
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ============================================
  // GRUPO 6: getSession - Obter Sessão Atual
  // ============================================
  describe('getSession', () => {
    it('deve retornar sessão ativa', async () => {
      const mockSession = {
        access_token: 'mock-token-123',
        user: { id: 'user-123', email: 'teste@rotamestre.com' },
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession } as any,
        error: null,
      });

      const session = await authService.getSession();

      expect(session).toEqual(mockSession);
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('deve retornar null quando não há sessão ativa', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await authService.getSession();

      expect(session).toBeNull();
    });
  });

  // ============================================
  // GRUPO 7: getUsuario - Obter Dados do Usuário
  // ============================================
  describe('getUsuario', () => {
    it('deve retornar dados do usuário com sucesso', async () => {
      const mockUsuario = {
        id: 'user-123',
        email: 'teste@rotamestre.com',
        nome: 'Usuário Teste',
        papel: 'gestor' as const,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUsuario,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const usuario = await authService.getUsuario('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('usuarios');
      expect(usuario).toEqual(mockUsuario);
    });

    it('deve retornar null quando usuário não existe', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Usuário não encontrado'),
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const usuario = await authService.getUsuario('user-999');

      expect(usuario).toBeNull();
    });

    it('não loga erro quando o perfil ainda não existe', async () => {
      // Entre o cadastro e a RPC do onboarding o usuário legitimamente não tem
      // linha em `usuarios` — é assim que o fluxo self-service funciona. Com
      // `.single()` o PostgREST devolve 406 + PGRST116 e isso virava
      // logger.error: como o Sentry está ligado na web em produção, todo
      // cadastro que DEU CERTO gerava eventos de erro. `.maybeSingle()` devolve
      // data:null com error:null, que é o estado real.
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        // Isca: se alguém voltar para `.single()`, este mock responde com o
        // PGRST116 real e o teste falha, em vez de quebrar por método ausente.
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST116',
            details: 'The result contains 0 rows',
            hint: null,
            message: 'Cannot coerce the result to a single JSON object',
          },
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const usuario = await authService.getUsuario('user-sem-perfil-ainda');

      expect(usuario).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('deve buscar usuário pelo ID correto', async () => {
      const mockEq = jest.fn().mockReturnThis();

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: mockEq,
        maybeSingle: jest.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      } as any);

      await authService.getUsuario('user-specific-id');

      expect(mockEq).toHaveBeenCalledWith('id', 'user-specific-id');
    });

    it('deve incluir dados da unidade na consulta', async () => {
      const mockSelect = jest.fn().mockReturnThis();

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      } as any);

      await authService.getUsuario('user-123');

      expect(mockSelect).toHaveBeenCalledWith('*, unidades(nome)');
    });

    it('deve logar erro quando busca falha', async () => {
      const mockError = new Error('Database error');
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      } as any);

      const result = await authService.getUsuario('user-123');

      expect(logger.error).toHaveBeenCalledWith(
        '[Auth] Erro ao buscar usuário:',
        mockError,
      );
      expect(result).toBeNull();
    });
  });

  // ============================================
  // GRUPO 8: verificarTipoUsuario - Verificar Tipo
  // ============================================
  describe('verificarTipoUsuario', () => {
    it('deve retornar tipo "gestor" corretamente', async () => {
      const mockUsuario = {
        id: 'user-123',
        email: 'gestor@rotamestre.com',
        nome: 'Gestor Teste',
        papel: 'gestor' as const,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUsuario,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const tipo = await authService.verificarTipoUsuario('user-123');

      expect(tipo).toBe('gestor');
    });

    it('deve retornar tipo "motorista" corretamente', async () => {
      const mockUsuario = {
        id: 'user-456',
        email: 'motorista@rotamestre.com',
        nome: 'Motorista Teste',
        papel: 'motorista' as const,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockUsuario,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const tipo = await authService.verificarTipoUsuario('user-456');

      expect(tipo).toBe('motorista');
    });

    it('deve retornar null quando usuário não existe', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Usuário não encontrado'),
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const tipo = await authService.verificarTipoUsuario('user-999');

      expect(tipo).toBeNull();
    });
  });
});
