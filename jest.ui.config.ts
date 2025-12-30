// jest.ui.config.ts
import type { Config } from 'jest';
import { createCjsPreset } from 'jest-preset-angular/presets/index.js';

export default {
    ...createCjsPreset(),
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    testPathIgnorePatterns: [
        '<rootDir>/dist/',
        '<rootDir>/node_modules/',
        '<rootDir>/api/',
        '<rootDir>/src/test.ts' // evita conflictos si existe el archivo “karma test” de Angular
    ],
} satisfies Config;
