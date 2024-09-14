import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/helloworld/helloworld.tact',
    options: {
        debug: true,
        external: true,
        masterchain: true,
    },
};
