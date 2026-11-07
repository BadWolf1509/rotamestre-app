/**
 * O babel-preset-expo 58 já aplica o plugin do worklets quando o pacote está
 * instalado, e `react-native-reanimated/plugin` (Reanimated 4) é só um reexport
 * dele. Listar os dois era exigência do Reanimated 3. Este teste prova as duas
 * metades: o config não repete o plugin e, mesmo assim, um 'worklet' é compilado.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');

describe('babel.config.js e o plugin de worklets', () => {
  it('não lista react-native-reanimated/plugin (o preset já o aplica)', () => {
    const fonte = readFileSync(join(RAIZ, 'babel.config.js'), 'utf8');
    expect(fonte).not.toMatch(/['"]react-native-reanimated\/plugin['"]/);
  });

  it("um 'worklet' ainda é compilado com o config do projeto", () => {
    const babel = require('@babel/core');
    const resultado = babel.transformSync(
      "export function f(x) { 'worklet'; return x + 1; }",
      {
        filename: join(RAIZ, 'src', 'zz-worklet.ts'),
        cwd: RAIZ,
        configFile: join(RAIZ, 'babel.config.js'),
        envName: 'production',
        babelrc: false,
      },
    );
    expect(resultado.code).toMatch(/__workletHash/);
  });
});
