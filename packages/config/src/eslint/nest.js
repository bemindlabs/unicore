const base = require('./base');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...base,
  {
    rules: {
      // NestJS uses classes with decorators extensively
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // Allow default exports for NestJS modules
      'import/no-default-export': 'off',

      // NestJS convention: constructor injection uses parameter properties
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Allow console in services for logging
      'no-console': 'off',
    },
  },
];
