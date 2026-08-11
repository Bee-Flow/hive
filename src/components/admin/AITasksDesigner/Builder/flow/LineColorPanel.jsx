import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { applyCaseColor, applyPiiGroupColor, caseColorOf, resolvePiiGroupColors } from './edgeColorOps';
import { autoCaseColor, EDGE_COLOR_KEYS, PII_GROUP_COLORS, resolveEdgeColor } from './edgeColors';

/**
 * The "Lines" control — the one discoverable home for connection colours.
 *
 * The hover swatches on a line are quick but invisible until you know them;
 * the rules behind the automatic colours had no surface at all. This panel
 * shows, in one place:
 *
 *   - the lens ("colour lines by"): Off · Branches · PII — ALL selectable,
 *     always. PII without data is not disabled any more; it explains what
 *     will make colours appear instead of silently refusing.
 *   - Branches: every routing rule (each Filter & Route case) with its
 *     current colour — automatic by default, click a swatch to pin one
 *     (writes the same edge.color the hover picker writes).
 *   - PII: the group → colour legend, editable per routine
 *     (definition.piiLineColors, palette keys only).
 *
 * Colour editing is gated on `editable`; the lens works everywhere (it's a
 * per-user view preference).
 */
export default function LineColorPanel({
    mode,
    onModeChange,
    definition,
    editable = false,
    onDefinitionChange = null,
    hasPiiData = false,
}) {
    const [open, setOpen] = useState(false);

    // Every routing rule that gets an automatic colour: switch cases, in
    // declaration order (the order autoCaseColor keys on).
    const caseRows = useMemo(() => {
        const rows = [];
        for (const s of (definition?.steps || [])) {
            if (s?.type !== 'switch' || !Array.isArray(s.cases) || !s.cases.length) continue;
            s.cases.forEach((c, i) => {
                if (!c?.name) return;
                rows.push({
                    stepId: s.id,
                    stepLabel: s.label || 'Filter & Route',
                    caseName: c.name,
                    autoHex: autoCaseColor(i),
                    pinned: caseColorOf(definition, s.id, c.name),
                });
            });
        }
        return rows;
    }, [definition]);

    const piiHex = useMemo(() => resolvePiiGroupColors(definition), [definition]);
    const piiOverrides = definition?.piiLineColors || {};
    const canEdit = editable && typeof onDefinitionChange === 'function';

    const pinCase = (row, colorKey) => {
        if (!canEdit) return;
        onDefinitionChange(applyCaseColor(definition, row.stepId, row.caseName, colorKey));
    };
    const pinPiiGroup = (group, colorKey) => {
        if (!canEdit) return;
        onDefinitionChange(applyPiiGroupColor(definition, group, colorKey));
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <div
                role="group"
                aria-label="Colour lines by"
                className="flex items-center gap-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)]/90 shadow-sm px-1 py-0.5 text-[10px]"
            >
                <span className="px-1 text-[var(--text-tertiary)]">Lines:</span>
                {[['off', 'Off'], ['branches', 'Branches'], ['pii', 'PII']].map(([m, label]) => (
                    <button
                        key={m}
                        type="button"
                        title={`Colour the connections by ${label.toLowerCase()}`}
                        aria-pressed={mode === m}
                        onClick={() => onModeChange(m)}
                        className={`px-1.5 py-0.5 rounded transition ${
                            mode === m
                                ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                        {label}
                    </button>
                ))}
                <button
                    type="button"
                    aria-label="Line colour rules"
                    aria-expanded={open}
                    title="Which colour means what — and change it"
                    onClick={() => setOpen(o => !o)}
                    className="px-1 py-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>

            {open && (
                <div className="w-72 max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-2.5 space-y-3 text-[11px]">
                    <section>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1.5">
                            Branch colours
                        </div>
                        {caseRows.length ? (
                            <div className="space-y-1.5">
                                {caseRows.map((row) => (
                                    <SwatchRow
                                        key={`${row.stepId}:${row.caseName}`}
                                        label={row.caseName}
                                        sublabel={row.stepLabel}
                                        currentKey={row.pinned}
                                        autoHex={row.autoHex}
                                        canEdit={canEdit}
                                        onPick={(key) => pinCase(row, key)}
                                    />
                                ))}
                                <p className="text-[10px] text-[var(--text-tertiary)]">
                                    Automatic by default — pick a swatch to pin a colour to that rule.
                                    Any single connection can still be coloured from its own hover controls.
                                </p>
                            </div>
                        ) : (
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                                No routing rules yet. Add a Filter &amp; Route step with rules
                                (e.g. pdf / word) and each rule gets its own coloured line.
                            </p>
                        )}
                    </section>

                    <section>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1.5">
                            PII colours
                        </div>
                        {!hasPiiData && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1.5">
                                No PII data yet — run a test (▶ or a dry run) with the Privacy
                                Shield applied to routines, and lines colour by what was detected.
                            </p>
                        )}
                        <div className="space-y-1.5">
                            {Object.keys(PII_GROUP_COLORS).map((group) => (
                                <SwatchRow
                                    key={group}
                                    label={group}
                                    currentKey={piiOverrides[group] || null}
                                    autoHex={piiHex[group]}
                                    canEdit={canEdit}
                                    onPick={(key) => pinPiiGroup(group, key)}
                                />
                            ))}
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                                Lines take the colour of the dominant group flowing through them.
                                Counts only — detected values are never stored.
                            </p>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

/**
 * One rule row: name + the current colour, expanding to the 8 swatches + an
 * "auto" dot on click. The same palette the hover picker offers — one colour
 * vocabulary everywhere.
 */
function SwatchRow({ label, sublabel = null, currentKey, autoHex, canEdit, onPick }) {
    const [picking, setPicking] = useState(false);
    const currentHex = resolveEdgeColor(currentKey) || autoHex;
    return (
        <div className="flex items-center gap-2 min-h-[22px]">
            <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                style={{ background: currentHex }}
            />
            <span className="text-[var(--text-primary)] truncate">{label}</span>
            {sublabel && <span className="text-[var(--text-tertiary)] truncate">· {sublabel}</span>}
            <span className="ml-auto shrink-0 flex items-center gap-1">
                {picking ? (
                    <>
                        {EDGE_COLOR_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                title={key}
                                aria-label={`Colour ${label} ${key}`}
                                onClick={() => { onPick(key); setPicking(false); }}
                                className={`w-3 h-3 rounded-full hover:scale-125 transition ${currentKey === key ? 'ring-2 ring-offset-1 ring-[var(--text-primary)]' : ''}`}
                                style={{ background: resolveEdgeColor(key) }}
                            />
                        ))}
                        <button
                            type="button"
                            title="Automatic"
                            aria-label={`Colour ${label} automatically`}
                            onClick={() => { onPick(null); setPicking(false); }}
                            className={`w-3 h-3 rounded-full border border-[var(--text-tertiary)] bg-[var(--bg-primary)] hover:scale-125 transition relative overflow-hidden ${currentKey ? '' : 'ring-2 ring-offset-1 ring-[var(--text-primary)]'}`}
                        >
                            <span className="absolute inset-x-0 top-1/2 rotate-45 border-t border-[var(--text-tertiary)]" />
                        </button>
                    </>
                ) : canEdit ? (
                    <button
                        type="button"
                        aria-label={`Change the colour of ${label}`}
                        onClick={() => setPicking(true)}
                        className="text-[10px] text-[var(--accent)] hover:underline"
                    >
                        {currentKey ? currentKey : 'auto'}
                    </button>
                ) : (
                    <span className="text-[10px] text-[var(--text-tertiary)]">{currentKey || 'auto'}</span>
                )}
            </span>
        </div>
    );
}
