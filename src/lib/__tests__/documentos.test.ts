/**
 * @jest-environment node
 */

import { soDigitos, telefoneComDDD } from '../documentos';

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

describe('telefoneComDDD', () => {
  it.each(['(83) 3333-4444', '83987654321'])('aceita %s', (valor) => {
    expect(telefoneComDDD(valor)).toBe(true);
  });

  it.each(['', '833334444', '558398765432', '+55 83 98765-4321', null])(
    'recusa %s',
    (valor) => {
      expect(telefoneComDDD(valor)).toBe(false);
    },
  );
});
