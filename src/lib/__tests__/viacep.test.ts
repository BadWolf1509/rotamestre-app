/**
 * Tests for viacep.ts
 * ViaCEP service: CEP validation, extraction, formatting, and API search
 */

import {
  isCEP,
  containsCEP,
  extractCEP,
  extractNumberFromCEPInput,
  formatCEP,
  maskCEP,
  viacepService,
} from '../viacep';

import type { ViaCEPResponse } from '../viacep';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock cache
const mockGetCache = jest.fn().mockResolvedValue(null);
const mockSetCache = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/cache', () => ({
  CACHE_TTL: {
    AUTOCOMPLETE: 5 * 60 * 1000,
    GEOCODING: 30 * 60 * 1000,
  },
  getCache: (...args: unknown[]) => mockGetCache(...args),
  setCache: (...args: unknown[]) => mockSetCache(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViaCEPResponse(
  overrides: Partial<ViaCEPResponse> = {},
): ViaCEPResponse {
  return {
    cep: '58068-504',
    logradouro: 'Rua Exemplo',
    complemento: '',
    unidade: '',
    bairro: 'Centro',
    localidade: 'João Pessoa',
    uf: 'PB',
    estado: 'Paraíba',
    regiao: 'Nordeste',
    ibge: '2507507',
    gia: '',
    ddd: '83',
    siafi: '2051',
    ...overrides,
  };
}

function mockFetchOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockFetchNotOk(status = 400) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('viacep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCache.mockResolvedValue(null);
  });

  // ========================================================================
  // isCEP
  // ========================================================================
  describe('isCEP', () => {
    it('returns true for 8-digit numeric string', () => {
      expect(isCEP('58068504')).toBe(true);
    });

    it('returns true for formatted CEP with hyphen', () => {
      expect(isCEP('58068-504')).toBe(true);
    });

    it('returns true for CEP with dot and hyphen', () => {
      expect(isCEP('58.068-504')).toBe(true);
    });

    it('returns false for less than 8 digits', () => {
      expect(isCEP('5806850')).toBe(false);
    });

    it('returns false for more than 8 digits', () => {
      expect(isCEP('580685041')).toBe(false);
    });

    it('returns false for non-numeric strings', () => {
      expect(isCEP('abcdefgh')).toBe(false);
      expect(isCEP('Rua Exemplo')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isCEP('')).toBe(false);
    });

    it('returns true for CEP with surrounding spaces', () => {
      expect(isCEP(' 58068-504 ')).toBe(true);
    });
  });

  // ========================================================================
  // containsCEP
  // ========================================================================
  describe('containsCEP', () => {
    it('returns true when text contains a formatted CEP', () => {
      expect(containsCEP('Meu CEP é 58068-504')).toBe(true);
    });

    it('returns true when text contains a raw 8-digit CEP', () => {
      expect(containsCEP('58068504 100')).toBe(true);
    });

    it('returns true when text is exactly a CEP', () => {
      expect(containsCEP('58068504')).toBe(true);
    });

    it('returns false when no CEP pattern exists', () => {
      expect(containsCEP('Rua das Flores, 123')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(containsCEP('')).toBe(false);
    });
  });

  // ========================================================================
  // extractCEP
  // ========================================================================
  describe('extractCEP', () => {
    it('extracts 8 digits from a formatted CEP', () => {
      expect(extractCEP('58068-504')).toBe('58068504');
    });

    it('extracts 8 digits from CEP with dot and hyphen', () => {
      expect(extractCEP('58.068-504')).toBe('58068504');
    });

    it('extracts CEP from mixed text', () => {
      expect(extractCEP('CEP: 58068-504, nº 100')).toBe('58068504');
    });

    it('returns null when no 8-digit block is found', () => {
      expect(extractCEP('Rua ABC, 123')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractCEP('')).toBeNull();
    });
  });

  // ========================================================================
  // extractNumberFromCEPInput
  // ========================================================================
  describe('extractNumberFromCEPInput', () => {
    it('extracts number after comma separator', () => {
      expect(extractNumberFromCEPInput('58068-504, 100')).toBe('100');
    });

    it('extracts number with n° prefix (degree sign)', () => {
      // n° uses degree sign (U+00B0) which the regex handles
      expect(extractNumberFromCEPInput('58068504 n\u00B0 150')).toBe('150');
    });

    it('extracts number with "numero" prefix', () => {
      expect(extractNumberFromCEPInput('58068504 numero 150')).toBe('150');
    });

    it('extracts alphanumeric number', () => {
      expect(extractNumberFromCEPInput('58068-504 123A')).toBe('123A');
    });

    it('returns null when no number present after CEP', () => {
      expect(extractNumberFromCEPInput('58068-504')).toBeNull();
    });
  });

  // ========================================================================
  // formatCEP
  // ========================================================================
  describe('formatCEP', () => {
    it('formats 8 raw digits into XXXXX-XXX', () => {
      expect(formatCEP('58068504')).toBe('58068-504');
    });

    it('formats already formatted CEP correctly', () => {
      expect(formatCEP('58068-504')).toBe('58068-504');
    });

    it('returns original string if digits count is not 8', () => {
      expect(formatCEP('1234')).toBe('1234');
      expect(formatCEP('123456789')).toBe('123456789');
    });

    it('strips non-digit chars before formatting', () => {
      expect(formatCEP('58.068-504')).toBe('58068-504');
    });
  });

  describe('maskCEP', () => {
    it('insere o hífen progressivamente enquanto digita', () => {
      // formatCEP devolveria estes intactos: só formata com os 8 dígitos.
      expect(maskCEP('580')).toBe('580');
      expect(maskCEP('58068')).toBe('58068');
      expect(maskCEP('580685')).toBe('58068-5');
      expect(maskCEP('58068504')).toBe('58068-504');
    });

    it('descarta o excedente em vez de deixar o campo crescer', () => {
      expect(maskCEP('580685049999')).toBe('58068-504');
    });

    it('é idempotente sobre um CEP já formatado', () => {
      expect(maskCEP('58068-504')).toBe('58068-504');
    });

    it('permite apagar sem travar no hífen', () => {
      expect(maskCEP('58068-50')).toBe('58068-50');
      expect(maskCEP('58068-')).toBe('58068');
    });
  });

  // ========================================================================
  // viacepService.searchByCEP
  // ========================================================================
  describe('viacepService.searchByCEP', () => {
    it('returns suggestion for a valid CEP', async () => {
      const apiResponse = makeViaCEPResponse();
      mockFetchOk(apiResponse);

      const result = await viacepService.searchByCEP('58068504');

      expect(result).not.toBeNull();
      expect(result!.cep).toBe('58068-504');
      expect(result!.place_id).toBe('cep_58068504');
      expect(result!.description).toContain('Rua Exemplo');
      expect(result!.structured_formatting.main_text).toBe('Rua Exemplo');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://viacep.com.br/ws/58068504/json/',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('accepts formatted CEP input and strips non-digits', async () => {
      const apiResponse = makeViaCEPResponse();
      mockFetchOk(apiResponse);

      const result = await viacepService.searchByCEP('58068-504');

      expect(result).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://viacep.com.br/ws/58068504/json/',
        expect.any(Object),
      );
    });

    it('returns null for invalid CEP length', async () => {
      const result = await viacepService.searchByCEP('1234');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns cached result when available', async () => {
      const cachedSuggestion = {
        place_id: 'cep_58068504',
        description: 'Rua Exemplo, Centro, João Pessoa, PB',
        structured_formatting: {
          main_text: 'Rua Exemplo',
          secondary_text: 'Centro, João Pessoa, PB',
        },
        cep: '58068-504',
      };
      mockGetCache.mockResolvedValueOnce(cachedSuggestion);

      const result = await viacepService.searchByCEP('58068504');

      expect(result).toEqual(cachedSuggestion);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('saves result to cache after successful fetch', async () => {
      mockFetchOk(makeViaCEPResponse());

      await viacepService.searchByCEP('58068504');

      expect(mockSetCache).toHaveBeenCalledWith(
        'viacep_58068504',
        expect.objectContaining({ cep: '58068-504' }),
        30 * 60 * 1000, // CACHE_TTL.GEOCODING
      );
    });

    it('returns null when API returns erro: true (CEP not found)', async () => {
      mockFetchOk({ erro: true });

      const result = await viacepService.searchByCEP('00000000');

      expect(result).toBeNull();
    });

    it('returns null when API returns non-OK status', async () => {
      mockFetchNotOk(500);

      const result = await viacepService.searchByCEP('58068504');

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await viacepService.searchByCEP('58068504');

      expect(result).toBeNull();
    });

    it('returns null on AbortError (timeout)', async () => {
      const abortError = new DOMException(
        'The operation was aborted.',
        'AbortError',
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await viacepService.searchByCEP('58068504');

      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // viacepService.searchByAddress
  // ========================================================================
  describe('viacepService.searchByAddress', () => {
    it('returns suggestions for valid address search', async () => {
      const apiData = [
        makeViaCEPResponse({ cep: '58068-504', logradouro: 'Rua A' }),
        makeViaCEPResponse({ cep: '58068-505', logradouro: 'Rua AB' }),
      ];
      mockFetchOk(apiData);

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua',
      );

      expect(result).toHaveLength(2);
      expect(result[0].cep).toBe('58068-504');
      expect(result[1].cep).toBe('58068-505');
    });

    it('returns empty array when logradouro is less than 3 chars', async () => {
      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Ru',
      );

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns cached results when available', async () => {
      const cachedResults = [
        {
          place_id: 'cep_58068504',
          description: 'Rua A, Centro, João Pessoa, PB',
          structured_formatting: {
            main_text: 'Rua A',
            secondary_text: 'Centro, João Pessoa, PB',
          },
          cep: '58068-504',
        },
      ];
      mockGetCache.mockResolvedValueOnce(cachedResults);

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua',
      );

      expect(result).toEqual(cachedResults);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array when API returns non-OK status', async () => {
      mockFetchNotOk(500);

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua',
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when API returns empty array', async () => {
      mockFetchOk([]);

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua Inexistente',
      );

      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua',
      );

      expect(result).toEqual([]);
    });

    it('limits results to 5 suggestions', async () => {
      const apiData = Array.from({ length: 10 }, (_, i) =>
        makeViaCEPResponse({ cep: `58068-50${i}`, logradouro: `Rua ${i}` }),
      );
      mockFetchOk(apiData);

      const result = await viacepService.searchByAddress(
        'PB',
        'João Pessoa',
        'Rua',
      );

      expect(result).toHaveLength(5);
    });
  });
});
