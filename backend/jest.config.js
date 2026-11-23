/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testTimeout: 60000,
  globalSetup: '<rootDir>/tests/globalSetup.cjs',
  globalTeardown: '<rootDir>/tests/globalTeardown.cjs',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }] },
};
