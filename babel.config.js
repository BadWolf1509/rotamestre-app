// Só nos testes: o babel-jest deste repo deixa `import()` intacto e o Node recusa
// ("dynamic import callback ... --experimental-vm-modules"). Troca por
// Promise.resolve().then(() => require(x)), que o jest.mock intercepta. Metro e
// o build web não passam por aqui — lá o import() vira chunk de verdade.
function importDinamicoParaRequire({ types: t }) {
  return {
    name: 'import-dinamico-para-require',
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') return;
        const requisicao = t.callExpression(t.identifier('require'), path.node.arguments);
        path.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), []),
              t.identifier('then')
            ),
            [t.arrowFunctionExpression([], requisicao)]
          )
        );
      },
    },
  };
}

module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'react-native-unistyles/plugin',
        {
          root: 'src',
          autoProcessImports: ['@/utils/styles'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
    env: {
      test: { plugins: [importDinamicoParaRequire] },
    },
  };
};
