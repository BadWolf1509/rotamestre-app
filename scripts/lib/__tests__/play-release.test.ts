/**
 * Testes de `montarRelease` — a única parte do `play:promote` com regra de
 * negócio.
 *
 * Por que existem: o script publica de verdade na Play e não havia nada em
 * `scripts/` coberto por teste. O `--dry-run` prova o corpo numa execução; isto
 * prova em toda execução do CI, inclusive contra quem mexer no script depois.
 *
 * As asserções abaixo codificam regras da PLAY API, não preferências nossas.
 * Se alguma falhar, confira a documentação da Play antes de ajustar o teste —
 * mudar a expectativa para o código passar reintroduz uma requisição recusada.
 */
import { montarRelease } from '../play-release.js';

describe('montarRelease', () => {
  const versionCode = '3030';

  describe('sem percentual (comportamento histórico)', () => {
    it('usa status completed', () => {
      expect(montarRelease({ versionCode })).toEqual({
        versionCodes: ['3030'],
        status: 'completed',
      });
    });

    it('NÃO inclui userFraction — a Play recusa completed com fração', () => {
      const release = montarRelease({ versionCode });
      expect(release).not.toHaveProperty('userFraction');
    });

    it('inclui o nome quando informado, e omite quando não', () => {
      expect(
        montarRelease({ versionCode, releaseName: '1.12.5' }),
      ).toHaveProperty('name', '1.12.5');
      expect(montarRelease({ versionCode })).not.toHaveProperty('name');
    });
  });

  describe('com percentual (rollout gradual)', () => {
    it('usa inProgress e converte porcentagem em fração', () => {
      expect(montarRelease({ versionCode, percentual: 10 })).toEqual({
        versionCodes: ['3030'],
        status: 'inProgress',
        userFraction: 0.1,
      });
    });

    it('converte os limites aceitos pela CLI', () => {
      expect(montarRelease({ versionCode, percentual: 1 }).userFraction).toBe(
        0.01,
      );
      expect(montarRelease({ versionCode, percentual: 50 }).userFraction).toBe(
        0.5,
      );
      expect(montarRelease({ versionCode, percentual: 99 }).userFraction).toBe(
        0.99,
      );
    });

    it('mantém a fração estritamente entre 0 e 1', () => {
      // A Play recusa 0 e 1. A CLI barra fora de 1-99; isto guarda a conversão.
      for (const p of [1, 25, 50, 75, 99]) {
        const { userFraction } = montarRelease({ versionCode, percentual: p });
        expect(userFraction).toBeGreaterThan(0);
        expect(userFraction).toBeLessThan(1);
      }
    });

    it('não vaza status completed quando há percentual', () => {
      expect(montarRelease({ versionCode, percentual: 10 }).status).toBe(
        'inProgress',
      );
    });
  });

  it('trata percentual undefined como ausente, não como zero', () => {
    // Se `undefined` virasse `userFraction: 0`, a Play recusaria e o erro só
    // apareceria na hora de publicar em produção.
    expect(montarRelease({ versionCode, percentual: undefined })).toEqual({
      versionCodes: ['3030'],
      status: 'completed',
    });
  });
});
