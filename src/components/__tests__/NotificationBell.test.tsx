import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { defaultTheme } from '@/utils/styles';

import { NotificationBell } from '../NotificationBell';

// Mock default
const defaultMock = {
  naoLidas: 3,
  notificacoes: [],
  loading: false,
  marcarComoLida: jest.fn(),
  marcarTodasComoLidas: jest.fn(),
  refresh: jest.fn(),
};

let mockReturn = { ...defaultMock };

// Mock do useNotifications
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => mockReturn,
}));

// Mock do NotificationModalContext
const mockOpenModal = jest.fn();
const mockCloseModal = jest.fn();
jest.mock('@/context/NotificationModalContext', () => ({
  useNotificationModal: () => ({
    isOpen: false,
    openModal: mockOpenModal,
    closeModal: mockCloseModal,
  }),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReturn = { ...defaultMock };
  });

  it('deve renderizar o ícone de notificação', () => {
    const { getByLabelText } = render(<NotificationBell variant="desktop" />);

    const bell = getByLabelText('Notificações');
    expect(bell).toBeTruthy();
  });

  it('deve mostrar badge com número de não lidas', () => {
    const { getByText } = render(<NotificationBell variant="desktop" />);

    const badge = getByText('3');
    expect(badge).toBeTruthy();
  });

  it('deve mostrar "99+" quando há mais de 99 notificações', () => {
    mockReturn = { ...defaultMock, naoLidas: 150 };

    const { getByText } = render(<NotificationBell variant="desktop" />);

    const badge = getByText('99+');
    expect(badge).toBeTruthy();
  });

  it('não deve mostrar badge quando não há notificações não lidas', () => {
    mockReturn = { ...defaultMock, naoLidas: 0 };

    const { queryByText } = render(<NotificationBell variant="desktop" />);

    expect(queryByText('0')).toBeNull();
  });

  it('deve abrir modal ao clicar', async () => {
    const { getByLabelText } = render(<NotificationBell variant="desktop" />);

    const bell = getByLabelText('Notificações');
    fireEvent.press(bell);

    // Agora o modal é gerenciado pelo NotificationModalContext
    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('deve usar ícone filled quando há não lidas', () => {
    const { UNSAFE_getByType } = render(<NotificationBell variant="desktop" />);
    const Ionicons = require('@expo/vector-icons').Ionicons;

    const icon = UNSAFE_getByType(Ionicons);
    // Com 3 não lidas, deve usar o ícone filled
    expect(icon.props.name).toBe('notifications');
  });

  it('deve usar ícone outline quando não há não lidas', () => {
    mockReturn = { ...defaultMock, naoLidas: 0 };

    const { UNSAFE_getByType } = render(<NotificationBell variant="desktop" />);
    const Ionicons = require('@expo/vector-icons').Ionicons;

    const icon = UNSAFE_getByType(Ionicons);
    expect(icon.props.name).toBe('notifications-outline');
  });

  it('deve aplicar estilos corretos para variant desktop', () => {
    const { UNSAFE_getByType } = render(<NotificationBell variant="desktop" />);
    const Ionicons = require('@expo/vector-icons').Ionicons;

    const icon = UNSAFE_getByType(Ionicons);
    expect(icon.props.size).toBe(24);
    expect(icon.props.color).toBe(defaultTheme.colors.gray700);
  });

  it('deve aplicar estilos corretos para variant mobile', () => {
    const { UNSAFE_getByType } = render(<NotificationBell variant="mobile" />);
    const Ionicons = require('@expo/vector-icons').Ionicons;

    const icon = UNSAFE_getByType(Ionicons);
    expect(icon.props.size).toBe(26);
    expect(icon.props.color).toBe(defaultTheme.colors.white);
  });

  it('deve ter acessibilidade configurada corretamente', () => {
    const { getByLabelText } = render(<NotificationBell variant="desktop" />);

    const bell = getByLabelText('Notificações');
    expect(bell.props.accessibilityLabel).toBe('Notificações');
    expect(bell.props.accessibilityHint).toBe('3 notificações não lidas');
  });

  // Nota: Os testes de overlay e conteúdo do modal foram removidos pois
  // o modal agora é gerenciado pelo NotificationModalContext, não pelo NotificationBell.
  // O NotificationBell apenas chama openModal() quando clicado.

  it('deve aplicar cor diferente para variant mobile com 0 notificações', () => {
    mockReturn = { ...defaultMock, naoLidas: 0 };

    const { UNSAFE_getByType } = render(<NotificationBell variant="mobile" />);
    const Ionicons = require('@expo/vector-icons').Ionicons;

    const icon = UNSAFE_getByType(Ionicons);
    expect(icon.props.color).toBe(defaultTheme.colors.white);
    expect(icon.props.name).toBe('notifications-outline');
  });
});
