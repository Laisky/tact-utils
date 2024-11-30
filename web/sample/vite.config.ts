import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';


// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export default defineConfig({
    plugins: [
        react(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            buffer: 'buffer',
            process: 'process/browser',
            stream: 'stream-browserify',
            zlib: 'browserify-zlib',
            'tweetnacl-util': 'tweetnacl-util/nacl-util.js'
        },
        extensions: ['.ts', '.tsx', '.js']
    },
    define: {
        'process.env': {},
        global: 'globalThis'
    },
    build: {
        outDir: 'dist',
        commonjsOptions: {
            transformMixedEsModules: true
        },
        rollupOptions: {
            input: './index.ts',
            output: {
                entryFileNames: 'bundle.js'
            }
        }
    },
    server: {
        port: 3000,
        // watch: {
        //     // usePolling: true,
        //     interval: 1000,
        //     additionalPaths: (watcher) => {
        //         watcher.add('./src/scss/**');
        //     }
        // },
    },
});
