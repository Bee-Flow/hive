import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAutomationBuilderStream from './useAutomationBuilderStream';
import { authFetch } from '../utils/helpers';

vi.mock('../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

/**
 * Run-state regressions behind BFSF-360 ("Execute does nothing" / "the output
 * panel is frozen on the previous run"). Each test names the symptom it locks
 * down; all four are state races that produce no error anywhere, so nothing but
 * a test catches them coming back.
 */

const json = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: () => Promise.resolve(body),
});

// Three nodes with output from a completed full run — the state every one of
// these tests starts from.
const FINISHED_RUN_ROWS = [
    { stepId: 's1', status: 'success', output: { a: 1 } },
    { stepId: 's2', status: 'success', output: { b: 2 } },
    { stepId: 's3', status: 'success', output: { c: 3 } },
];

const stepIds = (result) => result.current.state.steps.map(s => s.stepId).sort();

describe('useAutomationBuilderStream — run state', () => {
    beforeEach(() => {
        authFetch.mockReset();
        // Default: the active-run discovery poll started by watchActiveRun.
        authFetch.mockResolvedValue(json({ active: [] }));
    });

    it('a partial "Execute step" poll merges — it does not wipe every other node', async () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));
        act(() => { result.current.setRunResult({ id: 'run-1', status: 'success' }, FINISHED_RUN_ROWS); });

        // Executing ONE step mints a fresh run whose /steps response contains
        // only that step's row. Replacing state.steps with it erased s1 and s3
        // from the panel — and executeStep's own merge then merged into an
        // already-wiped map.
        let resolveRun;
        authFetch.mockImplementation((url) => {
            if (url.includes('/steps/s2/run')) return new Promise((r) => { resolveRun = r; });
            if (url.includes('/runs/run-2/steps')) {
                return Promise.resolve(json({ steps: [{ stepId: 's2', status: 'running', output: null }] }));
            }
            return Promise.resolve(json({ active: [] }));
        });

        let exec;
        await act(async () => {
            exec = result.current.executeStep('s2');
            await Promise.resolve();
        });
        await act(async () => { await result.current.pollRunProgress('run-2'); });

        expect(stepIds(result)).toEqual(['s1', 's2', 's3']);
        expect(result.current.state.steps.find(s => s.stepId === 's1').output).toEqual({ a: 1 });
        expect(result.current.state.steps.find(s => s.stepId === 's3').output).toEqual({ c: 3 });

        await act(async () => {
            resolveRun(json({
                run: { id: 'run-2', status: 'success' },
                steps: [{ stepId: 's2', status: 'success', output: { b: 22 } }],
            }));
            await exec;
        });

        // The executed step picked up its new output, the others kept theirs.
        expect(stepIds(result)).toEqual(['s1', 's2', 's3']);
        expect(result.current.state.steps.find(s => s.stepId === 's2').output).toEqual({ b: 22 });
        expect(result.current.state.steps.find(s => s.stepId === 's1').output).toEqual({ a: 1 });
    });

    it('a fresh FULL run still clears the previous run rows, then merges within that run', async () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));
        act(() => { result.current.setRunResult({ id: 'run-1', status: 'success' }, FINISHED_RUN_ROWS); });

        authFetch.mockResolvedValueOnce(json({ steps: [{ stepId: 's1', status: 'running', output: null }] }));
        await act(async () => { await result.current.pollRunProgress('run-9'); });
        // New run id + no partial execute in flight → start from a clean slate.
        expect(stepIds(result)).toEqual(['s1']);

        authFetch.mockResolvedValueOnce(json({ steps: [{ stepId: 's2', status: 'running', output: null }] }));
        await act(async () => { await result.current.pollRunProgress('run-9'); });
        // Same run → merge, so the row polled a moment ago survives.
        expect(stepIds(result)).toEqual(['s1', 's2']);
    });

    it('ignores a poll response that lands after a newer one', async () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));

        let resolveSlow;
        authFetch
            .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }))
            .mockImplementationOnce(() => Promise.resolve(json({
                steps: [{ stepId: 's1', status: 'success', output: { v: 2 } }],
            })));

        let slow;
        await act(async () => {
            slow = result.current.pollRunProgress('run-3');   // issued first, answers last
            await result.current.pollRunProgress('run-3');    // issued second, answers first
        });
        expect(result.current.state.steps).toEqual([{ stepId: 's1', status: 'success', output: { v: 2 } }]);

        await act(async () => {
            resolveSlow(json({ steps: [{ stepId: 's1', status: 'running', output: null }] }));
            await slow;
        });
        // The older snapshot must not re-freeze the panel on 'running'.
        expect(result.current.state.steps).toEqual([{ stepId: 's1', status: 'success', output: { v: 2 } }]);
    });

    it('a failed Execute clears that step\'s previous output instead of badging it Success', async () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));
        act(() => {
            result.current.setRunResult({ id: 'run-1', status: 'success' }, [
                ...FINISHED_RUN_ROWS,
                { stepId: 's2/inner', parentStepId: 's2', status: 'success', output: { deep: true } },
            ]);
        });

        authFetch.mockImplementation((url) => (url.includes('/steps/s2/run')
            ? Promise.resolve(json({ error: 'Gmail auth expired' }, { ok: false, status: 400 }))
            : Promise.resolve(json({ active: [] }))));

        await act(async () => { await result.current.executeStep('s2'); });

        const s2 = result.current.state.steps.find(s => s.stepId === 's2');
        expect(s2.status).toBe('error');
        expect(s2.output).toBeNull();
        expect(s2.error).toBe('Gmail auth expired');
        // The failed step's flowlet sub-rows belonged to the superseded attempt.
        expect(result.current.state.steps.some(s => s.stepId === 's2/inner')).toBe(false);
        // Untouched nodes keep their output.
        expect(result.current.state.steps.find(s => s.stepId === 's1').output).toEqual({ a: 1 });
        expect(result.current.state.error).toBe('Gmail auth expired');
    });

    it('settleRun releases a running progress stub without discarding the step rows', () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));
        act(() => { result.current.setRunResult({ id: 'run-5', status: 'running' }, FINISHED_RUN_ROWS); });

        act(() => { result.current.settleRun(); });

        // 'running'/'queued' is what keeps liveRunInFlight true and every ▶
        // Execute button disabled.
        expect(result.current.state.dryRun.status).toBe('error');
        expect(result.current.state.steps).toHaveLength(3);
    });

    it('settleRun leaves a genuinely completed run alone', () => {
        const { result } = renderHook(() => useAutomationBuilderStream({ automationId: 'a1' }));
        act(() => { result.current.setRunResult({ id: 'run-6', status: 'success' }, FINISHED_RUN_ROWS); });

        act(() => { result.current.settleRun(); });

        expect(result.current.state.dryRun.status).toBe('success');
    });
});
