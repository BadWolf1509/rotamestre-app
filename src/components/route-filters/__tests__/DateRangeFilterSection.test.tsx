/**
 * DateRangeFilterSection - Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DateRangeFilterSection } from '../DateRangeFilterSection';

// Mock react-native-ui-datepicker
jest.mock('react-native-ui-datepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  useDefaultStyles: jest.fn(() => ({})),
}));

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return jest.fn(() => null);
});

describe('DateRangeFilterSection', () => {
  const mockOnDateRangeChange = jest.fn();
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
    });
  });

  it('renders section title', () => {
    render(
      <DateRangeFilterSection
        dataInicio={null}
        dataFim={null}
        onDateRangeChange={mockOnDateRangeChange}
      />
    );
    expect(screen.getByText('Período')).toBeTruthy();
  });

  describe('Web platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
      });
    });

    it('renders date range button on web', () => {
      render(
        <DateRangeFilterSection
          dataInicio={null}
          dataFim={null}
          onDateRangeChange={mockOnDateRangeChange}
        />
      );

      expect(screen.getByTestId('filter-date-range')).toBeTruthy();
      expect(screen.getByText('Selecionar Período')).toBeTruthy();
    });

    it('shows formatted date range when dates are provided', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-15');

      render(
        <DateRangeFilterSection
          dataInicio={startDate}
          dataFim={endDate}
          onDateRangeChange={mockOnDateRangeChange}
        />
      );

      // Should show the range label format
      const rangeText = screen.queryByTestId('filter-date-range');
      expect(rangeText).toBeTruthy();
    });

    it('opens modal when date range button is pressed', () => {
      render(
        <DateRangeFilterSection
          dataInicio={null}
          dataFim={null}
          onDateRangeChange={mockOnDateRangeChange}
        />
      );

      fireEvent.press(screen.getByTestId('filter-date-range'));

      // Modal should be visible - check for modal content
      expect(screen.getByText('Cancelar')).toBeTruthy();
      expect(screen.getByText('Aplicar')).toBeTruthy();
    });
  });

  describe('Mobile platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
      });
    });

    it('renders two separate date buttons on mobile', () => {
      render(
        <DateRangeFilterSection
          dataInicio={null}
          dataFim={null}
          onDateRangeChange={mockOnDateRangeChange}
        />
      );

      // Should have "até" separator on mobile
      expect(screen.getByText('até')).toBeTruthy();
      // Should show "Selecionar" for both buttons when no dates
      expect(screen.getAllByText('Selecionar').length).toBe(2);
    });

    it('shows formatted dates when provided', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-15');

      render(
        <DateRangeFilterSection
          dataInicio={startDate}
          dataFim={endDate}
          onDateRangeChange={mockOnDateRangeChange}
        />
      );

      // Should not have "Selecionar" text when dates are provided
      expect(screen.queryByText('Selecionar')).toBeNull();
    });
  });
});
