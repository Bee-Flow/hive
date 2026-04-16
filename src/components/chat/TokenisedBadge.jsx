/**
 * Tiny pill rendered under the user's message bubble when the server
 * tokenised PII (or other DLP-flagged content) before sending the message to
 * the LLM. Gives the user a quiet, specific, trustworthy signal that
 *
 *   1. something sensitive was detected,
 *   2. the AI only saw placeholders,
 *   3. the real values stayed on BeeFlow's servers / their own device.
 *
 * Click the pill → a small dropdown lists each flagged category with its count.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';

function formatCategoryCounts(categories = []) {
    if (!Array.isArray(categories) || categories.length === 0) return [];
    const counts = new Map();
    for (const c of categories) {
        const key = String(c || 'Sensitive data');
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export default function TokenisedBadge({ count = 0, categories = [] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!count || count < 1) return null;

    const breakdown = formatCategoryCounts(categories);
    const primaryLabel = breakdown[0]?.label;
    const summary = primaryLabel
        ? (count === 1 ? `1 ${primaryLabel.toLowerCase()} redacted` : `${count} items redacted`)
        : `${count} item${count === 1 ? '' : 's'} redacted`;

    return (
        <span ref={ref} className="relative inline-flex">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors"
                style={{
                    background: 'rgba(59, 130, 246, 0.10)',
                    color: 'rgb(29, 78, 216)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                }}
                title="This message contained sensitive data — only placeholders were sent to the AI."
            >
                <Lock className="w-2.5 h-2.5" />
                <span>{summary}</span>
            </button>
            {open && (
                <span
                    role="tooltip"
                    className="absolute right-0 top-full mt-1 z-50 w-60 rounded-lg border shadow-lg p-3 text-xs leading-relaxed"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                    <div className="flex items-start justify-between mb-1.5">
                        <span className="font-semibold">Sensitive data detected</span>
                        <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]" aria-label="Close">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Only placeholders like <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>[email_1]</code> were sent to the AI. The real values stay here.
                    </p>
                    {breakdown.length > 0 && (
                        <ul className="space-y-1">
                            {breakdown.map(({ label, count: n }) => (
                                <li key={label} className="flex items-center justify-between">
                                    <span>{label}</span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>×{n}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </span>
            )}
        </span>
    );
}
