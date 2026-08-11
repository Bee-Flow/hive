import { useState } from 'react';
import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';

/**
 * App Studio runtime — 'input_number'. Spec: server/appStudio/componentSpecs.js.
 *
 * `min`/`max` are handed to the DOM here for the spinner's bounds, but the form
 * renders with `noValidate`, so the browser enforces nothing — AppForm turns the
 * same two props into ordinary min/max rules (see propRules there) and that is
 * what actually rejects an out-of-range value on submit.
 */

const BAD_INPUT_MESSAGE = 'Enter a number — use a dot as the decimal separator.';

export default function AppInputNumber({ node }) {
    const {
        name, label = 'Amount', min = null, max = null, step = 1,
        required = false, defaultValue = null,
    } = node.props || {};
    const { value, setValue, error } = useFormField({ name, defaultValue, required, label });
    // A number input reports value '' for anything the browser calls BAD INPUT
    // ('3,5' in a dot locale, '1e', '1.2.3'), while the box visibly still holds
    // the typed text. Storing that '' silently emptied the field: a required
    // field then said "This field is required." under a control with content in
    // it, and an optional one submitted nothing at all.
    const [badInput, setBadInput] = useState(false);
    const shownError = error || (badInput ? BAD_INPUT_MESSAGE : null);
    const id = `${node.id}-input`;
    return (
        <Field id={id} label={label} required={required} error={shownError}>
            <input
                id={id}
                name={name}
                type="number"
                value={value ?? ''}
                min={min ?? undefined}
                max={max ?? undefined}
                step={step ?? undefined}
                aria-required={required || undefined}
                aria-invalid={shownError ? true : undefined}
                aria-describedby={shownError ? `${id}-error` : undefined}
                onChange={(e) => {
                    const raw = e.target.value;
                    setBadInput(!!e.target.validity?.badInput);
                    // Submit numbers, not numeric strings; '' stays empty (fails `required`).
                    setValue(raw === '' ? '' : Number(raw));
                }}
                className={INPUT_CLASS}
                style={inputStyle(shownError)}
            />
        </Field>
    );
}
