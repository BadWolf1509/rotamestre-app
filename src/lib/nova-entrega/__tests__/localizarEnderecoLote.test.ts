import { geocodingService } from '@/lib/geocoding';
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon';

import {
  DISTANCIA_CONFERIR_LOTE_KM,
  localizarEnderecoLote,
} from '../localizarEnderecoLote';

jest.mock('@/lib/geocoding', () => ({
  geocodingService: { autocompleteWithCoordinates: jest.fn() },
}));

jest.mock('@/lib/photon', () => ({
  photonService: { geocodeAddress: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const roteador = geocodingService.autocompleteWithCoordinates as jest.Mock;
const photon = photonService.geocodeAddress as jest.Mock;

// Sede em João Pessoa; a parada a 0,01° de latitude fica a ~1,1 km.
const sede = { latitude: -7.1, longitude: -34.9 };

describe('localizarEnderecoLote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expõe o limite de conferência de 30 km', () => {
    expect(DISTANCIA_CONFERIR_LOTE_KM).toBe(30);
  });

  it('usa o roteador com o viés da sede e devolve o endereço que ele achou', async () => {
    roteador.mockResolvedValue({
      place_id: 'p1',
      description: 'Rua Exemplo, 100 - Centro, João Pessoa - PB',
      source: 'google',
      coordinates: { latitude: -7.11, longitude: -34.9 },
    });

    const resultado = await localizarEnderecoLote('Rua Exemplo, 100', sede);

    expect(roteador).toHaveBeenCalledWith('Rua Exemplo, 100', sede);
    expect(photon).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      enderecoEncontrado: 'Rua Exemplo, 100 - Centro, João Pessoa - PB',
      latitude: -7.11,
      longitude: -34.9,
      fonte: 'google',
    });
    expect(resultado?.distanciaSedeKm).toBeCloseTo(1.11, 1);
  });

  it('mantém a fonte viacep quando o roteador resolve por CEP', async () => {
    roteador.mockResolvedValue({
      place_id: 'cep',
      description: 'Rua do CEP, 10, Bairro, Cidade - PB',
      source: 'viacep',
      coordinates: { latitude: -7.1, longitude: -34.9 },
    });

    const resultado = await localizarEnderecoLote('58068-504, 10', sede);

    expect(resultado?.fonte).toBe('viacep');
    expect(resultado?.distanciaSedeKm).toBeCloseTo(0, 3);
  });

  it('cai no Photon quando o roteador não devolve nada e marca a fonte photon', async () => {
    roteador.mockResolvedValue(null);
    photon.mockResolvedValue({
      logradouro: 'Rua B',
      numero: '5',
      bairro: 'Centro',
      cidade: 'Cabedelo',
      estado: 'PB',
      cep: '',
      coordenadas: { latitude: -6.98, longitude: -34.83 },
      formatted_address: 'Rua B, 5, Centro, Cabedelo - PB',
    });

    const resultado = await localizarEnderecoLote('Rua B, 5', sede);

    expect(photon).toHaveBeenCalledWith('Rua B, 5');
    expect(resultado).toMatchObject({
      enderecoEncontrado: 'Rua B, 5, Centro, Cabedelo - PB',
      latitude: -6.98,
      longitude: -34.83,
      fonte: 'photon',
    });
  });

  it('monta o endereço do Photon quando ele não traz o formatado', async () => {
    roteador.mockResolvedValue(null);
    photon.mockResolvedValue({
      logradouro: 'Rua B',
      numero: '5',
      bairro: 'Centro',
      cidade: 'Cabedelo',
      estado: 'PB',
      cep: '',
      coordenadas: { latitude: -6.98, longitude: -34.83 },
      formatted_address: '',
    });

    const resultado = await localizarEnderecoLote('Rua B, 5', sede);

    expect(resultado?.enderecoEncontrado).toBe(
      'Rua B, 5, Centro, Cabedelo, PB',
    );
  });

  it('cai no Photon quando o roteador lança erro, e registra o aviso', async () => {
    const falha = new Error('rede');
    roteador.mockRejectedValue(falha);
    photon.mockResolvedValue({
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      coordenadas: { latitude: -7.1, longitude: -34.9 },
      formatted_address: 'Algum lugar',
    });

    const resultado = await localizarEnderecoLote('Rua C, 1', sede);

    expect(resultado?.fonte).toBe('photon');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('localizarEnderecoLote'),
      falha,
    );
  });

  it('devolve null quando o roteador e o Photon falham', async () => {
    roteador.mockResolvedValue(null);
    photon.mockResolvedValue(null);

    await expect(localizarEnderecoLote('Lugar nenhum', sede)).resolves.toBe(
      null,
    );
  });

  it('não envia viés e devolve distância null sem sede', async () => {
    roteador.mockResolvedValue({
      place_id: 'p1',
      description: 'Rua Exemplo, 100',
      source: 'google',
      coordinates: { latitude: -7.11, longitude: -34.9 },
    });

    const resultado = await localizarEnderecoLote('Rua Exemplo, 100', null);

    expect(roteador).toHaveBeenCalledWith('Rua Exemplo, 100', undefined);
    expect(resultado?.distanciaSedeKm).toBeNull();
  });
});
