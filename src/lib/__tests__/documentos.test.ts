/**
 * @jest-environment node
 */

import { soDigitos } from '../documentos';

describe('soDigitos', () => {
  it('tira tudo o que não é dígito', () => {
    expect(soDigitos('(83) 9.8765-4321')).toBe('83987654321');
  });

  it('de null, undefined e vazio é ""', () => {
    expect(soDigitos(null)).toBe('');
    expect(soDigitos(undefined)).toBe('');
    expect(soDigitos('')).toBe('');
  });
});
