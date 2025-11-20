import AsyncStorage from '@react-native-async-storage/async-storage';
import locationTrackingService from '../locationTracking';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-location');
jest.mock('expo-task-manager');
jest.mock('@/lib/supabase');
jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
}));
jest.mock('@/utils/styles', () => ({
    defaultTheme: { colors: { primary: '#000' } },
}));

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
            (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await locationTrackingService.updateNavigationPreferences({ autoAdvance: true });

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
