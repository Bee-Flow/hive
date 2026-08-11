import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Seeding `vars` from the app's declared variables — and, more delicately, NOT
 * un-seeding it while the author types.
 */

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});
vi.mock('./components/AppModal', () => ({ openAppModal: vi.fn(), closeAppModal: vi.fn() }));

import useActionRunner from './useActionRunner';

const decl = (name, type, def) => ({ name, label: name, type, default: def, description: '' });

function def(variables, actions = {}) {
    return { schemaVersion: 2, actions, ...(variables ? { variables } : {}) };
}

describe('useActionRunner — declared variables', () => {
    it('starts from the declared defaults', () => {
        const { result } = renderHook(
            () => useActionRunner('app1', def([decl('status', 'text', 'new'), decl('limit', 'number', 10)]), {}),
        );
        expect(result.current.vars).toEqual({ status: 'new', limit: 10 });
    });

    it('an app that declares nothing starts empty, exactly as before', () => {
        const { result } = renderHook(() => useActionRunner('app1', def(null), {}));
        expect(result.current.vars).toEqual({});
    });

    /*
     * THE regression. Canvas.jsx hands the hook the live editor definition,
     * which is a new object on every inspector keystroke. An effect keyed on
     * `definition` would re-seed and wipe vars.filters mid-typing.
     */
    it('a new definition object with the same declarations does not reset a written value', () => {
        const variables = [decl('status', 'text', 'new')];
        const { result, rerender } = renderHook(
            ({ d }) => useActionRunner('app1', d, {}),
            { initialProps: { d: def(variables) } },
        );

        act(() => result.current.setVar('status', 'closed'));
        expect(result.current.vars.status).toBe('closed');

        // Same declarations, brand-new definition object — an unrelated edit.
        rerender({ d: { ...def(variables), meta: { name: 'renamed' } } });
        expect(result.current.vars.status).toBe('closed');
    });

    it('adding a declaration seeds only the new name', () => {
        const { result, rerender } = renderHook(
            ({ d }) => useActionRunner('app1', d, {}),
            { initialProps: { d: def([decl('a', 'text', 'x')]) } },
        );
        act(() => result.current.setVar('a', 'written'));

        rerender({ d: def([decl('a', 'text', 'x'), decl('b', 'number', 7)]) });
        expect(result.current.vars).toEqual({ a: 'written', b: 7 });
    });

    it('changing a default does not clobber a value an action already wrote', () => {
        const { result, rerender } = renderHook(
            ({ d }) => useActionRunner('app1', d, {}),
            { initialProps: { d: def([decl('a', 'text', 'old')]) } },
        );
        act(() => result.current.setVar('a', 'from an action'));

        rerender({ d: def([decl('a', 'text', 'brand new')]) });
        expect(result.current.vars.a).toBe('from an action');
    });

    it('changing a default DOES apply while the value is untouched', () => {
        const { result, rerender } = renderHook(
            ({ d }) => useActionRunner('app1', d, {}),
            { initialProps: { d: def([decl('a', 'text', 'old')]) } },
        );
        rerender({ d: def([decl('a', 'text', 'new')]) });
        expect(result.current.vars.a).toBe('new');
    });

    it('undeclaring a variable keeps a value that was written to it', () => {
        const { result, rerender } = renderHook(
            ({ d }) => useActionRunner('app1', d, {}),
            { initialProps: { d: def([decl('a', 'text', 'x')]) } },
        );
        act(() => result.current.setVar('a', 'written'));
        rerender({ d: def([]) });
        expect(result.current.vars.a).toBe('written');
    });

    // Backwards compatibility, stated out loud: `vars` is still an open bag.
    it('setVar still works for a name nobody declared', () => {
        const { result } = renderHook(() => useActionRunner('app1', def([decl('a', 'text', 'x')]), {}));
        act(() => result.current.setVar('adhoc', 42));
        expect(result.current.vars).toEqual({ a: 'x', adhoc: 42 });
    });

    it('the filter bar’s reserved name is never seeded', () => {
        const { result } = renderHook(
            () => useActionRunner('app1', def([{ name: 'filters', label: 'f', type: 'text', default: 'x', description: '' }]), {}),
        );
        expect(result.current.vars).toEqual({});
    });
});
