export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',

  // ✅ Solo buscamos tests acá (no src/app)
  roots: ['<rootDir>/lib', '<rootDir>/api'],
  testMatch: ['**/*.spec.ts'],

  // ✅ ESM + TS
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },

  // ✅ Evitar basura
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/out-tsc/'],

  // ✅ Arreglo típico para imports con .js en ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  clearMocks: true,
};
