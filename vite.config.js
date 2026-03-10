import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file from parent directory
    const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

    // Get ports from env or default
    const SERVER_PORT = env.SERVER_PORT || 3001
    const CLIENT_PORT = env.CLIENT_PORT || 5175

    return {
        plugins: [react()],
        envDir: '..',
        server: {
            port: parseInt(CLIENT_PORT),
            proxy: {
                '/agents': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                },
                '/auth': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                },
                '/components': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                },
                '/test-component': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                },
                '/ai': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                },
                '/api': {
                    target: `http://localhost:${SERVER_PORT}`,
                    changeOrigin: true
                }
            }
        }
    }
})
