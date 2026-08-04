import { detectWebPlatform } from '../detectWebPlatform';

describe('detectWebPlatform', () => {
  it('detecta Android', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
      ),
    ).toBe('android');
  });

  it('detecta iOS (iPhone)', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe('ios');
  });

  it('trata desktop como padrão', () => {
    expect(
      detectWebPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ),
    ).toBe('desktop');
  });

  it('retorna desktop quando o userAgent está vazio ou ausente', () => {
    expect(detectWebPlatform('')).toBe('desktop');
    expect(detectWebPlatform(undefined)).toBe('desktop');
  });
});
