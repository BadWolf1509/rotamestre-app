/**
 * DrawerHeader component tests
 * Tests avatar display using signed URL from useSignedUrl hook.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { DrawerHeader } from '../DrawerHeader';

// Mock @/utils/styles to avoid unistyles dependency in tests
jest.mock('@/utils/styles', () => ({
  useUnistyles: jest.fn(),
  StyleSheet: {
    create: (fn: (theme: unknown) => unknown) => {
      const theme = {
        spacing: { xl: 24, md: 12, sm: 8, xs: 4, '1.5': 6 },
        colors: {
          gray200: '#E5E7EB',
          gray500: '#6B7280',
          gray900: '#111827',
          primary: '#007AFF',
          primaryDark: '#0056CC',
          secondary: '#FF9500',
          white: '#FFFFFF',
        },
        typography: {
          fontSize: { xs: 12, sm: 14, lg: 18, '2xl': 24 },
          fontSansBold: 'Inter-Bold',
          fontSansSemiBold: 'Inter-SemiBold',
        },
        borderRadius: { full: 9999, md: 8 },
        components: {
          drawer: { avatarSize: 64 },
        },
      };
      return typeof fn === 'function' ? fn(theme) : fn;
    },
  },
}));

// Mock useSignedUrl — default to no URL (initial letter avatar)
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest
    .fn()
    .mockReturnValue({ url: null, loading: false, error: false }),
}));

const mockProfile = {
  id: 'u1',
  nome: 'Maria Souza',
  email: 'maria@example.com',
  papel: 'gestor' as const,
  foto_url: 'perfis/p.jpg',
  is_gestor_principal: false,
  unidade_id: 'un1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockUnidade = { nome: 'Unidade Centro' };

describe('DrawerHeader', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when useSignedUrl returns a signed URL', () => {
    it('renders Image with the signed URL as source uri', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: 'https://signed/d',
        loading: false,
        error: false,
      });

      const { UNSAFE_getByType } = render(
        <DrawerHeader profile={mockProfile} unidade={mockUnidade} />,
      );

      const image = UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({ uri: 'https://signed/d' });
    });

    it('passes foto_url to useSignedUrl hook', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: 'https://signed/d',
        loading: false,
        error: false,
      });

      render(<DrawerHeader profile={mockProfile} unidade={mockUnidade} />);

      expect(useSignedUrl).toHaveBeenCalledWith('perfis/p.jpg');
    });
  });

  describe('when useSignedUrl returns null', () => {
    it('shows initial letter avatar instead of Image', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });

      const { UNSAFE_queryByType, getByText } = render(
        <DrawerHeader profile={mockProfile} unidade={mockUnidade} />,
      );

      expect(UNSAFE_queryByType(Image)).toBeNull();
      expect(getByText('M')).toBeTruthy();
    });
  });

  describe('when profile is null', () => {
    it('shows ? as initial when profile is null', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });

      const { UNSAFE_queryByType, getByText } = render(
        <DrawerHeader profile={null} unidade={null} />,
      );

      expect(UNSAFE_queryByType(Image)).toBeNull();
      expect(getByText('?')).toBeTruthy();
    });
  });
});
