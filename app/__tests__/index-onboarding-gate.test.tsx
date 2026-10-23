import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { lerPerfilConhecido } from '@/lib/auth/perfilConhecido';

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

jest.mock('@/lib/auth/perfilConhecido', () => ({
  lerPerfilConhecido: jest.fn(),
}));

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockLerPerfil = lerPerfilConhecido as jest.MockedFunction<
  typeof lerPerfilConhecido
>;
const falhaDeRede = { message: 'TypeError: Network request failed' };

describe('portão de onboarding em app/index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLerPerfil.mockResolvedValue(null);
  });

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

// Reproduzido no aparelho (1.14.3): offline, o Android matou o processo na
// câmera e o app reabriu do zero — o motorista caiu em "Criar sua unidade".
describe('portão em app/index com a busca do perfil falhando', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({ user: { id: 'm1' } } as never);
    mockAuth.getUsuario.mockRejectedValue(falhaDeRede as never);
  });

  it('usa o último perfil conhecido do próprio usuário e segue para /motorista', async () => {
    mockLerPerfil.mockResolvedValue({
      id: 'm1',
      papel: 'motorista',
      primeira_senha: false,
    } as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });
    expect(mockLerPerfil).toHaveBeenCalledWith('m1');
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/criar-unidade');
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('respeita primeira_senha do perfil conhecido', async () => {
    mockLerPerfil.mockResolvedValue({
      id: 'm1',
      papel: 'motorista',
      primeira_senha: true,
    } as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/first-password');
    });
  });

  it('sem perfil conhecido mostra "Sem conexão" e não manda a lugar nenhum', async () => {
    mockLerPerfil.mockResolvedValue(null);

    const tela = render(<Index />);

    expect(await tela.findByText('Sem conexão')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('"Tentar novamente" refaz a busca e segue quando ela volta', async () => {
    mockLerPerfil.mockResolvedValue(null);
    const tela = render(<Index />);
    await tela.findByText('Sem conexão');

    mockAuth.getUsuario.mockResolvedValue({
      id: 'm1',
      papel: 'motorista',
      primeira_senha: false,
    } as never);
    fireEvent.press(tela.getByText('Tentar novamente'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });
  });

  it('falha ao ler a sessão também não manda para o login', async () => {
    mockAuth.getSession.mockRejectedValue(falhaDeRede as never);

    const tela = render(<Index />);

    expect(await tela.findByText('Sem conexão')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });
});
