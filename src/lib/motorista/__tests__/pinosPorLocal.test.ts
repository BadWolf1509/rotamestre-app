import { montarPinosPorLocal, rotuloDoPino } from '../pinosPorLocal';

const p = (
  id: string,
  ordem: number,
  status: string,
  latitude = -23.55,
  longitude = -46.63,
) => ({ id, ordem, status, latitude, longitude });

describe('montarPinosPorLocal', () => {
  it('um pino por parada quando os pontos são distintos', () => {
    const pinos = montarPinosPorLocal([
      p('a', 1, 'pendente', -23.55, -46.63),
      p('b', 2, 'pendente', -23.6, -46.7),
    ]);
    expect(pinos.map((x) => x.rotulo)).toEqual(['1', '2']);
    expect(pinos.every((x) => x.membros.length === 1)).toBe(true);
  });

  it('junta as paradas do mesmo ponto sob o rótulo das ordens', () => {
    const [pino] = montarPinosPorLocal([
      p('a', 3, 'pendente'),
      p('b', 4, 'pendente'),
    ]);
    expect(pino.rotulo).toBe('3+4');
    expect(pino.principal.id).toBe('a');
    expect(pino.membros.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('a principal é a primeira ainda a fazer, e dá a cor ao pino', () => {
    const [pino] = montarPinosPorLocal([
      p('a', 3, 'concluida'),
      p('b', 4, 'pendente'),
    ]);
    expect(pino.principal.id).toBe('b');
    expect(pino.principal.status).toBe('pendente');
  });

  it('sem nenhuma a fazer, a principal é a primeira do grupo', () => {
    const [pino] = montarPinosPorLocal([
      p('a', 3, 'concluida'),
      p('b', 4, 'pulada'),
    ]);
    expect(pino.principal.id).toBe('a');
  });
});

describe('rotuloDoPino', () => {
  it('um só: a própria ordem', () => {
    expect(rotuloDoPino([p('a', 7, 'pendente')])).toBe('7');
  });
});
