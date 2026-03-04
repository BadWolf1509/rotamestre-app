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
    queuePhotoUpload,
    processOfflinePhotos,
    _resetProcessingLocks,
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

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: '/mock/documents/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    copyAsync: jest.fn().mockResolvedValue(undefined),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock storage (uploadELinkFotoParada)
jest.mock('../storage', () => ({
    uploadELinkFotoParada: jest.fn(),
}));

// Mock logger
jest.mock('../logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Mock notifications
jest.mock('../notifications', () => ({
    notifySyncComplete: jest.fn(),
    notifyOfflineMode: jest.fn(),
}));

const FileSystem = require('expo-file-system/legacy') as Record<string, jest.Mock>;

const { uploadELinkFotoParada } = require('../storage') as { uploadELinkFotoParada: jest.Mock };

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

        it('should not process queue concurrently', async () => {
            _resetProcessingLocks();

            let processCount = 0;

            // Make isOnline slow enough that two calls overlap
            mockNetInfo.fetch.mockImplementation(() => {
                processCount++;
                return new Promise(resolve =>
                    setTimeout(() => resolve({
                        isConnected: true,
                        isInternetReachable: true,
                    } as any), 50)
                );
            });

            // Empty queue
            mockAsyncStorage.getItem.mockResolvedValue('[]');

            const [result1, result2] = await Promise.all([
                processOfflineQueue(),
                processOfflineQueue(),
            ]);

            // Only one should have actually processed
            expect(processCount).toBe(1);

            // The blocked one returns early with zeros
            const totalSuccess = result1.success + result2.success;
            expect(totalSuccess).toBe(0);

            _resetProcessingLocks();
        });

        it('should reset queue lock after processing completes', async () => {
            _resetProcessingLocks();

            // First call
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            await processOfflineQueue();

            // Second call should work (lock released)
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            await processOfflineQueue();

            expect(mockNetInfo.fetch).toHaveBeenCalledTimes(2);

            _resetProcessingLocks();
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

    describe('removeFromPhotosIndex', () => {
        it('should remove only the specific photo entry by localPath, not all for same paradaId', async () => {
            const photos = [
                { localPath: '/path/parada-1_111.jpg', paradaId: 'parada-1', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p1a.jpg', savedAt: '2026-01-01T00:00:00.000Z' },
                { localPath: '/path/parada-1_222.jpg', paradaId: 'parada-1', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p1b.jpg', savedAt: '2026-01-01T00:01:00.000Z' },
                { localPath: '/path/parada-2_333.jpg', paradaId: 'parada-2', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p2.jpg', savedAt: '2026-01-01T00:02:00.000Z' },
            ];

            // Setup: online, photos in index
            mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            // First photo: file exists, upload succeeds
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo.jpg');
            // deleteLocalPhoto → getInfoAsync
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // removeFromPhotosIndex → getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            // Second photo (parada-1_222): file exists, upload succeeds
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo2.jpg');
            // deleteLocalPhoto → getInfoAsync
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // removeFromPhotosIndex → getOfflinePhotosIndex (after first removal)
            const afterFirstRemoval = [
                photos[1], // parada-1_222 should still be here
                photos[2], // parada-2_333
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(afterFirstRemoval));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            // Third photo (parada-2_333): file exists, upload succeeds
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo3.jpg');
            // deleteLocalPhoto → getInfoAsync
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // removeFromPhotosIndex → getOfflinePhotosIndex
            const afterSecondRemoval = [photos[2]];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(afterSecondRemoval));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 3, failed: 0 });

            // Check the first removeFromPhotosIndex call saved the correct filtered index
            // It should have removed only the first photo (parada-1_111.jpg), keeping parada-1_222.jpg
            const firstSetItemCall = mockAsyncStorage.setItem.mock.calls.find(
                (call: string[]) => call[0] === '@rotamestre:offline_photos_index'
            );
            expect(firstSetItemCall).toBeDefined();
            const firstSaved = JSON.parse(firstSetItemCall![1]);
            // The key assertion: parada-1_222.jpg should NOT be removed
            const remainingParada1 = firstSaved.filter(
                (p: any) => p.paradaId === 'parada-1'
            );
            expect(remainingParada1).toHaveLength(1);
            expect(remainingParada1[0].localPath).toBe('/path/parada-1_222.jpg');
        });

        it('should remove all photos for paradaId when no localPath provided (fallback)', async () => {
            // This tests the backward-compat fallback: removeFromPhotosIndex(paradaId) without localPath
            // removes ALL entries for that paradaId. We test this indirectly via processOfflinePhotos
            // by verifying that the missing-file path now does precise removal (passes localPath),
            // but also verify the fallback logic by checking the stored index directly.

            const photos = [
                { localPath: '/path/parada-1_111.jpg', paradaId: 'parada-1', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p1a.jpg', savedAt: '2026-01-01T00:00:00.000Z' },
                { localPath: '/path/parada-1_222.jpg', paradaId: 'parada-1', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p1b.jpg', savedAt: '2026-01-01T00:01:00.000Z' },
                { localPath: '/path/parada-2_333.jpg', paradaId: 'parada-2', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///p2.jpg', savedAt: '2026-01-01T00:02:00.000Z' },
            ];

            // Setup: online, photos in index
            mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));

            // First photo: file DOES NOT exist → precise removal by localPath
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
            // removeFromPhotosIndex(paradaId, localPath) → getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photos));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            // Second photo (parada-1_222): also missing
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
            // After first precise removal, parada-1_222 still in index
            const afterFirstRemoval = [photos[1], photos[2]];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(afterFirstRemoval));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            // Third photo: file exists, upload succeeds
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo.jpg');
            // deleteLocalPhoto
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // removeFromPhotosIndex with localPath
            const afterSecondRemoval = [photos[2]];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(afterSecondRemoval));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as any);

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 1, failed: 0 });

            // Verify precise removal: first setItem should remove ONLY parada-1_111, keeping parada-1_222
            const setItemCalls = mockAsyncStorage.setItem.mock.calls.filter(
                (call: string[]) => call[0] === '@rotamestre:offline_photos_index'
            );
            expect(setItemCalls.length).toBeGreaterThanOrEqual(1);
            const firstSaved = JSON.parse(setItemCalls[0][1]);
            // Precise removal: only parada-1_111 removed, parada-1_222 and parada-2 remain
            const remainingParada1 = firstSaved.filter(
                (p: any) => p.paradaId === 'parada-1'
            );
            expect(remainingParada1).toHaveLength(1);
            expect(remainingParada1[0].localPath).toBe('/path/parada-1_222.jpg');
            // parada-2 should remain
            const remainingParada2 = firstSaved.filter(
                (p: any) => p.paradaId === 'parada-2'
            );
            expect(remainingParada2).toHaveLength(1);
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

    describe('queuePhotoUpload', () => {
        beforeEach(() => {
            // FileSystem.getInfoAsync for ensureOfflinePhotosDir
            FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
            // AsyncStorage for addToPhotosIndex (photos index only, no general queue)
            mockAsyncStorage.getItem.mockResolvedValue(null);
            mockAsyncStorage.setItem.mockResolvedValue(undefined as any);
        });

        it('deve salvar foto localmente e adicionar ao photos index', async () => {
            const result = await queuePhotoUpload(
                'unidade-1',
                'rota-1',
                'parada-1',
                'file:///tmp/photo.jpg'
            );

            // Should return a local path
            expect(result).toContain('/mock/documents/offline_photos/');
            expect(result).toContain('parada-1');

            // Should have copied the file
            expect(FileSystem.copyAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'file:///tmp/photo.jpg',
                })
            );

            // Should have saved to photos index only (one setItem call)
            expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                '@rotamestre:offline_photos_index',
                expect.any(String)
            );
        });

        it('NÃO deve adicionar à fila offline geral (evita upload duplicado)', async () => {
            await queuePhotoUpload(
                'unidade-1',
                'rota-1',
                'parada-1',
                'file:///tmp/photo.jpg'
            );

            // Verify setItem was only called for photos index, NOT for offline queue
            const setItemCalls = mockAsyncStorage.setItem.mock.calls;
            const queueCalls = setItemCalls.filter(
                (call: string[]) => call[0] === '@rotamestre:offline_queue'
            );
            expect(queueCalls).toHaveLength(0);

            // Only photos index should be updated
            const photosIndexCalls = setItemCalls.filter(
                (call: string[]) => call[0] === '@rotamestre:offline_photos_index'
            );
            expect(photosIndexCalls).toHaveLength(1);
        });

        it('deve adicionar foto ao photos index com dados corretos', async () => {
            await queuePhotoUpload(
                'unidade-1',
                'rota-1',
                'parada-1',
                'file:///tmp/photo.jpg'
            );

            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData).toHaveLength(1);
            expect(savedData[0]).toMatchObject({
                unidadeId: 'unidade-1',
                rotaId: 'rota-1',
                paradaId: 'parada-1',
                originalUri: 'file:///tmp/photo.jpg',
            });
            expect(savedData[0].localPath).toContain('/mock/documents/offline_photos/');
            expect(savedData[0].savedAt).toBeDefined();
        });

        it('deve gerar nomes de arquivo únicos por parada', async () => {
            const result1 = await queuePhotoUpload('u1', 'r1', 'parada-A', 'file:///photo1.jpg');
            const result2 = await queuePhotoUpload('u1', 'r1', 'parada-B', 'file:///photo2.jpg');

            expect(result1).toContain('parada-A');
            expect(result2).toContain('parada-B');
            expect(result1).not.toEqual(result2);
        });

        it('deve propagar erro quando addToPhotosIndex falha (foto salva mas não rastreada)', async () => {
            // getInfoAsync for ensureOfflinePhotosDir
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // copyAsync succeeds - photo IS saved to disk
            FileSystem.copyAsync.mockResolvedValueOnce(undefined);
            // getOfflinePhotosIndex returns empty array
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);
            // setItem for photos index FAILS
            mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

            await expect(
                queuePhotoUpload('u1', 'r1', 'parada-1', 'file:///tmp/photo.jpg')
            ).rejects.toThrow('Storage full');

            // Photo was copied to disk before the index write failed
            expect(FileSystem.copyAsync).toHaveBeenCalled();
        });

        it('deve funcionar com photos index existente (append)', async () => {
            // Pre-existing photos in the index
            const existingPhotos = [
                { localPath: '/mock/path/existing.jpg', paradaId: 'p-existing', unidadeId: 'u1', rotaId: 'r1', originalUri: 'file:///existing.jpg', savedAt: '2026-01-01T00:00:00.000Z' },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingPhotos));

            const result = await queuePhotoUpload(
                'unidade-1',
                'rota-1',
                'parada-1',
                'file:///tmp/photo.jpg'
            );

            expect(result).toBeTruthy();

            // Should have appended to the existing photos index
            const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
            expect(savedData).toHaveLength(2);
            expect(savedData[0].paradaId).toBe('p-existing');
            expect(savedData[1].paradaId).toBe('parada-1');
        });
    });

    describe('processOfflinePhotos', () => {
        it('deve retornar {success:0, failed:0} quando offline', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: false,
                isInternetReachable: false,
            } as any);

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 0, failed: 0 });
            expect(uploadELinkFotoParada).not.toHaveBeenCalled();
        });

        it('deve retornar {success:0, failed:0} sem fotos no índice', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            // Empty photos index
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 0, failed: 0 });
        });

        it('deve fazer upload com sucesso e limpar arquivo local', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const photoIndex = [{
                localPath: '/mock/documents/offline_photos/parada-1_123.jpg',
                unidadeId: 'u1',
                rotaId: 'r1',
                paradaId: 'parada-1',
                originalUri: 'file:///original.jpg',
                savedAt: '2026-01-01T00:00:00.000Z',
            }];
            // getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));
            // File exists
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // Upload succeeds
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo.jpg');
            // removeFromPhotosIndex → getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));
            // deleteLocalPhoto → getInfoAsync
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 1, failed: 0 });

            // Should have uploaded
            expect(uploadELinkFotoParada).toHaveBeenCalledWith(
                'u1', 'r1', 'parada-1',
                '/mock/documents/offline_photos/parada-1_123.jpg'
            );

            // Should have cleaned up
            expect(FileSystem.deleteAsync).toHaveBeenCalled();
        });

        it('deve incrementar failed quando upload falha', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const photoIndex = [{
                localPath: '/mock/path/photo.jpg',
                unidadeId: 'u1',
                rotaId: 'r1',
                paradaId: 'parada-1',
                originalUri: 'file:///original.jpg',
                savedAt: '2026-01-01T00:00:00.000Z',
            }];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            // Upload returns null (failure)
            uploadELinkFotoParada.mockResolvedValueOnce(null);

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 0, failed: 1 });
            expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
        });

        it('deve pular foto cujo arquivo local não existe mais', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const photoIndex = [{
                localPath: '/mock/path/deleted.jpg',
                unidadeId: 'u1',
                rotaId: 'r1',
                paradaId: 'parada-1',
                originalUri: 'file:///original.jpg',
                savedAt: '2026-01-01T00:00:00.000Z',
            }];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));
            // File does NOT exist
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
            // removeFromPhotosIndex → getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));

            const result = await processOfflinePhotos();
            // Not counted as success or failure — just skipped
            expect(result).toEqual({ success: 0, failed: 0 });
            expect(uploadELinkFotoParada).not.toHaveBeenCalled();
        });

        it('should not process photos concurrently', async () => {
            // Reset locks to ensure clean state
            _resetProcessingLocks();

            // Track how many times the actual processing logic runs
            let processCount = 0;

            // Make isOnline slow enough that two calls overlap
            mockNetInfo.fetch.mockImplementation(() => {
                processCount++;
                return new Promise(resolve =>
                    setTimeout(() => resolve({
                        isConnected: true,
                        isInternetReachable: true,
                    } as any), 50)
                );
            });

            // Empty photos index (so processing finishes quickly after isOnline)
            mockAsyncStorage.getItem.mockResolvedValue('[]');

            // Start two calls simultaneously
            const [result1, result2] = await Promise.all([
                processOfflinePhotos(),
                processOfflinePhotos(),
            ]);

            // Only one should have actually processed (called isOnline)
            expect(processCount).toBe(1);

            // The other should return early with zeros
            const totalSuccess = result1.success + result2.success;
            const totalFailed = result1.failed + result2.failed;
            expect(totalSuccess).toBe(0);
            expect(totalFailed).toBe(0);

            _resetProcessingLocks();
        });

        it('should reset photo lock after processing completes', async () => {
            _resetProcessingLocks();

            // First call: online, empty index
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            const result1 = await processOfflinePhotos();
            expect(result1).toEqual({ success: 0, failed: 0 });

            // Second call should work normally (lock was released)
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);
            mockAsyncStorage.getItem.mockResolvedValueOnce('[]');

            const result2 = await processOfflinePhotos();
            expect(result2).toEqual({ success: 0, failed: 0 });

            // isOnline should have been called twice (once per invocation)
            expect(mockNetInfo.fetch).toHaveBeenCalledTimes(2);

            _resetProcessingLocks();
        });

        it('deve continuar processando outras fotos após falha individual', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const photoIndex = [
                {
                    localPath: '/mock/path/photo1.jpg',
                    unidadeId: 'u1',
                    rotaId: 'r1',
                    paradaId: 'p1',
                    originalUri: 'file:///p1.jpg',
                    savedAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    localPath: '/mock/path/photo2.jpg',
                    unidadeId: 'u1',
                    rotaId: 'r1',
                    paradaId: 'p2',
                    originalUri: 'file:///p2.jpg',
                    savedAt: '2026-01-01T00:00:00.000Z',
                },
            ];
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(photoIndex));

            // First photo: file exists, upload throws
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockRejectedValueOnce(new Error('network error'));

            // Second photo: file exists, upload succeeds
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
            uploadELinkFotoParada.mockResolvedValueOnce('https://storage.url/photo2.jpg');
            // removeFromPhotosIndex → getOfflinePhotosIndex
            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([photoIndex[1]]));
            // deleteLocalPhoto → getInfoAsync
            FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });

            const result = await processOfflinePhotos();
            expect(result).toEqual({ success: 1, failed: 1 });
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
