import { useEffect, useRef } from 'react';
import { resolveBinding } from './resolveBinding';
import { useRuntime } from './RuntimeContext';

/**
 * `valueFrom` — push a value INTO a form field from outside the form.
 *
 * This is the primitive behind two features that would otherwise each need
 * their own component: an "AI draft" button (ai_generate writes resultVar) and a
 * canned-reply picker (set_variable). Both just write a variable; the field
 * reads it back through a formula binding.
 *
 * Semantics that matter:
 *  • Only a CHANGE pushes. The user must be able to edit the drafted text
 *    afterwards without it being overwritten on every re-render.
 *  • Neither undefined NOR null pushes. An unresolved binding (the variable does
 *    not exist yet) must leave the field alone rather than clearing what is
 *    typed — and so must a resolved EMPTY one. Only `undefined` used to be
 *    treated as "nothing yet", so a record column that is NULL landing after
 *    the first paint wiped the reply the user was halfway through writing.
 *    There is no way to say "clear this field" through valueFrom, and there
 *    should not be: the field's own default is what an empty state looks like.
 *  • The first resolved value pushes too, so a field can be pre-filled.
 */
export default function useValueFrom(node, setValue) {
    const { actionState, dataState, scope } = useRuntime();
    const binding = node?.props?.valueFrom;
    const { value } = resolveBinding(binding, { actionState, dataState, scope });

    // Compared by serialised identity so an equal-but-new object (a fresh
    // resolve of the same formula) does not stomp the user's edits.
    //
    // `setValue` is recreated on every render by useFormField, so it stays out
    // of the dependency list on purpose — the token guard below already makes a
    // repeat run a no-op, and depending on it would just re-enter the effect
    // constantly. The ref is only ever written INSIDE the effect (writing one
    // during render is what breaks concurrent rendering).
    const lastRef = useRef(undefined);

    useEffect(() => {
        if (value === undefined || value === null) return;
        let token;
        try { token = JSON.stringify(value); } catch { token = String(value); }
        if (token === lastRef.current) return;
        lastRef.current = token;
        setValue(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
}
