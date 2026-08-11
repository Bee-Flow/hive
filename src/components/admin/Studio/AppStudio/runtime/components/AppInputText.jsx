import { useFormField } from '../formContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';
import useValueFrom from '../useValueFrom';

/** App Studio runtime — 'input_text'. Spec: server/appStudio/componentSpecs.js. */

export default function AppInputText({ node }) {
    const {
        name, label = 'Text', placeholder = null, required = false,
        defaultValue = null, inputType = 'text',
    } = node.props || {};
    const { value, setValue, error } = useFormField({ name, defaultValue, required, label });
    useValueFrom(node, setValue);
    const id = `${node.id}-input`;
    return (
        <Field id={id} label={label} required={required} error={error}>
            <input
                id={id}
                name={name}
                type={['text', 'email', 'url'].includes(inputType) ? inputType : 'text'}
                value={value ?? ''}
                placeholder={placeholder || undefined}
                aria-required={required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setValue(e.target.value)}
                className={INPUT_CLASS}
                style={inputStyle(error)}
            />
        </Field>
    );
}
