import React, { Suspense, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import useTranslation from '../hooks/useTranslation';

// Per-module host boundary for a runtime-loaded Studio app.
//
// A remote module is fetched at render time via a dynamic import of its
// same-origin entry bundle. Two things must never happen: (1) a module that
// fails to load must NOT take down the rest of the SPA, and (2) it must NOT
// reload-loop the page. So this deliberately does NOT use lazyWithReload (whose
// job is to hard-reload on a chunk 404) — instead a real error boundary shows a
// friendly card with a manual Retry, and version skew self-heals because the
// entry URL embeds the module version (a stale URL 404s → error card → Retry).

// CSS <link>s injected once per href (modules ship their own stylesheet).
const _injectedCss = new Set();
function injectCss(urls = []) {
    if (typeof document === 'undefined') return;
    for (const href of urls) {
        if (!href || _injectedCss.has(href)) continue;
        _injectedCss.add(href);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-beeflow-module-css', '');
        document.head.appendChild(link);
    }
}

// The single dynamic-import site. `@vite-ignore` keeps Vite from trying to
// analyse/pre-bundle the (runtime-only, same-origin) module URL.
function importRemoteEntry(entryUrl, cssUrls = []) {
    injectCss(cssUrls);
    return import(/* @vite-ignore */ entryUrl);
}

class ModuleErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('[module runtime]', this.props.moduleId, error, info);
    }
    render() {
        if (this.state.error) return this.props.renderFallback();
        return this.props.children;
    }
}

function LoadingCard() {
    return (
        <div className="flex items-center justify-center w-full h-full py-20">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)] animate-spin" />
        </div>
    );
}

function ErrorCard({ label, onRetry }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center w-full h-full py-16 px-6 text-center" data-testid="module-error-card">
            <AlertTriangle className="w-8 h-8 mb-3" style={{ color: '#f59e0b' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('modules.runtime_error_title', { name: label })}
            </p>
            <p className="text-xs mt-1.5 max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t('modules.runtime_error_body')}
            </p>
            <button
                onClick={onRetry}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            >
                <RefreshCw className="w-3.5 h-3.5" /> {t('modules.retry')}
            </button>
        </div>
    );
}

/**
 * RemoteStudioApp — renders a runtime module's exported component behind an
 * error boundary + Suspense.
 *
 * @param {string}   moduleId       module id (for logging / label fallback)
 * @param {object}   labels         { en, nl, … } locale label map
 * @param {string}   entryUrl       same-origin ESM entry to import
 * @param {string[]} cssUrls        stylesheet hrefs to inject before render
 * @param {function} [load]         test seam: (nonce) => Promise<{default}>;
 *                                  defaults to importRemoteEntry(entryUrl)
 * @param {object}   componentProps props forwarded to the module component
 */
export default function RemoteStudioApp({ moduleId, labels = {}, entryUrl, cssUrls = [], load, componentProps = {} }) {
    const { locale } = useTranslation();
    // Retry bumps the nonce: it remounts the boundary (fresh error state) AND
    // rebuilds the lazy with a cache-busted URL so a transient 404/skew is retried.
    const [nonce, setNonce] = useState(0);
    const label = labels[locale] || labels.en || moduleId;

    const Lazy = useMemo(() => {
        const importer = load
            ? () => load(nonce)
            : () => {
                const busted = nonce
                    ? `${entryUrl}${entryUrl.includes('?') ? '&' : '?'}r=${nonce}`
                    : entryUrl;
                return importRemoteEntry(busted, cssUrls);
            };
        return React.lazy(importer);
        // cssUrls/load are stable per descriptor; nonce drives intentional reloads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryUrl, nonce]);

    return (
        <ModuleErrorBoundary
            key={nonce}
            moduleId={moduleId}
            renderFallback={() => <ErrorCard label={label} onRetry={() => setNonce((n) => n + 1)} />}
        >
            <Suspense fallback={<LoadingCard />}>
                <Lazy {...componentProps} />
            </Suspense>
        </ModuleErrorBoundary>
    );
}
