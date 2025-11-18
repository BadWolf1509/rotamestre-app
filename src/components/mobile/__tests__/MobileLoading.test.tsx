import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';

import { MobileLoading } from '../MobileLoading';

// Mock useUnistyles
jest.mock('@/utils/styles', () => ({
  StyleSheet: {
    create: (fn: Function) => fn({
      spacing: { xl: 32, lg: 24 },
      typography: { sm: 14 },
      colors: { primary: '#007AFF', gray50: '#F9FAFB', gray500: '#6B7280' },
    }),
  },
  useUnistyles: jest.fn(),
}));

const mockUseUnistyles = require('@/utils/styles').useUnistyles;

describe('MobileLoading', () => {
  beforeEach(() => {
    mockUseUnistyles.mockReturnValue({
      theme: {
        colors: {
          primary: '#007AFF',
          gray50: '#F9FAFB',
          gray500: '#6B7280',
        },
        spacing: { xl: 32, lg: 24 },
        typography: { sm: 14 },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar ActivityIndicator', () => {
      const { UNSAFE_getByType } = render(<MobileLoading />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator).toBeTruthy();
    });

    it('deve renderizar mensagem padrão', () => {
      const { getByText } = render(<MobileLoading />);

      expect(getByText('Carregando...')).toBeTruthy();
    });

    it('deve renderizar mensagem customizada', () => {
      const { getByText } = render(<MobileLoading message="Buscando dados..." />);

      expect(getByText('Buscando dados...')).toBeTruthy();
    });

    it('não deve renderizar mensagem quando message é vazio', () => {
      const { queryByText, UNSAFE_getByType } = render(<MobileLoading message="" />);

      expect(queryByText('Carregando...')).toBeNull();
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('deve usar mensagem padrão quando message é undefined', () => {
      const { getByText } = render(<MobileLoading message={undefined} />);

      // message padrão é 'Carregando...'
      expect(getByText('Carregando...')).toBeTruthy();
    });
  });

  describe('Prop: size', () => {
    it('deve usar size="large" por padrão', () => {
      const { UNSAFE_getByType } = render(<MobileLoading />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('large');
    });

    it('deve aceitar size="small"', () => {
      const { UNSAFE_getByType } = render(<MobileLoading size="small" />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('small');
    });

    it('deve aceitar size="large"', () => {
      const { UNSAFE_getByType } = render(<MobileLoading size="large" />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('large');
    });
  });

  describe('Prop: color', () => {
    it('deve usar cor primária do tema por padrão', () => {
      const { UNSAFE_getByType } = render(<MobileLoading />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBe('#007AFF');
    });

    it('deve aceitar cor customizada', () => {
      const { UNSAFE_getByType } = render(<MobileLoading color="#FF0000" />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBe('#FF0000');
    });

    it('deve sobrescrever cor do tema quando fornecido', () => {
      const { UNSAFE_getByType } = render(<MobileLoading color="#00FF00" />);

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBe('#00FF00');
    });
  });

  describe('Prop: fullScreen', () => {
    it('deve usar fullScreen=true por padrão', () => {
      const { UNSAFE_getAllByType } = render(<MobileLoading />);

      const View = require('react-native').View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it('deve renderizar em fullScreen quando fullScreen=true', () => {
      const { UNSAFE_getAllByType } = render(<MobileLoading fullScreen={true} />);

      const View = require('react-native').View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it('deve renderizar inline quando fullScreen=false', () => {
      const { UNSAFE_getAllByType } = render(<MobileLoading fullScreen={false} />);

      const View = require('react-native').View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Prop: style', () => {
    it('deve aceitar style customizado', () => {
      const customStyle = { backgroundColor: '#FFFFFF' };

      const { UNSAFE_getAllByType } = render(<MobileLoading style={customStyle} />);

      const View = require('react-native').View;
      const views = UNSAFE_getAllByType(View);

      expect(views[0].props.style).toBeDefined();
    });

    it('deve combinar style customizado com style padrão', () => {
      const customStyle = { padding: 20 };

      const { UNSAFE_getAllByType } = render(
        <MobileLoading style={customStyle} fullScreen={false} />
      );

      const View = require('react-native').View;
      const views = UNSAFE_getAllByType(View);

      expect(views[0].props.style).toBeDefined();
    });
  });

  describe('Combinações de Props', () => {
    it('deve combinar todas as props', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileLoading
          message="Processando..."
          size="small"
          color="#FF00FF"
          fullScreen={false}
          style={{ marginTop: 10 }}
        />
      );

      expect(getByText('Processando...')).toBeTruthy();

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('small');
      expect(indicator.props.color).toBe('#FF00FF');
    });

    it('deve funcionar com fullScreen e cor customizada', () => {
      const { UNSAFE_getByType } = render(
        <MobileLoading fullScreen={true} color="#00FFFF" />
      );

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBe('#00FFFF');
    });

    it('deve funcionar com todas as props vazias/padrão', () => {
      const { getByText, UNSAFE_getByType } = render(<MobileLoading />);

      expect(getByText('Carregando...')).toBeTruthy();

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('large');
    });
  });

  describe('Casos de Uso', () => {
    it('deve funcionar como loading de página inteira', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileLoading message="Carregando página..." fullScreen={true} />
      );

      expect(getByText('Carregando página...')).toBeTruthy();
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('deve funcionar como loading inline em lista', () => {
      const { getByText, UNSAFE_getByType } = render(
        <MobileLoading
          message="Carregando mais itens..."
          size="small"
          fullScreen={false}
        />
      );

      expect(getByText('Carregando mais itens...')).toBeTruthy();

      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('small');
    });

    it('deve funcionar como loading sem texto (spinner apenas)', () => {
      const { UNSAFE_getByType, UNSAFE_queryAllByType } = render(
        <MobileLoading message="" />
      );

      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

      const Text = require('react-native').Text;
      const texts = UNSAFE_queryAllByType(Text);
      expect(texts.length).toBe(0);
    });
  });

  describe('Mensagens Longas', () => {
    it('deve renderizar mensagem longa', () => {
      const longMessage = 'Aguarde enquanto processamos sua solicitação. Isso pode levar alguns minutos...';

      const { getByText } = render(<MobileLoading message={longMessage} />);

      expect(getByText(longMessage)).toBeTruthy();
    });

    it('deve renderizar mensagem com quebras de linha', () => {
      const multilineMessage = 'Carregando dados...\nPor favor, aguarde.';

      const { getByText } = render(<MobileLoading message={multilineMessage} />);

      expect(getByText(multilineMessage)).toBeTruthy();
    });
  });
});
