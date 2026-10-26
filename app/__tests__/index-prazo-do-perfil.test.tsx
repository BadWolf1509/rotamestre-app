/**
 * Abertura com Wi-Fi sem internet: com perfil conhecido guardado, a busca do
 * perfil não espera o DNS desistir (ver `src/lib/auth/perfilNaAbertura.ts`).
 */
import { act, render, waitFor } from '@testing-library/react-native';

import { authService } from '@/lib/auth';
import { ContaDesativada } from '@/lib/auth/contaAtiva';
import { lerPerfilConhecido } from '@/lib/auth/perfilConhecido';
import { PRAZO_PERFIL_ABERTURA_MS } from '@/lib/auth/perfilNaAbertura';

import Index from '../index';

const mockReplace = jest.fn();
let mockRedeCaida = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => [],
}));
jest.mock('@/lib/auth', () => ({
  authService: {
    lerSessao: jest.fn(),
    getUsuario: jest.fn(),
    garantirContaAtiva: jest.fn(),
  },
}));
jest.mock('@/lib/auth/perfilConhecido', () => ({
  lerPerfilConhecido: jest.fn(),
  apagarPerfilConhecido: jest.fn(),
}));
jest.mock('@/lib/auth/ultimoUsuario', () => ({
  lerUltimoUsuario: jest.fn(async () => null),
}));
jest.mock('@/lib/redeObservada', () => ({
  redeCaidaObservada: () => mockRedeCaida,
}));

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockLerPerfil = lerPerfilConhecido as jest.Mock;
const motorista = { id: 'm1', papel: 'motorista', primeira_senha: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockRedeCaida = false;
  mockAuth.lerSessao.mockResolvedValue({
    session: { user: { id: 'm1' } },
    offline: false,
  } as never);
  mockAuth.garantirContaAtiva.mockResolvedValue(undefined);
});

it('queda de rede observada + perfil conhecido: entra sem consultar o perfil', async () => {
  mockRedeCaida = true;
  mockLerPerfil.mockResolvedValue(motorista);
  mockAuth.getUsuario.mockReturnValue(new Promise(() => undefined) as never);

  render(<Index />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/motorista'));
  expect(mockAuth.getUsuario).not.toHaveBeenCalled();
  // Perfil guardado não passa pelo portão da conta (igual ao ramo offline)
  expect(mockAuth.garantirContaAtiva).not.toHaveBeenCalled();
});

it('perfil guardado e resposta dentro do prazo: vale o perfil fresco, com o portão da conta', async () => {
  mockLerPerfil.mockResolvedValue(motorista);
  mockAuth.getUsuario.mockResolvedValue(motorista as never);
  mockAuth.garantirContaAtiva.mockRejectedValue(new ContaDesativada());

  render(<Index />);

  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith('/auth/login?conta=desativada'),
  );
  expect(mockReplace).not.toHaveBeenCalledWith('/motorista');
});

describe('prazo estourado (rede lenta, internet funcionando)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function abrirComRespostaAtrasada() {
    let responder: (u: unknown) => void = () => undefined;
    mockLerPerfil.mockResolvedValue(motorista);
    mockAuth.getUsuario.mockReturnValue(
      new Promise((r) => {
        responder = r;
      }) as never,
    );
    render(<Index />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PRAZO_PERFIL_ABERTURA_MS + 10);
    });
    return (u: unknown) => responder(u);
  }

  it('entra pelo perfil guardado e roda o portão quando a resposta chega', async () => {
    const responder = await abrirComRespostaAtrasada();
    expect(mockReplace).toHaveBeenCalledWith('/motorista');
    expect(mockAuth.garantirContaAtiva).not.toHaveBeenCalled();

    await act(async () => {
      responder(motorista);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockAuth.garantirContaAtiva).toHaveBeenCalledWith(motorista);
    expect(mockReplace).not.toHaveBeenCalledWith(
      '/auth/login?conta=desativada',
    );
  });

  it('conta desativada na resposta tardia: sai para o login com o aviso', async () => {
    mockAuth.garantirContaAtiva.mockRejectedValue(new ContaDesativada());
    const responder = await abrirComRespostaAtrasada();

    await act(async () => {
      responder(motorista);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/auth/login?conta=desativada',
    );
  });
});

it('online sem perfil guardado: consulta e passa pelo portão, como antes', async () => {
  mockRedeCaida = true;
  mockLerPerfil.mockResolvedValue(null);
  mockAuth.getUsuario.mockResolvedValue(motorista as never);

  render(<Index />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/motorista'));
  expect(mockAuth.getUsuario).toHaveBeenCalledWith('m1');
  expect(mockAuth.garantirContaAtiva).toHaveBeenCalled();
});
