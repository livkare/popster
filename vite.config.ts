import { defineConfig } from 'vite';

export default defineConfig({
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
        }
    }
});

