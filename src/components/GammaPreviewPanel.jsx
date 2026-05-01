import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

function toGammaEmbedUrl(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host !== 'gamma.app') return null;

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' && parts[1]) return parsed.toString();
        if (parts[0] === 'docs' && parts[1]) {
            parsed.pathname = `/embed/${parts.slice(1).join('/')}`;
            parsed.search = '';
            return parsed.toString();
        }
    } catch {
        return null;
    }
    return null;
}

export default function GammaPreviewPanel({ preview, onClose, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const generationId = preview?.generationId || '';
    const status = (preview?.status || (generationId ? 'pending' : '')).toLowerCase();
    const gammaUrl = preview?.gammaUrl || '';
    const embedUrl = useMemo(() => toGammaEmbedUrl(gammaUrl), [gammaUrl]);
    const isReady = embedUrl && (!generationId || ['completed', 'complete', 'succeeded', 'done'].includes(status));
    const isFailed = ['failed', 'error'].includes(status);
    const isPending = generationId && !isReady && !isFailed;

    const refreshStatus = async () => {
        if (!generationId) return;
        setLoading(true);
        setError('');
        try {
            const res = await authFetch(`${API_BASE}/integrations/gamma/generations/${encodeURIComponent(generationId)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Gamma status check failed (${res.status})`);
            onUpdate?.({ ...preview, ...data });
        } catch (err) {
            setError(err.message || 'Could not refresh Gamma status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isPending) return undefined;
        const id = setInterval(refreshStatus, 7000);
        return () => clearInterval(id);
    }, [isPending, generationId, status]);

    useEffect(() => {
        if (isPending) {
            refreshStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generationId, status]);

    return (
        <section className="flex flex-col h-full bg-[var(--bg-primary)] border-l border-[var(--border-subtle)]">
            <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">Gamma Preview</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {isReady ? 'Live Gamma document' : generationId ? `Generation ${status || 'pending'}` : 'No Gamma selected'}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isReady && (
                        <a
                            href={gammaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                            title="Open Gamma in new tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                    {isPending && (
                        <button
                            type="button"
                            onClick={refreshStatus}
                            disabled={loading}
                            className="p-2 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-50"
                            title="Refresh Gamma status"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                        title="Close preview"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0 bg-[var(--bg-primary)]">
                {isReady ? (
                    <iframe
                        title="Gamma preview"
                        src={embedUrl}
                        className="w-full h-full border-0 bg-white"
                        allow="fullscreen"
                        allowFullScreen
                    />
                ) : (
                    <div className="h-full flex items-center justify-center p-6">
                        <div className="max-w-sm text-center">
                            {isPending && (
                                <RefreshCw className="w-6 h-6 mx-auto mb-4 animate-spin text-[var(--text-tertiary)]" />
                            )}
                            <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                                {isFailed ? 'Gamma generation failed' : 'Gamma is being generated'}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {isFailed
                                    ? (preview?.error || 'Gamma reported a failed generation.')
                                    : 'The preview will appear here as soon as Gamma reports the generation is complete.'}
                            </p>
                            {gammaUrl && !isReady && (
                                <a
                                    href={gammaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-blue-600 hover:underline"
                                >
                                    Open generating Gamma
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                            {generationId && (
                                <div className="mt-4 text-[11px] font-mono text-[var(--text-tertiary)] break-all">
                                    {generationId}
                                </div>
                            )}
                            {error && <div className="mt-3 text-xs text-red-500">{error}</div>}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
