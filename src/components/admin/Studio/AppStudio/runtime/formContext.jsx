import { createContext, useContext, useEffect, useState } from 'react';

/**
 * App Studio runtime — the form ↔ input contract.
 *
 * AppForm owns all field state and publishes this context; inputs never keep
 * their own submit-relevant state. The context value AppForm provides:
 *
 *   values     — { [name]: value } (defaults seeded on register)
 *   setValue   — (name, value); also clears that field's error
 *   errors     — { [name]: message } from the last failed submit
 *   register   — (name, { required, label, defaultValue, disabled }) on input
 *                mount; seeds the default into values when the name is new
 *   unregister — (name) on unmount (value is kept; only validation forgets it)
 *   pending    — true while the form's onSubmit action is running
 *
 * Inputs go through useFormField() below, which degrades to plain local state
 * when rendered outside a form — the validator rejects that at publish time,
 * but the runtime must never crash over it.
 */

export const FormContext = createContext(null);

/**
 * "The node around me is switched off."
 *
 * AppRenderer wraps a node whose `enabledWhen` is false in an inert, unfocusable
 * DisabledWrap — but the input inside still mounted and still registered itself
 * as required, so a required field the user could not reach blocked submit with
 * an error they could not clear. The wrapper publishes the state here and the
 * field carries it into its registration, where AppForm skips its rules.
 */
export const FieldDisabledContext = createContext(false);

export function useFormContext() {
    return useContext(FormContext);
}

/**
 * useFormField({ name, defaultValue, required, label })
 *   → { value, setValue, error, pending }
 */
export function useFormField({ name, defaultValue = null, required = false, label = '' }) {
    const form = useContext(FormContext);
    const disabled = useContext(FieldDisabledContext);
    const [local, setLocal] = useState(defaultValue);

    useEffect(() => {
        if (!form || !name) return undefined;
        form.register(name, { required: !!required, label, defaultValue, disabled: !!disabled });
        return () => form.unregister(name);
        // register/unregister are stable (useCallback in AppForm); defaultValue
        // is schema data and only changes alongside the node itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, name, required, label, disabled]);

    if (!form || !name) {
        return { value: local, setValue: setLocal, error: null, pending: false };
    }
    const value = Object.prototype.hasOwnProperty.call(form.values, name)
        ? form.values[name]
        : defaultValue;
    return {
        value,
        setValue: (v) => form.setValue(name, v),
        error: form.errors[name] || null,
        pending: !!form.pending,
    };
}

export default FormContext;
