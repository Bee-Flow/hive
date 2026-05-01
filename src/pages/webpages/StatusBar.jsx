import React from 'react';
import { Sun, Moon, Download, History, AlertCircle, Loader2, Check } from 'lucide-react';

const LANG_LABELS = { html: 'HTML', css: 'CSS', js: 'JavaScript' };

function fmtSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtTime(date) {
    if (!date) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export default function StatusBar({
    theme, onThemeToggle,
    activeFile,
    cursor,          // { line, col }
    fileSize,        // bytes
    saveState,       // 'idle' | 'saving' | 'saved' | 'error'
    lastSavedAt,
    onDownload,
    onVersions,
}) {
    return (
        <div
            className="flex items-center shrink-0 px-2 gap-3 text-[11px] select-none"
            style={{ height: 22, background: 'var(--vsc-statusbar-bg)', color: 'var(--vsc-statusbar-fg)' }}
        >
            {/* Save state */}
            <span className="flex items-center gap-1">
                {saveState === 'saving' && <><Loader2 size={10} className="animate-spin" /> Saving…</>}
                {saveState === 'error'  && <><AlertCircle size={10} /> Save failed</>}
                {saveState === 'saved'  && <><Check size={10} /> Saved {fmtTime(lastSavedAt)}</>}
            </span>

            <span style={{ opacity: 0.4 }}>|</span>

            {/* Cursor */}
            <span>Ln {cursor?.line ?? 1}, Col {cursor?.col ?? 1}</span>

            {/* Language */}
            <span>{LANG_LABELS[activeFile] ?? 'HTML'}</span>

            {/* File size */}
            <span>{fmtSize(fileSize ?? 0)}</span>

            {/* Spacer */}
            <span className="flex-1" />

            {/* Actions */}
            <button
                onClick={onVersions}
                className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                title="Version history"
            >
                <History size={12} /> History
            </button>

            <button
                onClick={onDownload}
                className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                title="Download as ZIP"
            >
                <Download size={12} /> ZIP
            </button>

            {/* Theme toggle */}
            <button
                onClick={onThemeToggle}
                className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
                {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </button>
        </div>
    );
}
