import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Initial CI-friendly config:
//   - keeps `react-hooks/rules-of-hooks` strict (real bugs)
//   - demotes the rest of react-hooks v7 (the new React-Compiler rules) to warn
//   - demotes a few js.configs.recommended rules to warn so CI passes today
// Tighten over time by promoting individual rules back to 'error'.

// Long-file / long-function / complexity budgets. Warn-only so CI stays green;
// promote to 'error' as the codebase is cleaned up.
const sizeComplexityRules = {
    'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
    complexity: ['warn', { max: 15 }],
    'max-depth': ['warn', 4],
    'max-params': ['warn', 5],
    'max-statements': ['warn', 25],
    'max-nested-callbacks': ['warn', 4],
};

export default [
    {
        ignores: ['dist', 'build', 'node_modules', 'coverage', '.vite'],
    },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            // eslint-plugin-react is registered for exactly one rule
            // (react/jsx-no-undef, below). Its recommended set is deliberately
            // NOT spread in — it would bury the errors we do care about under a
            // few thousand new warnings.
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'import': importPlugin,
        },
        settings: {
            'import/resolver': {
                node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            ...sizeComplexityRules,

            // React rules — keep rules-of-hooks strict, demote the new
            // React-Compiler rules to warn for now.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
            'react-hooks/static-components': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/error-boundaries': 'warn',
            'react-hooks/component-hook-factories': 'warn',
            'react-hooks/incompatible-library': 'warn',
            'react-hooks/unsupported-syntax': 'warn',

            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],

            // A JSX element name is not a reference as far as core `no-undef`
            // is concerned, so `<Foo />` with no import for Foo lints clean and
            // then throws ReferenceError in the browser — minified to something
            // like "X is not defined", from inside whatever .map() rendered it.
            // That shipped to production once (BFSF-351: a missing lucide `X`
            // import crashed the notebook editor on every table click). Error,
            // not warn: there is no legitimate undefined JSX element.
            'react/jsx-no-undef': 'error',

            // Demote a handful of recommended JS rules to warn so CI is green
            // today. Promote back to 'error' as the codebase is cleaned up.
            //   no-dupe-keys     → 14 instances; these ARE real bugs, fix later.
            //   no-case-declarations → 16 instances, mostly cosmetic.
            //   no-useless-escape → 4 instances, minor.
            //   no-irregular-whitespace → narrow case.
            //   no-shadow-restricted-names → narrow case.
            //   no-constant-binary-expression → narrow case.
            'no-dupe-keys': 'warn',
            'no-case-declarations': 'warn',
            'no-useless-escape': 'warn',
            'no-irregular-whitespace': 'warn',
            'no-shadow-restricted-names': 'warn',
            'no-constant-binary-expression': 'warn',

            // Promoted back to 'error': the check turned up exactly one
            // violation repo-wide and it was a genuine crash (an unimported
            // MISTRAL_MODEL_META in AllowedModelsConfig). Every hit here is a
            // runtime ReferenceError waiting for the right render path.
            'no-undef': 'error',

            'no-unused-vars': [
                'warn',
                { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
            ],
            'no-empty': ['warn', { allowEmptyCatch: true }],

            // Import ordering — warn-only so existing files don't break CI.
            // Newly written or refactored files naturally pick up the
            // convention via editor auto-fix. The order keeps node builtins
            // / externals / parent / sibling / index groups separated and
            // alphabetizes within each group.
            'import/order': [
                'warn',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        ['parent', 'sibling', 'index'],
                    ],
                    pathGroups: [
                        { pattern: '@/**', group: 'internal', position: 'before' },
                    ],
                    'newlines-between': 'ignore',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],

            // Forbid raw fetch() in src/components and src/pages — those
            // should go through apiClient (or a dedicated React Query
            // hook). Demoted to 'warn' for now so the existing call sites
            // surface as todo markers; promote to 'error' once the
            // Phase 5 splits migrate them.
            'no-restricted-globals': ['warn', {
                name: 'fetch',
                message: 'Use apiClient (api/client) or a React Query hook instead of raw fetch().',
            }],
        },
    },
    {
        // TS/TSX were previously unlinted. Apply only the size/complexity budgets
        // here (syntax-only via the TS parser, no type-check) to avoid a rule flood.
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            ...sizeComplexityRules,
        },
    },
    // NOTE: scoping 'react-hooks/exhaustive-deps' to error inside src/hooks/
    // was attempted, but useChatEngine has intentional dep omissions
    // (documented inline) that the rule flags. Promote per-file once the
    // Phase 5.B7 split of useChatEngine into hooks/chat/ lands and the
    // contract becomes verifiable. Until then, the warn-level rule from the
    // base config keeps new code on the right side.
];
