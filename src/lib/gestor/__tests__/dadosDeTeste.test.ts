import { dadosDeTesteDoInicio, rotasDeTesteDaGestao } from '../dadosDeTeste';

describe('dadosDeTeste (R-GES-4)', () => {
  const diaCivil = /^\d{4}-\d{2}-\d{2}$/;

  it('a coluna date dos dados falsos é YYYY-MM-DD, nunca ISO com hora (fuso)', () => {
    for (const rota of dadosDeTesteDoInicio().rotas) {
      expect(rota.data).toMatch(diaCivil);
    }
    for (const rota of rotasDeTesteDaGestao()) {
      expect(rota.data).toMatch(diaCivil);
    }
  });

  it('o painel falso é coerente com as rotas', () => {
    const { rotas, stats, todayStats } = dadosDeTesteDoInicio();
    expect(stats.total).toBe(rotas.length);
    expect(todayStats.totalHoje).toBe(rotas.length);
  });
});
