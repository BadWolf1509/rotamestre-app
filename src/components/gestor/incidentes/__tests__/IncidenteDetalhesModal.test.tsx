/**
 * Tests for IncidenteDetalhesModal.tsx
 * Verifies signed URL integration via useSignedUrl hook.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import type { Incidente } from '@/hooks/incidentes-gestor/types';
import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { IncidenteDetalhesModal } from '../IncidenteDetalhesModal';

// Mock useSignedUrl
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest.fn(),
}));

const mockUseSignedUrl = useSignedUrl as jest.Mock;

// Mock design-system DesktopModal so we can render children
jest.mock('@/design-system', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    DesktopModal: ({
      visible,
      children,
      title,
      onClose,
    }: {
      visible: boolean;
      children: React.ReactNode;
      title: string;
      onClose: () => void;
    }) => {
      if (!visible) return null;
      return (
        <View testID="desktop-modal">
          <Text testID="modal-title">{title}</Text>
          <TouchableOpacity testID="close-button" onPress={onClose}>
            <Text>Close</Text>
          </TouchableOpacity>
          {children}
        </View>
      );
    },
    StatusBadge: ({ label }: { label: string }) => {
      const { Text } = require('react-native');
      return <Text>{label}</Text>;
    },
  };
});

// Mock useUnistyles
jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        gray400: '#9CA3AF',
        gray500: '#6B7280',
        gray600: '#4B5563',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
      },
    },
  }),
}));

// Mock styles
jest.mock('@/styles/gestor/incidentes.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}));

// Mock Text component
jest.mock('@/components/Text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Minimal incidente fixture
const incidente: Incidente = {
  id: 'inc-1',
  foto_url: 'incidentes/i.jpg',
  categoria: 'accident',
  status: 'aberto',
  motorista_id: 'mot-1',
  motorista_nome: 'João',
  endereco: 'Rua A, 1',
  descricao: 'Acidente leve',
  rota_id: 'rota-1',
  rota_data: null,
  observacoes_gestao: null,
  created_at: '2026-06-23T10:00:00Z',
  unidade_id: 'unid-1',
};

const defaultProps = {
  incidente,
  visible: true,
  onClose: jest.fn(),
  isDesktop: true,
  categoriaLabels: {
    accident: {
      label: 'Acidente',
      color: '#EF4444',
      icon: 'warning-outline' as const,
    },
  },
  statusLabels: {
    aberto: { label: 'Aberto', color: '#EF4444' },
  },
  fotoLoading: false,
  fotoError: false,
  onFotoLoad: jest.fn(),
  onFotoError: jest.fn(),
  onFotoRetry: jest.fn(),
  onAlterarStatus: jest.fn(),
  onRemarcarEntrega: jest.fn(),
  onVerHistoricoMotorista: jest.fn(),
  formatDate: (d: string) => d,
};

describe('IncidenteDetalhesModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: hook returns a signed url
    mockUseSignedUrl.mockReturnValue({
      url: 'https://signed/i',
      loading: false,
      error: false,
    });
  });

  describe('useSignedUrl integration', () => {
    it('passes foto_url to useSignedUrl', () => {
      render(<IncidenteDetalhesModal {...defaultProps} />);
      expect(mockUseSignedUrl).toHaveBeenCalledWith('incidentes/i.jpg');
    });

    it('renders Image with the signed url from useSignedUrl', () => {
      const { UNSAFE_getAllByType } = render(
        <IncidenteDetalhesModal {...defaultProps} />,
      );
      const images = UNSAFE_getAllByType(Image);
      expect(
        images.some((img) => img.props.source?.uri === 'https://signed/i'),
      ).toBe(true);
    });

    it('does not include ?retry= cache-bust in the image uri', () => {
      const { UNSAFE_getAllByType } = render(
        <IncidenteDetalhesModal {...defaultProps} />,
      );
      const images = UNSAFE_getAllByType(Image);
      images.forEach((img) => {
        const uri: string | undefined = img.props.source?.uri;
        if (uri) {
          expect(uri).not.toContain('?retry=');
        }
      });
    });
  });

  describe('hook unconditional call', () => {
    it('calls useSignedUrl even when incidente is null (hook must be before early return)', () => {
      // incidente=null triggers early return — hook must still be called
      render(<IncidenteDetalhesModal {...defaultProps} incidente={null} />);
      expect(mockUseSignedUrl).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when fotoLoading=true and fotoError=false', () => {
      const { getByText } = render(
        <IncidenteDetalhesModal
          {...defaultProps}
          fotoLoading={true}
          fotoError={false}
        />,
      );
      expect(getByText('Carregando foto...')).toBeTruthy();
    });
  });
});
