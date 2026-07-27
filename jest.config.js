module.exports = {
  preset: 'react-native',
  // The react-native preset transforms '^.+\\.(js|ts|tsx)$' — it omits `jsx`.
  // This codebase is overwhelmingly .jsx (every screen and component, and three
  // of the four contexts), so without this override babel-jest leaves those
  // files untransformed and any test importing one dies with
  // "Cannot use import statement outside a module".
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      'react-native/jest/assetFileTransformer.js',
    ),
  },
};
