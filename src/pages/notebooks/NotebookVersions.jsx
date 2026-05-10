import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    History, Clock, Save, Trash2, RotateCcw,
    X, Loader2, FileText, ChevronDown,
    Plus, Minus, Eye, GitCompare, Camera,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/* ── Diff engine ──────────────────────────────────────────────── */

function computeLineDiff(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');
    const m = oldLines.length, n = newLines.length;

    // LCS table
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = oldLines[i - 1] === newLines[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.unshift({ type: 'same', text: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'added', text: newLines[j - 1] });
            j--;
        } else {
            result.unshift({ type: 'removed', text: oldLines[i - 1] });
            i--;
        }
    }
    return result;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
}

function fullDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatSize(chars) {
    if (chars < 1000) return `${chars} chars`;
    if (chars < 1000000) return `${(chars / 1000).toFixed(1)}K chars`;
    return `${(chars / 1000000).toFixed(1)}M chars`;
}

const SUMMARY_STYLES = {
    'Auto-save':       { bg: 'rgba(100, 116, 139, 0.12)', color: 'rgb(148, 163, 184)', icon: Clock },
    'AI edit':         { bg: 'rgba(16, 185, 129, 0.12)',   color: 'rgb(52, 211, 153)',  icon: GitCompare },
    'Manual snapshot': { bg: 'rgba(59, 130, 246, 0.12)',   color: 'rgb(96, 165, 250)',  icon: Camera },
    'Before restore':  { bg: 'rgba(245, 158, 11, 0.12)',   color: 'rgb(251, 191, 36)',  icon: RotateCcw },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN OVERLAY COMPONENT                                        */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function NotebookVersions({
    notebookId,
    currentContent,
    onRestore,
    onClose,
}) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [selectedContent, setSelectedContent] = useState(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [creating, setCreating] = useState(false);
    const [viewMode, setViewMode] = useState('diff'); // 'diff' | 'preview'

    // Fetch versions
    const fetchVersions = useCallback(async () => {
        if (!notebookId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions`);
            const data = await res.json();
            setVersions(data.versions || []);
        } catch (e) { console.error('[Versions] Fetch failed:', e); }
        finally { setLoading(false); }
    }, [notebookId]);

    useEffect(() => { fetchVersions(); }, [fetchVersions]);

    // Load version content
    const handleSelect = useCallback(async (version) => {
        if (selectedVersion?.id === version.id) return;
        setSelectedVersion(version);
        setSelectedContent(null);
        setLoadingContent(true);
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions/${version.id}`);
            const data = await res.json();
            setSelectedContent(data.version?.content || '');
        } catch (e) {
            console.error('[Versions] Load failed:', e);
            setSelectedContent(null);
        } finally { setLoadingContent(false); }
    }, [notebookId, selectedVersion]);

    // Auto-select first version
    useEffect(() => {
        if (versions.length > 0 && !selectedVersion) {
            handleSelect(versions[0]);
        }
    }, [versions]);

    // Restore
    const handleRestore = useCallback(async () => {
        if (selectedContent === null) return;
        try {
            await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary: 'Before restore' }),
            });
        } catch (_) {}
        onRestore?.(selectedContent);
        onClose?.();
    }, [selectedContent, notebookId, onRestore, onClose]);

    // Manual snapshot
    const handleSnapshot = useCallback(async () => {
        if (!notebookId) return;
        setCreating(true);
        try {
            await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary: snapshotName.trim() || 'Manual snapshot' }),
            });
            setSnapshotName('');
            fetchVersions();
        } catch (e) { console.error('[Versions] Snapshot failed:', e); }
        finally { setCreating(false); }
    }, [notebookId, snapshotName, fetchVersions]);

    // Delete
    const handleDelete = useCallback(async (versionId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this version?')) return;
        try {
            await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions/${versionId}`, { method: 'DELETE' });
            if (selectedVersion?.id === versionId) {
                setSelectedVersion(null);
                setSelectedContent(null);
            }
            fetchVersions();
        } catch (e) { console.error('[Versions] Delete failed:', e); }
    }, [notebookId, selectedVersion, fetchVersions]);

    // Diff
    const diffLines = selectedContent !== null && viewMode === 'diff'
        ? computeLineDiff(selectedContent, currentContent || '')
        : null;

    const diffStats = diffLines ? {
        added: diffLines.filter(l => l.type === 'added').length,
        removed: diffLines.filter(l => l.type === 'removed').length,
    } : null;

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ animation: 'fadeIn .15s ease-out' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0"
                style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)' }}
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="relative flex flex-col overflow-hidden rounded-2xl shadow-2xl border"
                style={{
                    width: 'min(1100px, 92vw)',
                    height: 'min(700px, 85vh)',
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-default)',
                    animation: 'slideUp .2s ease-out',
                }}
            >
                {/* ── Top bar ── */}
                <div
                    className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                >
                    <div className="flex items-center gap-2 flex-1">
                        <div
                            className="w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                        >
                            <History className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                Version History
                            </h2>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {versions.length} version{versions.length !== 1 ? 's' : ''} saved
                            </p>
                        </div>
                    </div>

                    {/* Snapshot bar */}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={snapshotName}
                            onChange={e => setSnapshotName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSnapshot(); }}
                            placeholder="Snapshot name..."
                            className="px-3 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] outline-none w-[180px] focus:border-[var(--accent-primary)] transition-colors"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                        <button
                            onClick={handleSnapshot}
                            disabled={creating}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)', color: 'white' }}
                        >
                            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                            Snapshot
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors ml-1"
                    >
                        <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                </div>

                {/* ── Body: split layout ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ── Left: Version List ── */}
                    <div
                        className="w-[280px] shrink-0 border-r flex flex-col overflow-hidden"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                    >
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    <History className="w-7 h-7" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                </div>
                                <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                    No versions yet.<br />
                                    Versions are auto-saved as you edit, or save a snapshot manually.
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto py-1">
                                {versions.map((v) => {
                                    const isSelected = selectedVersion?.id === v.id;
                                    const style = SUMMARY_STYLES[v.summary] || SUMMARY_STYLES['Manual snapshot'];
                                    const Icon = style.icon;

                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => handleSelect(v)}
                                            className="w-full text-left px-3 py-3 flex items-start gap-2.5 transition-all group relative"
                                            style={{
                                                background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                                            }}
                                        >
                                            {/* Active indicator */}
                                            {isSelected && (
                                                <div
                                                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                                                    style={{ background: 'rgb(139, 92, 246)' }}
                                                />
                                            )}

                                            {/* Icon */}
                                            <div
                                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                style={{ background: style.bg }}
                                            >
                                                <Icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="text-[11px] font-semibold truncate"
                                                        style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                                    >
                                                        {v.summary || 'Version'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                    <span>{timeAgo(v.createdAt)}</span>
                                                    <span style={{ opacity: 0.4 }}>·</span>
                                                    <span>{formatSize(v.contentLength)}</span>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => handleDelete(v.id, e)}
                                                className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                                                title="Delete version"
                                            >
                                                <Trash2 className="w-3 h-3" style={{ color: 'rgb(239, 68, 68)' }} />
                                            </button>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Right: Diff / Preview ── */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {selectedVersion ? (
                            <>
                                {/* Toolbar */}
                                <div
                                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b"
                                    style={{ borderColor: 'var(--border-subtle)' }}
                                >
                                    {/* View toggle */}
                                    <div
                                        className="flex items-center rounded-lg overflow-hidden border"
                                        style={{ borderColor: 'var(--border-default)' }}
                                    >
                                        {[
                                            { key: 'diff', label: 'Diff', icon: GitCompare },
                                            { key: 'preview', label: 'Preview', icon: Eye },
                                        ].map(({ key, label, icon: Ic }) => (
                                            <button
                                                key={key}
                                                onClick={() => setViewMode(key)}
                                                className="px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                                                style={{
                                                    background: viewMode === key ? 'rgb(139, 92, 246)' : 'transparent',
                                                    color: viewMode === key ? 'white' : 'var(--text-tertiary)',
                                                }}
                                            >
                                                <Ic className="w-3 h-3" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Diff stats */}
                                    {diffStats && viewMode === 'diff' && (
                                        <div className="flex items-center gap-3 ml-2 text-[10px] font-mono font-semibold">
                                            <span className="flex items-center gap-1" style={{ color: 'rgb(34, 197, 94)' }}>
                                                <Plus className="w-3 h-3" />
                                                {diffStats.added}
                                            </span>
                                            <span className="flex items-center gap-1" style={{ color: 'rgb(239, 68, 68)' }}>
                                                <Minus className="w-3 h-3" />
                                                {diffStats.removed}
                                            </span>
                                        </div>
                                    )}

                                    {/* Version info */}
                                    <div className="flex-1 text-right">
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {fullDate(selectedVersion.createdAt)}
                                        </span>
                                    </div>

                                    {/* Restore */}
                                    <button
                                        onClick={handleRestore}
                                        disabled={loadingContent}
                                        className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                        style={{ background: 'rgb(34, 197, 94)', color: 'white' }}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Restore this version
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-auto">
                                    {loadingContent ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    ) : viewMode === 'diff' && diffLines ? (
                                        <div className="font-mono text-[11px] leading-[1.7]">
                                            {diffLines.map((line, idx) => {
                                                const isDiff = line.type !== 'same';
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex"
                                                        style={{
                                                            background:
                                                                line.type === 'added' ? 'rgba(34, 197, 94, 0.08)' :
                                                                line.type === 'removed' ? 'rgba(239, 68, 68, 0.08)' :
                                                                'transparent',
                                                            borderLeft: isDiff
                                                                ? `3px solid ${line.type === 'added' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}`
                                                                : '3px solid transparent',
                                                        }}
                                                    >
                                                        {/* Line number gutter */}
                                                        <span
                                                            className="w-10 shrink-0 text-right pr-2 select-none"
                                                            style={{
                                                                color: isDiff
                                                                    ? (line.type === 'added' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)')
                                                                    : 'var(--text-muted)',
                                                                opacity: isDiff ? 1 : 0.4,
                                                                background: isDiff
                                                                    ? (line.type === 'added' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)')
                                                                    : 'transparent',
                                                            }}
                                                        >
                                                            {idx + 1}
                                                        </span>

                                                        {/* +/- indicator */}
                                                        <span
                                                            className="w-5 shrink-0 text-center select-none font-bold"
                                                            style={{
                                                                color:
                                                                    line.type === 'added' ? 'rgb(34, 197, 94)' :
                                                                    line.type === 'removed' ? 'rgb(239, 68, 68)' :
                                                                    'transparent',
                                                            }}
                                                        >
                                                            {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                                                        </span>

                                                        {/* Content */}
                                                        <span
                                                            className="flex-1 px-2 whitespace-pre-wrap break-all"
                                                            style={{
                                                                color:
                                                                    line.type === 'added' ? 'rgb(74, 222, 128)' :
                                                                    line.type === 'removed' ? 'rgb(248, 113, 113)' :
                                                                    'var(--text-secondary)',
                                                            }}
                                                        >
                                                            {line.text || '\u00A0'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* Preview mode */
                                        <div className="p-6 max-w-[700px] mx-auto">
                                            <pre
                                                className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {selectedContent || '(empty)'}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* No version selected */
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    <FileText className="w-8 h-8" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                </div>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Select a version to compare
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
