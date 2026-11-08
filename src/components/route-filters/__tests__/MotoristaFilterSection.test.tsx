/**
 * MotoristaFilterSection - Tests
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MotoristaFilterSection } from '../MotoristaFilterSection';

import type { Motorista } from '../types';

describe('MotoristaFilterSection', () => {
  const mockOnMotoristaChange = jest.fn();
  const mockMotoristas: Motorista[] = [
    { id: 'driver-1', nome: 'João Silva' },
    { id: 'driver-2', nome: 'Maria Santos' },
    { id: 'driver-3', nome: 'Pedro Costa' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no motoristas provided', () => {
    const { toJSON } = render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={[]}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders section title', () => {
    render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );
    expect(screen.getByText('Motorista')).toBeTruthy();
  });

  it('renders "Todos" option', () => {
    render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );
    expect(screen.getByText('Todos')).toBeTruthy();
  });

  it('renders all motoristas', () => {
    render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText('Pedro Costa')).toBeTruthy();
  });

  it('calls onMotoristaChange when motorista is selected', () => {
    render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    fireEvent.press(screen.getByTestId('filter-motorista-driver-1'));
    expect(mockOnMotoristaChange).toHaveBeenCalledWith('driver-1');
  });

  it('toggles motorista off when same motorista is selected', () => {
    render(
      <MotoristaFilterSection
        motoristaId="driver-1"
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    fireEvent.press(screen.getByTestId('filter-motorista-driver-1'));
    expect(mockOnMotoristaChange).toHaveBeenCalledWith(null);
  });

  it('calls onMotoristaChange with null when "Todos" is selected', () => {
    render(
      <MotoristaFilterSection
        motoristaId="driver-1"
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    fireEvent.press(screen.getByText('Todos'));
    expect(mockOnMotoristaChange).toHaveBeenCalledWith(null);
  });
  it('motoristas são chips (FilterChip) que marcam o escolhido', () => {
    render(
      <MotoristaFilterSection
        motoristaId="driver-2"
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    const escolhido = screen.getByRole('button', { name: 'Maria Santos' });
    expect(escolhido.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(
      screen.getByRole('button', { name: 'João Silva' }).props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ selected: false }));
    expect(
      screen.getByRole('button', { name: 'Todos' }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: false }));
  });

  it('os chips ficam lado a lado e quebram linha', () => {
    render(
      <MotoristaFilterSection
        motoristaId={null}
        motoristas={mockMotoristas}
        onMotoristaChange={mockOnMotoristaChange}
      />,
    );

    expect(screen.getByTestId('filter-motorista-lista')).toHaveStyle({
      flexDirection: 'row',
      flexWrap: 'wrap',
    });
  });
});
