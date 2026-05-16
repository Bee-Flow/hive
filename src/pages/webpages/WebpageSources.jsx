import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Globe, Type, Upload, Trash2, Loader2, AlertCircle,
    FileText, File, Table2, Link2, RotateCw, XCircle, Plus, X,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const SOURCE_META = {
    pdf: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'PDF', Icon: FileText },
    docx: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Word', Icon: FileText },
    xlsx: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Excel', Icon: Table2 },
    csv: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'CSV', Icon: Table2 },
    text: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', label: 'Text', Icon: FileText },
    url: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'URL', Icon: Link2 },
    file: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'File', Icon: File },
};

function api(path, opts = {}) {
    const url = `${API_BASE}/api/webpages${path}`;
    return authFetch(url, {
        headers: opts.body && typeof opts.body === 'string' ? { 'Content-Type': 'application/json', ...opts.headers } : opts.headers,
        ...opts,
    });
}

function SourceCard({ source, onDelete, onRetry, onCancel }) {
    const meta = SOURCE_META[source.type] || SOURCE_META.file;
    const { Icon } = meta;
    const isProcessing = source.status === 'processing';
    const isError = source.status === 'error';
    const isReady = source.status === 'ready';
    const canRetry = isError && (source.type === 'url' || !!source.storageKey);

    return (
        <div className="group relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all hover:shadow-sm"
             style={{
                 background: 'var(--bg-primary)',
                 borderColor: isError ? 'rgba(239,68,68,0.35)' : isProcessing ? 'rgba(251,191,36,0.3)' : 'var(--border-subtle)',
             }}>
            <div className="shrink-0 w-0.5 self-stretch rounded-full mt-0.5"
                 style={{ background: isError ? '#ef4444' : isProcessing ? '#fbbf24' : meta.color }} />
            <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                 style={{ background: meta.bg, color: meta.color }}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }} title={source.name}>
                    {source.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                    </span>
                    {isProcessing && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: '#92400e' }}>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing…
                        </span>
                    )}
                    {isReady && source.wordCount != null && (
                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                            {source.wordCount.toLocaleString()} words
                        </span>
                    )}
                    {isError && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: '#991b1b' }} title={source.error || ''}>
                            <AlertCircle className="w-2.5 h-2.5" /> Error
                        </span>
                    )}
                </div>
                {isError && source.error && (
                    <div className="text-[9px] mt-1 truncate" style={{ color: '#991b1b' }} title={source.error}>
                        {source.error}
                    </div>
                )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                {canRetry && (
                    <button onClick={() => onRetry(source.id)} className="p-1 rounded hover:bg-white/40" title="Retry">
                        <RotateCw className="w-3 h-3" style={{ color: '#3b82f6' }} />
                    </button>
                )}
                {isProcessing && (
                    <button onClick={() => onCancel(source.id)} className="p-1 rounded hover:bg-white/40" title="Cancel">
                        <XCircle className="w-3 h-3" style={{ color: '#92400e' }} />
                    </button>
                )}
                <button onClick={() => onDelete(source.id)} className="p-1 rounded hover:bg-white/40" title="Delete">
                    <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                </button>
            </div>
        </div>
    );
}

/**
 * Knowledge panel for a single webpage. Imported files, URLs, and pasted text
 * the AI can draw on as reference material. Backend table is still
 * `webpage_sources` — this is purely the user-facing rename.
 */
