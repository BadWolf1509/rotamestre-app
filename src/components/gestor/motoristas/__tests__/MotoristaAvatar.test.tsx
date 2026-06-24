/**
 * Tests for MotoristaAvatar.tsx
 * Avatar do motorista na lista do gestor — usa useSignedUrl para signed URL.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { MotoristaAvatar } from '../MotoristaAvatar';

// Mock styles (Unistyles)
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      secondary: '#6b7280',
      white: '#ffffff',
    },
    typography: {
      base: 14,
      fontSansBold: 'System',
    },
    components: {
      avatar: {
        size: { md: 40 },
      },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => unknown) => fn(theme),
    },
  };
});

// Mock motoristas.styles — so the component can import from there
jest.mock('@/styles/gestor/motoristas.styles', () => ({
  styles: {
    avatarCell: {},
    avatarImage: {},
    avatarPlaceholder: {},
    avatarInitial: {},
  },
}));

// Mock useSignedUrl — default: null (shows initials placeholder)
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest
    .fn()
    .mockReturnValue({ url: null, loading: false, error: false }),
}));

describe('MotoristaAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSignedUrl as jest.Mock).mockReturnValue({
      url: null,
      loading: false,
      error: false,
    });
  });

  describe('quando useSignedUrl retorna uma URL assinada', () => {
    it('deve renderizar Image com a signed URL', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: 'https://signed.example.com/foto.jpg',
        loading: false,
        error: false,
      });

      const { UNSAFE_getByType } = render(
        <MotoristaAvatar fotoUrl="perfis/foto.jpg" nome="Ana Lima" />,
      );

      const image = UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({
        uri: 'https://signed.example.com/foto.jpg',
      });
    });

    it('deve passar fotoUrl para useSignedUrl', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: 'https://signed.example.com/foto.jpg',
        loading: false,
        error: false,
      });

      render(<MotoristaAvatar fotoUrl="perfis/foto.jpg" nome="Ana Lima" />);

      expect(useSignedUrl).toHaveBeenCalledWith('perfis/foto.jpg');
    });
  });

  describe('quando useSignedUrl retorna null (fallback)', () => {
    it('não deve renderizar Image', () => {
      const { UNSAFE_queryByType } = render(
        <MotoristaAvatar fotoUrl="perfis/foto.jpg" nome="Ana Lima" />,
      );

      expect(UNSAFE_queryByType(Image)).toBeNull();
    });

    it('deve mostrar inicial do nome', () => {
      const { getByText } = render(
        <MotoristaAvatar fotoUrl={null} nome="Carlos Melo" />,
      );

      expect(getByText('C')).toBeTruthy();
    });

    it('deve mostrar "M" como fallback quando nome é vazio', () => {
      const { getByText } = render(<MotoristaAvatar fotoUrl={null} nome="" />);

      expect(getByText('M')).toBeTruthy();
    });

    it('deve mostrar "M" como fallback quando nome é undefined', () => {
      const { getByText } = render(
        <MotoristaAvatar
          fotoUrl={undefined}
          nome={undefined as unknown as string}
        />,
      );

      expect(getByText('M')).toBeTruthy();
    });
  });

  describe('quando fotoUrl é null', () => {
    it('deve passar null para useSignedUrl', () => {
      render(<MotoristaAvatar fotoUrl={null} nome="Pedro Costa" />);

      expect(useSignedUrl).toHaveBeenCalledWith(null);
    });

    it('deve mostrar inicial do nome no placeholder', () => {
      const { getByText } = render(
        <MotoristaAvatar fotoUrl={null} nome="Pedro Costa" />,
      );

      expect(getByText('P')).toBeTruthy();
    });
  });
});
