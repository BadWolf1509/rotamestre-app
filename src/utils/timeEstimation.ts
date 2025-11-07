/**
 * Utilitário para calcular tempo estimado de conclusão de rotas
 */

interface Parada {
  latitude: number;
  longitude: number;
  status: string;
  tipo: string;
}

const VELOCIDADE_MEDIA_KMH = 30; // Velocidade média em área urbana
const TEMPO_MEDIO_PARADA_MIN = 10; // Tempo médio para realizar uma parada (entrega/retirada)
const TEMPO_SETUP_MIN = 5; // Tempo de preparação/finalização por parada

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * @param lat1 Latitude do ponto 1
 * @param lon1 Longitude do ponto 1
 * @param lat2 Latitude do ponto 2
 * @param lon2 Longitude do ponto 2
 * @returns Distância em quilômetros
 */
export function calcularDistancia(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distancia = R * c;

  return distancia;
}

/**
 * Calcula a distância total da rota entre todas as paradas
 * @param paradas Array de paradas
 * @returns Distância total em quilômetros
 */
export function calcularDistanciaTotal(paradas: Parada[]): number {
  if (paradas.length < 2) return 0;

  let distanciaTotal = 0;

  for (let i = 0; i < paradas.length - 1; i++) {
    const paradaAtual = paradas[i];
    const proximaParada = paradas[i + 1];

    // Pula paradas que foram marcadas como "pulada"
    if (paradaAtual.status === 'pulada' || proximaParada.status === 'pulada') {
      continue;
    }

    const distancia = calcularDistancia(
      paradaAtual.latitude,
      paradaAtual.longitude,
      proximaParada.latitude,
      proximaParada.longitude
    );

    distanciaTotal += distancia;
  }

  return distanciaTotal;
}

/**
 * Calcula o tempo estimado de viagem baseado na distância
 * @param distanciaKm Distância em quilômetros
 * @param velocidadeMediaKmh Velocidade média (padrão: 30 km/h)
 * @returns Tempo em minutos
 */
export function calcularTempoViagem(
  distanciaKm: number,
  velocidadeMediaKmh: number = VELOCIDADE_MEDIA_KMH
): number {
  return (distanciaKm / velocidadeMediaKmh) * 60; // Converte horas para minutos
}

/**
 * Calcula o tempo estimado para realizar todas as paradas
 * @param numeroParadas Número de paradas pendentes
 * @param tempoMedioParadaMin Tempo médio por parada (padrão: 10 min)
 * @param tempoSetupMin Tempo de setup por parada (padrão: 5 min)
 * @returns Tempo total em minutos
 */
export function calcularTempoParadas(
  numeroParadas: number,
  tempoMedioParadaMin: number = TEMPO_MEDIO_PARADA_MIN,
  tempoSetupMin: number = TEMPO_SETUP_MIN
): number {
  return numeroParadas * (tempoMedioParadaMin + tempoSetupMin);
}

/**
 * Calcula o tempo total estimado para conclusão da rota
 * @param paradas Array de paradas
 * @param posicaoAtual Posição atual do motorista (opcional)
 * @returns Objeto com informações de tempo estimado
 */
