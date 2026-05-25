import { Pin, PinOff, Copy as CopyIcon, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';
import JsonTree from './JsonTree';

/**
 * Inputs sub-tab of the Run view. Shows the resolved input the step was
 * called with on its most recent run, plus a "Pin as sample" affordance
 * so the user can keep a known-good payload while iterating on settings.
 *
 * Phase 1: pinned samples live in scopedStorage (per-step, per-user). A
 * Phase 2 follow-up persists them to `step._debug.sampleInput` so they
 * sync to the draft definition and follow the automation across users.
 *
 * Props:
 *   stepId        — current step id (used to scope the copy-path basePath)
 *   liveInput     — the input from the most recent run (or null)
 *   pinnedInput   — the user-pinned snapshot (or null)
 *   onPin(value)  — pin a snapshot
 *   onClearPin()  — drop the pinned snapshot
 *   onCopyPath(p) — clipboard hook for "copy path as binding"
 */
export default function StepInputsTab({
    stepId,
    liveInput,
    pinnedInput,
    onPin,
    onClearPin,
    onCopyPath,
}) {
    // When a pin exists, prefer it as the view source. Users can flip
    // back to "live" to re-anchor against the most recent run.
    const [source, setSource] = useState(pinnedInput ? 'pinned' : 'live');
    const shownValue = source === 'pinned' && pinnedInput ? pinnedInput : liveInput;
    const basePath = stepId ? `steps.${stepId}.input` : '';

    const canPin = liveInput != null;
    const hasPin = pinnedInput != null;

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
                <SourceToggle source={source} setSource={setSource} hasPin={hasPin} />
                <div className="flex-1" />
                {canPin && (
                    <button
                        type="button"
                        onClick={() => onPin?.(liveInput)}
                        title={hasPin ? 'Re-pin from the latest run' : 'Pin this input so it sticks across runs'}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    >
                        <Pin size={11} />
                        <span>{hasPin ? 'Re-pin' : 'Pin as sample'}</span>
                    </button>
                )}
                {hasPin && (
                    <button
                        type="button"
                        onClick={onClearPin}
                        title="Drop the pinned sample"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    >
                        <PinOff size={11} />
                    </button>
                )}
            </div>
            {shownValue == null ? (
                <EmptyState source={source} />
            ) : (
                <JsonTree
                    value={shownValue}
                    basePath={basePath}
                    onCopyPath={onCopyPath}
                    emptyMessage="No input recorded for this step."
                />
            )}
            <footer className="px-3 py-1.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                <CopyIcon size={10} />
                Hover any field to copy its binding path.
            </footer>
        </div>
    );
}

function SourceToggle({ source, setSource, hasPin }) {
    return (
        <div className="inline-flex items-center rounded border border-[var(--border-default)] overflow-hidden text-[10px]">
            <button
                type="button"
                onClick={() => setSource('live')}
                className={`px-2 py-0.5 ${source === 'live'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
            >
                Live
            </button>
            <button
                type="button"
                onClick={() => setSource('pinned')}
                disabled={!hasPin}
                title={hasPin ? '' : 'Nothing pinned yet'}
                className={`px-2 py-0.5 ${source === 'pinned'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed'}`}
            >
                Pinned
            </button>
        </div>
    );
}

function EmptyState({ source }) {
    return (
        <div className="flex-1 flex items-center justify-center px-6 py-12 text-[11px] text-[var(--text-tertiary)] text-center">
            {source === 'pinned' ? (
                <span className="flex items-center gap-1.5">
                    <RotateCcw size={12} />
                    No pinned sample. Flip back to Live or run the step first.
                </span>
            ) : (
                <span>No input recorded yet. Run or dry-run this step to capture one.</span>
            )}
        </div>
    );
}
