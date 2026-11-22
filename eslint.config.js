'use strict';
// ESLint flat config (ESLint 9+).
const webext = {
  browser: 'readonly', chrome: 'readonly', self: 'readonly', window: 'readonly',
  document: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly',
  FileReader: 'readonly', fetch: 'readonly', performance: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', structuredClone: 'readonly',
  importScripts: 'readonly', SHC: 'writable',
};

module.exports = [
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: webext },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      // Security: forbid innerHTML/outerHTML to keep the UI XSS-safe (S6).
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent / DOM APIs — no innerHTML.' },
        { property: 'outerHTML', message: 'Use textContent / DOM APIs — no outerHTML.' },
      ],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly', global: 'writable', process: 'readonly' },
    },
    rules: { 'no-unused-vars': 'warn' },
  },
];
