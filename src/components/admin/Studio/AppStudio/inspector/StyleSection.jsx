import React from 'react';
import {
    STYLE_KNOBS,
    SECTION_STYLE_KNOBS,
    SECTION_STYLE_DEFAULTS,
    getKnobsForType,
    clampKnob,
    knobLabel,
} from './styleKnobMeta';
import TokenColorField from './TokenColorField';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Slider from '../../../../shared/Slider';
import { updateNodeStyle } from '../state/definitionOps';

/**
 * StyleSection — renders ONLY the style knobs the selected type supports
 * (per-type lists mirrored from server/appStudio/componentSpecs.js in
 * styleKnobMeta.js) and commits every change immediately via
 * updateNodeStyle + onCommit(nextDef). NO debounce — the canvas is a live
 * preview and the shell's history coalesces rapid edits upstream.
 *
 * Two variants:
 *   node    — pass `node`; knobs come from the node's type.
 *   section — pass `sectionId`; knobs are the section trio (padding/gap/
 *             background). definitionOps.findNode only resolves component
 *             nodes, so the section lookup/patch helpers live here.
 */

// ---------------------------------------------------------------------------
// Section helpers — findNode/updateNodeStyle don't resolve section ids.
// ---------------------------------------------------------------------------

export function findSectionById(def, sectionId) {
    for (const screen of def?.screens || []) {
        for (const section of screen.sections || []) {
            if (section.id === sectionId) return { section, screen };
        }
    }
    return null;
}

/** Shallow-merge a style patch into a section (structural sharing; same def when a no-op). */
export function updateSectionStyle(def, sectionId, patch) {
    if (!patch || typeof patch !== 'object') return def;
    const screens = def.screens || [];
    for (let s = 0; s < screens.length; s++) {
        const sections = screens[s].sections || [];
        for (let j = 0; j < sections.length; j++) {
            const section = sections[j];
            if (section.id !== sectionId) continue;
            const current = section.style || {};
            if (Object.keys(patch).every((k) => Object.is(current[k], patch[k]))) return def;
            const nextSections = sections.slice();
            nextSections[j] = { ...section, style: { ...current, ...patch } };
            const nextScreens = screens.slice();
            nextScreens[s] = { ...screens[s], sections: nextSections };
            return { ...def, screens: nextScreens };
        }
    }
    return def;
}

// ---------------------------------------------------------------------------
// Knob presentation
// ---------------------------------------------------------------------------


// Human labels for enum values (fall back to capitalised value).
const VALUE_LABELS = {
    sm: 'S', md: 'M', lg: 'L',
    start: 'Left', center: 'Center', end: 'Right',
    regular: 'Regular', medium: 'Medium', semibold: 'Semibold',
    auto: 'Auto', none: 'None', full: 'Full',
    surface: 'Surface', tint: 'Tint',
};

function valueLabel(v) {
    if (v in VALUE_LABELS) return VALUE_LABELS[v];
    return String(v).charAt(0).toUpperCase() + String(v).slice(1);
}

// SegmentedControl values must be string|number — the radius knob's null
// ("inherit the theme") rides a sentinel and is mapped back on commit.
const INHERIT = '__inherit';

function enumOptions(knob) {
    return STYLE_KNOBS[knob].values.map((v) => (
        v === null
            ? { value: INHERIT, label: 'Inherit' }
            : { value: v, label: valueLabel(v) }
    ));
}

export default function StyleSection({
    definition,
    node = null,
    sectionId = null,
    onCommit,
    disabled = false,
}) {
    const isSection = sectionId != null;
    const knobs = isSection ? SECTION_STYLE_KNOBS : getKnobsForType(node?.type);
    const style = isSection
        ? { ...SECTION_STYLE_DEFAULTS, ...(findSectionById(definition, sectionId)?.section?.style || {}) }
        : (node?.style || {});

    if (!knobs.length) return null;

    const commit = (knob, rawValue) => {
        const value = clampKnob(knob, rawValue);
        const next = isSection
            ? updateSectionStyle(definition, sectionId, { [knob]: value })
            : updateNodeStyle(definition, node.id, { [knob]: value });
        if (next !== definition) onCommit(next);
    };

    const current = (knob) => (style[knob] !== undefined ? style[knob] : STYLE_KNOBS[knob].default);

    return (
        <div className="flex flex-col gap-4">
            {knobs.map((knob) => {
                const spec = STYLE_KNOBS[knob];
                if (!spec) return null;

                if (spec.type === 'int') {
                    return (
                        <Slider
                            key={knob}
                            label={knobLabel(knob)}
                            value={Number.isFinite(current(knob)) ? current(knob) : spec.default}
                            onChange={(v) => commit(knob, v)}
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
                        <FormField key={knob} label={knobLabel(knob)}>
                            <TokenColorField
                                value={current(knob)}
                                onChange={(v) => commit(knob, v)}
                                themePrimary={definition?.theme?.primary || null}
                                disabled={disabled}
                            />
                        </FormField>
                    );
                }

                // enum knob
                const value = current(knob);
                return (
                    <FormField key={knob} label={knobLabel(knob)}>
                        <SegmentedControl
                            value={value === null ? INHERIT : value}
                            onChange={(v) => commit(knob, v === INHERIT ? null : v)}
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
    );
}