export default function WebpageSources({ webpageId, sources, onSourcesChange }) {
    const [adding, setAdding] = useState(null); // 'url' | 'text' | null
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [textName, setTextName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const refreshSources = useCallback(async () => {
        try {
            const res = await api(`/${webpageId}/sources`);
            if (!res.ok) return;
            const { sources: fresh } = await res.json();
            onSourcesChange(fresh || []);
        } catch (_) {}
    }, [webpageId, onSourcesChange]);

    // Adaptive polling: when any source is still processing (or has no terminal
    // status yet), re-fetch with exponential backoff. Stops as soon as every
    // source is in a terminal state ('ready'/'error') or the webpage changes.
    // Replaces the previous fixed setTimeout(refreshSources, 2000) which would
    // miss updates when ingestion took longer than 2s.
    useEffect(() => {
        const isTerminal = (s) => s?.status === 'ready' || s?.status === 'error';
        const pending = (sources || []).some(s => !isTerminal(s));
        if (!pending) return;
        let cancelled = false;
        let delay = 1000;
        const maxDelay = 16000;
        let timer = null;
        const tick = async () => {
            if (cancelled) return;
            await refreshSources();
            if (cancelled) return;
            // The next render will re-evaluate `pending` from the updated
            // sources prop; if anything is still processing it re-arms here.
            timer = setTimeout(tick, delay);
            delay = Math.min(delay * 2, maxDelay);
        };
        timer = setTimeout(tick, delay);
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [sources, refreshSources]);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setSubmitting(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/sources/file`, {
                method: 'POST', body: form,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Upload failed');
            }
            const { source } = await res.json();
            onSourcesChange([...sources, source]);
            // Background processing — poll once shortly to refresh.
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddUrl = async () => {
        if (!urlInput.trim()) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await api(`/${webpageId}/sources/url`, {
                method: 'POST', body: JSON.stringify({ url: urlInput.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add URL');
            }
            const { source } = await res.json();
            onSourcesChange([...sources, source]);
            setUrlInput('');
            setAdding(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddText = async () => {
        if (!textInput.trim()) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await api(`/${webpageId}/sources/text`, {
                method: 'POST',
                body: JSON.stringify({ text: textInput, name: textName.trim() || 'Pasted text' }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add text');
            }
            const { source } = await res.json();
            onSourcesChange([...sources, source]);
            setTextInput('');
            setTextName('');
            setAdding(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sid) => {
        if (!confirm('Remove this knowledge item?')) return;
        try {
            await api(`/${webpageId}/sources/${sid}`, { method: 'DELETE' });
            onSourcesChange(sources.filter(s => s.id !== sid));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRetry = async (sid) => {
        try {
            await api(`/${webpageId}/sources/${sid}/retry`, { method: 'POST' });
            onSourcesChange(sources.map(s => s.id === sid ? { ...s, status: 'processing', error: null } : s));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCancel = async (sid) => {
        try {
            await api(`/${webpageId}/sources/${sid}/cancel`, { method: 'POST' });
            await refreshSources();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>📚 Knowledge</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{sources.length}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium border hover:bg-white/40 disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        <Upload className="w-3 h-3" /> File
                    </button>
                    <button
                        onClick={() => setAdding(adding === 'url' ? null : 'url')}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium border hover:bg-white/40"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        <Globe className="w-3 h-3" /> URL
                    </button>
                    <button
                        onClick={() => setAdding(adding === 'text' ? null : 'text')}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium border hover:bg-white/40"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        <Type className="w-3 h-3" /> Text
                    </button>
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                       accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md"
                       onChange={handleFileUpload} />

                {adding === 'url' && (
                    <div className="mt-2 flex items-center gap-1">
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                            className="flex-1 px-2 py-1 text-[11px] rounded border outline-none"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={handleAddUrl} disabled={submitting}
                                className="px-2 py-1 rounded-md text-[10px] font-medium disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                            Add
                        </button>
                    </div>
                )}

                {adding === 'text' && (
                    <div className="mt-2 space-y-1">
                        <input
                            type="text"
                            placeholder="Name (e.g. 'Brand guidelines')"
                            value={textName}
                            onChange={(e) => setTextName(e.target.value)}
                            className="w-full px-2 py-1 text-[11px] rounded border outline-none"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <textarea
                            placeholder="Paste text content…"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            rows={4}
                            className="w-full px-2 py-1 text-[11px] rounded border outline-none resize-none"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={handleAddText} disabled={submitting || !textInput.trim()}
                                className="w-full px-2 py-1 rounded-md text-[10px] font-medium disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                            Add to knowledge
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mt-2 text-[10px] p-1.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#991b1b' }}>
                        {error}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1.5">
                {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            No knowledge yet
                        </div>
                        <div className="text-[10px] mt-1 max-w-[200px]" style={{ color: 'var(--text-tertiary)' }}>
                            Add a file, URL, or paste text — the AI can use it as reference and inspiration.
                        </div>
                    </div>
                ) : (
                    sources.map(s => (
                        <SourceCard
                            key={s.id}
                            source={s}
                            onDelete={handleDelete}
                            onRetry={handleRetry}
                            onCancel={handleCancel}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
