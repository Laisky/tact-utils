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
            'buffer': 'buffer/'
        },
        extensions: ['.ts', '.tsx', '.js']
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: './index.ts',
            output: {
                entryFileNames: 'bundle.js'
            }
        }
    },
    define: {
        global: "window",
        'process.env': {}
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
