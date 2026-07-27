/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        outDir: 'build',
    },
    server: {
        port: 3000,
        open: true,
        // The player DB API allowlists only the deployed origin
        // (https://sleeper-player-db.web.app) for CORS, so a direct browser
        // request from localhost is blocked. Proxying it through the dev
        // server makes the call server-side, where CORS does not apply.
        // See src/urls.js, which uses a relative path in dev to hit this.
        proxy: {
            '/api/legacy': {
                target: 'https://fantasyteamassistant.com',
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
        css: true,
    },
});
