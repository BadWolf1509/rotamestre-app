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

    describe('getDirections (Routes API)', () => {
        it('deve retornar rota e detalhes', async () => {
            // Mock Routes API response format
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '600s',
                        distanceMeters: 1000,
                        polyline: { encodedPolyline: 'encoded_polyline' },
                        legs: [{
                            duration: '600s',
                            distanceMeters: 1000,
                            startLocation: { latLng: { latitude: 0, longitude: 0 } },
                            endLocation: { latLng: { latitude: 1, longitude: 1 } },
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
            // Mock Routes API error response
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    error: {
                        code: 400,
                        message: 'No route found',
                        status: 'NOT_FOUND',
                    },
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result).toBeNull();
        });

        it('deve retornar null quando não há rotas', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result).toBeNull();
        });

        it('deve incluir waypoints com otimização quando fornecidos', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '900s',
                        distanceMeters: 3000,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [
                            {
                                duration: '300s',
                                distanceMeters: 1000,
                                startLocation: { latLng: { latitude: 0, longitude: 0 } },
                                endLocation: { latLng: { latitude: 1, longitude: 1 } },
                            },
                            {
                                duration: '600s',
                                distanceMeters: 2000,
                                startLocation: { latLng: { latitude: 1, longitude: 1 } },
                                endLocation: { latLng: { latitude: 2, longitude: 2 } },
                            },
                        ],
                        optimizedIntermediateWaypointIndex: [1, 0],
                    }],
                }),
            });

            const waypoints = [
                { latitude: 0.5, longitude: 0.5 },
                { latitude: 1.5, longitude: 1.5 },
            ];

            await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 2, longitude: 2 },
                waypoints
            );

            // Routes API usa POST com JSON body
            expect(mockFetch).toHaveBeenCalledWith(
                'https://routes.googleapis.com/directions/v2:computeRoutes',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': expect.any(String),
                    }),
                })
            );
        });

        it('deve retornar ordem otimizada de waypoints', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '300s',
                        distanceMeters: 1000,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [{
                            duration: '300s',
                            distanceMeters: 1000,
                            startLocation: { latLng: { latitude: 0, longitude: 0 } },
                            endLocation: { latLng: { latitude: 1, longitude: 1 } },
                        }],
                        optimizedIntermediateWaypointIndex: [2, 0, 1],
                    }],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 3, longitude: 3 },
                [
                    { latitude: 1, longitude: 1 },
                    { latitude: 2, longitude: 2 },
                    { latitude: 0.5, longitude: 0.5 },
                ]
            );

            expect(result?.ordem_otimizada).toEqual([2, 0, 1]);
        });

        it('deve somar distâncias de múltiplas legs corretamente', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '1350s',
                        distanceMeters: 4500,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [
                            {
                                duration: '300s',
                                distanceMeters: 1000,
                                startLocation: { latLng: { latitude: 0, longitude: 0 } },
                                endLocation: { latLng: { latitude: 1, longitude: 1 } },
                            },
                            {
                                duration: '600s',
                                distanceMeters: 2000,
                                startLocation: { latLng: { latitude: 1, longitude: 1 } },
                                endLocation: { latLng: { latitude: 2, longitude: 2 } },
                            },
                            {
                                duration: '450s',
                                distanceMeters: 1500,
                                startLocation: { latLng: { latitude: 2, longitude: 2 } },
                                endLocation: { latLng: { latitude: 3, longitude: 3 } },
                            },
                        ],
                    }],
                }),
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

        it('deve usar POST para Routes API sem waypoints na URL', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '300s',
                        distanceMeters: 1000,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [{
                            duration: '300s',
                            distanceMeters: 1000,
                            startLocation: { latLng: { latitude: 0, longitude: 0 } },
                            endLocation: { latLng: { latitude: 1, longitude: 1 } },
                        }],
                    }],
                }),
            });

            await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            // Routes API usa POST, não GET com query params
            expect(mockFetch).toHaveBeenCalledWith(
                'https://routes.googleapis.com/directions/v2:computeRoutes',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('deve retornar array vazio para ordem_otimizada quando não há waypoints', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '300s',
                        distanceMeters: 1000,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [{
                            duration: '300s',
                            distanceMeters: 1000,
                            startLocation: { latLng: { latitude: 0, longitude: 0 } },
                            endLocation: { latLng: { latitude: 1, longitude: 1 } },
                        }],
                        // No optimizedIntermediateWaypointIndex when no waypoints
                    }],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 }
            );

            expect(result?.ordem_otimizada).toEqual([]);
        });

        it('deve mapear corretamente todas as informações de cada leg', async () => {
            mockFetch.mockResolvedValueOnce({
                json: jest.fn().mockResolvedValue({
                    routes: [{
                        duration: '900s',
                        distanceMeters: 5000,
                        polyline: { encodedPolyline: 'polyline' },
                        legs: [{
                            duration: '900s',
                            distanceMeters: 5000,
                            startLocation: { latLng: { latitude: -23.5505, longitude: -46.6333 } },
                            endLocation: { latLng: { latitude: -23.5615, longitude: -46.6561 } },
                        }],
                    }],
                }),
            });

            const result = await googleMapsService.getDirections(
                { latitude: -23.5505, longitude: -46.6333 },
                { latitude: -23.5615, longitude: -46.6561 }
            );

            // Routes API não retorna endereços formatados - usa coordenadas como fallback
            expect(result?.legs[0]).toEqual({
                distancia_metros: 5000,
                duracao_segundos: 900,
                endereco_inicio: '-23.550500, -46.633300',
                endereco_fim: '-23.561500, -46.656100',
                coordenadas_inicio: { latitude: -23.5505, longitude: -46.6333 },
                coordenadas_fim: { latitude: -23.5615, longitude: -46.6561 },
            });
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
