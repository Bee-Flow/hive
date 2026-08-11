// Mapping-state handlers for the "call" step editors (call_layer / call_block).
// Both CallLayerFields and CallStepFields open-coded an identical pair of
// handlers over `draft.inputs`:
//
//   const setInput = (name, binding) => { …delete-on-empty… set('inputs', next) };
//   const onAutoMap = () => { …autoMapInputs over the param contract… };
//
// This hook centralises that logic. Give it the current `inputs` map, the
// param `contract` ([{ name, type, required, description }]), the upstream
// `groups`, and an `onChange(nextInputs)` writer; it returns
// `{ setInput, onAutoMap }`. The shared renderer lives in CallContractFields.

import { autoMapInputs } from '../mapping/autoMapInputs';

export default function useInputMapping({ inputs, contract, groups, onChange }) {
    // Set or clear the binding for a single param. A missing binding or a
    // blank literal counts as "unset" so the key doesn't linger in the map.
    const setInput = (name, binding) => {
        const next = { ...inputs };
        if (!binding || (binding.kind === 'literal' && (binding.value === '' || binding.value == null))) delete next[name];
        else next[name] = binding;
        onChange(next);
    };

    // Auto-map every declared param from the upstream groups, merging the
    // result over the current bindings (existing bindings win).
    const onAutoMap = () => {
        const schema = {
            properties: Object.fromEntries(contract.map(p => [p.name, { type: p.type }])),
            required: contract.filter(p => p.required).map(p => p.name),
        };
        const patch = autoMapInputs(schema, inputs, groups || []);
        if (Object.keys(patch).length) onChange({ ...inputs, ...patch });
    };

    return { setInput, onAutoMap };
}
