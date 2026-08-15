/**
 * Tests for useNovaEntrega helpers
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock supabase
const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
    })),
  },
}));

import type { Parada } from '@/components/gestor/nova-entrega/types';

import {
  avaliarSanidadeGeografica,
  encontrarParadaDuplicada,
  generateUniqueId,
  criarParadaCheckpoint,
  prepararParadasParaInserir,
  atualizarVinculosParadas,
  distanceInMeters,
  ordenarParadasPorRota,
  validarOrdemDependencias,
  validarRascunhoRota,
} from '../useNovaEntrega.helpers';

describe('useNovaEntrega.helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUniqueId', () => {
    it('should generate a string starting with temp_', () => {
      const id = generateUniqueId();

      expect(typeof id).toBe('string');
      expect(id.startsWith('temp_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();

      expect(id1).not.toBe(id2);
    });

    it('should contain timestamp in the ID', () => {
      const before = Date.now();
      const id = generateUniqueId();
      const after = Date.now();

      // Extract timestamp from ID (format: temp_<timestamp>_<random>)
      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('criarParadaCheckpoint', () => {
    const mockEnderecoUnidade = {
      endereco: 'Rua Teste, 123',
      latitude: -23.55,
      longitude: -46.63,
    };

    it('should create a retirada checkpoint', () => {
      const result = criarParadaCheckpoint({
        rotaId: 'rota-123',
        tipo: 'retirada',
        enderecoUnidade: mockEnderecoUnidade,
        ordem: 0,
        nomeUnidade: 'Unidade Teste',
        observacoes: 'Ponto de partida',
      });

      expect(result).toEqual({
        rota_id: 'rota-123',
        tipo: 'retirada',
        endereco: 'Rua Teste, 123',
        latitude: -23.55,
        longitude: -46.63,
        ordem: 0,
        destinatario: 'Unidade Teste',
        telefone: null,
        observacoes: 'Ponto de partida',
        status: 'pendente',
        is_checkpoint: false,
      });
    });

    it('should create an entrega checkpoint', () => {
      const result = criarParadaCheckpoint({
        rotaId: 'rota-456',
        tipo: 'entrega',
        enderecoUnidade: mockEnderecoUnidade,
        ordem: 5,
        nomeUnidade: 'Unidade Final',
        observacoes: 'Ponto de chegada',
      });

      expect(result.tipo).toBe('entrega');
      expect(result.ordem).toBe(5);
      expect(result.destinatario).toBe('Unidade Final');
      expect(result.observacoes).toBe('Ponto de chegada');
    });
  });

  describe('prepararParadasParaInserir', () => {
    const mockEnderecoUnidade = {
      endereco: 'Unidade Central, 100',
      latitude: -23.54,
      longitude: -46.62,
    };

    const mockParadas = [
      {
        id: 'temp-1',
        tipo: 'entrega' as const,
        endereco: 'Rua A, 1',
        latitude: -23.55,
        longitude: -46.63,
        destinatario: 'Cliente A',
        telefone: '11999999999',
        observacoes: 'Obs A',
      },
      {
        id: 'temp-2',
        tipo: 'retirada' as const,
        endereco: 'Rua B, 2',
        latitude: -23.56,
        longitude: -46.64,
        destinatario: 'Cliente B',
        telefone: null,
        observacoes: null,
      },
    ];

    it('should add start and end checkpoints when enderecoUnidade is provided', () => {
      const result = prepararParadasParaInserir({
        rotaId: 'rota-123',
        paradas: mockParadas,
        enderecoUnidade: mockEnderecoUnidade,
        nomeUnidade: 'Central',
      });

      // Should have: start checkpoint + 2 paradas + end checkpoint = 4
      expect(result).toHaveLength(4);

      // First should be start checkpoint
      expect(result[0].tipo).toBe('retirada');
      expect(result[0].observacoes).toBe('Ponto de partida');
      expect(result[0].ordem).toBe(0);

      // Last should be end checkpoint
      expect(result[3].tipo).toBe('entrega');
      expect(result[3].observacoes).toBe('Ponto de chegada');
      expect(result[3].ordem).toBe(3);
    });

    it('should reject route creation when the unit has no base', () => {
      expect(() =>
        prepararParadasParaInserir({
          rotaId: 'rota-123',
          paradas: mockParadas,
          enderecoUnidade: null,
          nomeUnidade: 'Central',
        }),
      ).toThrow('sede válido');
    });

    it('should preserve parada data correctly', () => {
      const result = prepararParadasParaInserir({
        rotaId: 'rota-123',
        paradas: mockParadas,
        enderecoUnidade: mockEnderecoUnidade,
        nomeUnidade: 'Central',
      });

      expect(result[1]).toMatchObject({
        rota_id: 'rota-123',
        tipo: 'entrega',
        endereco: 'Rua A, 1',
        latitude: -23.55,
        longitude: -46.63,
        ordem: 1,
        destinatario: 'Cliente A',
        telefone: '11999999999',
        observacoes: 'Obs A',
        status: 'pendente',
        _temp_id: 'temp-1',
      });
    });

    it('should reject paradas without valid coordinates', () => {
      const paradasWithInvalid = [
        ...mockParadas,
        {
          id: 'temp-3',
          tipo: 'entrega' as const,
          endereco: 'Invalid',
          latitude: null,
          longitude: null,
          destinatario: 'Invalid Client',
          telefone: null,
          observacoes: null,
        },
      ];

      expect(() =>
        prepararParadasParaInserir({
          rotaId: 'rota-123',
          paradas: paradasWithInvalid,
          enderecoUnidade: mockEnderecoUnidade,
          nomeUnidade: 'Central',
        }),
      ).toThrow('endereço validado');
    });

    it('should set order correctly for paradas', () => {
      const result = prepararParadasParaInserir({
        rotaId: 'rota-123',
        paradas: mockParadas,
        enderecoUnidade: mockEnderecoUnidade,
        nomeUnidade: 'Central',
      });

      expect(result[0].ordem).toBe(0); // Start checkpoint
      expect(result[1].ordem).toBe(1); // First parada
      expect(result[2].ordem).toBe(2); // Second parada
      expect(result[3].ordem).toBe(3); // End checkpoint
    });

    it('should include vinculo_parada_id in _temp_vinculo_id', () => {
      const paradasWithVinculo = [
        {
          ...mockParadas[0],
          vinculo_parada_id: 'vinculo-123',
        },
      ];

      const result = prepararParadasParaInserir({
        rotaId: 'rota-123',
        paradas: paradasWithVinculo,
        enderecoUnidade: mockEnderecoUnidade,
        nomeUnidade: 'Central',
      });

      expect(result[1]._temp_vinculo_id).toBe('vinculo-123');
    });
  });

  describe('atualizarVinculosParadas', () => {
    it('should do nothing when no paradas have vinculos', async () => {
      const paradasParaInserir = [
        { ordem: 1, _temp_id: 'temp-1', _temp_vinculo_id: undefined } as any,
        { ordem: 2, _temp_id: 'temp-2', _temp_vinculo_id: undefined } as any,
      ];
      const paradasInseridas = [
        { id: 'real-1', ordem: 1 },
        { id: 'real-2', ordem: 2 },
      ];

      await atualizarVinculosParadas(paradasParaInserir, paradasInseridas);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should update vinculos when paradas have _temp_vinculo_id', async () => {
      mockEq.mockResolvedValue({ error: null });

      const paradasParaInserir = [
        { ordem: 1, _temp_id: 'temp-1', _temp_vinculo_id: undefined } as any,
        { ordem: 2, _temp_id: 'temp-2', _temp_vinculo_id: 'temp-1' } as any,
      ];
      const paradasInseridas = [
        { id: 'real-1', ordem: 1 },
        { id: 'real-2', ordem: 2 },
      ];

      await atualizarVinculosParadas(paradasParaInserir, paradasInseridas);

      expect(mockUpdate).toHaveBeenCalledWith({ vinculo_parada_id: 'real-1' });
      expect(mockEq).toHaveBeenCalledWith('id', 'real-2');
    });
  });

  describe('route draft safeguards', () => {
    const base = {
      endereco: 'Base Central',
      latitude: -3.73,
      longitude: -38.52,
    };
    const createStop = (overrides: Partial<Parada> = {}): Parada => ({
      id: 'stop-1',
      ordem: 1,
      tipo: 'entrega',
      endereco: 'Rua das Flores, 100',
      destinatario: 'Maria',
      telefone: '(85) 99999-0000',
      observacoes: '',
      latitude: -3.74,
      longitude: -38.53,
      ...overrides,
    });

    it('diz o que fazer quando a unidade não tem sede, em vez de jargão', () => {
      // A mensagem chega ao gestor num toast de 5 segundos, depois de ele ter
      // montado a rota inteira. "sede geocodificada" não indica ação nenhuma —
      // o conserto mora em Minha Unidade, e a mensagem precisa dizer isso.
      const { erros } = validarRascunhoRota({
        paradas: [createStop()],
        motoristaId: 'm1',
        dataRota: '2099-01-01',
        enderecoUnidade: null,
      });

      const erroDaSede = erros.find((e) => /sede/i.test(e));
      expect(erroDaSede).toBeDefined();
      expect(erroDaSede).toMatch(/Minha Unidade/);
      expect(erroDaSede).not.toMatch(/geocodificada/i);
    });

    it('detects duplicate addresses and phone numbers', () => {
      const existing = createStop();

      expect(
        encontrarParadaDuplicada([existing], {
          endereco: '  RUA DAS FLORES 100 ',
          telefone: '(85) 98888-1111',
        }),
      ).toBe(existing);
      expect(
        encontrarParadaDuplicada([existing], {
          endereco: 'Outro endereço',
          telefone: '85999990000',
        }),
      ).toBe(existing);
    });

    it('rejects a delivery ordered before its linked pickup', () => {
      const pickup = createStop({
        id: 'pickup',
        ordem: 2,
        tipo: 'retirada',
      });
      const delivery = createStop({
        id: 'delivery',
        ordem: 1,
        vinculo_parada_id: 'pickup',
      });

      expect(validarOrdemDependencias([delivery, pickup])).toEqual([
        expect.stringContaining('precisa ocorrer antes'),
      ]);
    });

    it('rejects impossible calendar dates and invalid coordinates', () => {
      const validation = validarRascunhoRota({
        paradas: [createStop({ latitude: 100 })],
        motoristaId: 'driver-1',
        dataRota: '2026-02-31',
        enderecoUnidade: base,
      });

      expect(validation.valido).toBe(false);
      expect(validation.erros).toEqual(
        expect.arrayContaining([
          'Informe uma data válida para a rota.',
          'Todas as paradas precisam ter um endereço validado.',
        ]),
      );
    });

    it('requires confirmation for stops more than 300 km from the base', () => {
      const sanity = avaliarSanidadeGeografica(
        [
          createStop({
            latitude: -8.05,
            longitude: -34.9,
          }),
        ],
        base,
      );

      expect(sanity.requerConfirmacao).toBe(true);
      expect(sanity.paradasDistantes).toHaveLength(1);
    });
  });

  describe('distanceInMeters', () => {
    it('should return POSITIVE_INFINITY when parada has no latitude', () => {
      const result = distanceInMeters(
        { latitude: undefined, longitude: -46.63 },
        { latitude: -23.55, longitude: -46.63 },
      );

      expect(result).toBe(Number.POSITIVE_INFINITY);
    });

    it('should return POSITIVE_INFINITY when parada has no longitude', () => {
      const result = distanceInMeters(
        { latitude: -23.55, longitude: undefined },
        { latitude: -23.55, longitude: -46.63 },
      );

      expect(result).toBe(Number.POSITIVE_INFINITY);
    });

    it('should return POSITIVE_INFINITY when coords is undefined', () => {
      const result = distanceInMeters(
        { latitude: -23.55, longitude: -46.63 },
        undefined,
      );

      expect(result).toBe(Number.POSITIVE_INFINITY);
    });

    it('should return 0 for same coordinates', () => {
      const result = distanceInMeters(
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.55, longitude: -46.63 },
      );

      expect(result).toBe(0);
    });

    it('should calculate correct distance for known points', () => {
      // São Paulo to nearby point (~1km)
      const result = distanceInMeters(
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.56, longitude: -46.63 },
      );

      // ~1.1km (1100m)
      expect(result).toBeGreaterThan(1000);
      expect(result).toBeLessThan(1200);
    });

    it('should calculate distance for longer distances', () => {
      // São Paulo to Rio (~360km)
      const result = distanceInMeters(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -22.9068, longitude: -43.1729 },
      );

      // ~358km
      expect(result).toBeGreaterThan(350000);
      expect(result).toBeLessThan(370000);
    });
  });

  describe('ordenarParadasPorRota', () => {
    const mockParadas = [
      { id: '1', endereco: 'A', latitude: -23.55, longitude: -46.63 },
      { id: '2', endereco: 'B', latitude: -23.56, longitude: -46.64 },
      { id: '3', endereco: 'C', latitude: -23.57, longitude: -46.65 },
    ] as any[];

    it('should return paradas in ordem_otimizada order when lengths match', () => {
      const result = ordenarParadasPorRota(mockParadas, [2, 0, 1]);

      expect(result[0].id).toBe('3'); // index 2
      expect(result[1].id).toBe('1'); // index 0
      expect(result[2].id).toBe('2'); // index 1
    });

    it('should return copy of paradas when ordem_otimizada length doesnt match', () => {
      const result = ordenarParadasPorRota(mockParadas, [0, 1]);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });

    it('should use legs to order paradas when ordem_otimizada doesnt match', () => {
      const mockLegs = [
        { coordenadas_fim: { latitude: -23.57, longitude: -46.65 } },
        { coordenadas_fim: { latitude: -23.55, longitude: -46.63 } },
        { coordenadas_fim: { latitude: -23.58, longitude: -46.66 } }, // Last leg (to destination)
      ];

      const result = ordenarParadasPorRota(mockParadas, [], mockLegs as any);

      // First leg ends near parada C (-23.57, -46.65)
      expect(result[0].id).toBe('3');
      // Second leg ends near parada A (-23.55, -46.63)
      expect(result[1].id).toBe('1');
      // Remaining parada B
      expect(result[2].id).toBe('2');
    });

    it('should return copy when no ordem_otimizada and no legs', () => {
      const result = ordenarParadasPorRota(mockParadas, []);

      expect(result).toEqual(mockParadas);
      // Should be a copy, not the same reference
      expect(result).not.toBe(mockParadas);
    });

    it('should handle empty paradas array', () => {
      const result = ordenarParadasPorRota([], []);

      expect(result).toEqual([]);
    });

    it('should handle undefined ordem_otimizada', () => {
      const result = ordenarParadasPorRota(mockParadas, undefined as any);

      expect(result).toEqual(mockParadas);
    });
  });
});
