import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { EXPR_FUNCTIONS, EXPR_OPERATOR_GROUPS } from './exprFunctions';

/**
 * Collapsible "Syntax help" for the restricted expression grammar.
 *
 * Extracted from ConditionBuilder's `RawExpression`, which was the only place
 * in the builder that explained expressions at all. Node parameter fields
 * offered an expression mode with no tooltip, no legend, and no hint about
 * what could go in it, so users had no way to learn the feature existed, let
 * alone how to use it (BFSF-321).
 *
 * `EXPR_FUNCTIONS` comes from the shared engine metadata (`@shared/expr`), so
 * this list can't drift from what the evaluator actually accepts.
 */
export function ExpressionHelpBody() {
    return (
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-2 space-y-1 text-[10px] text-[var(--text-secondary)]">
            <div className="font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Functions</div>
            {EXPR_FUNCTIONS.map(f => (
                <div key={f.name}>
                    <code className="text-[var(--text-primary)]">{f.signature}</code> — {f.description}
                </div>
            ))}
            <div className="font-semibold uppercase tracking-wide text-[var(--text-tertiary)] pt-1">Operators</div>
            {EXPR_OPERATOR_GROUPS.map(g => (
                <div key={g.label}>
                    <span className="text-[var(--text-tertiary)]">{g.label}:</span>{' '}
                    <code className="text-[var(--text-primary)]">{g.ops}</code>
                </div>
            ))}
        </div>
    );
}

/**
 * The help body behind its own disclosure toggle. Use this where there is no
 * existing toggle to hang the body off (ConditionBuilder has its own, so it
 * renders `ExpressionHelpBody` directly).
 */
export default function ExpressionHelp({ defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="space-y-1">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Syntax help
            </button>
            {open && <ExpressionHelpBody />}
        </div>
    );
}
