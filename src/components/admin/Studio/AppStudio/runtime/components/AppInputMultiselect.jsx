import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';
import useInputChange from '../useInputChange';
import useValueFrom from '../useValueFrom';

/**
 * App Studio runtime — 'input_multiselect'. Spec: server/appStudio/componentSpecs.js.
 * Chips for the chosen options + an "add" dropdown of the remaining ones.
 * SUBMITS an array of the selected option VALUES.
 */

/**
 * Whatever the field holds, read as a list.
 *
 * A `valueFrom` bound to a text column ('urgent,billing') pushed a STRING in.
 * The old code degraded that to [] for display while the form kept the string:
 * every option looked unselected, `required` still passed, submitting untouched
 * sent a string where an array was expected — and adding one chip committed
 * [thatChip] over the top of the original value.
 */
export function toValueList(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [value];
}

export default function AppInputMultiselect({ node }) {
    const { name, label = 'Choices', options = [], required = false, defaultValue = [] } = node.props || {};
    const { value, setValue, error } = useFormField({
        name, defaultValue: Array.isArray(defaultValue) ? defaultValue : [], required, label,
    });
    useValueFrom(node, setValue);   // setValue, never fireChange — see AppInputSelect
    const fireChange = useInputChange(node, name);
    const id = `${node.id}-input`;

    const opts = Array.isArray(options) ? options : [];
    const selected = toValueList(value);
    // Normalise the FORM's copy too, so an untouched submit sends the array the
    // routine expects rather than the scalar that was pushed in.
    useEffect(() => {
        if (value != null && value !== '' && !Array.isArray(value)) setValue(toValueList(value));
        // setValue is recreated every render by useFormField — see useValueFrom.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // The DOM hands option values back as strings, exactly as in AppInputSelect.
    const same = (a, b) => String(a) === String(b);
    const labelFor = (v) => opts.find((o) => same(o.value, v))?.label || v;
    const available = opts.filter((o) => !selected.some((v) => same(v, o.value)));

    // Adding and removing a chip are both "the value changed" — a tag bar that
    // only saved on add would silently lose removals.
    const commit = (next) => { setValue(next); fireChange(next); };
    const add = (v) => { if (v && !selected.some((x) => same(x, v))) commit([...selected, v]); };
    const remove = (v) => commit(selected.filter((x) => !same(x, v)));

    return (
        <Field id={id} label={label} required={required} error={error}>
            <div className="flex flex-col gap-2">
                {selected.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${label} selected`}>
                        {selected.map((v) => (
                            <li
                                key={v}
                                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-medium"
                                style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)', borderRadius: 'var(--app-radius)' }}
                            >
                                {labelFor(v)}
                                <button type="button" onClick={() => remove(v)} aria-label={`Remove ${labelFor(v)}`} style={{ color: 'inherit' }}>
                                    <X className="w-3 h-3" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <select
                    id={id}
                    value=""
                    aria-label={`Add to ${label}`}
                    aria-required={required || undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(e) => { add(e.target.value); e.target.value = ''; }}
                    className={INPUT_CLASS}
                    style={inputStyle(error)}
                    disabled={available.length === 0}
                >
                    <option value="" disabled>
                        {available.length ? 'Add an option…' : 'All options selected'}
                    </option>
                    {available.map((o) => (
                        <option key={o.value} value={o.value}>{o.label || o.value}</option>
                    ))}
                </select>
            </div>
        </Field>
    );
}
