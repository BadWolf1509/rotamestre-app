import NetInfo from '@react-native-community/netinfo';
import { offlineManager, QueuedRequest } from '../offline';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('offlineManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(offlineManager).toBeDefined();
        });

        it('should have queueRequest method', () => {
            expect(typeof offlineManager.queueRequest).toBe('function');
        });

        it('should have isOnline method', () => {
            expect(typeof offlineManager.isOnline).toBe('function');
        });

        it('should have getQueuedRequests method', () => {
            expect(typeof offlineManager.getQueuedRequests).toBe('function');
        });
    });

    describe('isOnline', () => {
        it('should return true when connected', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: true,
                isInternetReachable: true,
            } as any);

            const online = await offlineManager.isOnline();
            expect(online).toBe(true);
        });

        it('should return false when not connected', async () => {
            mockNetInfo.fetch.mockResolvedValueOnce({
                isConnected: false,
                isInternetReachable: false,
            } as any);

            const online = await offlineManager.isOnline();
            expect(online).toBe(false);
        });
    });

    describe('queueRequest', () => {
        it('should add request to queue', async () => {
            const request: QueuedRequest = {
                id: 'test-1',
                method: 'POST',
                url: '/api/test',
                data: { test: true },
                timestamp: Date.now(),
            };

            await offlineManager.queueRequest(request);
            const queued = await offlineManager.getQueuedRequests();

            expect(queued).toContainEqual(expect.objectContaining({
                id: 'test-1',
                method: 'POST',
            }));
        });
    });
});
