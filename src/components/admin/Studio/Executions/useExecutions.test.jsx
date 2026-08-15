import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
// One mutable api object the mocked hook returns; methods are reassigned
// fresh (vi.fn) per test so call assertions stay isolated.
const { apiMock } = vi.hoisted(() => ({ apiMock: {} }));

vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => apiMock }));

import useExecutions, { statusFilterToServer } from './useExecutions.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const iso = () => new Date().toISOString();

const RUNS = [
    { id: 'r1', status: 'success', startedAt: '2026-06-27T10:00:00.000Z', automationId: 'a1', automationTitle: 'Auto' },
    { id: 'r2', status: 'success', startedAt: '2026-06-27T09:00:00.000Z', automationId: 'a1', automationTitle: 'Auto' },
];

beforeEach(() => {
    apiMock.listRecentRuns = vi.fn().mockResolvedValue({ runs: RUNS, nextCursor: null });
    apiMock.listRuns = vi.fn().mockResolvedValue({ runs: [], nextCursor: null });
    apiMock.listStepRuns = vi.fn().mockResolvedValue({ runs: [], nextCursor: null });
    apiMock.getRunFacets = vi.fn().mockResolvedValue({ facets: {} });
});

// ── statusFilterToServer ─────────────────────────────────────────────────────
describe('statusFilterToServer', () => {
    it('maps each filter to its server status set', () => {
        expect(statusFilterToServer('all')).toBeUndefined();
        expect(statusFilterToServer('running')).toEqual(['running', 'queued']);
        expect(statusFilterToServer('awaiting')).toEqual(['awaiting_approval', 'awaiting_confirm', 'awaiting_form']);
        expect(statusFilterToServer('cancelled')).toEqual(['cancelled']);
        expect(statusFilterToServer('error')).toEqual(['error']);
        expect(statusFilterToServer('success')).toEqual(['success']);
    });
});

// ── hook ─────────────────────────────────────────────────────────────────────
describe('useExecutions — load + live merge', () => {
    const renderLoaded = async () => {
        const view = renderHook(() => useExecutions({ scope: 'global' }));
        await waitFor(() => expect(view.result.current.loading).toBe(false));
        await waitFor(() => expect(view.result.current.rows).toHaveLength(2));
        return view;
    };

    it('initial load yields the mocked runs', async () => {
        const { result } = await renderLoaded();
        expect(result.current.rows.map(r => r.id)).toEqual(['r1', 'r2']);
        expect(result.current.rows[0].status).toBe('success');
    });

    it('run.started PREPENDS a new running row', async () => {
        const { result } = await renderLoaded();
        act(() => {
            result.current.applyEvent('run.started', {
                runId: 'r3', automationId: 'a1', title: 'Auto', status: 'running', at: iso(),
            });
        });
        expect(result.current.rows).toHaveLength(3);
        expect(result.current.rows[0].id).toBe('r3');
        expect(result.current.rows[0].status).toBe('running');
    });

    it('run.finished PATCHES the existing row and does not add a row', async () => {
        const { result } = await renderLoaded();
        act(() => {
            result.current.applyEvent('run.finished', { runId: 'r1', status: 'success', durationMs: 1200 });
        });
        expect(result.current.rows).toHaveLength(2);
        const r1 = result.current.rows.find(r => r.id === 'r1');
        expect(r1.durationMs).toBe(1200);
    });

    it('run.started for an existing run does not duplicate; updates in place', async () => {
        const { result } = await renderLoaded();
        act(() => {
            result.current.applyEvent('run.started', {
                runId: 'r2', automationId: 'a1', title: 'Auto', status: 'running', at: iso(),
            });
        });
        expect(result.current.rows).toHaveLength(2);
        const r2 = result.current.rows.find(r => r.id === 'r2');
        expect(r2.status).toBe('running');
    });

    it('step.* events are a no-op on the list', async () => {
        const { result } = await renderLoaded();
        const before = result.current.rows;
        act(() => {
            result.current.applyEvent('step.started', { runId: 'r1', stepId: 's1' });
            result.current.applyEvent('step.finished', { runId: 'r1', stepId: 's1' });
            result.current.applyEvent('step.heartbeat', { runId: 'r1', stepId: 's1' });
        });
        expect(result.current.rows).toBe(before);
        expect(result.current.rows).toHaveLength(2);
    });
});
