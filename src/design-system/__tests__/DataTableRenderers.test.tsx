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

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock Avatar
jest.mock('@/components/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID="avatar">{name}</Text>;
  },
}));

// Mock StatusBadge
jest.mock('@/components/StatusBadge', () => ({
  StatusBadge: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text testID="status-badge">{label}</Text>;
  },
}));

// Mock Text component
jest.mock('@/components/Text', () => ({
  Text: ({
    children,
    style,
    testID,
  }: {
    children: React.ReactNode;
    style?: object;
    testID?: string;
  }) => {
    const { Text: RNText } = require('react-native');
    return (
      <RNText style={style} testID={testID}>
        {children}
      </RNText>
    );
  },
}));

import { render } from '@testing-library/react-native';
import React from 'react';

import {
  ProgressCell,
  StatusCell,
  UserCell,
  DateCell,
  CurrencyCell,
  DistanceCell,
  DurationCell,
  IconCell,
} from '../renderers/DataTableRenderers';

describe('ProgressCell', () => {
  it('deve renderizar barra de progresso com valores corretos', () => {
    const { getByText } = render(<ProgressCell value={5} total={10} />);

    expect(getByText('5/10')).toBeTruthy();
  });

  it('deve exibir porcentagem quando showPercentage é true', () => {
    const { getByText } = render(
      <ProgressCell value={5} total={10} showPercentage={true} />,
    );

    expect(getByText('5/10 (50%)')).toBeTruthy();
  });

  it('deve ocultar fração quando showFraction é false', () => {
    const { queryByText } = render(
      <ProgressCell
        value={5}
        total={10}
        showFraction={false}
        showPercentage={true}
      />,
    );

    expect(queryByText('5/10')).toBeNull();
    expect(queryByText(' (50%)')).toBeTruthy();
  });

  it('deve calcular 0% quando total é 0', () => {
    const { getByText } = render(
      <ProgressCell value={0} total={0} showPercentage={true} />,
    );

    expect(getByText('0/0 (0%)')).toBeTruthy();
  });

  it('deve arredondar porcentagem', () => {
    const { getByText } = render(
      <ProgressCell value={1} total={3} showPercentage={true} />,
    );

    expect(getByText('1/3 (33%)')).toBeTruthy();
  });
});

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

describe('UserCell', () => {
  it('deve renderizar nome do usuário', () => {
    const { getAllByText } = render(<UserCell name="João Silva" />);

    // Nome aparece no Avatar mock e no componente
    expect(getAllByText('João Silva').length).toBeGreaterThan(0);
  });

  it('deve renderizar avatar', () => {
    const { getByTestId } = render(<UserCell name="João Silva" />);

    expect(getByTestId('avatar')).toBeTruthy();
  });

  it('deve renderizar subtítulo quando fornecido', () => {
    const { getAllByText, getByText } = render(
      <UserCell name="João Silva" subtitle="Motorista" />,
    );

    expect(getAllByText('João Silva').length).toBeGreaterThan(0);
    expect(getByText('Motorista')).toBeTruthy();
  });

  it('deve aceitar prop de avatar URL', () => {
    const { getByTestId } = render(
      <UserCell name="João" avatarUrl="https://example.com/avatar.jpg" />,
    );

    expect(getByTestId('avatar')).toBeTruthy();
  });
});

