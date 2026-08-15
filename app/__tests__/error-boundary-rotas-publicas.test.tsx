import { render } from '@testing-library/react-native';
import React from 'react';

const FALHA = 'falha simulada no render';

// Cada tela tem um ponto de injeção diferente porque não há dependência comum
// às cinco: index chama useSegments, first-password chama useResponsive,
// exclusao-de-conta chama useAuth e as duas páginas legais renderizam LegalPage.
// Em todos os casos a chamada acontece DURANTE o render, que é o que o
// ErrorBoundary precisa capturar.

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useSegments: () => {
    throw new Error(FALHA);
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => {
    throw new Error(FALHA);
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => {
    throw new Error(FALHA);
  },
}));

jest.mock('@/components/legal/LegalPage', () => ({
  LegalPage: () => {
    throw new Error(FALHA);
  },
  LegalSection: ({ children }: any) => children ?? null,
  LegalParagraph: ({ children }: any) => children ?? null,
  LegalBullet: ({ children }: any) => children ?? null,
}));

const TELAS: { nome: string; carregar: () => React.ComponentType }[] = [
  { nome: 'index', carregar: () => require('../index').default },
  {
    nome: 'onboarding/first-password',
    carregar: () => require('../onboarding/first-password').default,
  },
  {
    nome: 'exclusao-de-conta',
    carregar: () => require('../exclusao-de-conta').default,
  },
  {
    nome: 'politica-de-privacidade',
    carregar: () => require('../politica-de-privacidade').default,
  },
  {
    nome: 'termos-de-uso',
    carregar: () => require('../termos-de-uso').default,
  },
];

describe('ErrorBoundary nas rotas fora de gestor/motorista', () => {
  let consoleErro: jest.SpyInstance;

  beforeEach(() => {
    // O React reporta o erro capturado em console.error. Silenciar mantém a
    // saída da suíte legível sem mascarar falha do próprio teste.
    consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErro.mockRestore();
  });

  for (const { nome, carregar } of TELAS) {
    it(`${nome} exibe o fallback em vez de derrubar a tela`, () => {
      const Tela = carregar();

      // Sem ErrorBoundary o erro escapa do render e sobra tela branca. No
      // index isso é especialmente ruim: é o portão que decide para onde o
      // usuário vai, então falhar ali prende quem abre o app.
      const { getByText } = render(<Tela />);

      expect(getByText('Algo deu errado')).toBeTruthy();
    });
  }
});
