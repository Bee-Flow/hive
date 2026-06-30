/**
 * CitationChips — renders the knowledge-base sources attached to an assistant
 * message (msg.kbSources, delivered via the `kb_sources` SSE event) as small
 * clickable pills. Clicking one opens the existing CitationOverlay through the
 * page's onCitationClick handler. Purely a presentation of data already present.
 */
import React from 'react';
import { FileText } from 'lucide-react';

export default function CitationChips({ sources, onCitationClick, t }) {
    if (!sources?.length) return null;
    const tt = (k, fb, p) => { const v = t ? t(k, fb, p) : null; return v != null ? v : fb; };
    return (
        <div className="flex flex-wrap gap-1.5 mt-1.5" role="list" aria-label={tt('notebooks.sources', 'Sources')}>
            {sources.map((s, i) => {
                const label = s.title || `${tt('notebooks.source', 'Source')} ${i + 1}`;
                return (
                    <button
                        key={i}
                        role="listitem"
                        onClick={() => onCitationClick?.({ ...s, index: i + 1 })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors hover:bg-[var(--accent-primary)]/10"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                        title={label}
                        aria-label={label}
                    >
                        <FileText className="w-2.5 h-2.5 shrink-0" strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />
                        <span className="truncate max-w-[150px]">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
