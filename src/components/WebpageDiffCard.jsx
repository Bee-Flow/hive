import React, { useState } from 'react';
import { ChevronRight, FileCode2, Palette, Cpu } from 'lucide-react';

const FILE_META = {
    html: { label: 'index.html', Icon: FileCode2 },
    css:  { label: 'style.css',  Icon: Palette },
    js:   { label: 'script.js',  Icon: Cpu },
};

/**
 * Compact post-edit diff card rendered below an assistant message in the
 * Webpages chat. Shows filename, +X −Y summary, and an expandable list of
 * hunks. Purely informational — the change is already applied to the editor.
 */
export default function WebpageDiffCard({ file, diff }) {
    const [open, setOpen] = useState(false);

    const meta = FILE_META[file] || FILE_META.html;
    const Icon = meta.Icon;
    const noChange = !diff || diff.summary === 'no change';

    return (
        <div
            className="my-1.5 rounded-lg border text-[12px]"
            style={{ borderColor: 'var(--vsc-border, var(--border-subtle))', background: 'var(--vsc-sidebar-bg, var(--bg-secondary))' }}
        >
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                style={{ color: 'var(--vsc-fg, var(--text-primary))' }}
            >
                <ChevronRight
                    size={12}
                    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .12s' }}
                />
                <Icon size={13} />
                <span className="font-mono truncate">{meta.label}</span>
                <span
                    className="ml-auto font-mono text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                        color: noChange ? 'var(--vsc-fg-muted, var(--text-tertiary))' : '#fff',
                        background: noChange ? 'transparent' : (diff.added > 0 && diff.removed === 0
                            ? 'rgba(22,163,74,0.85)'
                            : diff.removed > 0 && diff.added === 0
                                ? 'rgba(220,38,38,0.85)'
                                : 'rgba(2,132,199,0.85)'),
                    }}
                >
                    {diff?.summary || '—'}
                </span>
            </button>
            {open && diff?.hunks && diff.hunks.length > 0 && (
                <div
                    className="border-t font-mono text-[11px] overflow-x-auto"
                    style={{ borderColor: 'var(--vsc-border, var(--border-subtle))', background: 'var(--vsc-editor-bg, var(--bg-primary))' }}
                >
                    {diff.hunks.map((h, i) => {
                        const sigil = h.type === 'add' ? '+' : h.type === 'remove' ? '-' : h.type === 'gap' ? ' ' : ' ';
                        const bg = h.type === 'add'
                            ? 'rgba(22,163,74,0.12)'
                            : h.type === 'remove'
                                ? 'rgba(220,38,38,0.12)'
                                : 'transparent';
                        const fg = h.type === 'add'
                            ? 'rgb(22,101,52)'
                            : h.type === 'remove'
                                ? 'rgb(153,27,27)'
                                : h.type === 'gap'
                                    ? 'var(--vsc-fg-muted, var(--text-tertiary))'
                                    : 'var(--vsc-fg, var(--text-primary))';
                        return (
                            <div
                                key={i}
                                className="px-2.5 py-0.5 whitespace-pre"
                                style={{ background: bg, color: fg }}
                            >
                                {sigil}  {h.text === '' ? ' ' : h.text}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
