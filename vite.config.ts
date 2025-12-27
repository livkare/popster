import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    // Set base path for GitHub Pages in production, root for local dev
    base: command === 'build' ? '/Popster-Queen/' : '/',
    server: {
        port: 3000,
        strictPort: true,
        host: true
    },
    // Configure SPA routing - serve index.html for all routes
    appType: 'spa',
    build: {
        rollupOptions: {
            input: {
                main: './index.html'
            }
        },
        // Ensure assets are copied correctly
        assetsDir: 'assets'
    }
}));

