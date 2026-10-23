import { montarUrlRotaGoogleMaps } from '../urlRotaGoogleMaps';

type P = {
  id: string;
  ordem: number;
  status: string;
  latitude: number;
  longitude: number;
  is_checkpoint?: boolean;
};

const parada = (ordem: number, extra: Partial<P> = {}): P => ({
  id: `p${ordem}`,
  ordem,
  status: 'pendente',
  latitude: -23 - ordem / 100,
  longitude: -46 - ordem / 100,
  ...extra,
});

const parametros = (url: string | null) => new URL(url as string).searchParams;

describe('montarUrlRotaGoogleMaps', () => {
  it('destino é a última pendente e as anteriores viram waypoints, sem origem', () => {
    const url = montarUrlRotaGoogleMaps([parada(1), parada(2), parada(3)]);
    const q = parametros(url);

    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    expect(q.get('origin')).toBeNull();
    expect(q.get('destination')).toBe('-23.03,-46.03');
    expect(q.get('waypoints')).toBe('-23.01,-46.01|-23.02,-46.02');
    expect(q.get('travelmode')).toBe('driving');
  });

  it('ignora concluídas, puladas e checkpoints de partida/chegada', () => {
    const url = montarUrlRotaGoogleMaps([
      parada(0, { is_checkpoint: false }),
      parada(1, { status: 'concluida' }),
      parada(2, { status: 'pulada' }),
      parada(3, { status: 'em_andamento' }),
      parada(4),
      parada(5, { is_checkpoint: false }),
    ]);
    const q = parametros(url);

    expect(q.get('destination')).toBe('-23.04,-46.04');
    expect(q.get('waypoints')).toBe('-23.03,-46.03');
  });

  it('ordena pela ordem, não pela posição no array', () => {
    const q = parametros(montarUrlRotaGoogleMaps([parada(2), parada(1)]));

    expect(q.get('destination')).toBe('-23.02,-46.02');
    expect(q.get('waypoints')).toBe('-23.01,-46.01');
  });

  it('ignora coordenada inválida e o par (0,0), mas aceita zero numa só', () => {
    const q = parametros(
      montarUrlRotaGoogleMaps([
        parada(1, { latitude: NaN }),
        parada(2, { latitude: 0, longitude: 0 }),
        parada(3, { latitude: -100 }),
        parada(4, { latitude: 0 }),
      ]),
    );

    expect(q.get('destination')).toBe('0,-46.04');
    expect(q.get('waypoints')).toBeNull();
  });

  it('com mais de 9 pendentes, abre uma janela contínua: 8 waypoints e o destino é a 9ª, sem pular nenhuma', () => {
    // Destino = última pendente com waypoints = 8 primeiras faria 1→…→8→12 e
    // sumiria com 9, 10 e 11. A janela leva às próximas 9 em sequência.
    const paradas = Array.from({ length: 12 }, (_, i) => parada(i + 1));
    const q = parametros(montarUrlRotaGoogleMaps(paradas));
    const waypoints = (q.get('waypoints') as string).split('|');

    expect(waypoints).toEqual(
      Array.from({ length: 8 }, (_, i) => `-23.0${i + 1},-46.0${i + 1}`),
    );
    expect(q.get('destination')).toBe('-23.09,-46.09');
  });

  it('codifica o separador dos waypoints como %7C', () => {
    const url = montarUrlRotaGoogleMaps([parada(1), parada(2), parada(3)]);

    expect(url).toContain('waypoints=-23.01,-46.01%7C-23.02,-46.02&');
    expect(url).not.toContain('|');
  });

  it('uma única pendente: só destino, sem waypoints', () => {
    const q = parametros(montarUrlRotaGoogleMaps([parada(1)]));

    expect(q.get('destination')).toBe('-23.01,-46.01');
    expect(q.get('waypoints')).toBeNull();
  });

  it('sem pendente válida devolve null', () => {
    expect(montarUrlRotaGoogleMaps([])).toBeNull();
    expect(
      montarUrlRotaGoogleMaps([
        parada(0, { is_checkpoint: false }),
        parada(1, { status: 'concluida' }),
        parada(2, { latitude: NaN }),
      ]),
    ).toBeNull();
  });
});
