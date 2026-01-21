/**
 * Tests for type-guards utility functions
 */

import {
  isObject,
  isNonEmptyString,
  isValidNumber,
  isUUID,
  isISODateString,
  hasValidCoordinates,
  hasOptionalCoordinates,
  isStatusRota,
  isStatusCheckpoint,
  isTipoUsuario,
  hasSupabaseData,
  hasSupabaseError,
  extractSupabaseData,
  isSupabaseArray,
  hasPressableHover,
  isHovered,
  isPressed,
  getProperty,
  getStringProperty,
  getNumberProperty,
  getColumnValue,
  asIoniconName,
} from '../type-guards';

describe('type-guards', () => {
  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' ')).toBe(true);
    });

    it('should return false for empty strings and non-strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-45.67)).toBe(true);
      expect(isValidNumber(Infinity)).toBe(true);
    });

    it('should return false for NaN and non-numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });

  describe('isUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isUUID('')).toBe(false);
      expect(isUUID(null)).toBe(false);
      expect(isUUID(123)).toBe(false);
    });
  });

  describe('isISODateString', () => {
    it('should return true for valid ISO date strings', () => {
      expect(isISODateString('2024-01-15T10:30:00.000Z')).toBe(true);
      expect(isISODateString('2024-01-15')).toBe(true);
    });

    it('should return false for invalid date strings', () => {
      expect(isISODateString('not-a-date')).toBe(false);
      expect(isISODateString('')).toBe(false);
      expect(isISODateString(null)).toBe(false);
    });
  });

  describe('hasValidCoordinates', () => {
    it('should return true for valid coordinates', () => {
      expect(hasValidCoordinates({ latitude: -23.55, longitude: -46.63 })).toBe(true);
      expect(hasValidCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
      expect(hasValidCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
      expect(hasValidCoordinates({ latitude: -90, longitude: -180 })).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(hasValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
      expect(hasValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
      expect(hasValidCoordinates({ latitude: 'invalid', longitude: 0 })).toBe(false);
      expect(hasValidCoordinates({ latitude: null, longitude: null })).toBe(false);
      expect(hasValidCoordinates(null)).toBe(false);
      expect(hasValidCoordinates({})).toBe(false);
    });
  });

  describe('hasOptionalCoordinates', () => {
    it('should return true when both are undefined', () => {
      expect(hasOptionalCoordinates({})).toBe(true);
      expect(hasOptionalCoordinates({ latitude: undefined, longitude: undefined })).toBe(true);
    });

    it('should return true when both are valid', () => {
      expect(hasOptionalCoordinates({ latitude: -23.55, longitude: -46.63 })).toBe(true);
    });

    it('should return false when only one is defined', () => {
      expect(hasOptionalCoordinates({ latitude: -23.55 })).toBe(false);
      expect(hasOptionalCoordinates({ longitude: -46.63 })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasOptionalCoordinates(null)).toBe(false);
      expect(hasOptionalCoordinates('string')).toBe(false);
    });
  });

  describe('isStatusRota', () => {
    it('should return true for valid status values', () => {
      expect(isStatusRota('pendente')).toBe(true);
      expect(isStatusRota('em_andamento')).toBe(true);
      expect(isStatusRota('concluida')).toBe(true);
      expect(isStatusRota('cancelada')).toBe(true);
    });

    it('should return false for invalid status values', () => {
      expect(isStatusRota('invalid')).toBe(false);
      expect(isStatusRota('')).toBe(false);
      expect(isStatusRota(null)).toBe(false);
    });
  });

  describe('isStatusCheckpoint', () => {
    it('should return true for valid checkpoint status values', () => {
      expect(isStatusCheckpoint('pendente')).toBe(true);
      expect(isStatusCheckpoint('concluida')).toBe(true);
      expect(isStatusCheckpoint('pulada')).toBe(true);
    });

    it('should return false for invalid checkpoint status values', () => {
      expect(isStatusCheckpoint('em_andamento')).toBe(false);
      expect(isStatusCheckpoint('invalid')).toBe(false);
    });
  });

  describe('isTipoUsuario', () => {
    it('should return true for valid user types', () => {
      expect(isTipoUsuario('gestor')).toBe(true);
      expect(isTipoUsuario('motorista')).toBe(true);
    });

    it('should return false for invalid user types', () => {
      expect(isTipoUsuario('admin')).toBe(false);
      expect(isTipoUsuario('')).toBe(false);
      expect(isTipoUsuario(null)).toBe(false);
    });
  });

  describe('Supabase response guards', () => {
    describe('hasSupabaseData', () => {
      it('should return true when data is present and no error', () => {
        expect(hasSupabaseData({ data: { id: '123' }, error: null })).toBe(true);
        expect(hasSupabaseData({ data: [], error: null })).toBe(true);
      });

      it('should return false when error is present or data is null', () => {
        expect(hasSupabaseData({ data: null, error: null })).toBe(false);
        expect(hasSupabaseData({ data: { id: '123' }, error: { message: 'Error' } })).toBe(false);
      });
    });

    describe('hasSupabaseError', () => {
      it('should return true when error is present', () => {
        expect(hasSupabaseError({ data: null, error: { message: 'Error' } })).toBe(true);
      });

      it('should return false when no error', () => {
        expect(hasSupabaseError({ data: { id: '123' }, error: null })).toBe(false);
      });
    });

    describe('extractSupabaseData', () => {
      it('should return data when no error', () => {
        const result = extractSupabaseData({ data: { id: '123' }, error: null });
        expect(result).toEqual({ id: '123' });
      });

      it('should throw when error is present', () => {
        expect(() =>
          extractSupabaseData({ data: null, error: { message: 'Test error' } })
        ).toThrow('Supabase query failed: Test error');
      });

      it('should use custom error message', () => {
        expect(() =>
          extractSupabaseData({ data: null, error: { message: 'Test error' } }, 'Custom message')
        ).toThrow('Custom message: Test error');
      });
    });

    describe('isSupabaseArray', () => {
      it('should return true when data is an array', () => {
        expect(isSupabaseArray({ data: [], error: null })).toBe(true);
        expect(isSupabaseArray({ data: [{ id: '1' }], error: null })).toBe(true);
      });

      it('should return false when data is not an array', () => {
        expect(isSupabaseArray({ data: { id: '1' }, error: null })).toBe(false);
        expect(isSupabaseArray({ data: null, error: null })).toBe(false);
      });
    });
  });

  describe('Pressable state guards', () => {
    describe('hasPressableHover', () => {
      it('should return true for valid pressable state', () => {
        expect(hasPressableHover({ pressed: false })).toBe(true);
        expect(hasPressableHover({ pressed: true })).toBe(true);
        expect(hasPressableHover({ pressed: false, hovered: true })).toBe(true);
      });

      it('should return false for invalid pressable state', () => {
        expect(hasPressableHover(null)).toBe(false);
        expect(hasPressableHover({})).toBe(false);
        expect(hasPressableHover({ hovered: true })).toBe(false);
      });
    });

    describe('isHovered', () => {
      it('should return true when hovered is true', () => {
        expect(isHovered({ pressed: false, hovered: true })).toBe(true);
      });

      it('should return false when not hovered', () => {
        expect(isHovered({ pressed: false, hovered: false })).toBe(false);
        expect(isHovered({ pressed: false })).toBe(false);
        expect(isHovered(null)).toBe(false);
      });
    });

    describe('isPressed', () => {
      it('should return true when pressed is true', () => {
        expect(isPressed({ pressed: true })).toBe(true);
      });

      it('should return false when not pressed', () => {
        expect(isPressed({ pressed: false })).toBe(false);
        expect(isPressed(null)).toBe(false);
      });
    });
  });

  describe('Property accessors', () => {
    describe('getProperty', () => {
      it('should return property value when valid', () => {
        expect(getProperty({ name: 'test' }, 'name')).toBe('test');
        expect(getProperty({ count: 42 }, 'count')).toBe(42);
      });

      it('should return undefined for missing properties', () => {
        expect(getProperty({ name: 'test' }, 'missing')).toBeUndefined();
        expect(getProperty(null, 'name')).toBeUndefined();
      });

      it('should use validator when provided', () => {
        const isString = (v: unknown): v is string => typeof v === 'string';
        expect(getProperty({ name: 'test' }, 'name', isString)).toBe('test');
        expect(getProperty({ name: 123 }, 'name', isString)).toBeUndefined();
      });
    });

    describe('getStringProperty', () => {
      it('should return string properties', () => {
        expect(getStringProperty({ name: 'test' }, 'name')).toBe('test');
      });

      it('should return undefined for non-string properties', () => {
        expect(getStringProperty({ name: 123 }, 'name')).toBeUndefined();
        expect(getStringProperty({ name: '' }, 'name')).toBeUndefined();
      });
    });

    describe('getNumberProperty', () => {
      it('should return number properties', () => {
        expect(getNumberProperty({ count: 42 }, 'count')).toBe(42);
        expect(getNumberProperty({ value: 0 }, 'value')).toBe(0);
      });

      it('should return undefined for non-number properties', () => {
        expect(getNumberProperty({ count: '42' }, 'count')).toBeUndefined();
        expect(getNumberProperty({ count: NaN }, 'count')).toBeUndefined();
      });
    });

    describe('getColumnValue', () => {
      it('should return column value from item', () => {
        const item = { id: '123', name: 'Test', count: 5 };
        expect(getColumnValue(item, 'id')).toBe('123');
        expect(getColumnValue(item, 'name')).toBe('Test');
        expect(getColumnValue(item, 'count')).toBe(5);
      });
    });
  });

  describe('asIoniconName', () => {
    it('should return icon name for valid icons', () => {
      expect(asIoniconName('home')).toBe('home');
      expect(asIoniconName('home-outline')).toBe('home-outline');
      expect(asIoniconName('warning')).toBe('warning');
      expect(asIoniconName('warning-outline')).toBe('warning-outline');
    });

    it('should return undefined for invalid icons', () => {
      expect(asIoniconName('invalid-icon')).toBeUndefined();
      expect(asIoniconName('')).toBeUndefined();
    });
  });
});
