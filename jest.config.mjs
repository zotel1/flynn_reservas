export default {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/out-tsc/', '<rootDir>/src/test.ts'],
};
