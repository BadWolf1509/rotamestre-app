/**
 * O CI roda a suíte no fuso do projeto (America/Sao_Paulo).
 *
 * Os bugs de fuso do app (coluna `date` virando o dia anterior, dia do
 * calendário saindo de `toISOString()`) só aparecem em fuso negativo, e o
 * runner do GitHub é UTC — onde o código quebrado acerta. A guarda estática
 * `data-local-sem-utc.test.ts` cobre a forma literal; isto cobre o ambiente:
 *
 * 1. o passo "Run tests" do workflow define `TZ: America/Sao_Paulo`;
 * 2. no CI, o processo de fato está nesse fuso (`new Date('2026-09-05')` é
 *    meia-noite UTC e tem de cair no dia 04 local). Fora do CI o teste de
 *    runtime se pula: cada máquina tem o seu fuso, e pinar `process.env.TZ`
 *    dentro do Jest não é confiável (o fuso padrão já foi cacheado).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const noCI = process.env.CI === 'true';

describe('fuso da suíte no CI', () => {
  it('o passo de testes do workflow define TZ', () => {
    const yml = readFileSync(
      join(__dirname, '../../../.github/workflows/test.yml'),
      'utf8',
    ).replace(/\r\n/g, '\n');

    const inicio = yml.indexOf('- name: Run tests');
    expect(inicio).toBeGreaterThan(-1);
    const proximo = yml.indexOf('\n      - name:', inicio + 1);
    const passo = yml.slice(inicio, proximo === -1 ? undefined : proximo);

    expect(passo).toMatch(/env:\s*\n\s+TZ:\s*America\/Sao_Paulo/);
  });

  (noCI ? it : it.skip)(
    'no CI, new Date("2026-09-05") cai no dia 04 (meia-noite UTC em UTC-3)',
    () => {
      // O comportamento é a prova; `process.env.TZ` não aparece dentro do
      // Jest em todo ambiente (no Windows chega vazio).
      expect(new Date('2026-09-05').getDate()).toBe(4);
      expect(new Date('2026-09-05').getTimezoneOffset()).toBe(180);
    },
  );
});
