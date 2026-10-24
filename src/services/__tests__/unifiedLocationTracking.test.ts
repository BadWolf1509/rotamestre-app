/**
 * Tests for unifiedLocationTracking.ts
 * Serviço Unificado de Rastreamento de Localização
 */

import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

import {
  requestLocationPermissions,
  checkLocationPermissions,
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
  getTrackingContext,
  updateTrackingContext,
  requestAndStartTracking,
  garantirRastreamentoDaRota,
  POSICOES_ENTRE_CONFERENCIAS,
  POSICOES_MINIMAS_ENTRE_CONFERENCIAS,
} from '../unifiedLocationTracking';

import type { TrackingContext } from '../unifiedLocationTracking';

// Mock AsyncStorage
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}));

// Mock expo-location
const mockRequestForegroundPermissions = jest.fn();
const mockRequestBackgroundPermissions = jest.fn();
const mockGetForegroundPermissions = jest.fn();
const mockGetBackgroundPermissions = jest.fn();
const mockHasStartedLocationUpdates = jest.fn();
const mockStartLocationUpdates = jest.fn();
const mockStopLocationUpdates = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissions(),
  requestBackgroundPermissionsAsync: () => mockRequestBackgroundPermissions(),
  getForegroundPermissionsAsync: () => mockGetForegroundPermissions(),
  getBackgroundPermissionsAsync: () => mockGetBackgroundPermissions(),
  hasStartedLocationUpdatesAsync: () => mockHasStartedLocationUpdates(),
  startLocationUpdatesAsync: () => mockStartLocationUpdates(),
  stopLocationUpdatesAsync: () => mockStopLocationUpdates(),
  Accuracy: {
    High: 5,
    Balanced: 3,
  },
  ActivityType: {
    AutomotiveNavigation: 1,
  },
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

// Sessão lida na conferência da rota (só quando a rota não aparece).
const mockLerSessao = jest.fn();
jest.mock('@/lib/auth/sessao', () => ({
  lerSessao: () => mockLerSessao(),
}));

// A espera pelo primeiro plano é controlada pelo teste: por padrão o app já
// está ativo; `mockAguardar` permite segurar a promessa.
const mockAguardar = jest.fn(() => Promise.resolve());
jest.mock('@/lib/appEmPrimeiroPlano', () => ({
  aguardarAppEmPrimeiroPlano: () => mockAguardar(),
}));

// Mock Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(
      (
        _title: string,
        _message: string,
        buttons?: Array<{ onPress?: () => void }>,
      ) => buttons?.[1]?.onPress?.(),
    ),
  },
}));

// O corpo da task registrada no import do módulo (antes do `clearAllMocks`).
const tarefaDeSegundoPlano = (TaskManager.defineTask as jest.Mock).mock
  .calls[0][1] as (corpo: { data: unknown; error: unknown }) => Promise<void>;

