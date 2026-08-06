import { render, waitFor } from '@testing-library/react-native';

import { authService } from '@/lib/auth';

import Index from '../index';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  // app/index.tsx também chama useSegments() para checar se já está numa
  // rota autenticada — sem isso o mock local (que substitui o global de
  // jest.setup.js) deixa useSegments undefined e o render quebra.
  useSegments: () => [],
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    getSession: jest.fn(),
    getUsuario: jest.fn(),
  },
}));

const mockAuth = authService as jest.Mocked<typeof authService>;

describe('portão de onboarding em app/index', () => {
  beforeEach(() => jest.clearAllMocks());

  it('manda para o onboarding quando há sessão mas não há perfil', async () => {
    mockAuth.getSession.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockAuth.getUsuario.mockResolvedValue(null as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/criar-unidade');
    });
    // Regressão: devolver para o login é o beco silencioso que travou
    // 5 pessoas reais — a sessão é válida, então login não é a resposta.
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('mantém o destino de gestor quando há perfil', async () => {
    mockAuth.getSession.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockAuth.getUsuario.mockResolvedValue({
      id: 'u1',
      papel: 'gestor',
      primeira_senha: false,
    } as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/gestor/inicio');
    });
  });
});
