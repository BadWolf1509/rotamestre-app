/**
 * Tests for DataTableRenderers.tsx
 * Reusable render functions for common DataTable column types
 */

// Mock dependencies BEFORE imports
const mockTheme = {
  colors: {
    primary: '#284093',
    success: '#10b981',
    warning: '#f7a02a',
    info: '#3b82f6',
    error: '#ef4444',
    warningText: '#b45309',
    infoText: '#1d4ed8',
    successDark: '#047857',
    errorText: '#b91c1c',
    white: '#ffffff',
    gray200: '#e5e7eb',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray900: '#111827',
  },
  spacing: { xs: 4, sm: 8, md: 12 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16 },
    fontSans: 'System',
    fontSansMedium: 'System-Medium',
    fontSansSemiBold: 'System-SemiBold',
  },
  borderRadius: { sm: 8, md: 10, full: 9999 },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  StyleSheet: {
    create: () => ({}),
  },
  type: { Theme: {} },
}));

// Mock StatusBadge
jest.mock('@/components/StatusBadge', () => ({
  StatusBadge: ({
    label,
    icon,
    variant,
    textColor,
  }: {
    label: string;
    icon?: string;
    variant?: string;
    textColor?: string;
  }) => {
    const { Text } = require('react-native');
    return (
      <Text
        testID="status-badge"
        accessibilityLabel={`${icon}|${variant}`}
        style={{ color: textColor }}
      >
        {label}
      </Text>
    );
  },
}));

import { render } from '@testing-library/react-native';
import React from 'react';

import {
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
} from '@/constants/statusConfig';

import { StatusCell } from '../renderers/DataTableRenderers';

describe('StatusCell', () => {
  it('deve renderizar status badge para pendente', () => {
    const { getByText } = render(<StatusCell status="pendente" />);

    expect(getByText('Pendente')).toBeTruthy();
  });

  it('deve renderizar status badge para em_andamento', () => {
    const { getByText } = render(<StatusCell status="em_andamento" />);

    expect(getByText('Em andamento')).toBeTruthy();
  });

  it('deve renderizar status badge para concluida', () => {
    const { getByText } = render(<StatusCell status="concluida" />);

    expect(getByText('Concluída')).toBeTruthy();
  });

  it('deve renderizar status badge para cancelada', () => {
    const { getByText } = render(<StatusCell status="cancelada" />);

    expect(getByText('Cancelada')).toBeTruthy();
  });

  it('deve renderizar status badge para nao_executada', () => {
    const { getByText } = render(<StatusCell status="nao_executada" />);

    expect(getByText('Não executada')).toBeTruthy();
  });

  it('deve resolver rotulo, icone e variante pela config central', () => {
    const { getByText, getByTestId } = render(
      <StatusCell status="nao_executada" />,
    );

    expect(getByText(ROUTE_STATUS_CONFIG.nao_executada.label)).toBeTruthy();
    expect(getByTestId('status-badge').props.accessibilityLabel).toBe(
      `${ROUTE_STATUS_CONFIG.nao_executada.icon}|soft`,
    );
  });

  it.each([
    ['pendente', mockTheme.colors.warningText],
    ['em_andamento', mockTheme.colors.infoText],
    ['concluida', mockTheme.colors.successDark],
    ['nao_executada', mockTheme.colors.errorText],
  ])('texto de %s no tom de texto do status', (status, cor) => {
    const { getByTestId } = render(<StatusCell status={status} />);

    expect(getByTestId('status-badge').props.style).toEqual({ color: cor });
  });

  it('deve usar a config de paradas para pulada', () => {
    const { getByTestId } = render(<StatusCell status="pulada" />);

    expect(getByTestId('status-badge').props.accessibilityLabel).toBe(
      `${STOP_STATUS_CONFIG.pulada.icon}|soft`,
    );
  });

  it('deve renderizar status badge para pulada', () => {
    const { getByText } = render(<StatusCell status="pulada" />);

    expect(getByText('Pulada')).toBeTruthy();
  });

  it('deve usar label customizado quando fornecido', () => {
    const { getByText } = render(
      <StatusCell status="pendente" label="Custom Label" />,
    );

    expect(getByText('Custom Label')).toBeTruthy();
  });

  it('deve usar status como fallback para status desconhecido', () => {
    const { getByText } = render(<StatusCell status="unknown_status" />);

    expect(getByText('unknown_status')).toBeTruthy();
  });
});
