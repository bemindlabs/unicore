import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: './coverage',
};

export default config;
