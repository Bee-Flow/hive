import { Database, LayoutTemplate, Wrench } from 'lucide-react';
import React from 'react';

/**
 * App Studio — quick-action chips above the AI composer.
 *
 * Each chip seeds a SCOPED prompt and hands it to the pane's send flow (which
 * threads the current selection/screen/bound-table as context). "Fix errors"
 * only lights up when the last validation found issues. These are shortcuts —
 * the same turn machinery (streamLock / commitTurn) runs underneath.
 *
 * Chips are small, targeted asks — never big enough to warrant the plan-first
 * flow — so they force `planMode:'never'` to skip straight to building.
 *
 * The row lives in a ~340px pane: chips WRAP rather than scroll, and their
 * labels stay short (the full wording is the tooltip) so "Fix errors" — the
 * one chip a stuck user is looking for — can never be pushed out of sight.
 */

const ACTIONS = [
    {
        id: 'wire-data',
        label: 'Use my data',
        title: 'Connect the selected component to data from one of this app\'s tables',
        icon: Database,
        prompt: 'Wire the selected component to real data from one of this app\'s tables, creating the binding it needs.',
    },
    {
        id: 'generate-screen',
        label: 'New screen',
        title: 'Design and add a new screen that fits what this app already does',
        icon: LayoutTemplate,
        prompt: 'Design and add a new screen to this app that fits what it already does, with sensible components.',
    },
];

export default function QuickActions({ onAction, disabled = false, hasErrors = false }) {
    const trigger = (prompt) => {
        if (disabled) return;
        onAction?.(prompt, { planMode: 'never' });
    };

    const fixChip = (
        <button
            key="fix-errors"
            type="button"
            disabled={disabled || !hasErrors}
            onClick={() => trigger('Fix the validation errors in this app so it passes checks, without removing working features.')}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
            style={{
                borderColor: hasErrors ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-default)',
                color: hasErrors ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
            title={hasErrors ? 'Ask the AI to fix the current issues' : 'No issues to fix'}
        >
            <Wrench className="h-3.5 w-3.5" style={{ color: hasErrors ? '#f59e0b' : 'var(--text-tertiary)' }} aria-hidden="true" />
            Fix errors
        </button>
    );

    return (
        <div
            className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-2 py-1.5"
            style={{ borderColor: 'var(--border-default)' }}
            data-quick-actions=""
        >
            {/* Something is broken → the repair chip leads the row. */}
            {hasErrors ? fixChip : null}
            {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                    <button
                        key={a.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => trigger(a.prompt)}
                        title={a.title}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                        {a.label}
                    </button>
                );
            })}
            {hasErrors ? null : fixChip}
        </div>
    );
}
