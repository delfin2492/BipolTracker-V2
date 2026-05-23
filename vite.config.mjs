import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    root: 'frontend',
    publicDir: 'public',
    build: {
        outDir: '../backend/public',
        emptyOutDir: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'frontend/index.html'),
                login: path.resolve(__dirname, 'frontend/login.html'),
                admin: path.resolve(__dirname, 'frontend/admin.html'),
                driver: path.resolve(__dirname, 'frontend/driver.html')
            }
        }
    },
    server: {
        port: 3000,
        open: false,
    },
    plugins: [
        VitePWA({
            strategies: 'injectManifest',
            srcDir: '.',
            filename: 'sw.js',
            injectRegister: false,
            devOptions: {
                enabled: true,
                type: 'module'
            },
            manifest: false,
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
            }
        })
    ]
});
