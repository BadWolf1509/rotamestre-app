/**
 * Gerador de mensagens motivacionais dinâmicas para motoristas
 * Varia baseado em: hora do dia, dia da semana, performance recente, streak
 */

interface MotivationalContext {
  streak?: number;
  rotasHoje?: number;
  paradasHoje?: number;
  mediaRotasDia?: number;
  isAboveAverage?: boolean;
}

interface MotivationalMessage {
  title: string;
  subtitle: string;
  emoji?: string;
}

/**
 * Retorna saudação baseada na hora do dia
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Mensagens para quando não há rota atribuída
 */
const noRouteMessages: Record<string, MotivationalMessage[]> = {
  morning: [
    { title: 'Manhã de possibilidades!', subtitle: 'Novas rotas podem chegar a qualquer momento', emoji: '☀️' },
    { title: 'Pronto para começar?', subtitle: 'O dia está apenas começando', emoji: '🌅' },
    { title: 'Energia renovada!', subtitle: 'Aproveite para se preparar', emoji: '⚡' },
  ],
  afternoon: [
    { title: 'Tarde produtiva!', subtitle: 'Mantenha-se disponível para novas rotas', emoji: '🌤️' },
    { title: 'Meio do dia', subtitle: 'Momento ideal para entregas', emoji: '📦' },
    { title: 'Continue firme!', subtitle: 'Boas oportunidades estão por vir', emoji: '💪' },
  ],
  evening: [
    { title: 'Finalizando o dia', subtitle: 'Verifique se há rotas pendentes', emoji: '🌆' },
    { title: 'Reta final!', subtitle: 'Últimas oportunidades do dia', emoji: '🏁' },
    { title: 'Dia chegando ao fim', subtitle: 'Descanse bem para amanhã', emoji: '🌙' },
  ],
};

/**
 * Mensagens baseadas no dia da semana
 */
const weekdayMessages: Record<number, MotivationalMessage> = {
  0: { title: 'Domingo especial!', subtitle: 'Menos trânsito, mais agilidade', emoji: '🌟' },
  1: { title: 'Segunda cheia de energia!', subtitle: 'Nova semana, novas conquistas', emoji: '🚀' },
  2: { title: 'Terça de foco!', subtitle: 'Mantenha o ritmo', emoji: '🎯' },
  3: { title: 'Quarta no meio!', subtitle: 'Metade da semana conquistada', emoji: '⚡' },
  4: { title: 'Quinta produtiva!', subtitle: 'Quase lá, continue forte', emoji: '💪' },
  5: { title: 'Sextou!', subtitle: 'Último esforço da semana', emoji: '🎉' },
  6: { title: 'Sábado ativo!', subtitle: 'Fim de semana movimentado', emoji: '📦' },
};

/**
 * Mensagens baseadas em streak
 */
function getStreakMessage(streak: number): MotivationalMessage | null {
  if (streak <= 0) return null;

  if (streak === 1) {
    return { title: 'Primeira vitória!', subtitle: 'Continue amanhã para manter o ritmo', emoji: '🔥' };
  }
  if (streak === 7) {
    return { title: 'Uma semana perfeita!', subtitle: '7 dias seguidos, incrível!', emoji: '🏆' };
  }
  if (streak === 30) {
    return { title: 'Mês completo!', subtitle: '30 dias de dedicação total', emoji: '👑' };
  }
  if (streak >= 14) {
    return { title: `${streak} dias de dedicação!`, subtitle: 'Você é uma máquina!', emoji: '🔥' };
  }
  if (streak >= 5) {
    return { title: `${streak} dias seguidos!`, subtitle: 'Seu esforço é admirável', emoji: '⭐' };
  }
  if (streak >= 3) {
    return { title: `${streak} dias no ritmo!`, subtitle: 'Consistência é a chave', emoji: '💪' };
  }

  return { title: `${streak} dias ativos!`, subtitle: 'Continue assim!', emoji: '🔥' };
}

/**
 * Mensagens baseadas em performance
 */
