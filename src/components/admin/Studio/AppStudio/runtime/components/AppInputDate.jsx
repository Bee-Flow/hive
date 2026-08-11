import { todayIso } from './localDate';
import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';
import useInputChange from '../useInputChange';
import useValueFrom from '../useValueFrom';

/** App Studio runtime — 'input_date'. Spec: server/appStudio/componentSpecs.js. */

export default function AppInputDate({ node }) {
    const { name, label = 'Date', required = false, defaultValue = null } = node.props || {};
    // defaultValue is null | 'today' | an ISO date (allowIsoDate in the spec).
    const seeded = defaultValue === 'today' ? todayIso() : defaultValue;
    const { value, setValue, error } = useFormField({ name, defaultValue: seeded, required, label });
    useValueFrom(node, setValue);   // setValue, never fireChange — see AppInputSelect
    const fireChange = useInputChange(node, name);
    const id = `${node.id}-input`;
    return (
        <Field id={id} label={label} required={required} error={error}>
            <input
                id={id}
                name={name}
                type="date"
                value={value ?? ''}
                aria-required={required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => { setValue(e.target.value); fireChange(e.target.value); }}
                className={INPUT_CLASS}
                style={inputStyle(error)}
            />
        </Field>
    );
}
