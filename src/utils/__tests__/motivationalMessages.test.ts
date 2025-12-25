/**
 * Tests for motivationalMessages.ts
 * Mensagens motivacionais para motoristas
 */

import {
  getWorkContext,
  getGreeting,
  getMotivationalMessage,
  getCompletedMessage,
  getMilestoneMessage,
  getStreakIncentive,
  getNoRouteMessage,
} from '../motivationalMessages';

describe('motivationalMessages', () => {
  describe('getWorkContext', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar weekend para domingo', () => {
      jest.setSystemTime(new Date('2025-12-21T10:00:00')); // Domingo

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(false);
      expect(context.period).toBe('weekend');
    });

    it('deve retornar weekend para sábado', () => {
      jest.setSystemTime(new Date('2025-12-20T10:00:00')); // Sábado

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(false);
      expect(context.period).toBe('weekend');
    });

    it('deve retornar before para antes das 7h em dia útil', () => {
      jest.setSystemTime(new Date('2025-12-22T06:00:00')); // Segunda 6h

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(true);
      expect(context.isWorkHours).toBe(false);
      expect(context.period).toBe('before');
    });

    it('deve retornar morning para 7h-12h em dia útil', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda 10h

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(true);
      expect(context.isWorkHours).toBe(true);
      expect(context.period).toBe('morning');
    });

    it('deve retornar afternoon para 12h-17h em dia útil', () => {
      jest.setSystemTime(new Date('2025-12-22T14:00:00')); // Segunda 14h

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(true);
      expect(context.isWorkHours).toBe(true);
      expect(context.period).toBe('afternoon');
    });

    it('deve retornar after para após 17h em dia útil', () => {
      jest.setSystemTime(new Date('2025-12-22T18:00:00')); // Segunda 18h

      const context = getWorkContext();

      expect(context.isWorkDay).toBe(true);
      expect(context.isWorkHours).toBe(false);
      expect(context.period).toBe('after');
    });
  });

  describe('getGreeting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar "Bom dia" de manhã', () => {
      jest.setSystemTime(new Date('2025-12-22T09:00:00'));
      expect(getGreeting()).toBe('Bom dia');
    });

    it('deve retornar "Boa tarde" à tarde', () => {
      jest.setSystemTime(new Date('2025-12-22T15:00:00'));
      expect(getGreeting()).toBe('Boa tarde');
    });

    it('deve retornar "Boa noite" à noite', () => {
      jest.setSystemTime(new Date('2025-12-22T20:00:00'));
      expect(getGreeting()).toBe('Boa noite');
    });
  });

  describe('getMotivationalMessage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Mock Math.random para testes determinísticos
      jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('deve retornar mensagem de streak de 7 dias', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ streak: 7 });

      expect(message.title).toBe('Uma semana perfeita!');
      expect(message.emoji).toBe('🏆');
    });

    it('deve retornar mensagem de streak de 30 dias', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ streak: 30 });

      expect(message.title).toBe('Mês completo!');
      expect(message.emoji).toBe('👑');
    });

    it('deve retornar mensagem de performance excepcional', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ rotasHoje: 5 });

      expect(message.title).toBe('Dia excepcional!');
      expect(message.emoji).toBe('🏆');
    });

    it('deve retornar mensagem de 3 rotas', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ rotasHoje: 3 });

      expect(message.title).toBe('Excelente progresso!');
      expect(message.emoji).toBe('⭐');
    });

    it('deve retornar mensagem de muitas paradas', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ paradasHoje: 25 });

      expect(message.title).toBe('Muitas entregas!');
      expect(message.emoji).toBe('📦');
    });

    it('deve retornar mensagem de acima da média', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça

      const message = getMotivationalMessage({ isAboveAverage: true });

      expect(message.title).toBe('Acima da média!');
      expect(message.emoji).toBe('📈');
    });

    it('deve retornar mensagem de segunda-feira', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda

      const message = getMotivationalMessage({});

      expect(message.title).toBe('Segunda cheia de energia!');
      expect(message.emoji).toBe('🚀');
    });

    it('deve retornar mensagem de sexta-feira', () => {
      jest.setSystemTime(new Date('2025-12-26T10:00:00')); // Sexta

      const message = getMotivationalMessage({});

      expect(message.title).toBe('Sextou!');
      expect(message.emoji).toBe('🎉');
    });
  });

  describe('getCompletedMessage', () => {
    it('deve retornar mensagem de perfeição para 100%', () => {
      const message = getCompletedMessage(10, 100);

      expect(message.title).toBe('Perfeição!');
      expect(message.subtitle).toContain('10');
      expect(message.emoji).toBe('🏆');
    });

    it('deve retornar mensagem excelente para >= 90%', () => {
      const message = getCompletedMessage(10, 95);

      expect(message.title).toBe('Excelente trabalho!');
      expect(message.emoji).toBe('⭐');
    });

    it('deve retornar mensagem bom para >= 75%', () => {
      const message = getCompletedMessage(10, 80);

      expect(message.title).toBe('Bom resultado!');
      expect(message.emoji).toBe('👍');
    });

    it('deve retornar mensagem padrão para < 75%', () => {
      const message = getCompletedMessage(10, 60);

      expect(message.title).toBe('Rota finalizada');
      expect(message.emoji).toBe('✅');
    });
  });

  describe('getMilestoneMessage', () => {
    it('deve retornar mensagem para 10 entregas', () => {
      const message = getMilestoneMessage(10);

      expect(message.title).toBe('Primeira dezena!');
      expect(message.emoji).toBe('🎯');
    });

    it('deve retornar mensagem para 100 entregas', () => {
      const message = getMilestoneMessage(100);

      expect(message.title).toBe('Centenário!');
      expect(message.emoji).toBe('🏆');
    });

    it('deve retornar mensagem para 1000 entregas', () => {
      const message = getMilestoneMessage(1000);

      expect(message.title).toBe('Lenda!');
      expect(message.emoji).toBe('🎖️');
    });

    it('deve retornar mensagem genérica para milestone não definido', () => {
      const message = getMilestoneMessage(75);

      expect(message.title).toBe('75 entregas!');
      expect(message.emoji).toBe('🎉');
    });
  });

  describe('getStreakIncentive', () => {
    it('deve retornar incentivo para começar quando streak é 0', () => {
      expect(getStreakIncentive(0)).toBe('Comece sua sequência hoje!');
    });

    it('deve retornar incentivo para 6 dias (quase uma semana)', () => {
      expect(getStreakIncentive(6)).toBe('Amanhã completa 1 semana!');
    });

    it('deve retornar incentivo para 29 dias (quase um mês)', () => {
      expect(getStreakIncentive(29)).toBe('Amanhã completa 1 mês!');
    });

    it('deve retornar incentivo para manter streak >= 7', () => {
      expect(getStreakIncentive(10)).toBe('Mantenha a sequência de 10 dias!');
    });

    it('deve retornar incentivo padrão para streak baixo', () => {
      expect(getStreakIncentive(3)).toBe('3 dias seguidos - continue!');
    });
  });

  describe('getNoRouteMessage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar mensagem de antes do expediente', () => {
      jest.setSystemTime(new Date('2025-12-22T06:00:00')); // Segunda 6h

      const message = getNoRouteMessage({});

      expect(message.title).toBe('Bom dia!');
      expect(message.subtitle).toContain('7h');
    });

    it('deve retornar mensagem de após expediente', () => {
      jest.setSystemTime(new Date('2025-12-22T18:00:00')); // Segunda 18h

      const message = getNoRouteMessage({});

      expect(message.title).toBe('Expediente encerrado');
      expect(message.emoji).toBe('🌙');
    });

    it('deve retornar mensagem de fim de semana', () => {
      jest.setSystemTime(new Date('2025-12-21T12:00:00')); // Domingo 12h

      const message = getNoRouteMessage({});

      expect(message.title).toBe('Fim de semana');
      expect(message.emoji).toBe('🏖️');
    });

    it('deve retornar mensagem de performance quando >= 3 rotas', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda 10h

      const message = getNoRouteMessage({ rotasHoje: 3 });

      expect(message.title).toBe('Excelente dia!');
      expect(message.emoji).toBe('⭐');
    });

    it('deve retornar mensagem de muitas paradas quando >= 15', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda 10h

      const message = getNoRouteMessage({ paradasHoje: 15 });

      expect(message.title).toBe('Ótimo progresso!');
      expect(message.emoji).toBe('📦');
    });

    it('deve retornar mensagem de streak quando >= 5 dias', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda 10h

      const message = getNoRouteMessage({ streak: 5 });

      expect(message.title).toContain('5 dias');
      expect(message.emoji).toBe('🔥');
    });

    it('deve retornar mensagem de acima da média', () => {
      jest.setSystemTime(new Date('2025-12-23T10:00:00')); // Terça 10h

      const message = getNoRouteMessage({ isAboveAverage: true, paradasHoje: 5 });

      expect(message.title).toBe('Acima da média!');
      expect(message.emoji).toBe('📈');
    });

    it('deve retornar mensagem especial de segunda', () => {
      jest.setSystemTime(new Date('2025-12-22T10:00:00')); // Segunda 10h

      const message = getNoRouteMessage({});

      expect(message.title).toBe('Nova semana!');
      expect(message.emoji).toBe('🚀');
    });

    it('deve retornar mensagem especial de sexta', () => {
      jest.setSystemTime(new Date('2025-12-26T10:00:00')); // Sexta 10h

      const message = getNoRouteMessage({});

      expect(message.title).toBe('Último dia da semana');
      expect(message.emoji).toBe('🎉');
    });
  });
});
