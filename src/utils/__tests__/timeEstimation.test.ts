import {
  calcularDistancia,
  calcularDistanciaTotal,
  calcularTempoViagem,
  calcularTempoParadas,
  calcularTempoEstimado,
  formatarTempo,
  formatarHorario,
  calcularProximaParada,
  avaliarProgresso,
} from '../timeEstimation';

// Mock data para testes
const paradaSaoPaulo = {
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'pendente',
  tipo: 'entrega',
};

const paradaCampinas = {
  latitude: -22.9099,
  longitude: -47.0626,
  status: 'pendente',
  tipo: 'entrega',
};

const paradaSantos = {
  latitude: -23.9618,
  longitude: -46.3322,
  status: 'pendente',
  tipo: 'retirada',
};

const paradaPulada = {
  latitude: -23.5,
  longitude: -46.5,
  status: 'pulada',
  tipo: 'entrega',
};

const paradaConcluida = {
  latitude: -23.6,
  longitude: -46.7,
  status: 'concluida',
  tipo: 'entrega',
};

describe('timeEstimation', () => {
  describe('calcularDistancia', () => {
    it('deve calcular distância entre São Paulo e Campinas (~90km)', () => {
      const distancia = calcularDistancia(
        paradaSaoPaulo.latitude,
        paradaSaoPaulo.longitude,
        paradaCampinas.latitude,
        paradaCampinas.longitude
      );

      // Distância real é cerca de 90-100 km
      expect(distancia).toBeGreaterThan(80);
      expect(distancia).toBeLessThan(110);
    });

    it('deve calcular distância entre São Paulo e Santos (~55km)', () => {
      const distancia = calcularDistancia(
        paradaSaoPaulo.latitude,
        paradaSaoPaulo.longitude,
        paradaSantos.latitude,
        paradaSantos.longitude
      );

      // Distância em linha reta é cerca de 55 km
      expect(distancia).toBeGreaterThan(50);
      expect(distancia).toBeLessThan(65);
    });

    it('deve retornar 0 para o mesmo ponto', () => {
      const distancia = calcularDistancia(
        paradaSaoPaulo.latitude,
        paradaSaoPaulo.longitude,
        paradaSaoPaulo.latitude,
        paradaSaoPaulo.longitude
      );

      expect(distancia).toBe(0);
    });

    it('deve calcular distâncias pequenas corretamente', () => {
      // Duas coordenadas próximas (cerca de 1 km)
      const distancia = calcularDistancia(-23.5505, -46.6333, -23.5595, -46.6333);

      expect(distancia).toBeGreaterThan(0.5);
      expect(distancia).toBeLessThan(2);
    });
  });

  describe('calcularDistanciaTotal', () => {
    it('deve retornar 0 para array vazio', () => {
      expect(calcularDistanciaTotal([])).toBe(0);
    });

    it('deve retornar 0 para apenas uma parada', () => {
      expect(calcularDistanciaTotal([paradaSaoPaulo])).toBe(0);
    });

    it('deve calcular distância total entre múltiplas paradas', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas, paradaSantos];
      const distanciaTotal = calcularDistanciaTotal(paradas);

      // SP -> Campinas (~90km) + Campinas -> Santos (~140km) = ~230km
      expect(distanciaTotal).toBeGreaterThan(200);
      expect(distanciaTotal).toBeLessThan(280);
    });

    it('deve pular paradas com status "pulada"', () => {
      const paradas = [paradaSaoPaulo, paradaPulada, paradaCampinas];
      const distanciaTotal = calcularDistanciaTotal(paradas);

      // Se paradaAtual ou proximaParada está "pulada", pula o segmento inteiro
      // [SP, pulada, Campinas] resulta em 0 porque ambos segmentos têm parada pulada
      expect(distanciaTotal).toBe(0);
    });

    it('deve pular quando próxima parada está pulada', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas, paradaPulada];
      const distanciaTotal = calcularDistanciaTotal(paradas);

      // Deve calcular apenas SP -> Campinas
      expect(distanciaTotal).toBeGreaterThan(80);
      expect(distanciaTotal).toBeLessThan(110);
    });
  });

  describe('calcularTempoViagem', () => {
    it('deve calcular tempo de viagem com velocidade padrão (30 km/h)', () => {
      const tempo = calcularTempoViagem(30);
      expect(tempo).toBe(60); // 30 km a 30 km/h = 1 hora = 60 min
    });

    it('deve calcular tempo de viagem com velocidade customizada', () => {
      const tempo = calcularTempoViagem(60, 60);
      expect(tempo).toBe(60); // 60 km a 60 km/h = 1 hora = 60 min
    });

    it('deve retornar 0 para distância 0', () => {
      expect(calcularTempoViagem(0)).toBe(0);
    });

    it('deve calcular tempo para distâncias pequenas', () => {
      const tempo = calcularTempoViagem(5, 30);
      expect(tempo).toBe(10); // 5 km a 30 km/h = 10 min
    });
  });

  describe('calcularTempoParadas', () => {
    it('deve calcular tempo para paradas com valores padrão', () => {
      const tempo = calcularTempoParadas(3);
      expect(tempo).toBe(45); // 3 paradas * (10 min + 5 min) = 45 min
    });

    it('deve calcular tempo com valores customizados', () => {
      const tempo = calcularTempoParadas(2, 15, 10);
      expect(tempo).toBe(50); // 2 paradas * (15 min + 10 min) = 50 min
    });

    it('deve retornar 0 para 0 paradas', () => {
      expect(calcularTempoParadas(0)).toBe(0);
    });

    it('deve calcular tempo para 1 parada', () => {
      const tempo = calcularTempoParadas(1);
      expect(tempo).toBe(15); // 1 parada * 15 min = 15 min
    });
  });

  describe('calcularTempoEstimado', () => {
    it('deve retornar zeros para array vazio', () => {
      const resultado = calcularTempoEstimado([]);

      expect(resultado.tempoTotalMinutos).toBe(0);
      expect(resultado.tempoViagemMinutos).toBe(0);
      expect(resultado.tempoParadasMinutos).toBe(0);
      expect(resultado.distanciaTotalKm).toBe(0);
    });

    it('deve retornar zeros quando não há paradas pendentes', () => {
      const resultado = calcularTempoEstimado([paradaConcluida]);

      expect(resultado.tempoTotalMinutos).toBe(0);
      expect(resultado.tempoViagemMinutos).toBe(0);
      expect(resultado.tempoParadasMinutos).toBe(0);
      expect(resultado.distanciaTotalKm).toBe(0);
    });

    it('deve calcular tempo estimado para múltiplas paradas', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas];
      const resultado = calcularTempoEstimado(paradas);

      expect(resultado.distanciaTotalKm).toBeGreaterThan(80);
      expect(resultado.tempoParadasMinutos).toBe(30); // 2 paradas * 15 min
      expect(resultado.tempoViagemMinutos).toBeGreaterThan(0);
      expect(resultado.tempoTotalMinutos).toBeGreaterThan(30);
    });

    it('deve incluir distância da posição atual até primeira parada', () => {
      const paradas = [paradaCampinas];
      const posicaoAtual = {
        latitude: paradaSaoPaulo.latitude,
        longitude: paradaSaoPaulo.longitude,
      };

      const resultado = calcularTempoEstimado(paradas, posicaoAtual);

      // Deve incluir distância SP -> Campinas
      expect(resultado.distanciaTotalKm).toBeGreaterThan(80);
    });

    it('deve calcular horário estimado de conclusão', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas];
      const antes = new Date();

      const resultado = calcularTempoEstimado(paradas);

      const depois = new Date();
      depois.setMinutes(depois.getMinutes() + resultado.tempoTotalMinutos);

      // Horário estimado deve estar no futuro
      expect(resultado.horarioEstimadoConclusao.getTime()).toBeGreaterThan(antes.getTime());
    });

    it('deve arredondar valores corretamente', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas];
      const resultado = calcularTempoEstimado(paradas);

      // Distância com 1 casa decimal
      expect(resultado.distanciaTotalKm.toString()).toMatch(/^\d+\.\d$/);

      // Tempos inteiros
      expect(Number.isInteger(resultado.tempoTotalMinutos)).toBe(true);
      expect(Number.isInteger(resultado.tempoViagemMinutos)).toBe(true);
      expect(Number.isInteger(resultado.tempoParadasMinutos)).toBe(true);
    });
  });

  describe('formatarTempo', () => {
    it('deve formatar tempo menor que 60 minutos', () => {
      expect(formatarTempo(30)).toBe('30min');
      expect(formatarTempo(45)).toBe('45min');
      expect(formatarTempo(1)).toBe('1min');
    });

    it('deve formatar horas exatas', () => {
      expect(formatarTempo(60)).toBe('1h');
      expect(formatarTempo(120)).toBe('2h');
      expect(formatarTempo(180)).toBe('3h');
    });

    it('deve formatar horas com minutos', () => {
      expect(formatarTempo(90)).toBe('1h 30min');
      expect(formatarTempo(135)).toBe('2h 15min');
      expect(formatarTempo(195)).toBe('3h 15min');
    });

    it('deve formatar 0 minutos', () => {
      expect(formatarTempo(0)).toBe('0min');
    });
  });

  describe('formatarHorario', () => {
    it('deve formatar horário com padding de zeros', () => {
      const data = new Date(2024, 0, 1, 9, 5);
      expect(formatarHorario(data)).toBe('09:05');
    });

    it('deve formatar horário sem padding quando >= 10', () => {
      const data = new Date(2024, 0, 1, 14, 30);
      expect(formatarHorario(data)).toBe('14:30');
    });

    it('deve formatar meia-noite corretamente', () => {
      const data = new Date(2024, 0, 1, 0, 0);
      expect(formatarHorario(data)).toBe('00:00');
    });

    it('deve formatar meio-dia corretamente', () => {
      const data = new Date(2024, 0, 1, 12, 0);
      expect(formatarHorario(data)).toBe('12:00');
    });
  });

  describe('calcularProximaParada', () => {
    it('deve retornar null quando não há paradas pendentes', () => {
      const resultado = calcularProximaParada([paradaConcluida], {
        latitude: paradaSaoPaulo.latitude,
        longitude: paradaSaoPaulo.longitude,
      });

      expect(resultado).toBeNull();
    });

    it('deve calcular distância e tempo até próxima parada', () => {
      const paradas = [paradaSaoPaulo, paradaCampinas];
      const posicaoAtual = {
        latitude: -23.6,
        longitude: -46.7,
      };

      const resultado = calcularProximaParada(paradas, posicaoAtual);

      expect(resultado).not.toBeNull();
      expect(resultado?.distanciaKm).toBeGreaterThan(0);
      expect(resultado?.tempoEstimadoMinutos).toBeGreaterThan(0);
      expect(resultado?.paradaIndex).toBe(0);
    });

    it('deve encontrar primeira parada pendente ignorando concluídas', () => {
      const paradas = [paradaConcluida, paradaPulada, paradaSaoPaulo];
      const posicaoAtual = {
        latitude: -23.6,
        longitude: -46.7,
      };

      const resultado = calcularProximaParada(paradas, posicaoAtual);

      expect(resultado?.paradaIndex).toBe(2);
    });

    it('deve arredondar distância para 1 casa decimal', () => {
      const paradas = [paradaSaoPaulo];
      const posicaoAtual = {
        latitude: -23.6,
        longitude: -46.7,
      };

      const resultado = calcularProximaParada(paradas, posicaoAtual);

      expect(resultado?.distanciaKm.toString()).toMatch(/^\d+\.\d$/);
    });
  });

  describe('avaliarProgresso', () => {
    it('deve retornar "no_prazo" quando progresso está dentro do esperado', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 30); // Iniciada há 30 min

      const status = avaliarProgresso(iniciadaEm, 60, 50); // 50% de progresso em 30 min de 60 min total

      expect(status).toBe('no_prazo');
    });

    it('deve retornar "atencao" quando diferença está entre 10% e 25%', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 40); // Iniciada há 40 min

      const status = avaliarProgresso(iniciadaEm, 60, 50); // Esperado ~67%, real 50% = ~17% de diferença

      expect(status).toBe('atencao');
    });

    it('deve retornar "atrasado" quando diferença é maior que 25%', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 60); // Iniciada há 60 min

      const status = avaliarProgresso(iniciadaEm, 60, 30); // Esperado 100%, real 30% = 70% de diferença

      expect(status).toBe('atrasado');
    });

    it('deve retornar "no_prazo" quando progresso está adiantado', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 20); // Iniciada há 20 min

      const status = avaliarProgresso(iniciadaEm, 60, 50); // Esperado ~33%, real 50% = adiantado

      expect(status).toBe('no_prazo');
    });

    it('deve lidar com progresso 0', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 10);

      const status = avaliarProgresso(iniciadaEm, 60, 0);

      // Esperado ~17%, real 0% = ~17% de diferença
      expect(status).toBe('atencao');
    });

    it('deve lidar com progresso 100', () => {
      const iniciadaEm = new Date();
      iniciadaEm.setMinutes(iniciadaEm.getMinutes() - 30);

      const status = avaliarProgresso(iniciadaEm, 60, 100);

      // Esperado 50%, real 100% = adiantado
      expect(status).toBe('no_prazo');
    });
  });
});
