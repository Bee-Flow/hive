import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv } from 'vite'

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

    // Bundle analyzer: run `npm run build:analyze` to open dist/stats.html.
    // The env-gated check keeps it out of normal builds — adding it
    // unconditionally would emit stats.html on every CI build and slow
    // production builds for no reason.
    const enableAnalyzer = env.VITE_BUNDLE_ANALYZE === '1' || process.env.VITE_BUNDLE_ANALYZE === '1';

    return {
        plugins: [
            react(),
            ...(enableAnalyzer ? [visualizer({
                filename: 'dist/stats.html',
                template: 'treemap',
                gzipSize: true,
                brotliSize: true,
                emitFile: false,
                open: false,
            })] : []),
        ],
        envDir: '..',
        resolve: {
            // '@/' resolves to 'src/'. Use sparingly during the refactor —
            // files adopt the alias as they are touched; we do not mass-rewrite
            // existing relative imports. Keep the alias in sync with the
            // 'paths' mapping in tsconfig.json.
            alias: {
                '@': path.resolve(__dirname, 'src'),
            },
        },
        define: {
            // Available app-wide as import-meta constants. Rollup inlines them,
            // so there's no runtime cost and no risk of "undefined".
            __APP_VERSION__: JSON.stringify(pkg.version),
            __APP_BUILD_SHA__: JSON.stringify(buildSha),
            __APP_BUILD_DATE__: JSON.stringify(buildDate),
        },
        build: {
            target: 'esnext',
            // 'hidden': emit .map files but omit the //# sourceMappingURL= comment,
            // so browsers don't auto-fetch them. We strip the .map files from the
            // served Docker image (nginx 404 + Dockerfile delete) and keep them
            // only as CI artifacts for decoding minified production stack traces.
            sourcemap: 'hidden',
            rollupOptions: {
                output: {
                    manualChunks: {
                        // React core — changes almost never
                        'vendor-react': ['react', 'react-dom'],
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
                        // TipTap extras: niche extensions only loaded by NotebookEditor.
                        // Splitting them out means features that don't open notebooks
                        // (chat, admin, settings) don't pay for these chunks.
                        'vendor-tiptap-extra': [
                            '@tiptap/extension-color', '@tiptap/extension-drag-handle-react',
                            '@tiptap/extension-emoji', '@tiptap/extension-font-family',
                            '@tiptap/extension-image', '@tiptap/extension-mathematics',
                            '@tiptap/extension-table-of-contents', '@tiptap/extension-task-item',
                            '@tiptap/extension-task-list', '@tiptap/extension-text-style',
                            '@tiptap/extension-typography',
                        ],
                        // DnD primitives: only needed by builders / sortable lists.
                        'vendor-dnd': [
                            '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
                            '@xyflow/react', '@dagrejs/dagre',
                        ],
                        // React Grid Layout — used only by ComponentBuilder.
                        'vendor-grid-layout': ['react-grid-layout'],
                        'vendor-markdown': ['react-markdown', 'remark-gfm', 'highlight.js'],
                        // Charts / misc
                        'vendor-charts': ['recharts'],
                        'vendor-misc': ['@tanstack/react-query', 'lucide-react', 'uuid', 'html2pdf.js'],
                    },
                },
            },
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.js'],
            css: false,
            // 'forks' (vitest's default) launches worker processes whose IPC
            // paths get URL-encoded; with a workspace path that contains
            // spaces (e.g. "VS Projects/Bee Flow - AI") the encoded path
            // never resolves and every worker times out. 'threads' avoids
            // that handshake entirely.
            pool: 'threads',
            coverage: {
                provider: 'v8',
                reporter: ['text', 'html', 'json-summary'],
                include: ['src/**/*.{js,jsx,ts,tsx}'],
                exclude: [
                    'src/**/*.spec.{js,jsx,ts,tsx}',
                    'src/test/**',
                    'src/**/*.config.{js,ts}',
                ],
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

