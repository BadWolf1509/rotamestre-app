/**
 * Guarda do patch em patches/react-native-draggable-flatlist+4.0.3.patch.
 *
 * O RN 0.88 (Expo SDK 58) removeu o InteractionManager. O
 * react-native-draggable-flatlist 4.0.3 (sem manutenção) o chama ao receber
 * dados novos — o que acontece logo depois de cada arrasto —, e no aparelho
 * `InteractionManager` é undefined: TypeError na reordenação de paradas do
 * gestor e na lista da nova entrega. O web não quebra (o react-native-web ainda
 * o exporta), então nenhum e2e pegaria; o Jest também não, porque os testes
 * mockam a lib.
 *
 * O patch é aplicado pelo `patch-package` no postinstall. Se ele deixar de
 * aplicar (bump da lib, ou instalação com --ignore-scripts), este teste falha.
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

describe('react-native-draggable-flatlist sem InteractionManager', () => {
  it.each(ENTRADAS)(
    '%s não chama InteractionManager.runAfterInteractions',
    (arquivo) => {
      const codigo = readFileSync(join(RAIZ, arquivo), 'utf8');
      expect(codigo).not.toMatch(/InteractionManager\.runAfterInteractions/);
      expect(codigo).toMatch(/setTimeout\(/);
    },
  );
});
