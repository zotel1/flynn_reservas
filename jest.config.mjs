import { createCjsPreset } from 'jest-preset-angular/presets';

export default {
    ...createCjsPreset(),
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/**/?(*.)+(spec).ts'],
    testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/out-tsc/', '<rootDir>/src/test.ts'],
};
