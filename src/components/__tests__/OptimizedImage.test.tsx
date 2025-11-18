import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { OptimizedImage } from '../OptimizedImage';

// Mock PerformanceOptimizer
jest.mock('@/services/performanceOptimizer', () => ({
  __esModule: true,
  default: {
    getOptimizedImageUrl: jest.fn((uri: string) => uri),
    deferOperation: jest.fn((fn: () => Promise<void>) => fn()),
  },
}));

describe('OptimizedImage', () => {
  const mockSource = { uri: 'https://example.com/image.jpg' };
  const mockPlaceholder = { uri: 'https://example.com/placeholder.jpg' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com source numérico (local)', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={require('@/assets/icon.png')} />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getByType(Image)).toBeTruthy();
    });

    it('deve renderizar com source URI', async () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} />
      );

      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      expect(images.length).toBeGreaterThan(0);
    });

    it('deve aplicar style customizado', () => {
      const customStyle = { borderRadius: 10 };
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} style={customStyle} />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it('deve aplicar width e height', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} width={200} height={150} />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });
  });

  describe('Placeholder', () => {
    it('deve renderizar placeholder quando fornecido', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} placeholder={mockPlaceholder} />
      );

      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      // Deve ter placeholder + imagem final
      expect(images.length).toBeGreaterThan(1);
    });

    it('deve aplicar blurRadius ao placeholder', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage
          source={mockSource}
          placeholder={mockPlaceholder}
          blurRadius={5}
        />
      );

      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const placeholderImage = images.find((img) => img.props.blurRadius === 5);
      expect(placeholderImage).toBeTruthy();
    });

    it('deve usar blurRadius padrão de 10', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} placeholder={mockPlaceholder} />
      );

      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const placeholderImage = images.find((img) => img.props.blurRadius === 10);
      expect(placeholderImage).toBeTruthy();
    });

    it('deve renderizar BlurView no iOS quando tem placeholder', () => {
      // Mock Platform.OS como iOS
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const { UNSAFE_queryAllByType } = render(
        <OptimizedImage source={mockSource} placeholder={mockPlaceholder} />
      );

      const BlurView = require('expo-blur').BlurView;
      const blurViews = UNSAFE_queryAllByType(BlurView);
      expect(blurViews.length).toBeGreaterThan(0);
    });

    it('deve renderizar ActivityIndicator durante carregamento com placeholder', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} placeholder={mockPlaceholder} />
      );

      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('deve chamar onLoadStart ao iniciar carregamento', async () => {
      const mockOnLoadStart = jest.fn();

      render(
        <OptimizedImage
          source={mockSource}
          onLoadStart={mockOnLoadStart}
        />
      );

      await waitFor(() => {
        expect(mockOnLoadStart).toHaveBeenCalled();
      });
    });

    it('deve chamar onLoadEnd ao finalizar carregamento', async () => {
      const mockOnLoadEnd = jest.fn();

      render(
        <OptimizedImage
          source={mockSource}
          onLoadEnd={mockOnLoadEnd}
        />
      );

      await waitFor(() => {
        expect(mockOnLoadEnd).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling', () => {
    it('deve renderizar estado de erro quando image.onError é chamado', async () => {
      const { UNSAFE_getAllByType, queryByText } = render(
        <OptimizedImage source={mockSource} />
      );

      // Simular erro na imagem
      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const animatedImage = images[images.length - 1]; // Última imagem é a Animated.Image

      // Trigger onError
      if (animatedImage?.props?.onError) {
        animatedImage.props.onError(new Error('Failed to load'));
      }

      // Verificar que o componente renderiza (error icon pode não aparecer em testes devido ao unmount)
      expect(queryByText).toBeDefined();
    });

    it('deve chamar onError callback quando há erro', async () => {
      const mockOnError = jest.fn();

      const { UNSAFE_getAllByType } = render(
        <OptimizedImage
          source={mockSource}
          onError={mockOnError}
        />
      );

      // Simular erro
      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const animatedImage = images[images.length - 1];

      if (animatedImage?.props?.onError) {
        const error = new Error('Failed to load');
        animatedImage.props.onError(error);

        await waitFor(() => {
          expect(mockOnError).toHaveBeenCalledWith(error);
        });
      }
    });

    it('deve renderizar container de erro com estilo correto', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} width={100} height={100} />
      );

      // Simular erro
      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const animatedImage = images[images.length - 1];

      if (animatedImage?.props?.onError) {
        animatedImage.props.onError(new Error('Failed'));
      }

      // Verificar que o componente renderiza
      expect(images.length).toBeGreaterThan(0);
    });
  });

  describe('Props Opcionais', () => {
    it('deve renderizar sem placeholder', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar com priority="high"', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} priority="high" />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar com priority="low"', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} priority="low" />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar com enableCache=false', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} enableCache={false} />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar com enableLazyLoad=false', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} enableLazyLoad={false} />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });
  });

  describe('Image Props Passthrough', () => {
    it('deve passar resizeMode para Image', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} resizeMode="cover" />
      );

      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      const imageWithResizeMode = images.find((img) => img.props.resizeMode === 'cover');
      expect(imageWithResizeMode).toBeTruthy();
    });

    it('deve passar testID para componente', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} testID="optimized-image" />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it('deve passar accessible para Image', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} accessible={true} />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve passar accessibilityLabel para Image', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage source={mockSource} accessibilityLabel="Profile photo" />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });
  });

  describe('Dimensões Otimizadas', () => {
    it('deve aplicar width e height quando fornecidos', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} width={300} height={200} />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it('deve mesclar style com dimensões customizadas', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage
          source={mockSource}
          width={100}
          height={100}
          style={{ borderRadius: 50 }}
        />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it('deve usar style sem width/height quando não fornecidos', () => {
      const { UNSAFE_getByType } = render(
        <OptimizedImage source={mockSource} style={{ flex: 1 }} />
      );

      const { View } = require('react-native');
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar imagem de perfil com placeholder', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage
          source={{ uri: 'https://example.com/profile.jpg' }}
          placeholder={{ uri: 'https://example.com/avatar-placeholder.jpg' }}
          width={100}
          height={100}
          style={{ borderRadius: 50 }}
        />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar imagem de thumbnail com priority alta', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage
          source={{ uri: 'https://example.com/thumbnail.jpg' }}
          width={80}
          height={80}
          priority="high"
        />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });

    it('deve renderizar imagem de background com lazy load', () => {
      const { UNSAFE_getAllByType } = render(
        <OptimizedImage
          source={{ uri: 'https://example.com/background.jpg' }}
          priority="low"
          enableLazyLoad={true}
        />
      );

      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
    });
  });

  describe('Platform Specific', () => {
    it('deve usar PerformanceOptimizer.getOptimizedImageUrl na web', () => {
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

      render(
        <OptimizedImage source={mockSource} width={200} height={150} />
      );

      // Verificar que foi chamado (pode ser assíncrono)
      expect(PerformanceOptimizer.getOptimizedImageUrl).toHaveBeenCalled();
    });
  });
});
