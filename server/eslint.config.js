import js from '@eslint/js';
import n from 'eslint-plugin-n';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { n },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-undef': 'error',
      // The following are surfaced as warnings for the baseline so existing
      // code does not block CI. Tighten to 'error' once cleaned up.
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  {
    // Chart rendering services run against a canvas/DOM polyfill and reference
    // browser globals (document) at runtime.
    files: ['services/chartGenerationService.js', 'services/chartRenderingService.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'logs/**',
      'scripts/**',
      'migrations/**',
      'tesseract-data/**',
      '**/*.cjs',
    ],
  },
];
