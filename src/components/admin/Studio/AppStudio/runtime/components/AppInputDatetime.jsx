import { nowLocalIso, todayIso } from './localDate';
import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';

/** App Studio runtime — 'input_datetime'. Spec: server/appStudio/componentSpecs.js. */

/** Seed value for defaultValue null | 'now' | 'today' | an ISO literal. */
function seedValue(defaultValue, withTime) {
    if (defaultValue == null) return null;
    if (defaultValue === 'now') return withTime ? nowLocalIso() : todayIso();
    if (defaultValue === 'today') return withTime ? `${todayIso()}T00:00` : todayIso();
    // An ISO literal (allowIsoDate) — trim to the control's shape.
    return withTime ? String(defaultValue).slice(0, 16) : String(defaultValue).slice(0, 10);
}

export default function AppInputDatetime({ node }) {
    const {
        name, label = 'When', required = false, withTime = true, defaultValue = null,
    } = node.props || {};
    const seeded = seedValue(defaultValue, withTime);
    const { value, setValue, error } = useFormField({ name, defaultValue: seeded, required, label });
    const id = `${node.id}-input`;

    return (
        <Field id={id} label={label} required={required} error={error}>
            <input
                id={id}
                name={name}
                type={withTime ? 'datetime-local' : 'date'}
                value={value ?? ''}
                aria-required={required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setValue(e.target.value || null)}
                className={INPUT_CLASS}
                style={inputStyle(error)}
            />
        </Field>
    );
}
