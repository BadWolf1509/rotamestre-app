/**
 * Guarda do patch em patches/react-native-draggable-flatlist+4.0.3.patch.
 *
 * 1. O RN 0.88 (Expo SDK 58) removeu o InteractionManager. O
 *    react-native-draggable-flatlist 4.0.3 (sem manutenção) o chama ao receber
 *    dados novos — o que acontece logo depois de cada arrasto —, e no release
 *    `InteractionManager` é undefined: TypeError na reordenação de paradas do
 *    gestor e na lista da nova entrega. O patch troca por `queueMicrotask`, o
 *    equivalente do que o RN 0.86 fazia (runAfterInteractions era um stub sobre
 *    setImmediate, que no bridgeless é queueMicrotask).
 * 2. No Gesture Handler 3 o export `FlatList` é o da API nova, que ignora o
 *    `simultaneousHandlers` que a lib passa e disputa o toque de outro jeito com
 *    o pan legado (Gesture.Pan). A lib foi escrita para a API antiga: o patch a
 *    mantém no `LegacyFlatList`.
 *
 * O web não quebraria em (1) (o react-native-web ainda exporta o
 * InteractionManager), e o Jest mocka a lib: sem esta guarda, nada acusaria.
 * O patch é aplicado pelo `patch-package --error-on-fail` no postinstall (e no
 * CI, depois do `npm ci --ignore-scripts`). Se ele deixar de aplicar, falha aqui.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  'react-native-draggable-flatlist',
);

// As três entradas que um bundler pode escolher: `react-native` (Metro),
// `module` e `main` (Jest).
const ENTRADAS = [
  'src/components/DraggableFlatList.tsx',
  'lib/module/components/DraggableFlatList.js',
  'lib/commonjs/components/DraggableFlatList.js',
];

const ler = (arquivo: string) => readFileSync(join(RAIZ, arquivo), 'utf8');

describe('patch do react-native-draggable-flatlist', () => {
  it.each(ENTRADAS)(
    '%s não chama InteractionManager e reseta por microtask',
    (arquivo) => {
      const codigo = ler(arquivo);
      expect(codigo).not.toMatch(/InteractionManager\.runAfterInteractions/);
      expect(codigo).toMatch(/queueMicrotask\(/);
    },
  );

  it.each(ENTRADAS)('%s usa o LegacyFlatList do Gesture Handler', (arquivo) => {
    const codigo = ler(arquivo);
    expect(codigo).toMatch(/LegacyFlatList/);
    // Nenhum uso do `FlatList` novo do RNGH (import nomeado ou acesso no CJS).
    const importados = [
      ...codigo.matchAll(
        /import \{([^}]*)\} from "react-native-gesture-handler"/g,
      ),
    ].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]));
    expect(importados).not.toContain('FlatList');
    expect(codigo).not.toMatch(/_reactNativeGestureHandler\.FlatList\b/);
  });

  it('o Gesture Handler instalado ainda exporta LegacyFlatList', () => {
    // Lido do fonte, não pelo require: o jestSetup do RNGH mocka os componentes.
    const indice = readFileSync(
      join(RAIZ, '..', 'react-native-gesture-handler', 'src', 'index.ts'),
      'utf8',
    );
    expect(indice).toMatch(/\bLegacyFlatList\b/);
  });
});
