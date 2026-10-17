export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'backups/**',
    ],
  },
  {
    files: [
      'client/src/**/*.js',
      'client/src/**/*.jsx',
      'server/**/*.js',
      'scripts/**/*.mjs',
      'tests/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'no-constant-binary-expression': 'error',
      'valid-typeof': 'error',
      'no-unsafe-optional-chaining': 'error',
    },
  },
];
