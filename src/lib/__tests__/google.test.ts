import { googleMapsService, getCoordinates } from '../google';
import { clearCache } from '../osrm';

// Mock fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Helper para criar mock de resposta OSRM Route API
 */
function createOSRMRouteResponse(options: {
    distance: number;
    duration: number;
    geometry?: string;
    legs?: Array<{ distance: number; duration: number }>;
}) {
    const legs = options.legs || [{ distance: options.distance, duration: options.duration }];
    return {
        code: 'Ok',
        routes: [{
            distance: options.distance,
            duration: options.duration,
            geometry: options.geometry || 'encoded_polyline',
            legs: legs.map(leg => ({
                distance: leg.distance,
                duration: leg.duration,
                steps: [],
            })),
        }],
        waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
        ],
    };
}

// Helper para criar mock de resposta OSRM Trip API (rota circular/otimizada)
// Mantido comentado para referência futura caso seja necessário testar rotas circulares otimizadas
// function createOSRMTripResponse(options: {...}) {...}

describe('googleMapsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearCache(); // Limpar cache do OSRM entre testes
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

        it('deve incluir sessionToken na URL quando fornecido', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    predictions: [],
                }),
            });

            await googleMapsService.autocompleteAddress('Teste', 'session-token-123');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('sessiontoken=session-token-123')
            );
        });

        it('deve filtrar resultados apenas do Brasil', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    predictions: [],
                }),
            });

            await googleMapsService.autocompleteAddress('Teste');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('components=country:br')
            );
        });

        it('deve usar idioma pt-BR', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    predictions: [],
                }),
            });

            await googleMapsService.autocompleteAddress('Teste');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('language=pt-BR')
            );
        });

        it('deve tratar predictions sem secondary_text', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    predictions: [
                        {
                            place_id: '456',
                            description: 'Local sem secondary',
                            structured_formatting: { main_text: 'Local' },
                        },
                    ],
                }),
            });

            const result = await googleMapsService.autocompleteAddress('Local');
            expect(result[0].structured_formatting.secondary_text).toBe('');
        });

        it('deve retornar array vazio quando status não é OK', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'ZERO_RESULTS',
                }),
            });

            const result = await googleMapsService.autocompleteAddress('NaoExiste');
            expect(result).toEqual([]);
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

        it('deve incluir sessionToken na URL quando fornecido', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Test',
                        geometry: { location: { lat: 0, lng: 0 } },
                        address_components: [],
                    },
                }),
            });

            await googleMapsService.getPlaceDetails('place_123', 'token-456');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('sessiontoken=token-456')
            );
        });

        it('deve extrair todos os componentes do endereço corretamente', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Rua Teste, 123 - Centro, São Paulo - SP, 01234-567',
                        geometry: { location: { lat: -23.5505, lng: -46.6333 } },
                        address_components: [
                            { types: ['route'], long_name: 'Rua Teste' },
                            { types: ['street_number'], long_name: '123' },
                            { types: ['sublocality'], long_name: 'Centro' },
                            { types: ['locality'], long_name: 'São Paulo' },
                            { types: ['administrative_area_level_1'], long_name: 'SP' },
                            { types: ['postal_code'], long_name: '01234-567' },
                        ],
                    },
                }),
            });

            const result = await googleMapsService.getPlaceDetails('complete_address');
            expect(result).toEqual({
                logradouro: 'Rua Teste',
                numero: '123',
                bairro: 'Centro',
                cidade: 'São Paulo',
                estado: 'SP',
                cep: '01234-567',
                coordenadas: { latitude: -23.5505, longitude: -46.6333 },
                formatted_address: 'Rua Teste, 123 - Centro, São Paulo - SP, 01234-567',
            });
        });

        it('deve usar neighborhood como fallback para bairro', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Test',
                        geometry: { location: { lat: 0, lng: 0 } },
                        address_components: [
                            { types: ['neighborhood'], long_name: 'Bairro Alternativo' },
                        ],
                    },
                }),
            });

            const result = await googleMapsService.getPlaceDetails('test');
            expect(result?.bairro).toBe('Bairro Alternativo');
        });

        it('deve usar administrative_area_level_2 como fallback para cidade', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Test',
                        geometry: { location: { lat: 0, lng: 0 } },
                        address_components: [
                            { types: ['administrative_area_level_2'], long_name: 'Região Metropolitana' },
                        ],
                    },
                }),
            });

            const result = await googleMapsService.getPlaceDetails('test');
            expect(result?.cidade).toBe('Região Metropolitana');
        });

        it('deve tratar componentes faltando graciosamente', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    result: {
                        formatted_address: 'Endereço Parcial',
                        geometry: { location: { lat: 10, lng: 20 } },
                        address_components: [],
                    },
                }),
            });

            const result = await googleMapsService.getPlaceDetails('partial');
            expect(result).toEqual({
                logradouro: '',
                numero: '',
                bairro: '',
                cidade: '',
                estado: '',
                cep: '',
                coordenadas: { latitude: 10, longitude: 20 },
                formatted_address: 'Endereço Parcial',
            });
        });

        it('deve retornar null quando status não é OK', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    status: 'NOT_FOUND',
                }),
            });

            const result = await googleMapsService.getPlaceDetails('invalid');
            expect(result).toBeNull();
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

    describe('getDirections (OSRM - gratuito!)', () => {
        it('deve retornar rota e detalhes usando OSRM', async () => {
            // Mock OSRM Route API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 1000,
                    duration: 600,
                    geometry: 'encoded_polyline',
                })),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result).not.toBeNull();
            expect(result?.distancia_total_metros).toBe(1000);
            expect(result?.legs).toHaveLength(1);

            // Verificar que usou OSRM (router.project-osrm.org)
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('router.project-osrm.org'),
                expect.any(Object)
            );
        });

        it('deve retornar fallback Haversine quando OSRM falha (graceful degradation)', async () => {
            // OSRM retorna código de erro
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    code: 'NoRoute',
                    routes: [],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            // OSRM usa Haversine fallback, nunca retorna null
            expect(result).not.toBeNull();
            expect(result?.distancia_total_metros).toBeGreaterThan(0); // Haversine estimate
        });

        it('deve retornar fallback Haversine quando não há rotas', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    code: 'Ok',
                    routes: [],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            // Haversine fallback
            expect(result).not.toBeNull();
            expect(result?.distancia_total_metros).toBeGreaterThan(0);
        });

        it('deve usar OSRM Route API para rotas não-circulares', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 3000,
                    duration: 900,
                    legs: [
                        { distance: 1000, duration: 300 },
                        { distance: 2000, duration: 600 },
                    ],
                })),
            });

            const waypoints = [
                { latitude: 0.5, longitude: 0.5 },
            ];

            await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 2, longitude: 2 }, // Destino diferente da origem
                waypoints
            );

            // OSRM Route API usa GET
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('router.project-osrm.org/route/v1/driving'),
                expect.objectContaining({
                    method: 'GET',
                })
            );
        });

        it('deve retornar ordem dos waypoints para rota não otimizada', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 1000,
                    duration: 300,
                    legs: [
                        { distance: 333, duration: 100 },
                        { distance: 333, duration: 100 },
                        { distance: 334, duration: 100 },
                    ],
                })),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 3, longitude: 3 },
                [
                    { latitude: 1, longitude: 1 },
                    { latitude: 2, longitude: 2 },
                ]
            );

            // Para rota simples (não circular), a ordem é a mesma da entrada
            expect(result?.ordem_otimizada).toEqual([0, 1]);
        });

        it('deve somar distâncias de múltiplas legs corretamente', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 4500,
                    duration: 1350,
                    legs: [
                        { distance: 1000, duration: 300 },
                        { distance: 2000, duration: 600 },
                        { distance: 1500, duration: 450 },
                    ],
                })),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 3, longitude: 3 },
                [
                    { latitude: 1, longitude: 1 },
                    { latitude: 2, longitude: 2 },
                ]
            );

            expect(result?.distancia_total_metros).toBe(4500);
            expect(result?.duracao_total_segundos).toBe(1350);
            expect(result?.legs).toHaveLength(3);
        });

        it('deve usar OSRM GET request (gratuito vs Google POST pago)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 1000,
                    duration: 300,
                })),
            });

            await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            // OSRM usa GET, não POST
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('router.project-osrm.org'),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('deve retornar array vazio para ordem_otimizada quando não há waypoints', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 1000,
                    duration: 300,
                })),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result?.ordem_otimizada).toEqual([]);
        });

        it('deve mapear corretamente as informações de cada leg', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
                    distance: 5000,
                    duration: 900,
                })),
            });

            const result = await googleMapsService.getDirections(
                { latitude: -23.5505, longitude: -46.6333 },
                { latitude: -23.5615, longitude: -46.6561 }
            );

            // OSRM não retorna endereços formatados - usa strings vazias
            expect(result?.legs[0].distancia_metros).toBe(5000);
            expect(result?.legs[0].duracao_segundos).toBe(900);
            expect(result?.legs[0].coordenadas_inicio).toBeDefined();
            expect(result?.legs[0].coordenadas_fim).toBeDefined();
        });
    });

    describe('getDistanceMatrix (Routes API)', () => {
        it('deve calcular matriz de distâncias usando Routes API', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([
                    {
                        originIndex: 0,
                        destinationIndex: 0,
                        distanceMeters: 5000,
                        duration: '300s',
                        status: {},
                        condition: 'ROUTE_EXISTS',
                    },
                ]),
            } as any);

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

        it('deve usar POST com headers corretos', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([]),
            } as any);

            await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 1, longitude: 1 }]
            );

            expect(mockFetch).toHaveBeenCalledWith(
                'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': expect.any(String),
                        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
                    }),
                })
            );
        });

        it('deve retornar null quando API retorna erro HTTP', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
            } as any);

            const result = await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 1, longitude: 1 }]
            );

            expect(result).toBeNull();
        });

        it('deve processar múltiplas origens e destinos', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([
                    { originIndex: 0, destinationIndex: 0, distanceMeters: 1000, duration: '100s' },
                    { originIndex: 0, destinationIndex: 1, distanceMeters: 2000, duration: '200s' },
                    { originIndex: 1, destinationIndex: 0, distanceMeters: 3000, duration: '300s' },
                    { originIndex: 1, destinationIndex: 1, distanceMeters: 4000, duration: '400s' },
                ]),
            } as any);

            const origins = [
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 },
            ];
            const destinations = [
                { latitude: 2, longitude: 2 },
                { latitude: 3, longitude: 3 },
            ];

            const result = await googleMapsService.getDistanceMatrix(origins, destinations);

            expect(result).toHaveLength(2);
            expect(result?.[0].origem).toEqual(origins[0]);
            expect(result?.[0].destinos).toHaveLength(2);
            expect(result?.[0].destinos[0].destino).toEqual(destinations[0]);
            expect(result?.[0].destinos[0].distancia).toBe(1000);
            expect(result?.[0].destinos[1].distancia).toBe(2000);
            expect(result?.[1].destinos[0].distancia).toBe(3000);
            expect(result?.[1].destinos[1].distancia).toBe(4000);
        });

        it('deve tratar elementos ausentes (retorna 0)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([
                    // Elemento não encontrado - resposta vazia para esse par origem/destino
                ]),
            } as any);

            const result = await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 999, longitude: 999 }]
            );

            expect(result?.[0].destinos[0].distancia).toBe(0);
            expect(result?.[0].destinos[0].tempo).toBe(0);
        });

        it('deve enviar request body com formato correto', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([]),
            } as any);

            await googleMapsService.getDistanceMatrix(
                [
                    { latitude: -23.5505, longitude: -46.6333 },
                    { latitude: -23.5615, longitude: -46.6561 },
                ],
                [
                    { latitude: -23.5505, longitude: -46.6333 },
                ]
            );

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1].body);

            expect(requestBody.origins).toHaveLength(2);
            expect(requestBody.destinations).toHaveLength(1);
            expect(requestBody.origins[0].waypoint.location.latLng).toEqual({
                latitude: -23.5505,
                longitude: -46.6333,
            });
            expect(requestBody.travelMode).toBe('DRIVE');
            expect(requestBody.routingPreference).toBe('TRAFFIC_AWARE');
        });

        it('deve converter duration de string para número', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([
                    {
                        originIndex: 0,
                        destinationIndex: 0,
                        distanceMeters: 5000,
                        duration: '450s',
                        condition: 'ROUTE_EXISTS',
                    },
                ]),
            } as any);

            const result = await googleMapsService.getDistanceMatrix(
                [{ latitude: 0, longitude: 0 }],
                [{ latitude: 1, longitude: 1 }]
            );

            expect(result?.[0].destinos[0].tempo).toBe(450);
        });

        it('deve tratar erro de rede', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

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
