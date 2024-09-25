import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
