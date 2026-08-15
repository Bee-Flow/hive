import { tryEvaluate } from '@shared/expr/engine.mjs';
import { Loader2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormContext, registerFormReset } from '../formContext';
import { useRuntime } from '../RuntimeContext';
import { spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'form' (container). Spec: server/appStudio/componentSpecs.js.
 *
 * Owns all field state (inputs register via formContext), runs client-side
 * validation with inline field errors — props.required PLUS every rule the
 * author wrote into the field's `node.validations` — and renders exactly one
 * built-in submit button (+ optional reset). Submitting calls
 * runAction(onSubmit, { formValues, formId }); field values are NEVER cleared
 * on failure — the user's input survives a failed routine run.
 *
 * The full values object is published upward via
 * runtime.registerFormValue(formName, values) on mount and on EVERY change
 * (typing, defaults registering, reset) — the run surface stores it under
 * forms[formName] so formulas can read `form.*` (inside the form container)
 * and `forms.<name>.*` (anywhere). formName is props.name (canonicalize fills
 * it) with node.id as the fallback — keep in lockstep with AppRenderer's
 * form-container child scope.
 */

// ── node.validations (authored in the inspector's ValidationRuleEditor,
// canonicalized by server/appStudio/canonicalize.js) ────────────────────────
//
// Two rule vocabularies reach the runtime and both are honoured: the editor's
// (required · email · url · minLength · maxLength · min · max · pattern · expr)
// and the server validator's typed spelling of the same checks (format with
// format:'email'|'url', formula with expr).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empty for validation: null/undefined, '' and an EMPTY ARRAY (multi-fields). */
function isEmptyValue(v) {
    if (v == null || v === '') return true;
    return Array.isArray(v) && v.length === 0;
}

function lengthOf(v) {
    return (Array.isArray(v) || typeof v === 'string') ? v.length : String(v).length;
}

function ruleKind(rule) {
    if (rule?.type === 'format') return String(rule.format || '').toLowerCase();
    if (rule?.type === 'formula') return 'expr';
    return rule?.type;
}

function isUrl(v) {
    try { return !!new URL(String(v)).host; } catch { return false; }
}

/** True when the rule REJECTS this value. Never throws — a bad rule passes. */
function ruleFails(rule, value, fieldScope) {
    const kind = ruleKind(rule);
    // An unchecked box is `false`, which is not "empty" by any of the tests
    // above — so a consent checkbox marked required submitted unticked, and the
    // one rule on the form that had to hold was the one that never fired.
    // Strictly `false`, so a required number of 0 and a required empty-ish
    // string keep the meanings they already had.
    if (kind === 'required') return isEmptyValue(value) || value === false;
    // Every other rule only bites on a filled field, so an optional field with
    // a format/bound rule stays optional.
    if (isEmptyValue(value)) return false;
    switch (kind) {
        case 'email': return !EMAIL_RE.test(String(value));
        case 'url': return !isUrl(value);
        case 'minLength': return Number.isFinite(Number(rule.value)) && lengthOf(value) < Number(rule.value);
        case 'maxLength': return Number.isFinite(Number(rule.value)) && lengthOf(value) > Number(rule.value);
        case 'min': return Number.isFinite(Number(value)) && Number(value) < Number(rule.value);
        case 'max': return Number.isFinite(Number(value)) && Number(value) > Number(rule.value);
        case 'pattern':
            try { return !new RegExp(String(rule.value)).test(String(value)); } catch { return false; }
        case 'expr': {
            const expr = typeof rule.expr === 'string' ? rule.expr.trim() : '';
            if (!expr) return false;
            // Same read as the inspector's live preview and evalVisibility: an
            // expression that errors is falsy, so the rule rejects.
            return !tryEvaluate(expr, fieldScope).value;
        }
        default: return false;
    }
}

/** The author's message, or sensible copy generated from the rule itself. */
function ruleMessage(rule) {
    if (typeof rule?.message === 'string' && rule.message.trim()) return rule.message;
    switch (ruleKind(rule)) {
        case 'required': return 'This field is required.';
        case 'email': return 'Enter a valid email address.';
        case 'url': return 'Enter a valid URL.';
        case 'minLength': return `Enter at least ${rule.value} characters.`;
        case 'maxLength': return `Enter at most ${rule.value} characters.`;
        case 'min': return `Enter ${rule.value} or more.`;
        case 'max': return `Enter ${rule.value} or less.`;
        case 'pattern': return 'This value is not in the expected format.';
        default: return 'This value is not valid.';
    }
}

/**
 * The rules a component's own PROPS imply.
 *
 * `input_number` advertises min/max in the spec and passed them to the DOM only
 * — and the form renders with `noValidate`, so the browser never enforced them
 * either. A field documented as "1 to 10" happily submitted 500. These are
 * spelled as ordinary rules so they run through exactly the same machinery (and
 * message copy) as an authored one.
 */
function propRules(node) {
    if (node?.type !== 'input_number') return null;
    const out = [];
    const { min, max } = node.props || {};
    if (Number.isFinite(min)) out.push({ type: 'min', value: min });
    if (Number.isFinite(max)) out.push({ type: 'max', value: max });
    return out.length ? out : null;
}

/**
 * Deep-walk the form's child DEFINITIONS → Map(fieldName → rules). Deep,
 * because inputs may sit inside a container inside the form; only registered
 * (i.e. mounted) names are validated, so a hidden field's rules stay inert.
 *
 * Prop-implied rules come first so an authored rule with the same bound (and a
 * hand-written message) is the one the user sees.
 */
function collectValidations(node) {
    const out = new Map();
    const visit = (n) => {
        if (!n || typeof n !== 'object') return;
        const fieldName = n.props?.name;
        if (fieldName) {
            const authored = Array.isArray(n.validations) ? n.validations : [];
            const implied = propRules(n) || [];
            if (authored.length || implied.length) out.set(fieldName, [...implied, ...authored]);
        }
        for (const child of (Array.isArray(n.children) ? n.children : [])) visit(child);
    };
    for (const child of (Array.isArray(node.children) ? node.children : [])) visit(child);
    return out;
}

export default function AppForm({ node, children }) {
    const { mode, runAction, actionState, registerFormValue, scope } = useRuntime();
    const { submitLabel = 'Submit', showReset = false, showSubmit = true } = node.props || {};
    const formName = node.props?.name || node.id;
    const [values, setValues] = useState({});
    const [errors, setErrors] = useState({});
    const fieldsRef = useRef(new Map()); // name → { required, label, defaultValue }

    const pending = !!(node.onSubmit && actionState?.[node.onSubmit]?.status === 'running');
    // The spinner was the only thing read off the action's state, so a
    // failed submit just stopped spinning and said nothing.
    const submitError = node.onSubmit ? actionState?.[node.onSubmit]?.error : null;
    const validations = useMemo(() => collectValidations(node), [node]);

    useEffect(() => {
        if (typeof registerFormValue === 'function') registerFormValue(formName, values);
    }, [registerFormValue, formName, values]);

    const register = useCallback((name, meta) => {
        fieldsRef.current.set(name, meta);
        // Seed the default so untouched fields still submit their value.
        setValues((prev) => (Object.prototype.hasOwnProperty.call(prev, name)
            ? prev
            : { ...prev, [name]: meta.defaultValue ?? null }));
    }, []);

    const unregister = useCallback((name) => {
        fieldsRef.current.delete(name);
    }, []);

    const setValue = useCallback((name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    }, []);

    const handleReset = useCallback(() => {
        const next = {};
        for (const [name, meta] of fieldsRef.current) next[name] = meta.defaultValue ?? null;
        setValues(next);
        setErrors({});
    }, []);

    // The `reset_form` action step reaches this form by NAME through the
    // module-level bus — the same key the runtime files form values under.
    useEffect(() => registerFormReset(formName, handleReset), [formName, handleReset]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (mode !== 'run' || pending) return;
        const nextErrors = {};
        for (const [name, meta] of fieldsRef.current) {
            // A field the author switched off (enabledWhen:false) is inert on
            // screen — validating it puts an error the user cannot clear under
            // a control they cannot focus, and the form can never be sent.
            if (meta.disabled) continue;
            // The browser refused what was typed (a number box holding "12e"
            // reports '' while still showing the text). The input says so on
            // screen; without this the form did not, so an optional field
            // submitted EMPTY under a visible "Enter a number".
            if (meta.invalid) {
                nextErrors[name] = meta.invalidMessage || 'This value is not valid.';
                continue;
            }
            const v = values[name];
            if (meta.required && isEmptyValue(v)) {
                nextErrors[name] = 'This field is required.';
                continue;
            }
            const rules = validations.get(name);
            if (!rules) continue;
            // `form` is this form's LIVE values (the published forms.<name> copy
            // lags by an effect) and `value` is the field under test.
            const fieldScope = { ...scope, form: values, value: v };
            for (const rule of rules) {
                if (!ruleFails(rule, v, fieldScope)) continue;
                nextErrors[name] = ruleMessage(rule);
                break;
            }
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).some((k) => nextErrors[k])) return;
        if (node.onSubmit) {
            runAction(node.onSubmit, { formValues: { ...values }, formId: node.id });
        }
    };

    const ctx = useMemo(
        () => ({ values, setValue, errors, register, unregister, pending }),
        [values, setValue, errors, register, unregister, pending],
    );

    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    return (
        <FormContext.Provider value={ctx}>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col" style={{ gap: spaceSteps(gap) }}>
                <div
                    className="app-grid"
                    style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: spaceSteps(gap) }}
                >
                    {children}
                </div>
                {/* A form whose fields save on change (a triage bar) has nothing
                    to submit. Rendering the button anyway is the loudest signal
                    a screen was generated rather than designed — and the user
                    clicks it, and nothing happens. */}
                {submitError ? (
                    <p
                        className="text-sm"
                        role="alert"
                        style={{ color: 'var(--error)' }}
                        data-app-submit-error="true"
                    >
                        {submitError}
                    </p>
                ) : null}

                {showSubmit || showReset ? (
                    <div className="flex items-center gap-2">
                        {showSubmit ? (
                            <button
                                type="submit"
                                // `showSubmit` defaults to true while onSubmit is
                                // optional, so an unwired form shipped a fully
                                // enabled button that did nothing at all when
                                // clicked. Saying so beats swallowing the click.
                                disabled={pending || !node.onSubmit}
                                title={node.onSubmit ? undefined : 'This form has no submit action yet.'}
                                data-app-submit-inert={node.onSubmit ? undefined : 'true'}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
                                style={{
                                    background: 'var(--app-primary)',
                                    color: 'var(--app-primary-contrast)',
                                    borderRadius: 'var(--app-radius)',
                                }}
                            >
                                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
                                <span>{submitLabel}</span>
                            </button>
                        ) : null}
                        {showReset ? (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                                style={{ color: 'var(--text-secondary)', borderRadius: 'var(--app-radius)' }}
                            >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Reset</span>
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </form>
        </FormContext.Provider>
    );
}