describe('DateCell', () => {
  it('deve renderizar fallback quando data é null', () => {
    const { getByText } = render(<DateCell date={null} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve renderizar fallback quando data é undefined', () => {
    const { getByText } = render(<DateCell date={undefined} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve renderizar fallback customizado', () => {
    const { getByText } = render(<DateCell date={null} fallback="N/A" />);

    expect(getByText('N/A')).toBeTruthy();
  });

  it('deve renderizar data válida', () => {
    // Usar data com timezone para evitar problemas de fuso
    const { getByText } = render(
      <DateCell date="2024-01-15T12:00:00" format="date" />,
    );

    // Verifica se contém parte da data (formato pode variar por timezone)
    expect(getByText(/01\/2024/)).toBeTruthy();
  });

  it('deve renderizar data com formato datetime', () => {
    const { getByText } = render(
      <DateCell date="2024-01-15T14:30:00" format="datetime" />,
    );

    // Verifica se contém parte da data (formato pode variar por timezone)
    expect(getByText(/01\/2024/)).toBeTruthy();
  });

  it('deve renderizar fallback para data inválida', () => {
    const { getByText } = render(<DateCell date="invalid-date" />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve aceitar Date object', () => {
    // Criar data com horário para minimizar problemas de timezone
    const { getByText } = render(
      <DateCell date={new Date(2024, 0, 15, 12, 0, 0)} />,
    );

    expect(getByText(/15\/01\/2024/)).toBeTruthy();
  });

  it('deve aceitar timestamp', () => {
    // Timestamp para 2024-01-15 12:00:00 UTC
    const { getByText } = render(<DateCell date={1705320000000} />);

    // Verifica se contém parte da data
    expect(getByText(/01\/2024/)).toBeTruthy();
  });

  describe('Formato Relativo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve mostrar "Agora" para datas recentes', () => {
      const { getByText } = render(
        <DateCell date={new Date('2024-01-15T12:00:00')} format="relative" />,
      );

      expect(getByText('Agora')).toBeTruthy();
    });

    it('deve mostrar minutos atrás', () => {
      const { getByText } = render(
        <DateCell date={new Date('2024-01-15T11:30:00')} format="relative" />,
      );

      expect(getByText('30 min atrás')).toBeTruthy();
    });

    it('deve mostrar horas atrás', () => {
      const { getByText } = render(
        <DateCell date={new Date('2024-01-15T10:00:00')} format="relative" />,
      );

      expect(getByText('2h atrás')).toBeTruthy();
    });

    it('deve mostrar dias atrás', () => {
      const { getByText } = render(
        <DateCell date={new Date('2024-01-13T12:00:00')} format="relative" />,
      );

      expect(getByText('2d atrás')).toBeTruthy();
    });
  });
});

describe('CurrencyCell', () => {
  it('deve renderizar fallback quando valor é null', () => {
    const { getByText } = render(<CurrencyCell value={null} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve renderizar fallback quando valor é undefined', () => {
    const { getByText } = render(<CurrencyCell value={undefined} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve formatar valor em BRL', () => {
    const { getByText } = render(<CurrencyCell value={150.5} />);

    expect(getByText(/R\$\s*150,50/)).toBeTruthy();
  });

  it('deve converter centavos quando cents é true', () => {
    const { getByText } = render(<CurrencyCell value={15050} cents={true} />);

    expect(getByText(/R\$\s*150,50/)).toBeTruthy();
  });

  it('deve renderizar fallback customizado', () => {
    const { getByText } = render(<CurrencyCell value={null} fallback="N/A" />);

    expect(getByText('N/A')).toBeTruthy();
  });
});

describe('DistanceCell', () => {
  it('deve renderizar fallback quando km é null', () => {
    const { getByText } = render(<DistanceCell km={null} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve renderizar fallback quando km é undefined', () => {
    const { getByText } = render(<DistanceCell km={undefined} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve formatar distância com unidade', () => {
    const { getByText } = render(<DistanceCell km={25.5} />);

    expect(getByText('25,5 km')).toBeTruthy();
  });

  it('deve ocultar unidade quando showUnit é false', () => {
    const { getByText, queryByText } = render(
      <DistanceCell km={25.5} showUnit={false} />,
    );

    expect(getByText('25,5')).toBeTruthy();
    expect(queryByText('25,5 km')).toBeNull();
  });

  it('deve renderizar ícone de velocímetro', () => {
    const { getByTestId } = render(<DistanceCell km={25.5} />);

    expect(getByTestId('icon-speedometer-outline')).toBeTruthy();
  });
});

describe('DurationCell', () => {
  it('deve renderizar fallback quando minutes é null', () => {
    const { getByText } = render(<DurationCell minutes={null} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve renderizar fallback quando minutes é undefined', () => {
    const { getByText } = render(<DurationCell minutes={undefined} />);

    expect(getByText('--')).toBeTruthy();
  });

  it('deve formatar duração em minutos', () => {
    const { getByText } = render(<DurationCell minutes={45} />);

    expect(getByText('45 min')).toBeTruthy();
  });

  it('deve formatar duração em horas e minutos', () => {
    const { getByText } = render(<DurationCell minutes={90} />);

    expect(getByText('1h 30min')).toBeTruthy();
  });

  it('deve formatar duração apenas em horas quando minutos são zero', () => {
    const { getByText } = render(<DurationCell minutes={120} />);

    expect(getByText('2h')).toBeTruthy();
  });

  it('deve renderizar ícone de relógio', () => {
    const { getByTestId } = render(<DurationCell minutes={45} />);

    expect(getByTestId('icon-time-outline')).toBeTruthy();
  });
});

describe('IconCell', () => {
  it('deve renderizar ícone', () => {
    const { getByTestId } = render(<IconCell icon="location" />);

    expect(getByTestId('icon-location')).toBeTruthy();
  });

  it('deve renderizar texto quando fornecido', () => {
    const { getByText, getByTestId } = render(
      <IconCell icon="car" text="Em trânsito" />,
    );

    expect(getByTestId('icon-car')).toBeTruthy();
    expect(getByText('Em trânsito')).toBeTruthy();
  });

  it('não deve renderizar texto adicional quando não fornecido', () => {
    const { getByTestId, queryByText } = render(<IconCell icon="car" />);

    expect(getByTestId('icon-car')).toBeTruthy();
    // Não deve ter texto "Em trânsito" ou similar - apenas o ícone
    expect(queryByText('Em trânsito')).toBeNull();
  });
});
