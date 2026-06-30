import { useEffect, useMemo, useRef } from 'react';
import { STEP_ICON_NAMES } from './flow/stepIcons';

/**
 * Auto-label + auto-icon for builder steps.
 *
 * When the flow's STRUCTURE changes (a step added / removed / retyped) the
 * FAST tier names any step that's still unnamed (empty label/icon and not
 * user-locked). It is deliberately conservative:
 *
 *   - keyed on a structural signature that excludes labels, icons, positions
 *     and prompt text, so it never fires on a keystroke or a small tweak;
 *   - debounced, so a burst of structural edits triggers at most one pass;
 *   - only fills EMPTY, unlocked fields — a user-set label/icon (`labelManual`
 *     / `iconManual`) is never touched, and an existing label isn't reworded.
 *
 * The server does the same filtering; the apply step double-checks the locks.
 */

// Walk steps incl. loop bodies / parallel branches (mirrors server walkSteps).
export function walkSteps(steps, fn) {
    if (!Array.isArray(steps)) return;
    for (const s of steps) {
        if (!s || typeof s !== 'object') continue;
        fn(s);
        if (s.type === 'loop') walkSteps(s.body, fn);
        if (s.type === 'parallel' && Array.isArray(s.branches)) {
            for (const b of s.branches) walkSteps(b, fn);
        }
    }
}

// Identity of the flow's structure — NOT its labels/icons/positions/prompts.
export function structuralSignature(def) {
    const parts = [];
    walkSteps(def?.steps, (s) => {
        parts.push([s.id, s.type, s.tool || '', s.appId || '', s.kind || '', s.op || '', s.blockId || '', s.layerKey || ''].join(':'));
    });
    return parts.sort().join('|');
}

export function hasFillableStep(def) {
    let need = false;
    walkSteps(def?.steps, (s) => {
        if (need || !s.id || s.type === 'layer_output') return;
        const emptyLabel = !s.labelManual && !(typeof s.label === 'string' && s.label.trim());
        const emptyIcon = !s.iconManual && !(typeof s.icon === 'string' && s.icon.trim());
        if (emptyLabel || emptyIcon) need = true;
    });
    return need;
}

// Merge AI labels into the definition, recursing through nested bodies and
// honouring the per-field locks (defence in depth — the server already filters).
export function applyLabels(def, labels) {
    const mapStep = (s) => {
        if (!s || typeof s !== 'object') return s;
        let out = s;
        const l = labels[s.id];
        if (l) {
            out = { ...s };
            if (l.label && !s.labelManual && !(typeof s.label === 'string' && s.label.trim())) out.label = l.label;
            if (l.icon && !s.iconManual && !(typeof s.icon === 'string' && s.icon.trim())) out.icon = l.icon;
        }
        if (out.type === 'loop' && Array.isArray(out.body)) {
            out = { ...out, body: out.body.map(mapStep) };
        }
        if (out.type === 'parallel' && Array.isArray(out.branches)) {
            out = { ...out, branches: out.branches.map((b) => (Array.isArray(b) ? b.map(mapStep) : b)) };
        }
        return out;
    };
    return { ...def, steps: (def.steps || []).map(mapStep) };
}

export default function useAutoLabelSteps({ def, api, apply, enabled = true, delayMs = 2000 }) {
    // Re-run only when the structure changes — same-sig renders (label tweaks,
    // typing, the apply itself) leave the dependency untouched so the pending
    // debounce survives.
    const sig = useMemo(() => (def && Array.isArray(def.steps) ? structuralSignature(def) : null), [def]);

    const defRef = useRef(def); defRef.current = def;
    const apiRef = useRef(api); apiRef.current = api;
    const applyRef = useRef(apply); applyRef.current = apply;
    const baselineRef = useRef(null);
    const inFlightRef = useRef(false);

    useEffect(() => {
        if (!enabled || sig == null) return undefined;
        // Establish the on-open baseline without naming, so opening a flow never
        // churns its existing labels — only post-open structural edits do.
        if (baselineRef.current === null) { baselineRef.current = sig; return undefined; }
        if (sig === baselineRef.current) return undefined;

        const timer = setTimeout(async () => {
            const current = defRef.current;
            if (!current || !hasFillableStep(current)) { baselineRef.current = sig; return; }
            if (inFlightRef.current) return;
            inFlightRef.current = true;
            try {
                const r = await apiRef.current.labelSteps(current, STEP_ICON_NAMES);
                baselineRef.current = structuralSignature(defRef.current);
                const labels = r?.labels || {};
                if (Object.keys(labels).length) applyRef.current(applyLabels(defRef.current, labels));
            } catch (_) {
                /* best-effort — naming never blocks editing */
            } finally {
                inFlightRef.current = false;
            }
        }, delayMs);
        return () => clearTimeout(timer);
    }, [sig, enabled, delayMs]);
}
