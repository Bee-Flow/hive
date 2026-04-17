import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// Resolve a version string for the running build. Precedence:
//   1. VITE_BUILD_SHA env var (set by CI — `${{ github.sha }}` from the workflow).
//   2. `git rev-parse --short HEAD` (local dev).
//   3. 'dev' (no git available, e.g. inside a shallow Docker tarball).
function resolveBuildSha(envSha) {
    if (envSha && envSha.length > 0) return envSha.slice(0, 7);
    try {
        return execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim();
    } catch (_) {
        return 'dev';
    }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file from parent directory
    const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

    // Get ports from env or default
    const SERVER_PORT = env.SERVER_PORT || 3001
    const CLIENT_PORT = env.CLIENT_PORT || 5175

    // Version metadata — injected at build time as a JS constant.
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
    const buildSha = resolveBuildSha(env.VITE_BUILD_SHA || process.env.VITE_BUILD_SHA);
    const buildDate = new Date().toISOString();

    return {
        plugins: [react()],
        envDir: '..',
        define: {
            // Available app-wide as import-meta constants. Rollup inlines them,
            // so there's no runtime cost and no risk of "undefined".
            __APP_VERSION__: JSON.stringify(pkg.version),
            __APP_BUILD_SHA__: JSON.stringify(buildSha),
            __APP_BUILD_DATE__: JSON.stringify(buildDate),
        },
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
                            '@tiptap/react', '@tiptap/starter-kit',
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

