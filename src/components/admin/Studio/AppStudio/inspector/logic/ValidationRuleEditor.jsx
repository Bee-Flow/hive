import { Plus, X } from 'lucide-react';
import React from 'react';
import FormulaField from './FormulaField';
import StudioScopeProvider, { VALUE_GROUP } from './StudioScopeProvider';
import IconButton from '../../../../../shared/IconButton';
import { INPUT_CLS } from '../panels/kit';

/**
 * ValidationRuleEditor — a repeatable list of field validation rules, written
 * to `node.validations`. The server accepts exactly FOUR rule shapes
 * (VALIDATION_TYPES in server/appStudio/validate.js, authoritative):
 *
 *   { type: 'required' }
 *   { type: 'format', format }      — a named format check ('email' / 'url')
 *   { type: 'minLength', value }    — non-negative integer
 *   { type: 'formula', expr }       — restricted expression, must be truthy
 *
 * Anything else is rejected and every later save 422s, so each menu entry below
 * emits one of those four: the bounds with no native shape (max length, min /
 * max value) compile to a `formula` over the `value` scope root and read back
 * through NUMERIC_FORMULAS.
 *
 * `value` is the rules array; onChange emits the next array. The expr editor is
 * a FormulaField (Studio scope), so custom rules get the picker + live-eval.
 */

// Bounds with no native rule type. `value` is a legal formula scope root
// (componentSpecs.FORMULA_SCOPE_ROOTS), so these validate without warnings.
const NUMERIC_FORMULAS = {
    maxLength: { build: (n) => `len(value) <= ${n}`, read: /^len\(value\) <= (-?\d+(?:\.\d+)?)$/ },
    min: { build: (n) => `number(value) >= ${n}`, read: /^number\(value\) >= (-?\d+(?:\.\d+)?)$/ },
    max: { build: (n) => `number(value) <= ${n}`, read: /^number\(value\) <= (-?\d+(?:\.\d+)?)$/ },
};

const RULE_TYPES = [
    { value: 'required', label: 'Required', input: null },
    { value: 'email', label: 'Valid email', input: null },
    { value: 'url', label: 'Valid URL', input: null },
    { value: 'minLength', label: 'Min length', input: 'number' },
    { value: 'maxLength', label: 'Max length', input: 'number' },
    { value: 'min', label: 'Min value', input: 'number' },
    { value: 'max', label: 'Max value', input: 'number' },
    { value: 'formula', label: 'Custom expression', input: 'formula' },
];

const TYPE_BY_VALUE = new Map(RULE_TYPES.map((t) => [t.value, t]));

// Module-level so the memo inside StudioScopeProvider sees a stable reference.
const VALUE_GROUP_LIST = [VALUE_GROUP];

// A custom rule is born with a working expression: an empty `expr` fails to
// parse, and the row would be unsaveable before the user has typed anything.
const NEW_FORMULA = 'value != null';

function defaultMessage(kind) {
    switch (kind) {
        case 'required': return 'This field is required.';
        case 'email': return 'Enter a valid email address.';
        case 'url': return 'Enter a valid URL.';
        default: return '';
    }
}

/**
 * Stored rule → row state. Rules the OLD editor wrote (types the server never
 * accepted) map onto their nearest menu entry, so an app carrying them shows
 * what was meant — and writeRule turns the row into a saveable shape the
 * moment anything in it is edited.
 */
function readRule(rule) {
    const message = typeof rule?.message === 'string' ? rule.message : '';
    const number = typeof rule?.value === 'number' ? rule.value : null;
    switch (rule?.type) {
        case 'format':
            return { kind: rule.format === 'url' ? 'url' : 'email', message };
        case 'email':
        case 'url':
            return { kind: rule.type, message };
        case 'minLength':
        case 'maxLength':
        case 'min':
        case 'max':
            return { kind: rule.type, number, message };
        case 'formula':
        case 'expr': {
            const expr = typeof rule.expr === 'string' ? rule.expr : '';
            for (const [kind, spec] of Object.entries(NUMERIC_FORMULAS)) {
                const m = spec.read.exec(expr);
                if (m) return { kind, number: Number(m[1]), message };
            }
            return { kind: 'formula', expr, message };
        }
        default:
            return { kind: 'required', message };
    }
}

