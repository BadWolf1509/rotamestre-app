import { Platform } from 'react-native';

import {
  getConfirmationUrl,
  isAllowedConfirmationUrl,
} from '../confirmationLink';

// jest.setup.js mocka supabaseUrl como 'https://project.supabase.co'.
const HOST_VALIDO = 'https://project.supabase.co';

const originalLocation = window.location;
const originalPlatformOS = Platform.OS;

function setHash(hash: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hash },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  jest.replaceProperty(Platform, 'OS', originalPlatformOS);
});

describe('isAllowedConfirmationUrl', () => {
  it('aceita https no host exato do projeto Supabase', () => {
    expect(
      isAllowedConfirmationUrl(`${HOST_VALIDO}/auth/v1/verify?token=abc`),
    ).toBe(true);
  });

  // Sem esta rejeição a página vira trampolim de phishing: o domínio da
  // aplicação emprestaria credibilidade ao destino do atacante.
  it.each([
    ['host diferente', 'https://evil.example/auth/v1/verify?token=abc'],
    ['subdomínio forjado', 'https://project.supabase.co.evil.example/verify'],
    [
      'http mesmo com host correto',
      'http://project.supabase.co/auth/v1/verify',
    ],
    ['javascript:', 'javascript:alert(1)'],
    ['url relativa', '/auth/reset-password'],
    ['string vazia', ''],
  ])('rejeita %s', (_caso, url) => {
    expect(isAllowedConfirmationUrl(url)).toBe(false);
  });
});

describe('getConfirmationUrl', () => {
  it('extrai a URL do fragmento #url=', () => {
    const alvo = `${HOST_VALIDO}/auth/v1/verify?token=abc&type=signup`;
    setHash(`#url=${alvo}`);

    expect(getConfirmationUrl()).toBe(alvo);
  });

  // O ConfirmationURL do Supabase carrega & e = na query; o valor pode chegar
  // percent-encoded dependendo do escaping do template Go.
  it('decodifica fragmento percent-encoded', () => {
    const alvo = `${HOST_VALIDO}/auth/v1/verify?token=abc&type=signup`;
    setHash(`#url=${encodeURIComponent(alvo)}`);

    expect(getConfirmationUrl()).toBe(alvo);
  });

  it('preserva a query inteira, não só até o primeiro &', () => {
    const alvo = `${HOST_VALIDO}/auth/v1/verify?token=abc&type=signup&redirect_to=https://app.rotamestre.tec.br`;
    setHash(`#url=${alvo}`);

    expect(getConfirmationUrl()).toBe(alvo);
  });

  it.each([
    ['fragmento vazio', ''],
    ['fragmento sem o prefixo #url=', '#access_token=abc'],
    ['prefixo parecido mas diferente', '#urls=https://project.supabase.co'],
  ])('devolve null com %s', (_caso, hash) => {
    setHash(hash);

    expect(getConfirmationUrl()).toBeNull();
  });

  it('devolve null quando o destino não passa na validação de host', () => {
    setHash('#url=https://evil.example/auth/v1/verify?token=abc');

    expect(getConfirmationUrl()).toBeNull();
  });

  // decodeURIComponent lança em '%' solto — o catch precisa segurar.
  it('devolve null em percent-encoding malformado, sem lançar', () => {
    setHash('#url=%E0%A4%A');

    expect(() => getConfirmationUrl()).not.toThrow();
    expect(getConfirmationUrl()).toBeNull();
  });

  it('devolve null fora da web (o fluxo é web-only)', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    setHash(`#url=${HOST_VALIDO}/auth/v1/verify?token=abc`);

    expect(getConfirmationUrl()).toBeNull();
  });
});
