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
import {
  LIMITE_NOTAS,
  lerTrilhas,
  montarRelease,
  validarNotas,
} from '../play-release.js';

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

describe('montarRelease com notas da versão', () => {
  const versionCode = '3037';

  it('inclui releaseNotes em pt-BR quando há notas', () => {
    expect(
      montarRelease({
        versionCode,
        releaseName: '1.13.0',
        notas: 'Correções.',
      }),
    ).toEqual({
      name: '1.13.0',
      versionCodes: ['3037'],
      status: 'completed',
      releaseNotes: [{ language: 'pt-BR', text: 'Correções.' }],
    });
  });

  it('omite releaseNotes sem notas — a Play apagaria as atuais com lista vazia', () => {
    expect(montarRelease({ versionCode })).not.toHaveProperty('releaseNotes');
    expect(montarRelease({ versionCode, notas: undefined })).not.toHaveProperty(
      'releaseNotes',
    );
  });

  it('combina notas com rollout gradual', () => {
    expect(
      montarRelease({ versionCode, percentual: 10, notas: 'Novidades.' }),
    ).toEqual({
      versionCodes: ['3037'],
      status: 'inProgress',
      userFraction: 0.1,
      releaseNotes: [{ language: 'pt-BR', text: 'Novidades.' }],
    });
  });
});

describe('validarNotas', () => {
  it('aceita até o limite da Play e devolve o texto sem espaço nas pontas', () => {
    expect(LIMITE_NOTAS).toBe(500);
    expect(validarNotas('  Correções.\n')).toBe('Correções.');
    const noLimite = 'a'.repeat(500);
    expect(validarNotas(noLimite)).toBe(noLimite);
  });

  it('recusa acima de 500 caracteres, dizendo quantos tem', () => {
    expect(() => validarNotas('a'.repeat(501))).toThrow(/501.*500/);
  });

  it('conta caracteres, não unidades UTF-16 — emoji conta como 1', () => {
    // '🚚'.length === 2; a Play conta caracteres. 500 emojis passam.
    expect(() => validarNotas('🚚'.repeat(500))).not.toThrow();
    expect(() => validarNotas('🚚'.repeat(501))).toThrow();
  });

  it('normaliza CRLF do Windows antes de contar', () => {
    // Cada quebra CRLF contaria 2; a Play guarda e exibe LF.
    const texto = 'a\r\n'.repeat(200) + 'a'.repeat(99);
    expect(validarNotas(texto)).toBe('a\n'.repeat(200) + 'a'.repeat(99));
  });

  it('remove o BOM que o Out-File do PowerShell grava no arquivo', () => {
    expect(validarNotas('﻿Correções.')).toBe('Correções.');
  });

  it('recusa notas vazias — arquivo vazio é engano, não intenção', () => {
    expect(() => validarNotas('')).toThrow(/vazi/);
    expect(() => validarNotas('  \n ')).toThrow(/vazi/);
  });
});

describe('lerTrilhas', () => {
  it('aceita uma trilha', () => {
    expect(lerTrilhas('alpha')).toEqual(['alpha']);
  });

  it('aceita várias separadas por vírgula, na ordem dada', () => {
    expect(lerTrilhas('internal,alpha')).toEqual(['internal', 'alpha']);
    expect(lerTrilhas('internal, alpha')).toEqual(['internal', 'alpha']);
  });

  it('recusa trilha desconhecida', () => {
    expect(() => lerTrilhas('internal,producao')).toThrow(/producao/);
  });

  it('recusa trilha repetida — dois PUT na mesma edição, o segundo vence', () => {
    expect(() => lerTrilhas('alpha,alpha')).toThrow(/repetida/);
  });

  it('recusa item vazio (vírgula sobrando)', () => {
    expect(() => lerTrilhas('internal,')).toThrow();
  });
});
