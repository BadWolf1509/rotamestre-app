/**
 * Tests for notificationHandlers
 *
 * O destino depende de quem recebe (ver `destinoDaNotificacao`): o papel vem
 * do perfil conhecido do aparelho, lido pela sessão local (sem rede).
 */

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetSession = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

const mockLerPerfilConhecido = jest.fn();
jest.mock('../auth/perfilConhecido', () => ({
  lerPerfilConhecido: (id: string) => mockLerPerfilConhecido(id),
}));

let notificationCallback: ((response: unknown) => Promise<void> | void) | null =
  null;
const mockAddNotificationResponseListener = jest.fn((callback) => {
  notificationCallback = callback;
  return { remove: jest.fn() };
});

jest.mock('../notifications', () => ({
  __esModule: true,
  addNotificationResponseListener: (...args: unknown[]) =>
    mockAddNotificationResponseListener(...(args as [never])),
}));

import { logger } from '../logger';
import { setupNotificationResponseHandler } from '../notificationHandlers';

const resposta = (tipo: string | undefined, rotaId?: string) => ({
  notification: { request: { content: { data: { tipo, rota_id: rotaId } } } },
});

function comPapel(papel: 'gestor' | 'motorista' | null) {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  });
  mockLerPerfilConhecido.mockResolvedValue(papel ? { id: 'u1', papel } : null);
}

async function toca(tipo: string | undefined, rotaId?: string) {
  await notificationCallback!(resposta(tipo, rotaId));
}

describe('notificationHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationCallback = null;
    setupNotificationResponseHandler();
  });

  it('registra o listener e devolve a inscrição', () => {
    const result = setupNotificationResponseHandler();
    expect(mockAddNotificationResponseListener).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(typeof result.remove).toBe('function');
  });

  describe('motorista', () => {
    beforeEach(() => comPapel('motorista'));

    it('nova rota vai à Início pela aba existente (navigate, sem empilhar)', async () => {
      await toca('nova_rota_atribuida', 'r1');
      expect(mockRouter.navigate).toHaveBeenCalledWith('/motorista');
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('edição da rota pelo gestor vai à aba Paradas, não à área do gestor', async () => {
      await toca('rota_reordenada', 'r1');
      expect(mockRouter.navigate).toHaveBeenCalledWith('/motorista/paradas');
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('rota não executada vai ao histórico', async () => {
      await toca('rota_nao_executada', 'r1');
      expect(mockRouter.navigate).toHaveBeenCalledWith('/motorista/historico');
    });
  });

  describe('gestor', () => {
    beforeEach(() => comPapel('gestor'));

    it('parada pulada abre o mapa da rota, não a tela privada do motorista', async () => {
      await toca('parada_pulada', 'rota-123');
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/gestor/mapa-rota?id=rota-123',
      );
    });

    it('rota não executada abre o mapa da rota', async () => {
      await toca('rota_nao_executada', 'rota-9');
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/gestor/mapa-rota?id=rota-9',
      );
    });

    it('sem rota_id cai na gestão de rotas', async () => {
      await toca('rota_concluida');
      expect(mockRouter.push).toHaveBeenCalledWith('/gestor/gestao-rotas');
    });

    it('SOS abre os incidentes', async () => {
      await toca('sos_acionado', 'r1');
      expect(mockRouter.push).toHaveBeenCalledWith('/gestor/incidentes');
    });
  });

  describe('sem perfil conhecido', () => {
    it('tipo exclusivo decide pelo destinatário', async () => {
      comPapel(null);
      await toca('parada_reaberta', 'r7');
      expect(mockRouter.push).toHaveBeenCalledWith('/gestor/mapa-rota?id=r7');
    });

    it('sem sessão, tipo dos dois papéis vai à raiz', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      await toca('rota_nao_executada', 'r1');
      expect(mockRouter.navigate).toHaveBeenCalledWith('/');
      expect(mockLerPerfilConhecido).not.toHaveBeenCalled();
    });

    it('falha ao ler a sessão não impede a navegação', async () => {
      mockGetSession.mockRejectedValue(new Error('x'));
      await toca('rota_reordenada', 'r1');
      expect(mockRouter.navigate).toHaveBeenCalledWith('/motorista/paradas');
    });
  });

  describe('tipo desconhecido', () => {
    beforeEach(() => comPapel('gestor'));

    it('loga e não navega', async () => {
      await toca('unknown_type');
      expect(logger.warn).toHaveBeenCalledWith(
        '[NotificationHandler] Unknown notification type',
        { tipo: 'unknown_type' },
      );
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('sem tipo não navega', async () => {
      await toca(undefined);
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
