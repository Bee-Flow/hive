import React, { useState } from 'react';
import AppIcon from '../../../AppIcon';
import { FieldRow } from '../fields';

/**
 * SpacingStepper — rhythm-scale control for block padding (Style tab).
 *
 * Replaces the free-text SpacingRow inputs. Storage format is UNCHANGED:
 * each step writes the same verbatim CSS string the renderer consumes
 * ('3rem', '0', …); "Default" removes the key (empty → the caller deletes
 * it, falling back to the site's section rhythm).
 *
 * Back-compat: a stored value matching a step activates that step; any
 * other stored value (e.g. '4.2rem' or the old '4rem'/'8rem' presets)
 * shows as an active amber "Custom" chip whose raw bytes are NEVER
 * rewritten unless the user edits them. Clicking the chip opens a small
 * inline text input — the old escape hatch, demoted.
 *
 * A link toggle edits paddingTop + paddingBottom together (linked is only
 * offered/derived when both edges are equal, so linking never silently
 * rewrites an edge the user didn't touch — except the explicit
 * "link both edges" click when values differ, which copies top → bottom
 * and says so in its tooltip).
 *
 * Props:
 *   spacing  — { paddingTop?, paddingBottom? } (CSS strings)
 *   onChange — (nextSpacing) receives the whole next spacing object
 */

const SPACING_STEPS = [
    { value: '',       label: 'Default', hint: 'Site rhythm (no override)' },
    { value: '0',      label: 'None',    hint: '0px' },
    { value: '3rem',   label: 'S',       hint: '3rem ≈ 48px' },
    { value: '6rem',   label: 'M',       hint: '6rem ≈ 96px' },
    { value: '7.5rem', label: 'L',       hint: '7.5rem ≈ 120px' },
    { value: '10rem',  label: 'XL',      hint: '10rem ≈ 160px' },
];

const CHIP_BASE = 'px-2 py-1 text-[10px] font-medium transition-colors';

function StepButton({ step, active, onClick }) {
    return (
        <button
            type="button"
            title={step.hint}
            aria-pressed={active}
            onClick={onClick}
            className={`${CHIP_BASE} ${active
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
        >
            {step.label}
        </button>
    );
}

// Inline escape hatch — buffered: commits on Enter/blur, Escape cancels.
// Empty commit = reset to Default (remove the key).
function CustomInput({ initial, onCommit, onCancel }) {
    const [draft, setDraft] = useState(initial);
    return (
        <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onCommit(draft.trim())}
            onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.preventDefault(); onCommit(draft.trim()); }
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }}
            placeholder="e.g. 4.5rem"
            spellCheck={false}
            aria-label="Custom spacing value"
            className="w-20 px-2 py-1 rounded text-[10px] font-mono border border-amber-400/60 bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-amber-400"
        />
    );
}

// One edge (or the linked pair): segmented rhythm scale + optional custom
// chip for non-step stored values.
function StepperRow({ label, value, onChange, linkSlot }) {
    const v = typeof value === 'string' ? value : '';
    const isCustom = v !== '' && !SPACING_STEPS.some(s => s.value === v);
    const [editingCustom, setEditingCustom] = useState(false);

    const pick = (stepValue) => {
        setEditingCustom(false);
        onChange(stepValue || null); // '' → null → caller removes the key
    };

    return (
        <FieldRow label={label}>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden">
                    {SPACING_STEPS.map(step => (
                        <StepButton
                            key={step.label}
                            step={step}
                            active={!isCustom && v === step.value}
                            onClick={() => pick(step.value)}
                        />
                    ))}
                </div>
                {isCustom && !editingCustom ? (
                    <button
                        type="button"
                        onClick={() => setEditingCustom(true)}
                        title="Stored custom value — click to edit"
                        className={`${CHIP_BASE} rounded-md border font-mono bg-amber-400/15 border-amber-400/60 text-amber-500`}
                    >
                        Custom: {v}
                    </button>
                ) : null}
                {editingCustom ? (
                    <CustomInput
                        initial={v}
                        onCommit={(next) => { setEditingCustom(false); onChange(next || null); }}
                        onCancel={() => setEditingCustom(false)}
                    />
                ) : null}
                {linkSlot}
            </div>
        </FieldRow>
    );
}

function LinkToggle({ linked, mixed, onToggle }) {
    const title = linked
        ? 'Unlink — edit top and bottom separately'
        : (mixed
            ? 'Link both edges (sets bottom = top)'
            : 'Link both edges — one control edits top and bottom');
    return (
        <button
            type="button"
            onClick={onToggle}
            title={title}
            aria-pressed={linked}
            className={`p-1.5 rounded-md border transition-colors shrink-0
                ${linked
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
        >
            <AppIcon name={linked ? 'Link' : 'Unlink'} className="w-3.5 h-3.5" />
        </button>
    );
}

export default function SpacingStepper({ spacing, onChange }) {
    const sp = spacing || {};
    const top    = typeof sp.paddingTop === 'string' ? sp.paddingTop : '';
    const bottom = typeof sp.paddingBottom === 'string' ? sp.paddingBottom : '';
    const bothEqual = top === bottom;

    // Linked is DERIVED from equality; the user can force it off. Linking
    // while the edges differ is an explicit action that copies top → bottom
    // (announced in the toggle tooltip). Editing while unlinked naturally
    // keeps the rows apart once values diverge.
    const [forceUnlinked, setForceUnlinked] = useState(false);
    const linked = bothEqual && !forceUnlinked;

    const setEdges = (patch) => {
        const next = { ...sp };
        for (const [key, val] of Object.entries(patch)) {
            if (val === null || val === undefined || val === '') delete next[key];
            else next[key] = val;
        }
        onChange(next);
    };

    const toggleLink = () => {
        if (linked) { setForceUnlinked(true); return; }
        setForceUnlinked(false);
        if (!bothEqual) setEdges({ paddingBottom: top || null });
    };

    const linkSlot = <LinkToggle linked={linked} mixed={!bothEqual} onToggle={toggleLink} />;

    if (linked) {
        return (
            <StepperRow
                label="Padding (both edges)"
                value={top}
                onChange={(val) => setEdges({ paddingTop: val, paddingBottom: val })}
                linkSlot={linkSlot}
            />
        );
    }
    return (
        <>
            <StepperRow
                label="Padding top"
                value={top}
                onChange={(val) => setEdges({ paddingTop: val })}
                linkSlot={linkSlot}
            />
            <StepperRow
                label="Padding bottom"
                value={bottom}
                onChange={(val) => setEdges({ paddingBottom: val })}
            />
        </>
    );
}