function getPerformanceMessage(context: MotivationalContext): MotivationalMessage | null {
  const { rotasHoje = 0, paradasHoje = 0, isAboveAverage } = context;

  if (rotasHoje >= 5) {
    return { title: 'Dia excepcional!', subtitle: `${rotasHoje} rotas concluídas hoje`, emoji: '🏆' };
  }
  if (rotasHoje >= 3) {
    return { title: 'Excelente progresso!', subtitle: `${rotasHoje} rotas já finalizadas`, emoji: '⭐' };
  }
  if (paradasHoje >= 20) {
    return { title: 'Muitas entregas!', subtitle: `${paradasHoje} paradas concluídas hoje`, emoji: '📦' };
  }
  if (isAboveAverage) {
    return { title: 'Acima da média!', subtitle: 'Você está se superando', emoji: '📈' };
  }

  return null;
}

/**
 * Retorna período do dia
 */
function getTimePeriod(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Gera mensagem motivacional baseada no contexto completo
 */
export function getMotivationalMessage(context: MotivationalContext = {}): MotivationalMessage {
  const { streak = 0 } = context;

  // Prioridade 1: Mensagem de streak especial (7, 30 dias)
  if (streak === 7 || streak === 30) {
    const streakMsg = getStreakMessage(streak);
    if (streakMsg) return streakMsg;
  }

  // Prioridade 2: Performance excepcional
  const perfMsg = getPerformanceMessage(context);
  if (perfMsg) return perfMsg;

  // Prioridade 3: Streak ativo
  if (streak >= 3) {
    const streakMsg = getStreakMessage(streak);
    if (streakMsg) return streakMsg;
  }

  // Prioridade 4: Dia da semana (segunda ou sexta são especiais)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 1 || dayOfWeek === 5) {
    return weekdayMessages[dayOfWeek];
  }

  // Prioridade 5: Mensagem baseada no período do dia
  const period = getTimePeriod();
  const messages = noRouteMessages[period];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

/**
 * Mensagem para estado completed
 */
export function getCompletedMessage(paradasConcluidas: number, taxaSucesso: number): MotivationalMessage {
  if (taxaSucesso === 100) {
    return {
      title: 'Perfeição!',
      subtitle: `Todas as ${paradasConcluidas} entregas concluídas`,
      emoji: '🏆'
    };
  }
  if (taxaSucesso >= 90) {
    return {
      title: 'Excelente trabalho!',
      subtitle: `${paradasConcluidas} entregas finalizadas`,
      emoji: '⭐'
    };
  }
  if (taxaSucesso >= 75) {
    return {
      title: 'Bom resultado!',
      subtitle: `${paradasConcluidas} entregas concluídas`,
      emoji: '👍'
    };
  }
  return {
    title: 'Rota finalizada',
    subtitle: `${paradasConcluidas} entregas realizadas`,
    emoji: '✅'
  };
}

/**
 * Mensagem quando atinge um milestone
 */
export function getMilestoneMessage(milestone: number): MotivationalMessage {
  const messages: Record<number, MotivationalMessage> = {
    10: { title: 'Primeira dezena!', subtitle: '10 entregas concluídas', emoji: '🎯' },
    25: { title: 'Quarto de centena!', subtitle: '25 entregas no total', emoji: '🌟' },
    50: { title: 'Meio centena!', subtitle: '50 entregas alcançadas', emoji: '🔥' },
    100: { title: 'Centenário!', subtitle: '100 entregas é um marco', emoji: '🏆' },
    250: { title: 'Veterano!', subtitle: '250 entregas de experiência', emoji: '💎' },
    500: { title: 'Meio milhar!', subtitle: '500 entregas incríveis', emoji: '👑' },
    1000: { title: 'Lenda!', subtitle: '1000 entregas realizadas', emoji: '🎖️' },
  };

  return messages[milestone] || {
    title: `${milestone} entregas!`,
    subtitle: 'Mais um marco conquistado',
    emoji: '🎉'
  };
}

/**
 * Mensagem de incentivo para manter streak
 */
export function getStreakIncentive(streak: number): string {
  if (streak === 0) return 'Comece sua sequência hoje!';
  if (streak === 6) return 'Amanhã completa 1 semana!';
  if (streak === 29) return 'Amanhã completa 1 mês!';
  if (streak >= 7) return `Mantenha a sequência de ${streak} dias!`;
  return `${streak} dias seguidos - continue!`;
}
