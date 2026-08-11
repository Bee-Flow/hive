import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    History, Clock, Save, Trash2, RotateCcw,
    X, Loader2, FileText, ChevronDown,
    Plus, Minus, Eye, GitCompare, Camera, AlertCircle,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import useTranslation from '../../hooks/useTranslation';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatRelativeTime } from '../../utils/dateFormatters';

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

// `undefined` = the browser's locale. Hardcoding 'en-US' rendered every version
// timestamp in US format for Dutch users, right next to a locale-aware relative
// time on the same row.
function fullDate(dateStr) {
    return new Date(dateStr).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatSize(chars, t) {
    if (chars < 1000) return t('notebooks.version_size_chars', { count: chars });
    if (chars < 1000000) return t('notebooks.version_size_kchars', { count: (chars / 1000).toFixed(1) });
    return t('notebooks.version_size_mchars', { count: (chars / 1000000).toFixed(1) });
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
    const { t } = useTranslation();
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [selectedContent, setSelectedContent] = useState(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [creating, setCreating] = useState(false);
    const [viewMode, setViewMode] = useState('diff'); // 'diff' | 'preview'
    // Error states — surface failed fetches instead of leaving the modal in
    // a half-loading state with nothing but a console.error trail.
    const [fetchError, setFetchError] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [restoreError, setRestoreError] = useState(null);
    const [restoring, setRestoring] = useState(false);
    // Confirmation dialogs (replace the no-confirm restore + the native confirm()).
    const [pendingRestore, setPendingRestore] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    // Fetch versions
    const fetchVersions = useCallback(async () => {
        if (!notebookId) return;
        setLoading(true);
        setFetchError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setVersions(data.versions || []);
        } catch (e) {
            console.error('[Versions] Fetch failed:', e);
            setFetchError(e.message || 'Failed to load versions');
        } finally { setLoading(false); }
    }, [notebookId]);

    useEffect(() => { fetchVersions(); }, [fetchVersions]);

    // Load version content. Extracted helper so the retry button can re-run
    // a load against the already-selected version without bumping ids.
    const loadVersionContent = useCallback(async (versionId) => {
        setSelectedContent(null);
        setLoadError(null);
        setLoadingContent(true);
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions/${versionId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setSelectedContent(data.version?.content || '');
        } catch (e) {
            console.error('[Versions] Load failed:', e);
            setSelectedContent(null);
            setLoadError(e.message || 'Failed to load version content');
        } finally { setLoadingContent(false); }
    }, [notebookId]);

    const handleSelect = useCallback(async (version) => {
        if (selectedVersion?.id === version.id) return;
        setSelectedVersion(version);
        await loadVersionContent(version.id);
    }, [selectedVersion, loadVersionContent]);

    // Auto-select first version. handleSelect and selectedVersion are in the
    // deps so React's lint rule passes; the `!selectedVersion` guard prevents
    // re-selecting an already-loaded version.
    useEffect(() => {
        if (versions.length > 0 && !selectedVersion) {
            handleSelect(versions[0]);
        }
    }, [versions, selectedVersion, handleSelect]);

    // Restore. Awaits the pre-restore snapshot AND the parent's restore call so
    // we can surface failures instead of silently dismissing the modal.
    const handleRestore = useCallback(async () => {
        if (selectedContent === null) return;
        setRestoring(true);
        setRestoreError(null);
        try {
            // Pre-restore snapshot. The dialog promises the current document is
            // saved first, so this must NOT be best-effort: send the live
            // content (the server would otherwise snapshot the last persisted
            // value, losing anything inside the save debounce) and abort the
            // restore if it fails — the response status used to be ignored, so
            // a 400 on an empty notebook passed silently for the whole flow.
            const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary: 'Before restore', content: currentContent || undefined }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || t('notebooks.restore_snapshot_failed', 'Could not snapshot the current document — restore cancelled.'));
            }
            await Promise.resolve(onRestore?.(selectedContent));
            onClose?.();
        } catch (e) {
            console.error('[Versions] Restore failed:', e);
            setRestoreError(e.message || t('notebooks.restore_failed', 'Restore failed'));
        } finally {
            setRestoring(false);
        }
    }, [selectedContent, currentContent, notebookId, onRestore, onClose, t]);

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

    // Delete — confirmed via <ConfirmDialog/> (pendingDeleteId), not window.confirm.
    const performDelete = useCallback(async (versionId) => {
        try {
            await authFetch(`${API_BASE}/api/notebooks/${notebookId}/versions/${versionId}`, { method: 'DELETE' });
            if (selectedVersion?.id === versionId) {
                setSelectedVersion(null);
                setSelectedContent(null);
            }
            fetchVersions();
        } catch (e) { console.error('[Versions] Delete failed:', e); }
    }, [notebookId, selectedVersion, fetchVersions]);

    // Diff. Memoized: computeLineDiff is an O(m·n) LCS that allocates a full
    // (m+1)×(n+1) table, and this ran on EVERY render — including every
    // keystroke in the "Snapshot name" input.
    const diffLines = useMemo(() => (
        selectedContent !== null && viewMode === 'diff'
            ? computeLineDiff(selectedContent, currentContent || '')
            : null
    ), [selectedContent, currentContent, viewMode]);

    const diffStats = useMemo(() => (diffLines ? {
        added: diffLines.filter(l => l.type === 'added').length,
        removed: diffLines.filter(l => l.type === 'removed').length,
    } : null), [diffLines]);

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
                            maxLength={100}
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
                        ) : fetchError ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                                <AlertCircle className="w-6 h-6" style={{ color: 'rgb(239,68,68)' }} />
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                    {t('notebooks.load_versions_failed')}
                                </p>
                                <button
                                    onClick={fetchVersions}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                                >
                                    {t('notebooks.retry')}
                                </button>
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
                                                    style={{ background: 'var(--accent-primary)' }}
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
                                                    <span>{formatRelativeTime(v.createdAt)}</span>
                                                    <span style={{ opacity: 0.4 }}>·</span>
                                                    <span>{formatSize(v.contentLength, t)}</span>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setPendingDeleteId(v.id); }}
                                                className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                                                title={t('notebooks.delete', 'Delete')}
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
                                                    background: viewMode === key ? 'var(--accent-primary)' : 'transparent',
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
                                        onClick={() => setPendingRestore(true)}
                                        disabled={loadingContent || restoring}
                                        className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                        style={{ background: 'rgb(34, 197, 94)', color: 'white' }}
                                    >
                                        {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                        {t('notebooks.restore_this_version', 'Restore this version')}
                                    </button>
                                </div>
                                {restoreError && (
                                    <div
                                        className="shrink-0 flex items-center gap-2 px-4 py-2 text-[11px] font-medium border-b"
                                        style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)', borderColor: 'var(--border-subtle)' }}
                                    >
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span className="flex-1">{t('notebooks.restore_failed')}</span>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 overflow-auto">
                                    {loadingContent ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    ) : loadError ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                                            <AlertCircle className="w-6 h-6" style={{ color: 'rgb(239,68,68)' }} />
                                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                {t('notebooks.load_version_content_failed')}
                                            </p>
                                            <button
                                                onClick={() => selectedVersion && loadVersionContent(selectedVersion.id)}
                                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                                            >
                                                {t('notebooks.retry')}
                                            </button>
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

            {/* Restore confirmation — overwrites the current document */}
            <ConfirmDialog
                open={pendingRestore}
                title={t('notebooks.confirm_restore_title', 'Restore this version?')}
                description={t('notebooks.confirm_restore_body', 'This replaces the current document with the selected version. A snapshot of the current document is saved first, so you can undo it.')}
                confirmLabel={t('notebooks.restore', 'Restore')}
                cancelLabel={t('notebooks.cancel', 'Cancel')}
                onConfirm={async () => { await handleRestore(); setPendingRestore(false); }}
                onCancel={() => setPendingRestore(false)}
            />

            {/* Delete-version confirmation */}
            <ConfirmDialog
                open={pendingDeleteId != null}
                title={t('notebooks.confirm_delete_version_title', 'Delete version?')}
                description={t('notebooks.confirm_delete_version_body', "This permanently removes the snapshot. This can't be undone.")}
                confirmLabel={t('notebooks.delete', 'Delete')}
                cancelLabel={t('notebooks.cancel', 'Cancel')}
                destructive
                onConfirm={async () => { const id = pendingDeleteId; setPendingDeleteId(null); await performDelete(id); }}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    );
}
