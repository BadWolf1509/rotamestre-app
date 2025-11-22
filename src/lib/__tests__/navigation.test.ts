import { Alert, Linking } from 'react-native';

import {
    abrirNavegacao,
    abrirNavegacaoDireta,
    verificarAppInstalado,
    abrirNavegacaoRotaCompleta,
    Coordenadas,
} from '../navigation';

// Mock Linking
jest.mock('react-native', () => ({
    Linking: {
        canOpenURL: jest.fn().mockResolvedValue(true),
        openURL: jest.fn().mockResolvedValue(true),
    },
    Platform: {
        OS: 'ios',
        select: jest.fn((obj: any) => obj.ios || obj.android),
    },
    Alert: {
        alert: jest.fn((title, message, buttons) => {
            // Simula pressionar o primeiro botão
            if (buttons && buttons[0] && buttons[0].onPress) {
                buttons[0].onPress();
            }
        }),
    },
    ActionSheetIOS: {
        showActionSheetWithOptions: jest.fn(),
    },
}));

describe('navigation lib', () => {
    const mockCoords: Coordenadas = {
        latitude: -23.5505,
        longitude: -46.6333,
        endereco: 'Rua Teste, 123',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('abrirNavegacao', () => {
        it('deve ser uma função', () => {
            expect(typeof abrirNavegacao).toBe('function');
        });

        it('deve aceitar coordenadas como parâmetro', () => {
            expect(() => abrirNavegacao(mockCoords)).not.toThrow();
        });
    });

    describe('abrirNavegacaoDireta', () => {
        it('deve ser uma função', () => {
            expect(typeof abrirNavegacaoDireta).toBe('function');
        });

        it('deve abrir Google Maps quando appName é google', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

            await abrirNavegacaoDireta(mockCoords, 'google');

            expect(Linking.openURL).toHaveBeenCalled();
        });

        it('deve abrir Waze quando appName é waze', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

            await abrirNavegacaoDireta(mockCoords, 'waze');

            expect(Linking.openURL).toHaveBeenCalled();
        });

        it('deve usar fallback quando app não está instalado', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

            await abrirNavegacaoDireta(mockCoords, 'google');

            expect(Linking.openURL).toHaveBeenCalled();
        });
    });

    describe('verificarAppInstalado', () => {
        it('deve ser uma função', () => {
            expect(typeof verificarAppInstalado).toBe('function');
        });

        it('deve verificar se Waze está instalado', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

            const result = await verificarAppInstalado('waze');

            expect(Linking.canOpenURL).toHaveBeenCalledWith('waze://');
            expect(result).toBe(true);
        });

        it('deve verificar se Google Maps está instalado', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

            const result = await verificarAppInstalado('google');

            expect(Linking.canOpenURL).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('deve retornar false quando app não está instalado', async () => {
            (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

            const result = await verificarAppInstalado('waze');

            expect(result).toBe(false);
        });
    });

    describe('abrirNavegacaoRotaCompleta', () => {
        it('deve ser uma função', () => {
            expect(typeof abrirNavegacaoRotaCompleta).toBe('function');
        });

        it('deve mostrar alerta quando há menos de 2 paradas', () => {
            abrirNavegacaoRotaCompleta([mockCoords]);

            expect(Alert.alert).toHaveBeenCalledWith(
                'Rota Incompleta',
                'É necessário pelo menos 2 paradas para iniciar navegação.'
            );
        });

        it('deve aceitar array de paradas', () => {
            const paradas: Coordenadas[] = [
                { latitude: -23.5505, longitude: -46.6333 },
                { latitude: -23.5600, longitude: -46.6400 },
            ];

            expect(() => abrirNavegacaoRotaCompleta(paradas)).not.toThrow();
        });
    });

    describe('Coordenadas interface', () => {
        it('deve aceitar latitude e longitude', () => {
            const coords: Coordenadas = {
                latitude: -23.5505,
                longitude: -46.6333,
            };

            expect(coords.latitude).toBe(-23.5505);
            expect(coords.longitude).toBe(-46.6333);
        });

        it('deve aceitar endereco opcional', () => {
            const coords: Coordenadas = {
                latitude: -23.5505,
                longitude: -46.6333,
                endereco: 'Rua Teste',
            };

            expect(coords.endereco).toBe('Rua Teste');
        });
    });
});
