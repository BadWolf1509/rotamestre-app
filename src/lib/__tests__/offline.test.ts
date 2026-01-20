import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {
    isOnline,
    addToOfflineQueue,
    getOfflineQueue,
    clearOfflineQueue,
    processOfflineQueue,
    saveOfflineData,
    getOfflineData,
    clearOfflineData,
    hasOfflineData,
    getOfflineQueueSize,
    setupOfflineSync,
    getOfflinePhotosIndex,
    getPendingPhotosCount,
    hasOfflinePhoto,
    getOfflinePhotoPath,
} from '../offline';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(),
    addEventListener: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Mock Supabase
jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            update: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
            insert: jest.fn(() => Promise.resolve({ error: null })),
        })),
    },
}));

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('offline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isOnline', () => {
        it('deve retornar true quando conectado e com internet acessível', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const result = await isOnline();
            expect(result).toBe(true);
            expect(mockNetInfo.fetch).toHaveBeenCalled();
        });

        it('deve retornar false quando não conectado', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: false,
                isInternetReachable: false,
            } as any);

            const result = await isOnline();
            expect(result).toBe(false);
        });

        it('deve retornar false quando internet não é acessível', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: false,
            } as any);

            const result = await isOnline();
            expect(result).toBe(false);
        });

        it('deve retornar false quando isConnected é null', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: null,
                isInternetReachable: true,
            } as any);

            const result = await isOnline();
            expect(result).toBe(false);
        });
    });

    describe('getOfflineQueue', () => {
        it('deve retornar array vazio quando não há dados', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getOfflineQueue();
            expect(result).toEqual([]);
        });

        it('deve retornar fila parseada do storage', async () => {
            const queue = [
                { id: '1', type: 'update_parada', data: {}, timestamp: '2024-01-01' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(queue));

            const result = await getOfflineQueue();
            expect(result).toEqual(queue);
        });

        it('deve retornar array vazio quando há erro ao ler', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

            const result = await getOfflineQueue();
            expect(result).toEqual([]);
        });
    });

    describe('addToOfflineQueue', () => {
        it('deve adicionar ação à fila vazia', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await addToOfflineQueue({
                type: 'update_parada',
                data: { id: '123', status: 'concluida' },
            });

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                '@rotamestre:offline_queue',
                expect.stringContaining('update_parada')
            );
        });

        it('deve adicionar ação à fila existente', async () => {
            const existingQueue = [
                { id: '1', type: 'insert_log', data: {}, timestamp: '2024-01-01' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingQueue));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await addToOfflineQueue({
                type: 'update_parada',
                data: { id: '123' },
            });

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData).toHaveLength(2);
        });

        it('deve gerar id único para cada ação', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await addToOfflineQueue({
                type: 'update_parada',
                data: {},
            });

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData[0].id).toMatch(/^offline_\d+_[a-z0-9]+$/);
        });

        it('deve adicionar timestamp ISO à ação', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await addToOfflineQueue({
                type: 'insert_log',
                data: {},
            });

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('deve propagar erro quando falha ao salvar', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Save failed'));

            await expect(
                addToOfflineQueue({ type: 'update_parada', data: {} })
            ).rejects.toThrow('Save failed');
        });
    });

    describe('clearOfflineQueue', () => {
        it('deve remover item do storage', async () => {
            mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

            await clearOfflineQueue();

            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
                '@rotamestre:offline_queue'
            );
        });

        it('deve lidar silenciosamente com erro', async () => {
            mockAsyncStorage.removeItem.mockRejectedValueOnce(new Error('Remove failed'));

            // Não deve lançar erro
            await expect(clearOfflineQueue()).resolves.toBeUndefined();
        });
    });

    describe('processOfflineQueue', () => {
        it('deve retornar zeros quando offline', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: false,
                isInternetReachable: false,
            } as any);

            const result = await processOfflineQueue();

            expect(result).toEqual({ success: 0, failed: 0, errors: [] });
        });

        it('deve processar fila quando online', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const queue = [
                { id: '1', type: 'update_parada', data: { id: '123', status: 'concluida' }, timestamp: '2024-01-01' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(queue));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            const result = await processOfflineQueue();

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
        });

        it('deve retornar success 0 quando fila está vazia', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            const result = await processOfflineQueue();

            expect(result.success).toBe(0);
            expect(result.failed).toBe(0);
        });
    });

    describe('saveOfflineData', () => {
        it('deve salvar dados no storage', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await saveOfflineData({ rota: { id: '1', nome: 'Teste' } });

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                '@rotamestre:offline_data',
                expect.stringContaining('rota')
            );
        });

        it('deve mesclar com dados existentes', async () => {
            const existingData = { rota: { id: '1' } };
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingData));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await saveOfflineData({ paradas: [{ id: 'p1' }] });

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData.rota).toEqual({ id: '1' });
            expect(savedData.paradas).toEqual([{ id: 'p1' }]);
        });

        it('deve adicionar lastSync automaticamente', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await saveOfflineData({ rota: {} });

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData.lastSync).toBeDefined();
        });

        it('deve propagar erro quando falha ao salvar', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Save failed'));

            await expect(saveOfflineData({})).rejects.toThrow('Save failed');
        });
    });

    describe('getOfflineData', () => {
        it('deve retornar objeto vazio quando não há dados', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getOfflineData();
            expect(result).toEqual({});
        });

        it('deve retornar dados parseados', async () => {
            const data = { rota: { id: '1' }, paradas: [] };
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(data));

            const result = await getOfflineData();
            expect(result).toEqual(data);
        });

        it('deve retornar objeto vazio quando há erro', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Read error'));

            const result = await getOfflineData();
            expect(result).toEqual({});
        });
    });

    describe('clearOfflineData', () => {
        it('deve remover dados do storage', async () => {
            mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

            await clearOfflineData();

            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
                '@rotamestre:offline_data'
            );
        });

        it('deve lidar silenciosamente com erro', async () => {
            mockAsyncStorage.removeItem.mockRejectedValueOnce(new Error('Error'));

            await expect(clearOfflineData()).resolves.toBeUndefined();
        });
    });

    describe('hasOfflineData', () => {
        it('deve retornar false quando não há dados', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await hasOfflineData();
            expect(result).toBe(false);
        });

        it('deve retornar true quando há rota', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
                rota: { id: '1' },
            }));

            const result = await hasOfflineData();
            expect(result).toBe(true);
        });

        it('deve retornar true quando há paradas', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
                paradas: [{ id: 'p1' }],
            }));

            const result = await hasOfflineData();
            expect(result).toBe(true);
        });

        it('deve retornar false quando paradas está vazio', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
                paradas: [],
            }));

            const result = await hasOfflineData();
            expect(result).toBe(false);
        });

        it('deve retornar false quando há erro', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Error'));

            const result = await hasOfflineData();
            expect(result).toBe(false);
        });
    });

    describe('getOfflineQueueSize', () => {
        it('deve retornar 0 quando fila está vazia', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getOfflineQueueSize();
            expect(result).toBe(0);
        });

        it('deve retornar tamanho correto da fila', async () => {
            const queue = [
                { id: '1', type: 'update_parada', data: {}, timestamp: '' },
                { id: '2', type: 'insert_log', data: {}, timestamp: '' },
                { id: '3', type: 'finalizar_rota', data: {}, timestamp: '' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(queue));

            const result = await getOfflineQueueSize();
            expect(result).toBe(3);
        });

        it('deve retornar 0 quando há erro', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Error'));

            const result = await getOfflineQueueSize();
            expect(result).toBe(0);
        });
    });

    describe('getOfflinePhotosIndex', () => {
        it('deve retornar array vazio quando não há fotos', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getOfflinePhotosIndex();
            expect(result).toEqual([]);
        });

        it('deve retornar fotos parseadas do storage', async () => {
            const photos = [
                { localPath: '/path/1.jpg', paradaId: 'p1', unidadeId: 'u1', rotaId: 'r1' },
                { localPath: '/path/2.jpg', paradaId: 'p2', unidadeId: 'u1', rotaId: 'r1' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await getOfflinePhotosIndex();
            expect(result).toEqual(photos);
        });

        it('deve retornar array vazio quando há erro ao ler', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

            const result = await getOfflinePhotosIndex();
            expect(result).toEqual([]);
        });
    });

    describe('getPendingPhotosCount', () => {
        it('deve retornar 0 quando não há fotos pendentes', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getPendingPhotosCount();
            expect(result).toBe(0);
        });

        it('deve retornar quantidade correta de fotos pendentes', async () => {
            const photos = [
                { localPath: '/path/1.jpg', paradaId: 'p1' },
                { localPath: '/path/2.jpg', paradaId: 'p2' },
                { localPath: '/path/3.jpg', paradaId: 'p3' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await getPendingPhotosCount();
            expect(result).toBe(3);
        });
    });

    describe('hasOfflinePhoto', () => {
        it('deve retornar false quando não há fotos', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await hasOfflinePhoto('p1');
            expect(result).toBe(false);
        });

        it('deve retornar true quando parada tem foto offline', async () => {
            const photos = [
                { localPath: '/path/1.jpg', paradaId: 'p1' },
                { localPath: '/path/2.jpg', paradaId: 'p2' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await hasOfflinePhoto('p1');
            expect(result).toBe(true);
        });

        it('deve retornar false quando parada não tem foto offline', async () => {
            const photos = [
                { localPath: '/path/1.jpg', paradaId: 'p1' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await hasOfflinePhoto('p3');
            expect(result).toBe(false);
        });
    });

    describe('getOfflinePhotoPath', () => {
        it('deve retornar null quando não há fotos', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await getOfflinePhotoPath('p1');
            expect(result).toBeNull();
        });

        it('deve retornar caminho da foto quando existe', async () => {
            const photos = [
                { localPath: '/path/to/photo.jpg', paradaId: 'p1' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await getOfflinePhotoPath('p1');
            expect(result).toBe('/path/to/photo.jpg');
        });

        it('deve retornar null quando foto não existe para parada', async () => {
            const photos = [
                { localPath: '/path/to/photo.jpg', paradaId: 'p1' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            const result = await getOfflinePhotoPath('p2');
            expect(result).toBeNull();
        });
    });

    describe('setupOfflineSync', () => {
        it('deve registrar listener de NetInfo', () => {
            setupOfflineSync();

            expect(mockNetInfo.addEventListener).toHaveBeenCalled();
        });

        it('deve retornar função de unsubscribe', () => {
            const mockUnsubscribe = jest.fn();
            mockNetInfo.addEventListener.mockReturnValueOnce(mockUnsubscribe);

            const unsubscribe = setupOfflineSync();

            expect(unsubscribe).toBe(mockUnsubscribe);
        });

        it('deve processar fila quando reconecta', async () => {
            let connectionCallback: any;
            mockNetInfo.addEventListener.mockImplementation((callback) => {
                connectionCallback = callback;
                return jest.fn();
            });

            setupOfflineSync();

            // Simula reconexão
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');
            await connectionCallback({ isConnected: true, isInternetReachable: true });

            expect(mockAsyncStorage.getItem).toHaveBeenCalled();
        });

        it('não deve processar fila quando desconectado, mas verifica pendências para notificação', async () => {
            let connectionCallback: any;
            mockNetInfo.addEventListener.mockImplementation((callback) => {
                connectionCallback = callback;
                return jest.fn();
            });

            // Mock para retornar fila vazia
            mockAsyncStorage.getItem.mockResolvedValue(null);

            setupOfflineSync();

            // Simula desconexão
            await connectionCallback({ isConnected: false, isInternetReachable: false });

            // Deve chamar getItem para verificar pendências (para notificação offline)
            // mas não deve processar a fila
            expect(mockAsyncStorage.getItem).toHaveBeenCalled();
            // Não deve chamar setItem (que seria chamado se processasse a fila)
            expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });
});

// Legacy export para compatibilidade
export const offlineManager = {
    isOnline,
    queueRequest: addToOfflineQueue,
    getQueuedRequests: getOfflineQueue,
};

export interface QueuedRequest {
    id: string;
    method: string;
    url: string;
    data?: any;
    timestamp: number;
}