/** Row state → the server shape. Never emits a type validate.js rejects. */
function writeRule(row) {
    const n = Number(row.number);
    const rule = { type: 'required' };
    if (row.kind === 'email' || row.kind === 'url') {
        rule.type = 'format';
        rule.format = row.kind;
    } else if (row.kind === 'minLength') {
        rule.type = 'minLength';
        rule.value = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    } else if (NUMERIC_FORMULAS[row.kind]) {
        rule.type = 'formula';
        rule.expr = NUMERIC_FORMULAS[row.kind].build(Number.isFinite(n) ? n : 0);
    } else if (row.kind === 'formula') {
        rule.type = 'formula';
        rule.expr = row.expr || '';
    }
    if (row.message) rule.message = row.message;
    return rule;
}

export default function ValidationRuleEditor({ value, onChange, definition = null, node = null, disabled = false }) {
    const rules = Array.isArray(value) ? value : [];

    const addRule = () => onChange?.([...rules, writeRule({ kind: 'required', message: defaultMessage('required') })]);
    const removeRule = (i) => onChange?.(rules.filter((_, k) => k !== i));

    // `value` — the field being checked — is a legal root here and nowhere
    // else, so the picker offers it only inside a rule. Without it the
    // placeholder promised an expression over `value` while the {} list never
    // mentioned `value` at all.
    return (
        <StudioScopeProvider definition={definition} node={node} extraGroups={VALUE_GROUP_LIST}>
            <div className="flex flex-col gap-2">
                {rules.map((rule, i) => {
                    const row = readRule(rule);
                    const spec = TYPE_BY_VALUE.get(row.kind) || RULE_TYPES[0];
                    // Every edit rebuilds the whole rule, so a legacy row can
                    // never keep its rejected `type` through a patch.
                    const put = (patch) => {
                        const next = rules.slice();
                        next[i] = writeRule({ ...row, ...patch });
                        onChange?.(next);
                    };
                    return (
                        <div key={i} className="rounded-md border border-[var(--border-subtle)] p-2.5 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <select
                                    className={INPUT_CLS}
                                    value={row.kind}
                                    onChange={(e) => put({
                                        kind: e.target.value,
                                        expr: row.expr || NEW_FORMULA,
                                        // Replace the message when it is still
                                        // the OLD kind's default — every rule is
                                        // born with a non-blank one, so `||`
                                        // never fired and switching "Required"
                                        // to "Valid email" left the rule saying
                                        // "This field is required." to someone
                                        // who typed `bob@`.
                                        message: row.message && row.message !== defaultMessage(row.kind)
                                            ? row.message
                                            : defaultMessage(e.target.value),
                                    })}
                                    disabled={disabled}
                                    aria-label={`Rule ${i + 1} type`}
                                >
                                    {RULE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <IconButton
                                    ariaLabel={`Remove rule ${i + 1}`}
                                    onClick={() => removeRule(i)}
                                    disabled={disabled}
                                    variant="danger"
                                    size="sm"
                                >
                                    <X />
                                </IconButton>
                            </div>

                            {spec.input === 'number' && (
                                <input
                                    type="number"
                                    className={INPUT_CLS}
                                    value={row.number ?? ''}
                                    onChange={(e) => put({ number: e.target.value === '' ? null : Number(e.target.value) })}
                                    placeholder={spec.label}
                                    disabled={disabled}
                                    aria-label={`Rule ${i + 1} value`}
                                />
                            )}
                            {spec.input === 'formula' && (
                                <FormulaField
                                    value={row.expr || ''}
                                    onChange={(expr) => put({ expr })}
                                    definition={definition}
                                    node={node}
                                    placeholder="e.g. len(value) > 0"
                                    expectsBoolean
                                    ariaLabel={`Rule ${i + 1} formula`}
                                    disabled={disabled}
                                />
                            )}

                            <input
                                type="text"
                                className={INPUT_CLS}
                                value={row.message}
                                onChange={(e) => put({ message: e.target.value })}
                                placeholder="Message shown when invalid"
                                disabled={disabled}
                                aria-label={`Rule ${i + 1} message`}
                            />
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={addRule}
                    disabled={disabled}
                    className="px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                    <Plus size={12} /> Add rule
                </button>
            </div>
        </StudioScopeProvider>
    );
}
