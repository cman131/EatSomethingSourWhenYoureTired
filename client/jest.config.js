'use strict';

const path = require('path');
const babelTransform = require.resolve('react-scripts/config/jest/babelTransform.js');
const cssTransform = require.resolve('react-scripts/config/jest/cssTransform.js');
const fileTransform = require.resolve('react-scripts/config/jest/fileTransform.js');

const rootDir = path.resolve(__dirname);
const srcDir = path.join(rootDir, 'src');

module.exports = {
  rootDir,
  roots: [srcDir],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': babelTransform,
    '^.+\\.css$': cssTransform,
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': fileTransform,
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
  },
  moduleFileExtensions: ['web.js', 'js', 'web.ts', 'ts', 'web.tsx', 'tsx', 'json', 'web.jsx', 'jsx', 'node'],
  setupFiles: [require.resolve('react-app-polyfill/jsdom')],
  resetMocks: true,
};
