import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import MarkdownRenderer from '../../../../MarkdownRenderer';

/**
 * Compact "what this automation does" affordance for the header title row: an
 * info button that opens a popover with the AI-authored markdown summary, so the
 * summary no longer takes a permanent row above the canvas.
 */
export default function AutomationSummary({ label, text }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [open]);
    if (!text || !text.trim()) return null;
    return (
        <div ref={ref} className="relative flex-shrink-0">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                title={label}
                aria-label={label}
                aria-expanded={open}
                className={`p-1 rounded-lg transition ${open ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
            >
                <Info size={15} />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-40 w-[440px] max-w-[80vw] max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-3 custom-scrollbar">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">{label}</div>
                    <MarkdownRenderer content={text} className="text-xs leading-snug text-[var(--text-secondary)] [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs" />
                </div>
            )}
        </div>
    );
}
