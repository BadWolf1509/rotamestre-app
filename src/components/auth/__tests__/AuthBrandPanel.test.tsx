import React from 'react';
import { render } from '@testing-library/react-native';

import { AuthBrandPanel } from '../AuthBrandPanel';

// Mock do assets
jest.mock('@/../assets/marketing/login-background.png', () => 'mocked-image');

describe('AuthBrandPanel', () => {
  it('deve renderizar sem erros', () => {
    const { toJSON } = render(<AuthBrandPanel />);
    expect(toJSON()).toBeTruthy();
  });

  it('deve renderizar ImageBackground', () => {
    const { getByTestId, UNSAFE_root } = render(<AuthBrandPanel />);

    // Verificar que o componente renderiza
    expect(UNSAFE_root).toBeTruthy();
  });

  it('deve usar a imagem de background correta', () => {
    const { UNSAFE_getByType } = render(<AuthBrandPanel />);
    const ImageBackground = require('react-native').ImageBackground;

    const imageBackground = UNSAFE_getByType(ImageBackground);
    expect(imageBackground.props.source).toBe('mocked-image');
  });

  it('deve ter resizeMode como cover', () => {
    const { UNSAFE_getByType } = render(<AuthBrandPanel />);
    const ImageBackground = require('react-native').ImageBackground;

    const imageBackground = UNSAFE_getByType(ImageBackground);
    expect(imageBackground.props.resizeMode).toBe('cover');
  });

  it('deve aplicar estilos corretos ao container', () => {
    const { UNSAFE_getByType } = render(<AuthBrandPanel />);
    const ImageBackground = require('react-native').ImageBackground;

    const imageBackground = UNSAFE_getByType(ImageBackground);
    expect(imageBackground.props.style).toBeDefined();
  });

  it('deve aceitar props vazias sem erros', () => {
    // Component has Record<string, never> props, so no props should work
    expect(() => render(<AuthBrandPanel />)).not.toThrow();
  });
});