describe('unifiedLocationTracking', () => {
  const mockContext: TrackingContext = {
    rotaId: 'rota-123',
    motoristaId: 'motorista-456',
    motoristaNome: 'João Motorista',
    startedAt: '2025-12-25T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockRemoveItem.mockReset();
    // Os testes de `garantirRastreamentoDaRota` usam `mockResolvedValue`
    // (persistente), que o `clearAllMocks` não desfaz.
    mockHasStartedLocationUpdates.mockReset();
    mockStartLocationUpdates.mockReset();
    mockGetForegroundPermissions.mockResolvedValue({ status: 'undetermined' });
    mockGetBackgroundPermissions.mockResolvedValue({ status: 'undetermined' });
  });

  describe('requestLocationPermissions', () => {
    it('deve retornar false para ambos quando foreground negado', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: false, background: false });
    });

    it('deve solicitar background quando foreground concedido', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: true, background: true });
      expect(mockRequestBackgroundPermissions).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Localização durante a rota',
        expect.stringContaining('app está fechado'),
        expect.any(Array),
        expect.objectContaining({ cancelable: true }),
      );
    });

    it('deve retornar foreground true e background false', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: true, background: false });
    });
  });

  describe('checkLocationPermissions', () => {
    it('deve verificar status das permissões', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await checkLocationPermissions();

      expect(result).toEqual({ foreground: true, background: false });
    });

    it('deve retornar ambos verdadeiros', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });

      const result = await checkLocationPermissions();

      expect(result).toEqual({ foreground: true, background: true });
    });
  });

  describe('startBackgroundTracking', () => {
    it('deve retornar false sem permissão foreground', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(false);
    });

    it('deve salvar contexto e iniciar tracking', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);
      mockStartLocationUpdates.mockResolvedValueOnce(undefined);

      const result = await startBackgroundTracking(mockContext);

      expect(mockSetItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('deve retornar true se já está rastreando', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(true);
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
    });

    it('deve retornar true mesmo sem permissão background', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(true);
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
    });

    // #570: o pedido de permissão do `requestAndStartTracking` tira o app da
    // tela por uma fração de segundo, e o Android 12+ recusa o serviço em
    // primeiro plano iniciado nessa janela.
    it('só inicia o serviço depois que o app volta ao primeiro plano', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);
      let liberar: () => void = () => {};
      mockAguardar.mockImplementationOnce(
        () => new Promise<void>((resolve) => (liberar = resolve)),
      );

      const promessa = startBackgroundTracking(mockContext);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();

      liberar();
      await expect(promessa).resolves.toBe(true);
      expect(mockStartLocationUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('garantirRastreamentoDaRota', () => {
    it('não pede nada quando a task já está registrada', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(true);
      mockGetItem.mockResolvedValue(JSON.stringify(mockContext));

      const resultado = await garantirRastreamentoDaRota(mockContext);

      expect(resultado).toBe('ativo');
      expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();
      expect(mockRequestBackgroundPermissions).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    // Num reinício a frio (force-stop, reboot, processo morto) o
    // expo-task-manager restaura a task ANTES de o app estar na tela, e o
    // expo-location recusa o serviço em primeiro plano ("Foreground location
    // task cannot be started while the app is in the background!"): a task
    // fica registrada, `hasStartedLocationUpdatesAsync` diz true, e o serviço
    // não roda. Registrar de novo só atualiza as opções e sobe o serviço.
    it('reafirma a task já registrada uma vez por processo', async () => {
      await jest.isolateModulesAsync(async () => {
        const modulo = require('../unifiedLocationTracking');
        mockHasStartedLocationUpdates.mockResolvedValue(true);
        mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
        mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
        mockGetItem.mockResolvedValue(JSON.stringify(mockContext));

        expect(await modulo.garantirRastreamentoDaRota(mockContext)).toBe(
          'ativo',
        );
        expect(await modulo.garantirRastreamentoDaRota(mockContext)).toBe(
          'ativo',
        );

        expect(mockStartLocationUpdates).toHaveBeenCalledTimes(1);
        expect(mockAguardar).toHaveBeenCalled();
      });
    });

    it('não reafirma a task registrada sem a permissão de segundo plano', async () => {
      await jest.isolateModulesAsync(async () => {
        const modulo = require('../unifiedLocationTracking');
        mockHasStartedLocationUpdates.mockResolvedValue(true);
        mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
        mockGetBackgroundPermissions.mockResolvedValue({ status: 'denied' });
        mockGetItem.mockResolvedValue(JSON.stringify(mockContext));

        await modulo.garantirRastreamentoDaRota(mockContext);

        expect(mockStartLocationUpdates).not.toHaveBeenCalled();
      });
    });

    it('religa o serviço sumido quando as duas permissões já existem', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(false);
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetItem.mockResolvedValue(null);

      const resultado = await garantirRastreamentoDaRota(mockContext);

      expect(resultado).toBe('religado');
      expect(mockStartLocationUpdates).toHaveBeenCalledTimes(1);
      // O contexto some junto com a task numa reinstalação; sem ele a task
      // roda e descarta toda posição.
      expect(mockSetItem).toHaveBeenCalledWith(
        '@rotamestre:tracking_context',
        JSON.stringify(mockContext),
      );
      expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();
      expect(mockRequestBackgroundPermissions).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('sem a permissão de segundo plano, não pede de surpresa nem inicia o serviço', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(false);
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValue({ status: 'denied' });
      mockGetItem.mockResolvedValue(null);

      const resultado = await garantirRastreamentoDaRota(mockContext);

      expect(resultado).toBe('sem-segundo-plano');
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
      expect(mockRequestBackgroundPermissions).not.toHaveBeenCalled();
      // A divulgação destacada só aparece no fluxo que o motorista aciona.
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('sem permissão nenhuma, não pede nada', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(false);
      mockGetForegroundPermissions.mockResolvedValue({ status: 'denied' });
      mockGetBackgroundPermissions.mockResolvedValue({ status: 'denied' });

      const resultado = await garantirRastreamentoDaRota(mockContext);

      expect(resultado).toBe('sem-permissao');
      expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
    });

    it('preserva o contexto já gravado para a mesma rota', async () => {
      const gravado = { ...mockContext, startedAt: '2025-12-25T08:00:00Z' };
      mockHasStartedLocationUpdates.mockResolvedValue(false);
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetItem.mockResolvedValue(JSON.stringify(gravado));

      await garantirRastreamentoDaRota(mockContext);

      const gravacoes = mockSetItem.mock.calls.map((c) => JSON.parse(c[1]));
      expect(gravacoes.every((g) => g.startedAt === gravado.startedAt)).toBe(
        true,
      );
    });

    it('troca o contexto que sobrou de outra rota', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(true);
      mockGetItem.mockResolvedValue(
        JSON.stringify({ ...mockContext, rotaId: 'rota-antiga' }),
      );

      await garantirRastreamentoDaRota(mockContext);

      expect(mockSetItem).toHaveBeenCalledWith(
        '@rotamestre:tracking_context',
        JSON.stringify(mockContext),
      );
    });

    it('devolve falhou quando o Android recusa iniciar o serviço', async () => {
      mockHasStartedLocationUpdates.mockResolvedValue(false);
      mockGetForegroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
      mockGetItem.mockResolvedValue(null);
      mockStartLocationUpdates.mockRejectedValueOnce(
        new Error('ForegroundServiceStartNotAllowedException'),
      );

      const resultado = await garantirRastreamentoDaRota(mockContext);

      expect(resultado).toBe('falhou');
    });
  });

  describe('stopBackgroundTracking', () => {
    it('deve parar tracking e remover contexto', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);
      mockStopLocationUpdates.mockResolvedValueOnce(undefined);

      await stopBackgroundTracking();

      expect(mockStopLocationUpdates).toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalled();
    });

    it('deve apenas remover contexto se não está rastreando', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      await stopBackgroundTracking();

      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalled();
    });
  });

  describe('isBackgroundTrackingActive', () => {
    it('deve retornar true quando ativo', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(true);
    });

    it('deve retornar false quando inativo', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(false);
    });

    it('deve retornar false em caso de erro', async () => {
      mockHasStartedLocationUpdates.mockRejectedValueOnce(new Error('Error'));

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(false);
    });
  });

  describe('getTrackingContext', () => {
    it('deve retornar contexto quando existe', async () => {
      mockGetItem.mockResolvedValueOnce(JSON.stringify(mockContext));

      const result = await getTrackingContext();

      expect(result).toEqual(mockContext);
    });

    it('deve retornar null quando não existe', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const result = await getTrackingContext();

      expect(result).toBeNull();
    });

    it('deve retornar null em caso de erro', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('Error'));

      const result = await getTrackingContext();

      expect(result).toBeNull();
    });
  });

  describe('updateTrackingContext', () => {
    it('deve atualizar contexto existente', async () => {
      mockGetItem.mockResolvedValueOnce(JSON.stringify(mockContext));

      await updateTrackingContext({ motoristaNome: 'Novo Nome' });

      expect(mockSetItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Novo Nome'),
      );
    });

    it('não deve fazer nada se contexto não existe', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      await updateTrackingContext({ motoristaNome: 'Novo Nome' });

      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe('requestAndStartTracking', () => {
    it('deve mostrar alerta e retornar started=false quando foreground negado', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({
        started: false,
        hasBackgroundPermission: false,
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permissão Necessária',
        expect.stringContaining('localização'),
        [{ text: 'OK' }],
      );
    });

    it('deve iniciar tracking com ambas permissões concedidas', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      // startBackgroundTracking internally calls checkLocationPermissions
      mockGetForegroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);
      mockStartLocationUpdates.mockResolvedValueOnce(undefined);

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: true, hasBackgroundPermission: true });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Localização durante a rota',
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('deve mostrar alerta de rastreamento limitado quando background negado', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({
        status: 'denied',
      });
      // startBackgroundTracking internally calls checkLocationPermissions
      mockGetForegroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'denied' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: true, hasBackgroundPermission: false });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Rastreamento Limitado',
        expect.stringContaining('segundo plano'),
        [{ text: 'Entendi' }],
      );
    });

    it('deve retornar started=false quando startBackgroundTracking falha', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({
        status: 'granted',
      });
      // startBackgroundTracking fails (foreground denied internally)
      mockGetForegroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'denied' });
      mockGetBackgroundPermissions
        .mockResolvedValueOnce({ status: 'undetermined' })
        .mockResolvedValueOnce({ status: 'denied' });

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: false, hasBackgroundPermission: true });
      // No alert for limited tracking since started=false
      expect(Alert.alert).toHaveBeenCalledWith(
        'Localização durante a rota',
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      );
    });
  });

  // A task de segundo plano é o caminho que mais roda sem rede (app fechado,
  // motorista na estrada): a posição que falha por rede fica no aparelho.
  describe('task de segundo plano sem rede', () => {
    it('guarda a posição na fila do aparelho em vez de perdê-la', async () => {
      mockGetItem.mockImplementation(async (chave: string) =>
        chave === '@rotamestre:tracking_context'
          ? JSON.stringify(mockContext)
          : null,
      );
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: { message: 'TypeError: Network request failed' },
        }),
      });

      await tarefaDeSegundoPlano({
        data: {
          locations: [
            {
              coords: {
                latitude: -7.1,
                longitude: -34.8,
                accuracy: 10,
                speed: null,
                heading: null,
              },
              timestamp: Date.UTC(2026, 9, 24, 12, 0),
            },
          ],
        },
        error: null,
      });

      const gravacaoNaFila = mockSetItem.mock.calls.find(
        ([chave]) => chave === '@rotamestre:fila_posicoes',
      );
      expect(gravacaoNaFila).toBeDefined();
      expect(JSON.parse(gravacaoNaFila![1]).posicoes).toEqual([
        expect.objectContaining({
          motorista_id: 'motorista-456',
          rota_id: 'rota-123',
          fonte: 'background',
          timestamp: '2026-10-24T12:00:00.000Z',
        }),
      ]);
    });
  });
  // MOT-2: o sistema pode entregar várias leituras num lote só (no iOS, a
  // cada 30 s / 100 m). Gravar a mais antiga deixava o marcador do gestor
  // atrás de onde o motorista já estava.
  describe('task de segundo plano com várias leituras no lote', () => {
    const leitura = (minuto: number, latitude: number) => ({
      coords: {
        latitude,
        longitude: -34.8,
        accuracy: 10,
        speed: null,
        heading: null,
      },
      timestamp: Date.UTC(2026, 9, 24, 12, minuto),
    });

    afterEach(() => {
      (supabase.from as jest.Mock).mockReset();
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
    });

    it.each([
      ['em ordem', [leitura(1, -7.1), leitura(2, -7.2), leitura(3, -7.3)]],
      ['fora de ordem', [leitura(1, -7.1), leitura(3, -7.3), leitura(2, -7.2)]],
    ])('grava só a mais recente, com o horário dela (%s)', async (_n, lote) => {
      const insert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockImplementation((tabela: string) =>
        tabela === 'rotas'
          ? {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        status: 'em_andamento',
                        motorista_id: 'motorista-456',
                      },
                      error: null,
                    }),
                }),
              }),
            }
          : { insert },
      );
      mockGetItem.mockImplementation(async (chave: string) =>
        chave === '@rotamestre:tracking_context'
          ? JSON.stringify(mockContext)
          : null,
      );

      await tarefaDeSegundoPlano({ data: { locations: lote }, error: null });

      expect(insert).toHaveBeenCalledTimes(1);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: -7.3,
          timestamp: '2026-10-24T12:03:00.000Z',
          fonte: 'background',
        }),
      );
    });
  });

  // MOT-1: a task headless roda sem tela nenhuma. Rota concluída pela web,
  // por outro aparelho, pela expiração ou reatribuída seguia gravando
  // posições por até ~21 h. A task confere a rota do contexto e para.
  describe('task de segundo plano confere se a rota ainda anda', () => {
    const insertPadrao = jest.fn();
    let rotaNoBanco: { data: unknown; error: unknown };
    let selectsDaRota: number;

    const umaPosicao = () =>
      tarefaDeSegundoPlano({
        data: {
          locations: [
            {
              coords: {
                latitude: -7.1,
                longitude: -34.8,
                accuracy: 10,
                speed: null,
                heading: null,
              },
              timestamp: Date.UTC(2026, 9, 24, 12, 0),
            },
          ],
        },
        error: null,
      });

    const recusaDeRls = {
      code: '42501',
      message: 'new row violates row-level security policy',
    };

    beforeEach(async () => {
      selectsDaRota = 0;
      rotaNoBanco = {
        data: { status: 'em_andamento', motorista_id: 'motorista-456' },
        error: null,
      };
      insertPadrao.mockReset();
      insertPadrao.mockResolvedValue({ error: null });
      mockLerSessao.mockReset();
      mockLerSessao.mockResolvedValue({
        session: { user: { id: 'motorista-456' } },
        offline: false,
      });
      (supabase.from as jest.Mock).mockImplementation((tabela: string) => {
        if (tabela === 'rotas') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => {
                  selectsDaRota++;
                  return Promise.resolve(rotaNoBanco);
                },
              }),
            }),
          };
        }
        return { insert: insertPadrao };
      });
      // Parar zera a contagem: a primeira posição depois confere.
      await stopBackgroundTracking();
      mockGetItem.mockImplementation(async (chave: string) =>
        chave === '@rotamestre:tracking_context'
          ? JSON.stringify(mockContext)
          : null,
      );
      mockHasStartedLocationUpdates.mockResolvedValue(true);
      mockStopLocationUpdates.mockClear();
      mockRemoveItem.mockClear();
    });

    afterEach(() => {
      (supabase.from as jest.Mock).mockReset();
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
    });

    it('para quando a conferência diz que a rota acabou', async () => {
      rotaNoBanco = {
        data: { status: 'concluida', motorista_id: 'motorista-456' },
        error: null,
      };

      await umaPosicao();

      expect(selectsDaRota).toBe(1);
      expect(mockStopLocationUpdates).toHaveBeenCalledTimes(1);
      expect(mockRemoveItem).toHaveBeenCalledWith(
        '@rotamestre:tracking_context',
      );
    });

    it('para quando a rota foi reatribuída a outro motorista', async () => {
      rotaNoBanco = {
        data: { status: 'em_andamento', motorista_id: 'outro-motorista' },
        error: null,
      };

      await umaPosicao();

      expect(mockStopLocationUpdates).toHaveBeenCalledTimes(1);
    });

    it('não para com a rota em andamento', async () => {
      await umaPosicao();

      expect(selectsDaRota).toBe(1);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
      expect(mockRemoveItem).not.toHaveBeenCalledWith(
        '@rotamestre:tracking_context',
      );
    });

    it('sem rede, não para', async () => {
      rotaNoBanco = {
        data: null,
        error: { message: 'TypeError: Network request failed' },
      };
      insertPadrao.mockResolvedValue({
        error: { message: 'TypeError: Network request failed' },
      });

      await umaPosicao();

      expect(selectsDaRota).toBe(1);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    it('rota que não aparece mais (apagada ou de outro) para, com a sessão do próprio motorista', async () => {
      rotaNoBanco = { data: null, error: null };

      await umaPosicao();

      expect(mockStopLocationUpdates).toHaveBeenCalledTimes(1);
    });

    it('rota que não aparece sem sessão confirmada não para (a consulta pode ter saído anônima)', async () => {
      rotaNoBanco = { data: null, error: null };
      mockLerSessao.mockResolvedValue({ session: null, offline: true });

      await umaPosicao();

      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    it('não para se o contexto mudou de rota durante a conferência', async () => {
      rotaNoBanco = {
        data: { status: 'concluida', motorista_id: 'motorista-456' },
        error: null,
      };
      let leituras = 0;
      mockGetItem.mockImplementation(async (chave: string) => {
        if (chave !== '@rotamestre:tracking_context') return null;
        leituras++;
        // A 1ª leitura é a da posição; depois, o motorista já iniciou outra.
        return JSON.stringify(
          leituras === 1
            ? mockContext
            : { ...mockContext, rotaId: 'rota-nova' },
        );
      });

      await umaPosicao();

      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    it(`confere na primeira posição e depois a cada ${POSICOES_ENTRE_CONFERENCIAS}`, async () => {
      await umaPosicao();
      expect(selectsDaRota).toBe(1);

      for (let i = 1; i < POSICOES_ENTRE_CONFERENCIAS; i++) await umaPosicao();
      expect(selectsDaRota).toBe(1);

      await umaPosicao();
      expect(selectsDaRota).toBe(2);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    it('posição recusada pelo banco (ex.: 42501 da rota de outro) confere fora da contagem', async () => {
      await umaPosicao();
      expect(selectsDaRota).toBe(1);
      // Respeita o espaçamento mínimo desde a última conferência.
      for (let i = 2; i < POSICOES_MINIMAS_ENTRE_CONFERENCIAS + 1; i++) {
        await umaPosicao();
      }
      expect(selectsDaRota).toBe(1);

      insertPadrao.mockResolvedValue({ error: recusaDeRls });
      rotaNoBanco = {
        data: { status: 'em_andamento', motorista_id: 'outro-motorista' },
        error: null,
      };

      await umaPosicao();

      expect(selectsDaRota).toBe(2);
      expect(mockStopLocationUpdates).toHaveBeenCalledTimes(1);
    });

    it('recusa do banco com a rota ainda viva (token vencido) não para', async () => {
      await umaPosicao();
      insertPadrao.mockResolvedValue({ error: recusaDeRls });

      for (let i = 0; i < POSICOES_MINIMAS_ENTRE_CONFERENCIAS; i++) {
        await umaPosicao();
      }

      expect(selectsDaRota).toBe(2);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    // Sessão anônima permanente (refresh token revogado): toda posição é
    // recusada. Sem espaçamento, cada uma fazia INSERT + SELECT + lerSessao.
    it(`recusas seguidas conferem no máximo a cada ${POSICOES_MINIMAS_ENTRE_CONFERENCIAS} posições`, async () => {
      await umaPosicao();
      expect(selectsDaRota).toBe(1);
      insertPadrao.mockResolvedValue({ error: recusaDeRls });

      for (let i = 0; i < 2 * POSICOES_MINIMAS_ENTRE_CONFERENCIAS; i++) {
        await umaPosicao();
      }

      expect(selectsDaRota).toBe(3);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    // A consulta saiu anônima (refresh falhou) e logo depois o token foi
    // renovado: a sessão lida só DEPOIS confirmaria um vazio que não era
    // resposta sobre este motorista.
    it('rota que não aparece com a sessão renovada só depois do SELECT não para', async () => {
      rotaNoBanco = { data: null, error: null };
      // Sem sessão até o SELECT sair; renovada logo depois.
      mockLerSessao.mockImplementation(async () =>
        selectsDaRota === 0
          ? { session: null, offline: true }
          : { session: { user: { id: 'motorista-456' } }, offline: false },
      );

      await umaPosicao();

      expect(selectsDaRota).toBe(1);
      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });

    it('rota que não aparece com a sessão perdida depois do SELECT não para', async () => {
      rotaNoBanco = { data: null, error: null };
      // Sessão boa até o SELECT; perdida logo depois (refresh falhou).
      mockLerSessao.mockImplementation(async () =>
        selectsDaRota === 0
          ? { session: { user: { id: 'motorista-456' } }, offline: false }
          : { session: null, offline: true },
      );

      await umaPosicao();

      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
    });
  });
});
