import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        target: 'es2020',
        sourcemap: false,
    },
    server: {
        port: 5173,
        open: true,
    },
});
