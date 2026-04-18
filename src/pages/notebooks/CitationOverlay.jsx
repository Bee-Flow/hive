import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';

/* ── Citation Overlay — shows source name + chunk content ────── */
export default function CitationOverlay({ source, onClose }) {
    if (!source) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--brand-gradient)' }}>
                        <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {source.title}
                        </div>
                        {source.score > 0 && (
                            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                Relevance: {Math.round(source.score * 100)}%
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                        <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {source.content || 'No content preview available.'}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        Source #{source.index}
                    </span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 text-xs font-medium rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
