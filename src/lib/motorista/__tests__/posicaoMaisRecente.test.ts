/**
 * A task de navegação (locationTracking) usava `locations[0]`, a leitura mais
 * antiga do lote. As duas tasks escolhem agora pela mesma função.
 */
import fs from 'fs';
import path from 'path';

import { maisRecente } from '../posicaoMaisRecente';

const leitura = (timestamp: number) =>
  ({
    timestamp,
    coords: { latitude: 0, longitude: 0 },
  }) as Parameters<typeof maisRecente>[0] extends (infer T)[] | undefined
    ? T
    : never;

describe('maisRecente', () => {
  it('devolve a de maior horário, sem depender da ordem do lote', () => {
    const lote = [leitura(1), leitura(3), leitura(2)];
    expect(maisRecente(lote)?.timestamp).toBe(3);
  });

  it('lote vazio ou ausente devolve undefined', () => {
    expect(maisRecente([])).toBeUndefined();
    expect(maisRecente(undefined)).toBeUndefined();
  });
});

describe('tasks de rastreamento', () => {
  it.each(['locationTracking.ts', 'unifiedLocationTracking.ts'])(
    'src/services/%s não usa locations[0] e usa maisRecente',
    (arquivo) => {
      const texto = fs.readFileSync(
        path.resolve(__dirname, '..', '..', '..', 'services', arquivo),
        'utf8',
      );
      expect(texto).not.toContain('locations[0]');
      expect(texto).toContain('maisRecente(');
    },
  );
});
