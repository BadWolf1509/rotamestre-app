import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { FalhaAoCarregarPerfil } from '@/lib/auth/falhaPerfil';
import {
  apagarPerfilConhecido,
  lerPerfilConhecido,
} from '@/lib/auth/perfilConhecido';
import { lerUltimoUsuario } from '@/lib/auth/ultimoUsuario';

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
    lerSessao: jest.fn(),
    getUsuario: jest.fn(),
  },
}));

jest.mock('@/lib/auth/perfilConhecido', () => ({
  lerPerfilConhecido: jest.fn(),
  apagarPerfilConhecido: jest.fn(),
}));

jest.mock('@/lib/auth/ultimoUsuario', () => ({
  lerUltimoUsuario: jest.fn(),
}));

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockLerPerfil = lerPerfilConhecido as jest.Mock;
const mockApagarPerfil = apagarPerfilConhecido as jest.Mock;
const mockUltimo = lerUltimoUsuario as jest.Mock;

const comSessao = (id: string) =>
  mockAuth.lerSessao.mockResolvedValue({
    session: { user: { id } },
    offline: false,
  } as never);
const transitoria = () =>
  new FalhaAoCarregarPerfil('sem resposta', { transitoria: true, status: 0 });
const motorista = (primeira_senha = false) =>
  ({ id: 'm1', papel: 'motorista', primeira_senha }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockLerPerfil.mockResolvedValue(null);
  mockApagarPerfil.mockResolvedValue(undefined);
  mockUltimo.mockResolvedValue(null);
});

describe('portão de onboarding em app/index', () => {
  it('manda para o onboarding quando há sessão mas não há perfil', async () => {
    comSessao('u1');
    mockAuth.getUsuario.mockResolvedValue(null as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/criar-unidade');
    });
    // Regressão: devolver para o login é o beco silencioso que travou
    // 5 pessoas reais — a sessão é válida, então login não é a resposta.
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('sem linha (resposta autenticada e real) apaga o perfil conhecido antes do onboarding', async () => {
    comSessao('u1');
    mockAuth.getUsuario.mockResolvedValue(null as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/criar-unidade');
    });
    expect(mockApagarPerfil).toHaveBeenCalledWith('u1');
  });

  it('mantém o destino de gestor quando há perfil', async () => {
    comSessao('u1');
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

  it('sem sessão (e online) vai ao login', async () => {
    mockAuth.lerSessao.mockResolvedValue({
      session: null,
      offline: false,
    } as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    });
  });
});

// Reproduzido no aparelho (1.14.3): offline, o Android matou o processo na
// câmera e o app reabriu do zero — o motorista caiu em "Criar sua unidade".
describe('portão em app/index com a busca do perfil falhando', () => {
  beforeEach(() => {
    comSessao('m1');
    mockAuth.getUsuario.mockRejectedValue(transitoria() as never);
  });

  it('usa o último perfil conhecido do próprio usuário e segue para /motorista', async () => {
    mockLerPerfil.mockResolvedValue(motorista());

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });
    expect(mockLerPerfil).toHaveBeenCalledWith('m1');
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/criar-unidade');
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('respeita primeira_senha do perfil conhecido', async () => {
    mockLerPerfil.mockResolvedValue(motorista(true));

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/first-password');
    });
  });

  it('sem perfil conhecido mostra "Sem conexão" e não manda a lugar nenhum', async () => {
    render(<Index />);

    expect(await screen.findByText('Sem conexão')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('erro de verdade (400/42501) NÃO entra com o perfil conhecido', async () => {
    mockAuth.getUsuario.mockRejectedValue(
      new FalhaAoCarregarPerfil('permissão', {
        transitoria: false,
        status: 403,
        code: '42501',
      }) as never,
    );
    mockLerPerfil.mockResolvedValue(motorista());

    render(<Index />);

    expect(
      await screen.findByText('Não foi possível carregar seu perfil'),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockApagarPerfil).not.toHaveBeenCalled();
  });

  it('"Tentar novamente" mostra carregando no botão e segue quando a busca volta', async () => {
    render(<Index />);
    await screen.findByText('Sem conexão');

    let liberar!: (v: unknown) => void;
    mockAuth.getUsuario.mockReturnValue(
      new Promise((r) => {
        liberar = r;
      }) as never,
    );
    fireEvent.press(screen.getByText('Tentar novamente'));

    // Carregando: o botão fica ocupado (sem texto, desabilitado).
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tentar novamente' }).props
          .accessibilityState,
      ).toMatchObject({ disabled: true }),
    );
    expect(screen.queryByText('Tentar novamente')).toBeNull();

    await act(async () => liberar(motorista()));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });
  });
});

// auth-js: access token vencido + refresh sem rede → `getSession()` devolve
// `{ session: null, error: AuthRetryableFetchError }` (a sessão continua no
// storage). Antes isso era lido como "deslogado" e ia ao login.
describe('portão em app/index com a sessão offline (token vencido sem rede)', () => {
  beforeEach(() => {
    mockAuth.lerSessao.mockResolvedValue({
      session: null,
      offline: true,
    } as never);
  });

  it('com último usuário e perfil conhecido dele, entra', async () => {
    mockUltimo.mockResolvedValue('m1');
    mockLerPerfil.mockResolvedValue(motorista());

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/motorista');
    });
    expect(mockLerPerfil).toHaveBeenCalledWith('m1');
    expect(mockAuth.getUsuario).not.toHaveBeenCalled();
  });

  it('sem último usuário, "Sem conexão" (nunca login)', async () => {
    render(<Index />);

    expect(await screen.findByText('Sem conexão')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('com último usuário mas sem perfil conhecido, "Sem conexão"', async () => {
    mockUltimo.mockResolvedValue('m1');

    render(<Index />);

    expect(await screen.findByText('Sem conexão')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sessão que não responde no prazo vira "Sem conexão", não login', async () => {
    jest.useFakeTimers();
    try {
      mockAuth.lerSessao.mockReturnValue(new Promise(() => {}) as never);

      render(<Index />);
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      expect(await screen.findByText('Sem conexão')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
    } finally {
      jest.useRealTimers();
    }
  });
});
