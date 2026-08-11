/**
 * Regression test for a React error #185 ("Maximum update depth exceeded")
 * reproduced live on /app/studio/routines.
 *
 * Root cause: `setEditing: (next) => reportEditing(activeApp.id, next)` was a
 * fresh arrow function every Studio render. The active app (AITasksDesigner)
 * has a `useEffect(() => { onEditingChange?.(automationEditing); ... },
 * [automationEditing, onEditingChange])` — an unstable `onEditingChange`
 * identity makes that effect re-fire every render, calling reportEditing →
 * setEditingById(new object) → Studio re-renders → new setEditing → the
 * child's effect deps change again → infinite loop.
 *
 * The fix (index.jsx): reportEditing's setState is a no-op (returns the SAME
 * object) when the per-app value hasn't actually changed, so React bails out
 * of the render cascade regardless of how often the child re-invokes it with
 * an identical value; `setEditing` and the parent-notification effect are
 * also stabilised. This test mounts a mock "app" that mimics the exact
 * effect shape that triggered the loop and asserts Studio settles instead of
 * looping (jsdom/React would throw "Maximum update depth exceeded" if it
 * still looped, same as the browser's minified error #185).
 */
import { render, screen, cleanup } from '@testing-library/react';
import React, { useEffect } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Studio from './index';

vi.mock('../../../hooks/useTranslation', () => ({
    default: () => ({ t: (_key, fallback) => fallback ?? _key }),
}));
vi.mock('../../LicenseContext', () => ({
    useLicenseContext: () => ({ hasFeature: () => true }),
}));

// Mimics the AITasksDesigner effect shape that caused the loop: re-fires
// whenever ITS `onEditingChange` prop identity changes, and reports back
// unconditionally.
function LoopProneApp({ onEditingChange }) {
    useEffect(() => {
        onEditingChange?.(true);
        return () => { onEditingChange?.(false); };
    }, [onEditingChange]);
    return <div>loop-prone-app</div>;
}

vi.mock('./studioApps', () => ({
    STUDIO_APPS: [
        {
            id: 'aiTasks',
            urlSegment: 'routines',
            labelKey: 'x', labelFallback: 'Routines',
            Icon: () => <span />,
            gate: () => true,
            Component: LoopProneApp,
            getProps: ({ setEditing }) => ({ onEditingChange: setEditing }),
        },
    ],
    makeCanUse: () => () => true,
}));

describe('Studio — editing-state ping-pong regression', () => {
    beforeEach(() => cleanup());

    it('settles instead of looping when the active app re-fires an unstable onEditingChange every render', () => {
        // If the fix regresses, React throws "Maximum update depth exceeded"
        // synchronously during this render — the test fails with that throw
        // rather than a false negative.
        expect(() => {
            render(<Studio user={{}} section="aiTasks" onEditingChange={vi.fn()} />);
        }).not.toThrow();
        expect(screen.getByText('loop-prone-app')).toBeTruthy();
    });

    it('reports the aggregate editing state to the parent exactly once it stabilises', async () => {
        const onEditingChange = vi.fn();
        render(<Studio user={{}} section="aiTasks" onEditingChange={onEditingChange} />);
        // Aggregate flips true → parent notified with the settled value; not
        // spammed on every re-render.
        await vi.waitFor(() => expect(onEditingChange).toHaveBeenCalledWith(true));
        const callCountAfterSettle = onEditingChange.mock.calls.length;
        await new Promise(r => setTimeout(r, 20));
        expect(onEditingChange.mock.calls.length).toBe(callCountAfterSettle);
    });
});
