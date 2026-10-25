/**
 * Na web não existe rastreamento em segundo plano: `hasStartedLocationUpdatesAsync`
 * nem existe no expo-location web, e cada "Sair" gravava um `logger.error`
 * ("Erro ao parar"). Na web o logout pula a parada dos rastreamentos.
 */
import { Platform } from 'react-native';

jest.mock('../notifications', () => ({
  unregisterPushToken: jest.fn(async () => undefined),
  cancelRouteReminder: jest.fn(async () => undefined),
}));
jest.mock('@/services/unifiedLocationTracking', () => ({
  stopBackgroundTracking: jest.fn(async () => undefined),
}));
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: { stopTracking: jest.fn(async () => true) },
}));
jest.mock('../auth/limparEstadoLocal', () => ({
  limparEstadoLocalDoUsuario: jest.fn(async () => undefined),
}));
jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import LocationTrackingService from '@/services/locationTracking';
import { stopBackgroundTracking } from '@/services/unifiedLocationTracking';

import { authService } from '../auth';
import { cancelRouteReminder } from '../notifications';
import { supabase } from '../supabase';

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const original = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
  auth.signOut.mockResolvedValue({ error: null } as never);
});
afterEach(() => {
  Platform.OS = original;
});

describe('signOut e o rastreamento por plataforma', () => {
  it('na web não tenta parar o rastreamento, mas cancela o lembrete e sai', async () => {
    Platform.OS = 'web';

    await authService.signOut();

    expect(stopBackgroundTracking).not.toHaveBeenCalled();
    expect(LocationTrackingService.stopTracking).not.toHaveBeenCalled();
    expect(cancelRouteReminder).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('no aparelho continua parando os dois rastreamentos', async () => {
    Platform.OS = 'android';

    await authService.signOut();

    expect(stopBackgroundTracking).toHaveBeenCalledTimes(1);
    expect(LocationTrackingService.stopTracking).toHaveBeenCalledTimes(1);
  });
});
