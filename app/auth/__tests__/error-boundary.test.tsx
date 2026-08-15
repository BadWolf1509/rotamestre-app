import { render } from '@testing-library/react-native';
import React from 'react';

// As 5 telas de auth chamam useResponsive durante o render. Fazê-lo lançar
// simula um defeito em qualquer ponto da árvore — é o cenário que hoje deixa
// o usuário com tela branca na porta de entrada do app, sem recuperação.
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => {
    throw new Error('falha simulada no render');
  },
}));

const TELAS: { nome: string; carregar: () => React.ComponentType }[] = [
  { nome: 'login', carregar: () => require('../login').default },
  { nome: 'register', carregar: () => require('../register').default },
  {
    nome: 'forgot-password',
    carregar: () => require('../forgot-password').default,
  },
  {
    nome: 'reset-password',
    carregar: () => require('../reset-password').default,
  },
  {
    nome: 'confirm-reset',
    carregar: () => require('../confirm-reset').default,
  },
];

describe('ErrorBoundary nas telas de auth', () => {
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

      // Sem ErrorBoundary o erro escapa do render e o usuário fica com tela
      // branca — em auth não há para onde voltar, é a primeira tela do app.
      const { getByText } = render(<Tela />);

      expect(getByText('Algo deu errado')).toBeTruthy();
    });
  }
});
