/**
 * Tests for PerfilHeader.tsx
 * Header com avatar, nome, email, telefone, status e ações.
 * Avatar usa useSignedUrl para obter URL assinada do bucket privado.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { PerfilHeader } from '../PerfilHeader';

import type { Motorista } from '../types';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      white: '#ffffff',
      gray700: '#374151',
      success: '#10b981',
      error: '#ef4444',
    },
  };

  return {
    useUnistyles: () => ({ theme }),
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

// Mock styles file
jest.mock('../styles', () => ({
  styles: {
    perfilHeaderCard: {},
    perfilHeaderContent: {},
    avatarContainer: {},
    avatarImage: {},
    avatarPlaceholder: {},
    avatarInitial: {},
    perfilInfo: {},
    perfilNome: {},
    perfilEmail: {},
    perfilTelefone: {},
    statusBadge: {},
    statusBadgeAtivo: {},
    statusBadgeInativo: {},
    statusBadgeText: {},
    statusBadgeTextAtivo: {},
    statusBadgeTextInativo: {},
    perfilDesde: {},
    perfilActions: {},
    actionButton: {},
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    actionButtonText: {},
    actionButtonTextPrimary: {},
    actionButtonTextSecondary: {},
  },
}));

// Mock useSignedUrl — default: null (shows initials placeholder)
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest
    .fn()
    .mockReturnValue({ url: null, loading: false, error: false }),
}));

describe('PerfilHeader', () => {
  const mockMotorista: Motorista = {
    id: 'motorista-1',
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '(11) 99999-9999',
    foto_url: 'perfis/joao.jpg',
    ativo: true,
    created_at: '2025-01-15T10:00:00Z',
  };

  const mockOnEdit = jest.fn();
  const mockOnToggleStatus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSignedUrl as jest.Mock).mockReturnValue({
      url: null,
      loading: false,
      error: false,
    });
  });

  describe('Renderização básica', () => {
    it('deve renderizar nome do motorista', () => {
      const { getByText } = render(<PerfilHeader motorista={mockMotorista} />);

      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve renderizar email do motorista', () => {
      const { getByText } = render(<PerfilHeader motorista={mockMotorista} />);

      expect(getByText('joao@example.com')).toBeTruthy();
    });

    it('deve renderizar telefone quando disponível', () => {
      const { getByText } = render(<PerfilHeader motorista={mockMotorista} />);

      expect(getByText('(11) 99999-9999')).toBeTruthy();
    });

    it('não deve renderizar telefone quando não disponível', () => {
      const motoristaSemTelefone = { ...mockMotorista, telefone: undefined };
      const { queryByText } = render(
        <PerfilHeader motorista={motoristaSemTelefone} />,
      );

      expect(queryByText('(11) 99999-9999')).toBeNull();
    });

    it('deve mostrar data de criação formatada', () => {
      const { getByText } = render(<PerfilHeader motorista={mockMotorista} />);

      expect(getByText(/Motorista desde/)).toBeTruthy();
    });
  });

  describe('Avatar — useSignedUrl integration', () => {
    it('deve passar foto_url para useSignedUrl', () => {
      render(<PerfilHeader motorista={mockMotorista} />);

      expect(useSignedUrl).toHaveBeenCalledWith('perfis/joao.jpg');
    });

    it('deve mostrar Image com URL assinada quando useSignedUrl retorna URL', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: 'https://signed/joao.jpg',
        loading: false,
        error: false,
      });

      const { UNSAFE_getByType } = render(
        <PerfilHeader motorista={mockMotorista} />,
      );

      const image = UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({ uri: 'https://signed/joao.jpg' });
    });

    it('deve mostrar inicial quando useSignedUrl retorna null', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });

      const { UNSAFE_queryByType, getByText } = render(
        <PerfilHeader motorista={mockMotorista} />,
      );

      expect(UNSAFE_queryByType(Image)).toBeNull();
      expect(getByText('J')).toBeTruthy();
    });

    it('deve mostrar inicial mesmo quando foto_url está definido mas signed URL é null', () => {
      (useSignedUrl as jest.Mock).mockReturnValue({
        url: null,
        loading: false,
        error: true,
      });

      const motoristaComFoto = {
        ...mockMotorista,
        foto_url: 'perfis/joao.jpg',
      };
      const { UNSAFE_queryByType } = render(
        <PerfilHeader motorista={motoristaComFoto} />,
      );

      expect(UNSAFE_queryByType(Image)).toBeNull();
    });
  });

  describe('Status Badge', () => {
    it('deve mostrar "Ativo" quando motorista está ativo', () => {
      const { getByText } = render(<PerfilHeader motorista={mockMotorista} />);

      expect(getByText('Ativo')).toBeTruthy();
    });

    it('deve mostrar "Inativo" quando motorista está inativo', () => {
      const motoristaInativo = { ...mockMotorista, ativo: false };
      const { getByText } = render(
        <PerfilHeader motorista={motoristaInativo} />,
      );

      expect(getByText('Inativo')).toBeTruthy();
    });
  });

  describe('Botões de ação', () => {
    it('deve renderizar botão Editar quando onEdit fornecido', () => {
      const { getByText } = render(
        <PerfilHeader motorista={mockMotorista} onEdit={mockOnEdit} />,
      );

      expect(getByText('Editar')).toBeTruthy();
    });

    it('deve chamar onEdit ao clicar no botão', () => {
      const { getByText } = render(
        <PerfilHeader motorista={mockMotorista} onEdit={mockOnEdit} />,
      );

      fireEvent.press(getByText('Editar'));

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar botão Desativar quando motorista ativo', () => {
      const { getByText } = render(
        <PerfilHeader
          motorista={mockMotorista}
          onToggleStatus={mockOnToggleStatus}
        />,
      );

      expect(getByText('Desativar')).toBeTruthy();
    });

    it('deve renderizar botão Ativar quando motorista inativo', () => {
      const motoristaInativo = { ...mockMotorista, ativo: false };
      const { getByText } = render(
        <PerfilHeader
          motorista={motoristaInativo}
          onToggleStatus={mockOnToggleStatus}
        />,
      );

      expect(getByText('Ativar')).toBeTruthy();
    });

    it('deve chamar onToggleStatus ao clicar no botão', () => {
      const { getByText } = render(
        <PerfilHeader
          motorista={mockMotorista}
          onToggleStatus={mockOnToggleStatus}
        />,
      );

      fireEvent.press(getByText('Desativar'));

      expect(mockOnToggleStatus).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar ações quando nenhum callback fornecido', () => {
      const { queryByText } = render(
        <PerfilHeader motorista={mockMotorista} />,
      );

      expect(queryByText('Editar')).toBeNull();
      expect(queryByText('Desativar')).toBeNull();
    });

    it('deve renderizar ambos botões quando ambos callbacks fornecidos', () => {
      const { getByText } = render(
        <PerfilHeader
          motorista={mockMotorista}
          onEdit={mockOnEdit}
          onToggleStatus={mockOnToggleStatus}
        />,
      );

      expect(getByText('Editar')).toBeTruthy();
      expect(getByText('Desativar')).toBeTruthy();
    });
  });
});
