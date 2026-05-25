import React, { createContext, useContext } from 'react';

/**
 * Carries the upstream variable groups + merged sample-root tree from the
 * StepInspector down to BindingField/TemplateField without each settings
 * subcomponent having to thread `groups` through its own props. Lets the
 * per-field {} button open a VariablePicker that already knows what's
 * available — no parent coordination needed.
 *
 * Default empty so the fields render a graceful "no upstream variables
 * yet" message when used outside a provider.
 */
const VariablePickerContext = createContext({ groups: [], previewSample: null });

export function VariablePickerProvider({ groups, previewSample, children }) {
    const value = React.useMemo(
        () => ({ groups: groups || [], previewSample: previewSample || null }),
        [groups, previewSample],
    );
    return (
        <VariablePickerContext.Provider value={value}>
            {children}
        </VariablePickerContext.Provider>
    );
}

export function useVariablePickerContext() {
    return useContext(VariablePickerContext);
}
