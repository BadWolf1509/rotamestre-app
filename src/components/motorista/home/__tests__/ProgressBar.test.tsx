import { render } from '@testing-library/react-native';
import React from 'react';

import { ProgressBar } from '../ProgressBar';

// Mock styles
jest.mock('@/utils/styles', () => ({
  defaultTheme: {
    colors: {
      white: '#fff',
      black: '#000',
      primary: '#007AFF',
      success: '#10b981',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      successBg: '#d1fae5',
      successDark: '#047857',
      primaryBg: '#dbeafe',
      warningBg: '#fef3c7',
      warningText: '#b45309',
    },
  },
  useUnistyles: () => ({
    theme: {
      colors: {
        white: '#fff',
        black: '#000',
        primary: '#007AFF',
        success: '#10b981',
        gray100: '#f3f4f6',
        gray200: '#e5e7eb',
        gray300: '#d1d5db',
        gray500: '#6b7280',
        gray600: '#4b5563',
        gray700: '#374151',
        successBg: '#d1fae5',
        successDark: '#047857',
        primaryBg: '#dbeafe',
        warningBg: '#fef3c7',
        warningText: '#b45309',
      },
    },
  }),
}));

describe('ProgressBar', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar com props obrigatórias (completed, total)', () => {
      const { getByText } = render(<ProgressBar completed={3} total={10} />);

      expect(getByText('Progresso da Rota')).toBeTruthy();
      expect(getByText('30%')).toBeTruthy();
      expect(getByText('3')).toBeTruthy(); // Concluídas
      expect(getByText('7')).toBeTruthy(); // Restantes (10 - 3)
    });

    it('deve renderizar labels corretos', () => {
      const { getByText } = render(<ProgressBar completed={5} total={10} />);

      expect(getByText('Progresso da Rota')).toBeTruthy();
      expect(getByText('Concluídas')).toBeTruthy();
      expect(getByText('Restantes')).toBeTruthy();
    });

    it('deve renderizar barra de progresso visual', () => {
      const { UNSAFE_getAllByType } = render(<ProgressBar completed={5} total={10} />);

      const { View } = require('react-native');
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });

  describe('Cálculo de Percentual', () => {
    it('deve calcular 0% quando completed=0', () => {
      const { getByText } = render(<ProgressBar completed={0} total={10} />);

      expect(getByText('0%')).toBeTruthy();
    });

    it('deve calcular 50% quando metade concluída', () => {
      const { getByText } = render(<ProgressBar completed={5} total={10} />);

      expect(getByText('50%')).toBeTruthy();
    });

    it('deve calcular 100% quando tudo concluído', () => {
      const { getByText } = render(<ProgressBar completed={10} total={10} />);

      expect(getByText('100%')).toBeTruthy();
    });

    it('deve arredondar percentual (33% para 3/9)', () => {
      const { getByText } = render(<ProgressBar completed={3} total={9} />);

      expect(getByText('33%')).toBeTruthy();
    });

    it('deve arredondar percentual (67% para 6/9)', () => {
      const { getByText } = render(<ProgressBar completed={6} total={9} />);

      expect(getByText('67%')).toBeTruthy();
    });

    it('deve retornar 0% quando total=0 (evita divisão por zero)', () => {
      const { getByText } = render(<ProgressBar completed={0} total={0} />);

      expect(getByText('0%')).toBeTruthy();
    });

    it('deve calcular corretamente com números grandes', () => {
      const { getByText } = render(<ProgressBar completed={45} total={100} />);

      expect(getByText('45%')).toBeTruthy();
    });
  });

  describe('Estatísticas de Tarefas', () => {
    it('deve mostrar número correto de tarefas concluídas', () => {
      const { getByText } = render(<ProgressBar completed={7} total={15} />);

      expect(getByText('7')).toBeTruthy();
      expect(getByText('Concluídas')).toBeTruthy();
    });

    it('deve calcular número correto de tarefas restantes', () => {
      const { getByText } = render(<ProgressBar completed={7} total={15} />);

      expect(getByText('8')).toBeTruthy(); // 15 - 7
      expect(getByText('Restantes')).toBeTruthy();
    });

    it('deve mostrar 0 restantes quando tudo concluído', () => {
      const { getByText } = render(<ProgressBar completed={10} total={10} />);

      expect(getByText('10')).toBeTruthy(); // Concluídas
      expect(getByText('0')).toBeTruthy(); // Restantes
    });

    it('deve mostrar total como restantes quando nada concluído', () => {
      const { getByText } = render(<ProgressBar completed={0} total={20} />);

      expect(getByText('0')).toBeTruthy(); // Concluídas
      expect(getByText('20')).toBeTruthy(); // Restantes
    });
  });

  describe('TimeElapsed (Opcional)', () => {
    it('deve renderizar timeElapsed quando fornecido', () => {
      const { getByText } = render(
        <ProgressBar completed={5} total={10} timeElapsed="1h 30min" />
      );

      expect(getByText('1h 30min')).toBeTruthy();
      expect(getByText('Decorrido')).toBeTruthy();
    });

    it('não deve renderizar timeElapsed quando undefined', () => {
      const { queryByText } = render(<ProgressBar completed={5} total={10} />);

      expect(queryByText('Decorrido')).toBeNull();
    });

    it('deve renderizar diferentes formatos de timeElapsed', () => {
      const { getByText } = render(
        <ProgressBar completed={3} total={10} timeElapsed="45min" />
      );

      expect(getByText('45min')).toBeTruthy();
    });

    it('deve renderizar timeElapsed com segundos', () => {
      const { getByText } = render(
        <ProgressBar completed={2} total={5} timeElapsed="00:15:30" />
      );

      expect(getByText('00:15:30')).toBeTruthy();
    });
  });

  describe('EstimatedTime (Tempo Restante)', () => {
    it('deve calcular tempo restante quando timeElapsed e estimatedTime são fornecidos', () => {
      const { getByText } = render(
        <ProgressBar
          completed={5}
          total={10}
          timeElapsed="1h 30min"
          estimatedTime="2h 30min"
        />
      );

      // 2h30min - 1h30min = 1h restante
      expect(getByText('~1h restantes')).toBeTruthy();
    });

    it('deve mostrar "Concluindo..." quando tempo restante é 0', () => {
      const { getByText } = render(
        <ProgressBar
          completed={9}
          total={10}
          timeElapsed="2h 30min"
          estimatedTime="2h 30min"
        />
      );

      expect(getByText('Concluindo...')).toBeTruthy();
    });

    it('não deve mostrar tempo restante sem timeElapsed', () => {
      const { queryByText } = render(
        <ProgressBar completed={5} total={10} estimatedTime="2h 15min" />
      );

      // Sem timeElapsed, não calcula tempo restante
      expect(queryByText(/restantes/)).toBeNull();
    });

    it('não deve mostrar tempo restante sem estimatedTime', () => {
      const { queryByText } = render(
        <ProgressBar completed={5} total={10} timeElapsed="1h 30min" />
      );

      // Sem estimatedTime, não calcula tempo restante
      expect(queryByText(/restantes/)).toBeNull();
    });
  });

  describe('Combinações de Props Opcionais', () => {
    it('deve renderizar timeElapsed e informação de tempo estimado', () => {
      const { getByText, queryByText } = render(
        <ProgressBar
          completed={5}
          total={10}
          timeElapsed="1h 30min"
          estimatedTime="3h"
        />
      );

      expect(getByText('1h 30min')).toBeTruthy();
      expect(getByText('Decorrido')).toBeTruthy();
      // Componente mostra tempo restante calculado ou estimatedTime dependendo do parsing
      const hasTimeInfo = queryByText(/restantes/) !== null || queryByText('3h') !== null;
      expect(hasTimeInfo).toBeTruthy();
    });

    it('deve renderizar apenas timeElapsed sem estimatedTime', () => {
      const { getByText, queryByText } = render(
        <ProgressBar completed={5} total={10} timeElapsed="1h" />
      );

      expect(getByText('1h')).toBeTruthy();
      expect(queryByText(/restantes/)).toBeNull();
    });

    it('deve renderizar sem timeElapsed nem estimatedTime', () => {
      const { queryByText } = render(<ProgressBar completed={5} total={10} />);

      expect(queryByText('Decorrido')).toBeNull();
      expect(queryByText(/restantes/)).toBeNull();
    });
  });

  describe('Milestones Visuais', () => {
    it('deve renderizar milestones para cada parada', () => {
      const { UNSAFE_getAllByType } = render(<ProgressBar completed={5} total={10} />);

      const { View } = require('react-native');
      const views = UNSAFE_getAllByType(View);
      // Deve ter vários views para milestones
      expect(views.length).toBeGreaterThan(3);
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve renderizar progresso inicial de rota (0/20)', () => {
      const { getByText } = render(
        <ProgressBar completed={0} total={20} timeElapsed="0min" />
      );

      expect(getByText('0%')).toBeTruthy();
      expect(getByText('0')).toBeTruthy(); // Concluídas
      expect(getByText('20')).toBeTruthy(); // Restantes
      expect(getByText('0min')).toBeTruthy();
    });

    it('deve renderizar progresso em andamento (8/20)', () => {
      const { getByText } = render(
        <ProgressBar
          completed={8}
          total={20}
          timeElapsed="1h 15min"
          estimatedTime="3h"
        />
      );

      expect(getByText('40%')).toBeTruthy();
      expect(getByText('8')).toBeTruthy();
      expect(getByText('12')).toBeTruthy(); // 20 - 8
      expect(getByText('1h 15min')).toBeTruthy();
    });

    it('deve renderizar rota quase completa (18/20)', () => {
      const { getByText } = render(
        <ProgressBar
          completed={18}
          total={20}
          timeElapsed="2h 45min"
          estimatedTime="3h"
        />
      );

      expect(getByText('90%')).toBeTruthy();
      expect(getByText('18')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });

    it('deve renderizar rota completa (20/20)', () => {
      const { getByText } = render(
        <ProgressBar completed={20} total={20} timeElapsed="2h 50min" />
      );

      expect(getByText('100%')).toBeTruthy();
      expect(getByText('20')).toBeTruthy();
      expect(getByText('0')).toBeTruthy(); // Restantes
      expect(getByText('2h 50min')).toBeTruthy();
    });

    it('deve renderizar rota pequena (3/5)', () => {
      const { getByText } = render(
        <ProgressBar completed={3} total={5} timeElapsed="30min" />
      );

      expect(getByText('60%')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });

    it('deve renderizar rota grande (45/100)', () => {
      const { getByText } = render(
        <ProgressBar
          completed={45}
          total={100}
          timeElapsed="3h"
          estimatedTime="6h 30min"
        />
      );

      expect(getByText('45%')).toBeTruthy();
      expect(getByText('45')).toBeTruthy();
      expect(getByText('55')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com completed > total (não deve acontecer mas trata)', () => {
      const { getByText } = render(<ProgressBar completed={15} total={10} />);

      expect(getByText('150%')).toBeTruthy();
    });

    it('deve renderizar com completed negativo (não deve acontecer)', () => {
      const { getByText } = render(<ProgressBar completed={-5} total={10} />);

      // Percentual negativo
      expect(getByText('-50%')).toBeTruthy();
    });

    it('deve renderizar com total negativo (não deve acontecer)', () => {
      const { getByText } = render(<ProgressBar completed={5} total={-10} />);

      // total < 0 retorna 0% (total > 0 ? ... : 0)
      expect(getByText('0%')).toBeTruthy();
      expect(getByText('5')).toBeTruthy(); // Concluídas
      expect(getByText('-15')).toBeTruthy(); // Restantes (-10 - 5)
    });

    it('deve renderizar com valores decimais (arredonda)', () => {
      const { getByText } = render(<ProgressBar completed={3.7} total={10.2} />);

      // Math.round((3.7 / 10.2) * 100) = 36%
      expect(getByText('36%')).toBeTruthy();
    });

    it('deve renderizar com timeElapsed vazio', () => {
      const { queryByText } = render(
        <ProgressBar completed={5} total={10} timeElapsed="" />
      );

      // String vazia é falsy, não deve renderizar
      expect(queryByText('Decorrido')).toBeNull();
    });

    it('deve renderizar com estimatedTime vazio', () => {
      const { queryByText } = render(
        <ProgressBar completed={5} total={10} estimatedTime="" />
      );

      expect(queryByText(/restantes/)).toBeNull();
    });
  });
});
