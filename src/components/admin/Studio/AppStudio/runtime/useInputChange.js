import { useCallback } from 'react';
import { useFormContext } from './formContext';
import { useRuntime } from './RuntimeContext';

/**
 * `onChange` — run an action the moment a DISCRETE input changes.
 *
 * This is what turns a row of dropdowns into a triage bar: pick a status and it
 * saves, no Save button. Offered only on select / checkbox / date / multiselect;
 * a text field would fire on every keystroke, which is why the spec does not
 * declare the event there.
 *
 * The action receives the WHOLE form's values with this field's new value
 * already applied — `setValue` is async state, so reading the context back on
 * the same tick would hand the action the previous value. That off-by-one is
 * exactly the bug that makes a status bar save the status you picked *before*
 * this one.
 *
 * Run mode only: clicking through a dropdown while designing must not write.
 */
export default function useInputChange(node, name) {
    const { mode, runAction } = useRuntime();
    const form = useFormContext();

    return useCallback((nextValue) => {
        if (mode !== 'run') return;
        const actionId = node?.onChange;
        if (!actionId) return;
        const values = { ...(form?.values || {}) };
        if (name) values[name] = nextValue;
        runAction(actionId, { formValues: values });
    }, [mode, runAction, node?.onChange, form, name]);
}
