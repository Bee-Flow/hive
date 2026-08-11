import { Copy, Layers, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { STYLE_KNOBS, getKnobsForType, clampKnob, knobLabel } from './styleKnobMeta';
import TokenColorField from './TokenColorField';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import IconButton from '../../../../shared/IconButton';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Slider from '../../../../shared/Slider';
import { duplicateNode, findNode, removeNode, updateNodeStyle } from '../state/definitionOps';

/**
 * MultiInspector — the inspector body shown when more than one node is
 * selected. It exposes the style knobs COMMON to every selected type (the
 * intersection of each type's knob list) and applies each change to ALL
 * selected nodes in a single history commit, plus bulk duplicate/delete.
 *
 * A knob whose value differs across the selection reads "Mixed" until you set
 * it; setting it writes the same value to every node.
 */

const VALUE_LABELS = {
    sm: 'S', md: 'M', lg: 'L', start: 'Left', center: 'Center', end: 'Right',
    regular: 'Regular', medium: 'Medium', semibold: 'Semibold',
    auto: 'Auto', none: 'None', full: 'Full', surface: 'Surface', tint: 'Tint',
};
const INHERIT = '__inherit';

function valueLabel(v) {
    if (v in VALUE_LABELS) return VALUE_LABELS[v];
    return String(v).charAt(0).toUpperCase() + String(v).slice(1);
}
function enumOptions(knob) {
    return STYLE_KNOBS[knob].values.map((v) => (
        v === null ? { value: INHERIT, label: 'Inherit' } : { value: v, label: valueLabel(v) }
    ));
}

/** Common knobs across a set of component types (order from the first type). */
export function commonKnobs(types) {
    const lists = (types || []).map(getKnobsForType).filter((l) => l.length);
    if (!lists.length) return [];
    return lists.reduce((acc, list) => acc.filter((k) => list.includes(k)));
}

/** The shared value of `knob` across nodes, or undefined when they disagree. */
export function sharedValue(nodes, knob) {
    let seen;
    let has = false;
    for (const node of nodes) {
        const v = node.style?.[knob] !== undefined ? node.style[knob] : STYLE_KNOBS[knob]?.default;
        if (!has) { seen = v; has = true; }
        else if (!Object.is(seen, v)) return undefined; // mixed
    }
    return has ? seen : undefined;
}

export default function MultiInspector({ definition, ids, onCommit, disabled, dispatch }) {
    const nodes = (ids || [])
        .map((id) => findNode(definition, id)?.node)
        .filter(Boolean);
    const knobs = commonKnobs(nodes.map((n) => n.type));

    const commitKnob = (knob, rawValue) => {
        const value = clampKnob(knob, rawValue);
        let def = definition;
        for (const node of nodes) def = updateNodeStyle(def, node.id, { [knob]: value });
        if (def !== definition) onCommit(def);
    };

    const doDuplicate = () => {
        let def = definition;
        const newIds = [];
        for (const node of nodes) {
            const res = duplicateNode(def, node.id);
            if (res.nodeId) { def = res.def; newIds.push(res.nodeId); }
        }
        if (def !== definition) onCommit(def);
        if (newIds.length) dispatch?.({ type: 'select_many', ids: newIds });
    };

    // Deleting one container asks first (InspectorPanel's ConfirmDialog);
    // deleting five of them from here did not ask at all, and a bulk delete is
    // the case where the most is at stake — a selected Card takes its whole
    // subtree with it and nothing on screen said so.
    const [confirming, setConfirming] = useState(false);
    const withChildren = nodes.filter((n) => Array.isArray(n.children) && n.children.length > 0);

    const doRemove = () => {
        setConfirming(false);
        let def = definition;
        for (const node of nodes) def = removeNode(def, node.id);
        if (def !== definition) onCommit(def);
        dispatch?.({ type: 'clear_selection' });
    };
    const bulkRemove = () => (withChildren.length ? setConfirming(true) : doRemove());

    return (
        <div className="p-4 flex flex-col gap-3">
            <header className="flex items-center gap-2">
                <Layers className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
                    {nodes.length} selected
                </h2>
                <IconButton ariaLabel="Duplicate selected" onClick={doDuplicate} disabled={disabled}>
                    <Copy />
                </IconButton>
                <IconButton ariaLabel="Delete selected" variant="danger" onClick={bulkRemove} disabled={disabled}>
                    <Trash2 />
                </IconButton>
            </header>

            {knobs.length ? (
                <div className="flex flex-col gap-4">
                    {knobs.map((knob) => {
                        const spec = STYLE_KNOBS[knob];
                        if (!spec) return null;
                        const shared = sharedValue(nodes, knob);
                        const mixed = shared === undefined;

                        if (spec.type === 'int') {
                            return (
                                <Slider
                                    key={knob}
                                    label={`${knobLabel(knob)}${mixed ? ' · Mixed' : ''}`}
                                    value={Number.isFinite(shared) ? shared : spec.default}
                                    onChange={(v) => commitKnob(knob, v)}
                                    min={spec.min}
                                    max={spec.max}
                                    step={spec.step}
                                    suffix={knob === 'span' ? ' col' : ''}
                                    disabled={disabled}
                                />
                            );
                        }
                        if (spec.type === 'colorOrRole') {
                            return (
                                <FormField key={knob} label={`${knobLabel(knob)}${mixed ? ' · Mixed' : ''}`}>
                                    <TokenColorField
                                        value={mixed ? null : shared}
                                        onChange={(v) => commitKnob(knob, v)}
                                        themePrimary={definition?.theme?.primary || null}
                                        disabled={disabled}
                                    />
                                </FormField>
                            );
                        }
                        return (
                            <FormField key={knob} label={`${knobLabel(knob)}${mixed ? ' · Mixed' : ''}`}>
                                <SegmentedControl
                                    value={mixed ? null : (shared === null ? INHERIT : shared)}
                                    onChange={(v) => commitKnob(knob, v === INHERIT ? null : v)}
                                    options={enumOptions(knob)}
                                    size="sm"
                                    fullWidth
                                    disabled={disabled}
                                    ariaLabel={knobLabel(knob)}
                                />
                            </FormField>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-[var(--text-tertiary)]">
                    These components don&rsquo;t share adjustable style options. Use the toolbar to duplicate or delete
                    them together.
                </p>
            )}

            <ConfirmDialog
                open={confirming}
                title={`Delete ${nodes.length} components?`}
                description={
                    withChildren.length === 1
                        ? 'One of them holds other components — everything inside it will be deleted too.'
                        : `${withChildren.length} of them hold other components — everything inside those will be deleted too.`
                }
                confirmLabel="Delete"
                destructive
                onConfirm={doRemove}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}
