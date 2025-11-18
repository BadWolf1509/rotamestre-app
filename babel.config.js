module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', { root: 'app' }],
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: [
            '.ios.js',
            '.android.js',
            '.js',
            '.jsx',
            '.json',
            '.tsx',
            '.ts',
            '.native.js',
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.svg',
          ],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@lib': './src/lib',
            '@types': './src/types',
            '@config': './src/config',
            '@assets': './assets',
          },
        },
      ],
    ],
  };
};
