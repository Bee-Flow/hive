import React, { useState } from 'react';
import { Sparkles, ChevronDown, Loader2 } from 'lucide-react';
import MarkdownRenderer from '../../../components/MarkdownRenderer';

const TEMPLATES = [
    { id: 'general', label: 'General meeting' },
    { id: 'standup', label: 'Stand-up' },
    { id: 'sales', label: 'Sales call' },
    { id: 'interview', label: 'Interview' },
    { id: 'retrospective', label: 'Retrospective' },
];

export default function SummaryView({ summary, onRegenerate, regenerating }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Summary</h2>
                {onRegenerate && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMenuOpen((o) => !o)}
                            disabled={regenerating}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Regenerate
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border shadow-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                {TEMPLATES.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => { setMenuOpen(false); onRegenerate(t.id); }}
                                        className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto rounded-xl border px-4 py-3" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                {summary ? (
                    <MarkdownRenderer content={summary} />
                ) : (
                    <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                        No summary yet.
                    </div>
                )}
            </div>
        </div>
    );
}
