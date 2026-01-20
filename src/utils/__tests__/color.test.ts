/**
 * Tests for color utilities
 */

import { withOpacity, boxShadow, dropShadow, textShadow } from '../color';

describe('color utilities', () => {
  describe('withOpacity', () => {
    it('should return empty string for empty color', () => {
      expect(withOpacity('', 0.5)).toBe('');
    });

    it('should convert 6-character hex to rgba', () => {
      expect(withOpacity('#FF5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
      expect(withOpacity('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
      expect(withOpacity('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)');
    });

    it('should convert 3-character hex to rgba', () => {
      expect(withOpacity('#F50', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
      expect(withOpacity('#000', 1)).toBe('rgba(0, 0, 0, 1)');
      expect(withOpacity('#FFF', 0.75)).toBe('rgba(255, 255, 255, 0.75)');
    });

    it('should handle hex without # prefix', () => {
      expect(withOpacity('FF5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
      expect(withOpacity('F50', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
    });

    it('should return original color for invalid hex length', () => {
      expect(withOpacity('#FF55', 0.5)).toBe('#FF55');
      expect(withOpacity('#FF5500FF', 0.5)).toBe('#FF5500FF');
    });

    it('should handle various opacity values', () => {
      expect(withOpacity('#FF5500', 0)).toBe('rgba(255, 85, 0, 0)');
      expect(withOpacity('#FF5500', 0.25)).toBe('rgba(255, 85, 0, 0.25)');
      expect(withOpacity('#FF5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
      expect(withOpacity('#FF5500', 0.75)).toBe('rgba(255, 85, 0, 0.75)');
      expect(withOpacity('#FF5500', 1)).toBe('rgba(255, 85, 0, 1)');
    });

    it('should handle lowercase hex colors', () => {
      expect(withOpacity('#ff5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
      expect(withOpacity('ff5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)');
    });
  });

  describe('boxShadow', () => {
    it('should create box shadow without spread', () => {
      const result = boxShadow(0, 4, 8, 0, '#000000', 0.2);
      expect(result).toBe('0px 4px 8px rgba(0, 0, 0, 0.2)');
    });

    it('should create box shadow with spread', () => {
      const result = boxShadow(0, 4, 8, 2, '#000000', 0.2);
      expect(result).toBe('0px 4px 8px 2px rgba(0, 0, 0, 0.2)');
    });

    it('should handle negative offsets', () => {
      const result = boxShadow(-2, -4, 8, 0, '#000000', 0.2);
      expect(result).toBe('-2px -4px 8px rgba(0, 0, 0, 0.2)');
    });

    it('should handle color with opacity', () => {
      const result = boxShadow(0, 2, 4, 0, '#FF5500', 0.5);
      expect(result).toBe('0px 2px 4px rgba(255, 85, 0, 0.5)');
    });
  });

  describe('dropShadow', () => {
    it('should create drop shadow filter', () => {
      const result = dropShadow(0, 4, 8, '#000000', 0.2);
      expect(result).toBe('drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))');
    });

    it('should handle negative offsets', () => {
      const result = dropShadow(-2, -4, 8, '#000000', 0.2);
      expect(result).toBe('drop-shadow(-2px -4px 8px rgba(0, 0, 0, 0.2))');
    });

    it('should handle color with opacity', () => {
      const result = dropShadow(0, 2, 4, '#FF5500', 0.75);
      expect(result).toBe('drop-shadow(0px 2px 4px rgba(255, 85, 0, 0.75))');
    });
  });

  describe('textShadow', () => {
    it('should create text shadow', () => {
      const result = textShadow(1, 1, 2, '#000000', 0.3);
      expect(result).toBe('1px 1px 2px rgba(0, 0, 0, 0.3)');
    });

    it('should handle zero blur', () => {
      const result = textShadow(1, 1, 0, '#000000', 0.5);
      expect(result).toBe('1px 1px 0px rgba(0, 0, 0, 0.5)');
    });

    it('should handle negative offsets', () => {
      const result = textShadow(-1, -1, 2, '#FFFFFF', 0.5);
      expect(result).toBe('-1px -1px 2px rgba(255, 255, 255, 0.5)');
    });

    it('should handle color with opacity', () => {
      const result = textShadow(0, 2, 4, '#FF5500', 0.8);
      expect(result).toBe('0px 2px 4px rgba(255, 85, 0, 0.8)');
    });
  });
});
