/**
 * @unicore/config — shared configuration package
 *
 * Usage:
 *   ESLint:     require('@unicore/config/eslint/base')
 *   TypeScript: { "extends": "@unicore/config/typescript/base" }
 *   Tailwind:   import baseConfig from '@unicore/config/tailwind/base'
 *   Prettier:   require('@unicore/config/prettier/base')
 */

export const eslint = {
  base: '@unicore/config/eslint/base',
  next: '@unicore/config/eslint/next',
  nest: '@unicore/config/eslint/nest',
  react: '@unicore/config/eslint/react',
} as const;

export const typescript = {
  base: '@unicore/config/typescript/base',
  next: '@unicore/config/typescript/next',
  nest: '@unicore/config/typescript/nest',
  library: '@unicore/config/typescript/library',
} as const;

export const tailwind = {
  base: '@unicore/config/tailwind/base',
} as const;

export const prettier = {
  base: '@unicore/config/prettier/base',
} as const;
