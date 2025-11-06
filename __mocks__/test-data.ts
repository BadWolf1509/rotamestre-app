// Dados de teste para usar nos testes

import { Usuario, TipoUsuario } from '../src/types/usuario';

export const mockGestor: Usuario = {
  id: 'gestor-test-123',
  email: 'gestor@rotamestre.com',
  nome: 'Gestor Teste',
  papel: 'gestor' as TipoUsuario,
  empresa_id: 'empresa-test-123',
  created_at: new Date().toISOString(),
};

export const mockMotorista: Usuario = {
  id: 'motorista-test-456',
  email: 'motorista@rotamestre.com',
  nome: 'Motorista Teste',
  papel: 'motorista' as TipoUsuario,
  empresa_id: 'empresa-test-123',
  created_at: new Date().toISOString(),
};

export const mockSession = {
  access_token: 'mock-access-token-123',
  refresh_token: 'mock-refresh-token-456',
  user: {
    id: mockGestor.id,
    email: mockGestor.email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
  expires_at: Date.now() + 3600000, // 1 hora
  expires_in: 3600,
  token_type: 'bearer',
};

export const mockCredentials = {
  valid: {
    email: 'gestor@rotamestre.com',
    password: 'senha123456',
  },
  invalid: {
    email: 'invalido@teste.com',
    password: 'senhaerrada',
  },
};

export const mockRota = {
  id: 'rota-test-789',
  titulo: 'Rota Teste 1',
  motorista_id: mockMotorista.id,
  criado_por: mockGestor.id,
  data: new Date().toISOString(),
  status: 'planejada',
  paradas: [
    {
      id: 'parada-1',
      endereco: 'Rua Teste, 123',
      lat: -23.5505,
      lng: -46.6333,
      ordem: 0,
    },
    {
      id: 'parada-2',
      endereco: 'Av. Paulista, 1000',
      lat: -23.5615,
      lng: -46.6556,
      ordem: 1,
    },
  ],
};

export const mockSupabaseError = {
  message: 'Mock error message',
  status: 400,
  code: 'mock_error_code',
};

export const mockSupabaseAuthError = {
  message: 'Invalid login credentials',
  status: 401,
  code: 'invalid_credentials',
};

export const mockSupabaseNetworkError = {
  message: 'Network request failed',
  status: 0,
  code: 'network_error',
};
