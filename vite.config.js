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
        build: {
            target: 'esnext',
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        // React core — changes almost never
                        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                        // Heavy visualisation libs
                        'vendor-mermaid': ['mermaid'],
                        'vendor-monaco': ['@monaco-editor/react'],
                        'vendor-vega': ['vega', 'vega-embed', 'vega-lite'],
                        'vendor-katex': ['katex', 'rehype-katex', 'remark-math'],
                        // Editor / markdown
                        'vendor-tiptap': [
                            '@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm',
                            '@tiptap/extension-bubble-menu', '@tiptap/extension-highlight',
                            '@tiptap/extension-link', '@tiptap/extension-placeholder',
                            '@tiptap/extension-table', '@tiptap/extension-table-cell',
                            '@tiptap/extension-table-header', '@tiptap/extension-table-row',
                            '@tiptap/extension-text-align', '@tiptap/extension-underline',
                            'tiptap-markdown',
                        ],
                        'vendor-markdown': ['react-markdown', 'remark-gfm', 'highlight.js'],
                        // Charts / misc
                        'vendor-charts': ['recharts'],
                        'vendor-misc': ['@tanstack/react-query', 'lucide-react', 'uuid', 'html2pdf.js'],
                    },
                },
            },
        },
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

