import { Workflow, Zap, Repeat } from 'lucide-react';
import React from 'react';
import { parseRefTokens, resolveChipLabel } from './refTokens';

/**
 * Read-only render of a bound-field value with step/trigger/loop references
 * shown as labelled chips (the human step NAME) instead of the raw id path.
 *
 * Display-only: it never mutates the value. Parents (BindingField /
 * TemplateField) overlay this on top of the real <input>/<textarea> while
 * the field is blurred, then reveal the raw text for editing on focus. The
 * overlay is pointer-events-none so clicks fall through to focus the input.
 *
 * Colours use only project tokens (--accent / --bg-* / --text-* /
 * --border-default) — never purple/violet/indigo (project rule).
 */
const SOURCE_ICON = { steps: Workflow, trigger: Zap, loop: Repeat };

export default function RefChips({ text, mode = 'expression', stepLabelById = null, className = '' }) {
    const tokens = parseRefTokens(text, { mode });
    return (
        <div className={`whitespace-pre-wrap break-words leading-[1.5] ${className}`} aria-hidden="true">
            {tokens.map((t, i) => {
                if (t.type === 'literal') {
                    return <span key={i} className="text-[var(--text-primary)]">{t.text}</span>;
                }
                const { name, suffix, missing } = resolveChipLabel(t, stepLabelById);
                const Icon = SOURCE_ICON[t.source] || Workflow;
                return (
                    <span
                        key={i}
                        title={missing ? `Step no longer exists — ${t.path}` : t.path}
                        className={`inline-flex items-center gap-1 align-middle mx-0.5 rounded px-1.5 py-0.5 text-[11px] border ${
                            missing
                                ? 'border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                                : 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                        }`}
                    >
                        <Icon size={10} className="shrink-0 opacity-70" />
                        <span className="font-medium">{name}</span>
                        {suffix && <span className="opacity-70">▸ {suffix}</span>}
                    </span>
                );
            })}
        </div>
    );
}
