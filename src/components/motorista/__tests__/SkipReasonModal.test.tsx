/**
 * Tests for SkipReasonModal
 *
 * Covers reason selection, "outro" text input, confirm/cancel actions.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { SKIP_REASONS } from '@/constants/skipReasons';

import { SkipReasonModal } from '../SkipReasonModal';

// Mock DesktopModal with button support
jest.mock('@/components/desktop/DesktopModal', () => ({
  DesktopModal: ({ visible, onClose, title, children, primaryButton, secondaryButton }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    primaryButton?: { text: string; onPress: () => void; disabled?: boolean };
    secondaryButton?: { text: string; onPress: () => void };
  }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="desktop-modal">
        <Text testID="modal-title">{title}</Text>
        <TouchableOpacity testID="close-button" onPress={onClose}>
          <Text>X</Text>
        </TouchableOpacity>
        {children}
        <View testID="modal-footer">
          {secondaryButton && (
            <TouchableOpacity
              onPress={secondaryButton.onPress}
              testID="secondary-button"
            >
              <Text>{secondaryButton.text}</Text>
            </TouchableOpacity>
          )}
          {primaryButton && (
            <TouchableOpacity
              onPress={primaryButton.onPress}
              disabled={primaryButton.disabled}
              testID="primary-button"
            >
              <Text>{primaryButton.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockParada = {
  id: 'parada-1',
  endereco: 'Rua Teste, 123 - Centro',
  ordem: 1,
  status: 'em_andamento',
  tipo: 'entrega',
  latitude: -23.55,
  longitude: -46.63,
};

describe('SkipReasonModal', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar todos os 6 motivos', () => {
    const { getAllByRole } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const radioButtons = getAllByRole('radio');
    expect(radioButtons).toHaveLength(SKIP_REASONS.length);
  });

  it('não deve renderizar quando visible=false', () => {
    const { queryByTestId } = render(
      <SkipReasonModal
        visible={false}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(queryByTestId('desktop-modal')).toBeNull();
  });

  it('deve exibir endereço da parada', () => {
    const { getByText } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Rua Teste, 123 - Centro')).toBeTruthy();
  });

  it('deve NÃO chamar onConfirm sem selecionar motivo', () => {
    const { getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByTestId('primary-button'));

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('deve chamar onConfirm ao selecionar motivo e confirmar', () => {
    const { getByLabelText, getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByLabelText('Cliente ausente'));
    fireEvent.press(getByTestId('primary-button'));

    expect(mockOnConfirm).toHaveBeenCalledWith('cliente_ausente', undefined);
  });

  it('deve mostrar campo de texto ao selecionar "outro"', () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByLabelText('Outro motivo'));

    expect(getByPlaceholderText('Descreva o motivo (mínimo 10 caracteres)')).toBeTruthy();
  });

  it('deve NÃO chamar onConfirm com "outro" e texto curto', () => {
    const { getByLabelText, getByPlaceholderText, getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByLabelText('Outro motivo'));
    fireEvent.changeText(getByPlaceholderText('Descreva o motivo (mínimo 10 caracteres)'), 'curto');
    fireEvent.press(getByTestId('primary-button'));

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('deve chamar onCancel ao clicar cancelar', () => {
    const { getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByTestId('secondary-button'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('deve chamar onConfirm com motivo correto', () => {
    const { getByLabelText, getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByLabelText('Acesso bloqueado'));
    fireEvent.press(getByTestId('primary-button'));

    expect(mockOnConfirm).toHaveBeenCalledWith('acesso_bloqueado', undefined);
  });

  it('deve chamar onConfirm com "outro" incluindo observacoes', () => {
    const { getByLabelText, getByPlaceholderText, getByTestId } = render(
      <SkipReasonModal
        visible={true}
        parada={mockParada}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.press(getByLabelText('Outro motivo'));
    fireEvent.changeText(
      getByPlaceholderText('Descreva o motivo (mínimo 10 caracteres)'),
      'O portão estava trancado e ninguém atendeu'
    );
    fireEvent.press(getByTestId('primary-button'));

    expect(mockOnConfirm).toHaveBeenCalledWith(
      'outro',
      'O portão estava trancado e ninguém atendeu'
    );
  });
});
