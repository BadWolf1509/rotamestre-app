/**
 * StatusFilterSection - Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { StatusFilterSection } from '../StatusFilterSection';

describe('StatusFilterSection', () => {
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders section title', () => {
    render(<StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />);
    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('renders all status options', () => {
    render(<StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />);

    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getByText('Em Andamento')).toBeTruthy();
    expect(screen.getByText('Concluída')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
  });

  it('calls onStatusChange when status is selected', () => {
    render(<StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />);

    fireEvent.press(screen.getByTestId('filter-status-pendente'));
    expect(mockOnStatusChange).toHaveBeenCalledWith('pendente');
  });

  it('toggles status off when same status is selected', () => {
    render(<StatusFilterSection status="pendente" onStatusChange={mockOnStatusChange} />);

    fireEvent.press(screen.getByTestId('filter-status-pendente'));
    expect(mockOnStatusChange).toHaveBeenCalledWith(null);
  });

  it('calls onStatusChange with null when "Todos" is selected', () => {
    render(<StatusFilterSection status="pendente" onStatusChange={mockOnStatusChange} />);

    fireEvent.press(screen.getByTestId('filter-status-all'));
    expect(mockOnStatusChange).toHaveBeenCalledWith(null);
  });

  it('renders with correct testIDs', () => {
    render(<StatusFilterSection status={null} onStatusChange={mockOnStatusChange} />);

    expect(screen.getByTestId('filter-status-all')).toBeTruthy();
    expect(screen.getByTestId('filter-status-pendente')).toBeTruthy();
    expect(screen.getByTestId('filter-status-em_andamento')).toBeTruthy();
    expect(screen.getByTestId('filter-status-concluida')).toBeTruthy();
    expect(screen.getByTestId('filter-status-cancelada')).toBeTruthy();
  });
});