export function calcularTempoEstimado(
  paradas: Parada[],
  posicaoAtual?: { latitude: number; longitude: number }
): {
  tempoTotalMinutos: number;
  tempoViagemMinutos: number;
  tempoParadasMinutos: number;
  distanciaTotalKm: number;
  horarioEstimadoConclusao: Date;
} {
  // Filtra apenas paradas pendentes
  const paradasPendentes = paradas.filter((p) => p.status === 'pendente');

  if (paradasPendentes.length === 0) {
    return {
      tempoTotalMinutos: 0,
      tempoViagemMinutos: 0,
      tempoParadasMinutos: 0,
      distanciaTotalKm: 0,
      horarioEstimadoConclusao: new Date(),
    };
  }

  // Calcula distância total
  let distanciaTotal = 0;

  // Se tiver posição atual, calcula distância até a primeira parada pendente
  if (posicaoAtual) {
    const primeiraParada = paradasPendentes[0];
    distanciaTotal += calcularDistancia(
      posicaoAtual.latitude,
      posicaoAtual.longitude,
      primeiraParada.latitude,
      primeiraParada.longitude
    );
  }

  // Calcula distância entre todas as paradas pendentes
  distanciaTotal += calcularDistanciaTotal(paradasPendentes);

  // Calcula tempo de viagem
  const tempoViagem = calcularTempoViagem(distanciaTotal);

  // Calcula tempo das paradas
  const tempoParadas = calcularTempoParadas(paradasPendentes.length);

  // Tempo total
  const tempoTotal = tempoViagem + tempoParadas;

  // Horário estimado de conclusão
  const horarioEstimado = new Date();
  horarioEstimado.setMinutes(horarioEstimado.getMinutes() + tempoTotal);

  return {
    tempoTotalMinutos: Math.round(tempoTotal),
    tempoViagemMinutos: Math.round(tempoViagem),
    tempoParadasMinutos: Math.round(tempoParadas),
    distanciaTotalKm: Math.round(distanciaTotal * 10) / 10, // Arredonda para 1 casa decimal
    horarioEstimadoConclusao: horarioEstimado,
  };
}

/**
 * Formata tempo em minutos para string legível
 * @param minutos Tempo em minutos
 * @returns String formatada (ex: "2h 30min")
 */
export function formatarTempo(minutos: number): string {
  if (minutos < 60) {
    return `${minutos}min`;
  }

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;

  if (minutosRestantes === 0) {
    return `${horas}h`;
  }

  return `${horas}h ${minutosRestantes}min`;
}

/**
 * Formata horário para string legível
 * @param data Data/hora
 * @returns String formatada (ex: "14:30")
 */
export function formatarHorario(data: Date): string {
  const horas = data.getHours().toString().padStart(2, '0');
  const minutos = data.getMinutes().toString().padStart(2, '0');
  return `${horas}:${minutos}`;
}

/**
 * Calcula distância e tempo até a próxima parada pendente
 * @param paradas Array de paradas
 * @param posicaoAtual Posição atual do motorista
 * @returns Informações sobre a próxima parada
 */
export function calcularProximaParada(
  paradas: Parada[],
  posicaoAtual: { latitude: number; longitude: number }
): {
  distanciaKm: number;
  tempoEstimadoMinutos: number;
  paradaIndex: number;
} | null {
  // Encontra primeira parada pendente
  const proximaParadaIndex = paradas.findIndex((p) => p.status === 'pendente');

  if (proximaParadaIndex === -1) {
    return null;
  }

  const proximaParada = paradas[proximaParadaIndex];

  const distancia = calcularDistancia(
    posicaoAtual.latitude,
    posicaoAtual.longitude,
    proximaParada.latitude,
    proximaParada.longitude
  );

  const tempoEstimado = calcularTempoViagem(distancia);

  return {
    distanciaKm: Math.round(distancia * 10) / 10,
    tempoEstimadoMinutos: Math.round(tempoEstimado),
    paradaIndex: proximaParadaIndex,
  };
}

/**
 * Avalia se o motorista está atrasado baseado no tempo decorrido
 * @param iniciadaEm Horário de início da rota
 * @param tempoEstimadoMinutos Tempo estimado total
 * @param progresso Percentual de conclusão (0-100)
 * @returns Status: "no_prazo", "atencao", "atrasado"
 */
export function avaliarProgresso(
  iniciadaEm: Date,
  tempoEstimadoMinutos: number,
  progresso: number
): 'no_prazo' | 'atencao' | 'atrasado' {
  const agora = new Date();
  const tempoDecorridoMs = agora.getTime() - iniciadaEm.getTime();
  const tempoDecorridoMinutos = tempoDecorridoMs / (1000 * 60);

  const progressoEsperado = (tempoDecorridoMinutos / tempoEstimadoMinutos) * 100;

  const diferenca = progressoEsperado - progresso;

  if (diferenca <= 10) {
    return 'no_prazo';
  } else if (diferenca <= 25) {
    return 'atencao';
  } else {
    return 'atrasado';
  }
}
