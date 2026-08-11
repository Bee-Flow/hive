import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';
import useInputChange from '../useInputChange';
import useValueFrom from '../useValueFrom';

/** App Studio runtime — 'input_select'. Spec: server/appStudio/componentSpecs.js. */

// The DOM emits option values as strings, so option matching compares as strings.
function hasOption(opts, v) {
    return v != null && v !== '' && opts.some((o) => String(o?.value) === String(v));
}

export default function AppInputSelect({ node }) {
    const {
        name, label = 'Choice', options = [], required = false,
        defaultValue = null, placeholder = null,
    } = node.props || {};
    const opts = Array.isArray(options) ? options : [];
    // A default that matches no option would render blank while still SUBMITTING
    // — seed (and show) nothing instead of a value the user cannot see.
    const seeded = hasOption(opts, defaultValue) ? defaultValue : null;
    const { value, setValue, error } = useFormField({ name, defaultValue: seeded, required, label });
    // Show the value the record ALREADY has. Deliberately setValue and NOT
    // fireChange: putting the current status back into the control must not
    // look like the user just picked it, or opening a ticket would write the
    // status it already had — and stamp an activity row for it.
    useValueFrom(node, setValue);
    const fireChange = useInputChange(node, name);
    const id = `${node.id}-input`;
    // A value the field HOLDS that matches no option — a valueFrom binding
    // pushing a status the author forgot to list. The control used to fall back
    // to '' and show the placeholder while still holding and submitting the
    // hidden value, so the screen said "nothing chosen" about a ticket that was
    // very much in a state. Show what it holds instead, and never silently
    // rewrite the record's own value.
    const unlisted = !hasOption(opts, value) && value != null && value !== '';
    return (
        <Field id={id} label={label} required={required} error={error}>
            <select
                id={id}
                name={name}
                value={unlisted ? String(value) : (hasOption(opts, value) ? value : '')}
                aria-required={required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => { setValue(e.target.value); fireChange(e.target.value); }}
                className={INPUT_CLASS}
                style={inputStyle(error)}
            >
                <option value="" disabled={required}>
                    {placeholder || 'Choose…'}
                </option>
                {unlisted ? (
                    <option value={String(value)} data-app-unlisted="true">{String(value)}</option>
                ) : null}
                {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
                ))}
            </select>
        </Field>
    );
}
