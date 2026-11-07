/**
 * StatusFilterSection - Tests
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { StatusFilterSection } from '../StatusFilterSection';

describe('StatusFilterSection', () => {
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders section title', () => {
    render(
      <StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />,
    );
    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('renders all status options', () => {
    render(
      <StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />,
    );

    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.getByText('Concluída')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
  });

  it('calls onStatusChange when status is selected', () => {
    render(
      <StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />,
    );

    fireEvent.press(screen.getByTestId('filter-status-pendente'));
    expect(mockOnStatusChange).toHaveBeenCalledWith('pendente');
  });

  it('toggles status off when same status is selected', () => {
    render(
      <StatusFilterSection
        status="pendente"
        onStatusChange={mockOnStatusChange}
      />,
    );

    fireEvent.press(screen.getByTestId('filter-status-pendente'));
    expect(mockOnStatusChange).toHaveBeenCalledWith(null);
  });

  it('calls onStatusChange with null when "Todos" is selected', () => {
    render(
      <StatusFilterSection
        status="pendente"
        onStatusChange={mockOnStatusChange}
      />,
    );

    fireEvent.press(screen.getByTestId('filter-status-all'));
    expect(mockOnStatusChange).toHaveBeenCalledWith(null);
  });

  it('renderiza chips acessiveis, com o ativo marcado como selecionado', () => {
    render(
      <StatusFilterSection
        status="concluida"
        onStatusChange={mockOnStatusChange}
      />,
    );

    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(5);

    const ativo = screen.getByTestId('filter-status-concluida');
    expect(ativo.props.accessibilityRole).toBe('button');
    expect(ativo.props.accessibilityState).toEqual({ selected: true });

    const inativo = screen.getByTestId('filter-status-pendente');
    expect(inativo.props.accessibilityState).toEqual({ selected: false });
  });

  it('renders with correct testIDs', () => {
    render(
      <StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />,
    );

    expect(screen.getByTestId('filter-status-all')).toBeTruthy();
    expect(screen.getByTestId('filter-status-pendente')).toBeTruthy();
    expect(screen.getByTestId('filter-status-em_andamento')).toBeTruthy();
    expect(screen.getByTestId('filter-status-concluida')).toBeTruthy();
    expect(screen.getByTestId('filter-status-cancelada')).toBeTruthy();
  });
});
