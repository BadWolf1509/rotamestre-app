// Mock dependencies BEFORE imports
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
    stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
    Accuracy: { BestForNavigation: 6, High: 4 },
}));

jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
    isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
    unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn().mockResolvedValue({ error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        })),
    },
}));

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    Platform: { OS: 'ios' },
}));

jest.mock('@/utils/styles', () => ({
    defaultTheme: { colors: { primary: '#000' } },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import locationTrackingService from '../locationTracking';

describe('LocationTrackingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    });

    describe('getNavigationPreferences', () => {
        it('deve retornar objeto vazio se não existirem preferências salvas', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            const prefs = await locationTrackingService.getNavigationPreferences();

            expect(prefs).toEqual({});
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('navigationPreferences');
        });

        it('deve carregar preferências salvas', async () => {
            const savedPrefs = {
                autoAdvance: false,
                soundAlerts: true,
                vibrationAlerts: false,
                proximityRadius: 100,
            };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(savedPrefs));

            const prefs = await locationTrackingService.getNavigationPreferences();

            expect(prefs).toEqual(savedPrefs);
        });

        it('deve retornar objeto vazio em caso de erro no parse JSON', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json{');

            const prefs = await locationTrackingService.getNavigationPreferences();

            expect(prefs).toEqual({});
        });
    });

    describe('updateNavigationPreferences', () => {
        it('deve atualizar preferências existentes (merge)', async () => {
            const currentPrefs = { autoAdvance: true, soundAlerts: false };
            const newPrefs = { vibrationAlerts: true, proximityRadius: 75 };

            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(currentPrefs));

            await locationTrackingService.updateNavigationPreferences(newPrefs);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'navigationPreferences',
                JSON.stringify({
                    autoAdvance: true,
                    soundAlerts: false,
                    vibrationAlerts: true,
                    proximityRadius: 75,
                })
            );
        });

        it('deve criar preferências se não existirem', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
            const newPrefs = { autoAdvance: false };

            await locationTrackingService.updateNavigationPreferences(newPrefs);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'navigationPreferences',
                JSON.stringify(newPrefs)
            );
        });

        it('deve tratar erro ao atualizar preferências', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            // getNavigationPreferences trata seu próprio erro, então fazemos setItem falhar
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
            (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await locationTrackingService.updateNavigationPreferences({ autoAdvance: true });

            expect(consoleSpy).toHaveBeenCalledWith('Error updating preferences:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
