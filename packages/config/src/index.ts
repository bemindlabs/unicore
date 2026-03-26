/**
 * @bemindlabs/unicore-config — shared configuration package
 *
 * Usage:
 *   ESLint:     require('@bemindlabs/unicore-config/eslint/base')
 *   TypeScript: { "extends": "@bemindlabs/unicore-config/typescript/base" }
 *   Tailwind:   import baseConfig from '@bemindlabs/unicore-config/tailwind/base'
 *   Prettier:   require('@bemindlabs/unicore-config/prettier/base')
 */

export const eslint = {
  base: '@bemindlabs/unicore-config/eslint/base',
  next: '@bemindlabs/unicore-config/eslint/next',
  nest: '@bemindlabs/unicore-config/eslint/nest',
  react: '@bemindlabs/unicore-config/eslint/react',
} as const;

export const typescript = {
  base: '@bemindlabs/unicore-config/typescript/base',
  next: '@bemindlabs/unicore-config/typescript/next',
  nest: '@bemindlabs/unicore-config/typescript/nest',
  library: '@bemindlabs/unicore-config/typescript/library',
} as const;

export const tailwind = {
  base: '@bemindlabs/unicore-config/tailwind/base',
} as const;

export const prettier = {
  base: '@bemindlabs/unicore-config/prettier/base',
} as const;
