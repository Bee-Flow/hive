import { useFormField } from '../formContext';
import { Field } from '../uiBits';
import useInputChange from '../useInputChange';

/**
 * App Studio runtime — 'input_checkbox'. Spec: server/appStudio/componentSpecs.js.
 *
 * `input_checkbox` is isInput, so the inspector's Logic section offers
 * validation rules on it — and this was the one input that rendered none of
 * them: it took only `{ value, setValue }` off the form and skipped the shared
 * Field wrapper, so "you have to agree to the terms" was enforced on submit and
 * never explained on screen.
 */
export default function AppInputCheckbox({ node }) {
    const { name, label = 'Yes', defaultChecked = false, required = false } = node.props || {};
    const { value, setValue, error } = useFormField({
        name, defaultValue: !!defaultChecked, required, label,
    });
    const fireChange = useInputChange(node, name);
    const id = `${node.id}-input`;

    return (
        // The visible text belongs to the checkbox itself, so Field carries no
        // label of its own — only the error, which is what was missing.
        <Field id={id} label={null} error={error}>
            <label htmlFor={id} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                    id={id}
                    name={name}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => { setValue(e.target.checked); fireChange(e.target.checked); }}
                    aria-required={required || undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="h-4 w-4"
                    style={{ accentColor: 'var(--app-primary)' }}
                />
                <span>
                    {label}
                    {required ? <span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span> : null}
                </span>
            </label>
        </Field>
    );
}
