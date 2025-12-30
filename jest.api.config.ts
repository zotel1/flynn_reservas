// jest.api.config.ts
import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const presetConfig = createDefaultEsmPreset({
    tsconfig: '<rootDir>/api/tsconfig.json',
});

export default {
    ...presetConfig,
    testEnvironment: 'node',
    testMatch: ['<rootDir>/lib/**/*.spec.ts', '<rootDir>/api/**/*.spec.ts'],
} satisfies Config;
