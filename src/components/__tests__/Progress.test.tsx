import React from 'react';
import { render } from '@testing-library/react-native';
import { Progress } from '../Progress';

describe('Progress Component', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar barra de progresso', () => {
      const { getByText } = render(<Progress progress={0.5} />);
      expect(getByText('50%')).toBeTruthy();
    });

    it('deve renderizar com porcentagem por padrão', () => {
      const { getByText } = render(<Progress progress={0.65} />);
      expect(getByText('65%')).toBeTruthy();
    });

    it('deve renderizar com label', () => {
      const { getByText } = render(
        <Progress progress={0.8} label="Concluído" />
      );
      expect(getByText('Concluído')).toBeTruthy();
      expect(getByText('80%')).toBeTruthy();
    });

    it('deve ocultar porcentagem quando showPercentage=false', () => {
      const { queryByText } = render(
        <Progress progress={0.5} showPercentage={false} />
      );
      expect(queryByText('50%')).toBeNull();
    });

    it('deve renderizar label sem porcentagem', () => {
      const { getByText, queryByText } = render(
        <Progress
          progress={0.3}
          label="Carregando..."
          showPercentage={false}
        />
      );
      expect(getByText('Carregando...')).toBeTruthy();
      expect(queryByText('30%')).toBeNull();
    });
  });

  describe('Valores de Progresso', () => {
    it('deve exibir 0% para progresso 0', () => {
      const { getByText } = render(<Progress progress={0} />);
      expect(getByText('0%')).toBeTruthy();
    });

    it('deve exibir 100% para progresso 1', () => {
      const { getByText } = render(<Progress progress={1} />);
      expect(getByText('100%')).toBeTruthy();
    });

    it('deve exibir 50% para progresso 0.5', () => {
      const { getByText } = render(<Progress progress={0.5} />);
      expect(getByText('50%')).toBeTruthy();
    });

    it('deve arredondar porcentagem corretamente', () => {
      const { getByText } = render(<Progress progress={0.666} />);
      expect(getByText('67%')).toBeTruthy();
    });

    it('deve limitar progresso máximo em 100%', () => {
      const { getByText } = render(<Progress progress={1.5} />);
      expect(getByText('100%')).toBeTruthy();
    });

    it('deve limitar progresso mínimo em 0%', () => {
      const { getByText } = render(<Progress progress={-0.5} />);
      expect(getByText('0%')).toBeTruthy();
    });
  });

  describe('Tamanhos', () => {
    it('deve renderizar com size small', () => {
      const { getByText } = render(
        <Progress progress={0.3} size="small" />
      );
      expect(getByText('30%')).toBeTruthy();
    });

    it('deve renderizar com size medium (padrão)', () => {
      const { getByText } = render(<Progress progress={0.5} />);
      expect(getByText('50%')).toBeTruthy();
    });

    it('deve renderizar com size large', () => {
      const { getByText } = render(
        <Progress progress={0.8} size="large" />
      );
      expect(getByText('80%')).toBeTruthy();
    });
  });

  describe('Cores', () => {
    it('deve renderizar com color primary (padrão)', () => {
      const { getByText } = render(<Progress progress={0.5} />);
      expect(getByText('50%')).toBeTruthy();
    });

    it('deve renderizar com color success', () => {
      const { getByText } = render(
        <Progress progress={1.0} color="success" label="Completo" />
      );
      expect(getByText('Completo')).toBeTruthy();
      expect(getByText('100%')).toBeTruthy();
    });

    it('deve renderizar com color warning', () => {
      const { getByText } = render(
        <Progress progress={0.4} color="warning" label="Atenção" />
      );
      expect(getByText('Atenção')).toBeTruthy();
      expect(getByText('40%')).toBeTruthy();
    });

    it('deve renderizar com color error', () => {
      const { getByText } = render(
        <Progress progress={0.9} color="error" label="Crítico" />
      );
      expect(getByText('Crítico')).toBeTruthy();
      expect(getByText('90%')).toBeTruthy();
    });
  });

  describe('Animação', () => {
    it('deve aceitar animated=true (padrão)', () => {
      const { getByText } = render(<Progress progress={0.7} />);
      expect(getByText('70%')).toBeTruthy();
    });

    it('deve aceitar animated=false', () => {
      const { getByText } = render(
        <Progress progress={0.6} animated={false} />
      );
      expect(getByText('60%')).toBeTruthy();
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar progresso de upload', () => {
      const { getByText } = render(
        <Progress
          progress={0.75}
          label="Upload em andamento"
          color="primary"
        />
      );
      expect(getByText('Upload em andamento')).toBeTruthy();
      expect(getByText('75%')).toBeTruthy();
    });

    it('deve renderizar progresso completo', () => {
      const { getByText } = render(
        <Progress
          progress={1.0}
          label="Upload completo"
          color="success"
        />
      );
      expect(getByText('Upload completo')).toBeTruthy();
      expect(getByText('100%')).toBeTruthy();
    });

    it('deve renderizar progresso de tarefas', () => {
      const completedTasks = 7;
      const totalTasks = 10;
      const { getByText } = render(
        <Progress
          progress={completedTasks / totalTasks}
          label={`${completedTasks} de ${totalTasks} tarefas`}
        />
      );
      expect(getByText('7 de 10 tarefas')).toBeTruthy();
      expect(getByText('70%')).toBeTruthy();
    });

    it('deve renderizar progresso de paradas de rota', () => {
      const completedStops = 8;
      const totalStops = 12;
      const { getByText } = render(
        <Progress
          progress={completedStops / totalStops}
          label="Paradas concluídas"
        />
      );
      expect(getByText('Paradas concluídas')).toBeTruthy();
      expect(getByText('67%')).toBeTruthy();
    });
  });

  describe('Estilos Customizados', () => {
    it('deve aceitar style customizado', () => {
      const customStyle = { marginTop: 20 };
      const { getByText } = render(
        <Progress progress={0.5} style={customStyle} />
      );
      expect(getByText('50%')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar todos os elementos juntos', () => {
      const { getByText } = render(
        <Progress
          progress={0.85}
          label="Processamento"
          showPercentage={true}
          size="large"
          color="success"
          animated={true}
        />
      );
      expect(getByText('Processamento')).toBeTruthy();
      expect(getByText('85%')).toBeTruthy();
    });

    it('deve renderizar barra simples sem label nem porcentagem', () => {
      const { queryByText, root } = render(
        <Progress progress={0.5} showPercentage={false} />
      );
      expect(root).toBeTruthy();
      expect(queryByText('50%')).toBeNull();
    });
  });
});
