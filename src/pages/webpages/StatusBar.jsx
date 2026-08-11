import React from 'react';
import { Download, History } from 'lucide-react';
import SaveStatus from './SaveStatus';

const LANG_LABELS = { html: 'HTML', css: 'CSS', js: 'JavaScript' };

const EXT_LANG_LABEL = {
    html: 'HTML', htm: 'HTML',
    css: 'CSS',
    js: 'JavaScript', mjs: 'JavaScript',
    json: 'JSON',
    md: 'Markdown', markdown: 'Markdown',
    svg: 'SVG', xml: 'XML',
    ts: 'TypeScript', tsx: 'TypeScript',
    yml: 'YAML', yaml: 'YAML',
};

function labelForActiveFile(activeFile) {
    if (!activeFile) return null;
    if (typeof activeFile === 'string') return LANG_LABELS[activeFile] ?? 'Text';
    if (activeFile.kind === 'extra' && activeFile.path) {
        const ext = (activeFile.path.split('.').pop() || '').toLowerCase();
        return EXT_LANG_LABEL[ext] || 'Text';
    }
    return 'Text';
}

function fmtSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function StatusBar({
    activeFile,
    cursor,          // { line, col }
    fileSize,        // bytes
    saveState,       // 'idle' | 'saving' | 'saved' | 'error'
    lastSavedAt,
    onDownload,
    onVersions,
    onRetrySave,
}) {
    return (
        <div
            className="flex items-center shrink-0 px-2 gap-3 text-[11px] select-none"
            style={{ height: 22, background: 'var(--vsc-statusbar-bg)', color: 'var(--vsc-statusbar-fg)' }}
        >
            {/* Save state */}
            <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} onRetry={onRetrySave} size={11} />

            <span style={{ opacity: 0.4 }}>|</span>

            {/* Cursor / file metadata — hidden when no file is open */}
            {activeFile ? (
                <>
                    <span>Ln {cursor?.line ?? 1}, Col {cursor?.col ?? 1}</span>
                    <span>{labelForActiveFile(activeFile)}</span>
                    <span>{fmtSize(fileSize ?? 0)}</span>
                </>
            ) : (
                <span style={{ opacity: 0.85 }}>Preview · click a file to edit</span>
            )}

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
        </div>
    );
}
