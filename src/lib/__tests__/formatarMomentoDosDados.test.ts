/**
 * "Sem conexão — dados de …": a hora sozinha só serve se o retrato é de hoje.
 * O retrato guardado não expira, então a rota de ontem, aberta offline de
 * manhã, parecia ser de hoje (revisão final da 1.14.5, Minor 6).
 *
 * "Hoje" é o dia LOCAL. Os instantes aqui são montados com o construtor local
 * (`new Date(a, m, d, h, min)`), então as asserções valem em qualquer fuso. O
 * fuso de São Paulo é fixado para que o caso da virada (21:30 de ontem já é
 * "hoje" em UTC) discrimine `toISOString`; no Node 22 do CI o ICU pode ter
 * cacheado o fuso (ver `data-local-sem-utc.test.ts`) — aí o caso só não
 * discrimina, sem dar falso vermelho, e a guarda estática cobre a forma.
 */
import { formatarMomentoDosDados } from '../dateUtils';

const TZ_ORIGINAL = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Sao_Paulo';
});

afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

afterEach(() => {
  jest.useRealTimers();
});

function agoraE(data: Date) {
  jest.useFakeTimers({ now: data });
}

describe('formatarMomentoDosDados', () => {
  it('retrato de hoje: só a hora', () => {
    agoraE(new Date(2026, 9, 24, 9, 0));
    expect(formatarMomentoDosDados(new Date(2026, 9, 24, 7, 5).getTime())).toBe(
      '07:05',
    );
  });

  it('retrato de outro dia: dia/mês e hora', () => {
    agoraE(new Date(2026, 9, 24, 9, 0));
    expect(
      formatarMomentoDosDados(new Date(2026, 9, 23, 18, 40).getTime()),
    ).toBe('23/10 às 18:40');
  });

  it('virada do dia local: 21:30 de ontem continua sendo de ontem', () => {
    // Em UTC-3, 21:30 de 23/10 já é 24/10 em UTC — o mesmo dia de "agora".
    agoraE(new Date(2026, 9, 24, 8, 0));
    expect(
      formatarMomentoDosDados(new Date(2026, 9, 23, 21, 30).getTime()),
    ).toBe('23/10 às 21:30');
  });

  it('fim do dia local: 23:59 de hoje continua sendo de hoje', () => {
    agoraE(new Date(2026, 9, 24, 23, 59));
    expect(
      formatarMomentoDosDados(new Date(2026, 9, 24, 21, 15).getTime()),
    ).toBe('21:15');
  });
});
