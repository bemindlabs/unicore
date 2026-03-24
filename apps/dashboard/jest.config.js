import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': `${__dirname}/src/$1`,
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@unicore/shared-types$': `${__dirname}/../../packages/shared-types/src/index.ts`,
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },
};

export default config;
