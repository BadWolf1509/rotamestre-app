import { googleMapsService, getCoordinates } from '../google';

// Mock fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('googleMapsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCoordinates', () => {
        it('deve retornar coordenadas quando API responde OK', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    results: [{ geometry: { location: { lat: 10, lng: 20 } } }],
                }),
            });

            const result = await getCoordinates('Rua Teste');
            expect(result).toEqual({ lat: 10, lng: 20 });
        });

        it('deve retornar null quando API falha ou não encontra', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({ status: 'ZERO_RESULTS', results: [] }),
            });

            const result = await getCoordinates('Rua Inexistente');
            expect(result).toBeNull();
        });
    });

    describe('autocompleteAddress', () => {
        it('deve retornar sugestões', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    predictions: [
                        {
                            place_id: '123',
                            description: 'Local Teste',
                            structured_formatting: { main_text: 'Local', secondary_text: 'Teste' },
                        },
                    ],
                }),
            });

            const result = await googleMapsService.autocompleteAddress('Loc');
            expect(result).toHaveLength(1);
            expect(result[0].place_id).toBe('123');
        });

        it('deve retornar array vazio se input < 3 chars', async () => {
            const result = await googleMapsService.autocompleteAddress('Lo');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('getPlaceDetails', () => {
        it('deve retornar detalhes do lugar', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Endereço Completo',
                        geometry: { location: { lat: 10, lng: 20 } },
                        address_components: [
                            { types: ['route'], long_name: 'Rua Teste' },
                            { types: ['street_number'], long_name: '123' },
                        ],
                    },
                }),
            });

            const result = await googleMapsService.getPlaceDetails('place_id_123');
            expect(result).not.toBeNull();
            expect(result?.logradouro).toBe('Rua Teste');
            expect(result?.numero).toBe('123');
            expect(result?.coordenadas).toEqual({ latitude: 10, longitude: 20 });
        });
    });

    describe('geocodeAddress', () => {
        it('deve geocodificar endereço', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    results: [{
                        formatted_address: 'Endereço Formatado',
                        geometry: { location: { lat: 10, lng: 20 } },
                        address_components: [],
                    }],
                }),
            });

            const result = await googleMapsService.geocodeAddress('Rua Teste');
            expect(result).not.toBeNull();
            expect(result?.coordenadas).toEqual({ latitude: 10, longitude: 20 });
        });
    });

    describe('reverseGeocode', () => {
        it('deve retornar endereço formatado', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    results: [{ formatted_address: 'Rua Teste, 123' }],
                }),
            });

            const result = await googleMapsService.reverseGeocode({ latitude: 10, longitude: 20 });
            expect(result).toBe('Rua Teste, 123');
        });
    });

    describe('getDirections', () => {
        it('deve retornar rota e detalhes', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    routes: [{
                        overview_polyline: { points: 'encoded_polyline' },
                        legs: [{
                            distance: { value: 1000 },
                            duration: { value: 600 },
                            start_address: 'A',
                            end_address: 'B',
                            start_location: { lat: 0, lng: 0 },
                            end_location: { lat: 1, lng: 1 },
                        }],
                    }],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result).not.toBeNull();
            expect(result?.distancia_total_metros).toBe(1000);
            expect(result?.legs).toHaveLength(1);
        });

        it('deve retornar null quando API retorna erro', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'ZERO_RESULTS',
                    routes: [],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result).toBeNull();
        });
    });

    describe('getDistanceMatrix', () => {
        it('deve calcular matriz de distâncias', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    rows: [{
                        elements: [{
                            distance: { value: 5000, text: '5 km' },
                            duration: { value: 300, text: '5 min' },
                            status: 'OK',
                        }],
                    }],
                }),
            });

            const result = await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 1, longitude: 1 }]
            );

            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(true);
            expect(result?.length).toBeGreaterThan(0);

            // Validar estrutura transformada
            if (result && result.length > 0) {
                expect(result[0]).toHaveProperty('origem');
                expect(result[0]).toHaveProperty('destinos');
                expect(result[0].destinos[0].distancia).toBe(5000);
                expect(result[0].destinos[0].tempo).toBe(300);
            }
        });

        it('deve retornar null quando API falha', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'INVALID_REQUEST',
                }),
            });

            const result = await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 1, longitude: 1 }]
            );

            expect(result).toBeNull();
        });
    });

    describe('Tratamento de erros', () => {
        it('autocompleteAddress deve retornar array vazio em caso de erro de rede', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await googleMapsService.autocompleteAddress('Test');
            expect(result).toEqual([]);
        });

        it('getPlaceDetails deve retornar null em caso de erro', async () => {
            mockFetch.mockRejectedValueOnce(new Error('API error'));

            const result = await googleMapsService.getPlaceDetails('invalid_id');
            expect(result).toBeNull();
        });

        it('geocodeAddress deve retornar null quando não encontra resultados', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'ZERO_RESULTS',
                    results: [],
                }),
            });

            const result = await googleMapsService.geocodeAddress('Endereço Inexistente');
            expect(result).toBeNull();
        });

        it('reverseGeocode deve retornar null em caso de erro', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'ERROR',
                    results: [],
                }),
            });

            const result = await googleMapsService.reverseGeocode({ latitude: 999, longitude: 999 });
            expect(result).toBeNull();
        });
    });
});
