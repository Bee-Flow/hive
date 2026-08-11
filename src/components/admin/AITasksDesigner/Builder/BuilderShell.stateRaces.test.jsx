import { render, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Builder state races — three ways an edit or a run silently disappeared.
 *
 * All three produce NO error: the request succeeds, the toast says "saved",
 * and the state the shell keeps around is quietly wrong. That is exactly the
 * class of bug that regresses unnoticed, so each test names its symptom.
 *
 * The shell is driven through mocked children: BuildTab and SettingsTab hand
 * back the callbacks they'd invoke from the canvas / the Settings form, and
 * `authFetch` stands in for the server (it echoes writes back the way the real
 * PUT does, so the shell sees a realistic round-trip).
 */

vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../shared/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Heavy leaves the shell only needs for their exports / rendering.
vi.mock('./DiagramPane', () => ({ default: () => null, applyAddNode: (d) => d }));
vi.mock('../../../InputArea', () => ({ default: () => null }));
vi.mock('../../Studio/Executions/ExecutionsPanel', () => ({ default: () => null }));
vi.mock('./VersionHistoryPanel', () => ({ default: () => null }));
vi.mock('./TriggerDiagnosePanel', () => ({ default: () => null }));

let buildTab = null;
let header = null;
let settings = null;
vi.mock('./BuilderHeader', () => ({ default: (p) => { header = p; return null; } }));
vi.mock('./BuildTab', () => ({ default: (p) => { buildTab = p; header = p.headerProps; return null; } }));
vi.mock('./SettingsTab', () => ({ default: (p) => { settings = p; return null; } }));

import BuilderShell from './BuilderShell.jsx';
import { authFetch } from '../../../../utils/helpers';

const D0 = () => ({
    schemaVersion: 2,
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', label: 'Manually' },
    steps: [{ id: 's1', type: 'ai_step', label: 'Draft it', prompt: 'hi', position: { x: 0, y: 0 } }],
    edges: [{ from: 'trg', to: 's1' }],
});

let row;        // the stored automation row
let writes;     // [{ method, url, body }] in order
let dryRunGate; // deferred control over POST /dry-run
let activeRuns;

const json = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: () => Promise.resolve(body) });

// The last definition the shell PUT to the server.
const lastPutDefinition = () => {
    for (let i = writes.length - 1; i >= 0; i--) {
        if (writes[i].method === 'PUT' && writes[i].body?.definition) return writes[i].body.definition;
    }
    return null;
};

const putCount = () => writes.filter(w => w.method === 'PUT').length;

// Let the debounced visual save (500ms) fire and settle.
const flushDebouncedSave = async () => {
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });
};

const mountShell = async () => {
    render(<BuilderShell automationId="a1" onBack={() => {}} user={{ id: 'u1' }} />);
    // Wait for the GET to land so the canvas has the stored definition.
    await waitFor(() => expect(buildTab?.rootDef?.steps?.length).toBe(1));
};

describe('BuilderShell — state races', () => {
    beforeEach(() => {
        buildTab = null; header = null; settings = null;
        row = { id: 'a1', title: 'Weekly digest', description: null, definition: D0() };
        writes = [];
        dryRunGate = null;
        activeRuns = [];
        authFetch.mockReset();
        authFetch.mockImplementation((url, opts = {}) => {
            const method = opts.method || 'GET';
            if (url === '/api/automation/a1' && method === 'GET') return Promise.resolve(json({ automation: { ...row } }));
            if (url === '/api/automation/a1' && method === 'PUT') {
                const body = JSON.parse(opts.body);
                writes.push({ method, url, body });
                row = { ...row, ...body };
                return Promise.resolve(json({ automation: { ...row } }));
            }
            if (url === '/api/automation/a1/dry-run') {
                return new Promise((res, rej) => { dryRunGate = { res, rej }; });
            }
            if (url === '/api/automation/_runs/active') return Promise.resolve(json({ active: activeRuns }));
            if (url.startsWith('/api/automation/builder/session/')) return Promise.resolve(json({}, { ok: false, status: 404 }));
            if (url.startsWith('/api/automation/a1/runs')) return Promise.resolve(json({ runs: [] }));
            if (url.startsWith('/ai/config/tiers-for-user')) return Promise.resolve(json({ auto: { label: 'Auto' } }));
            return Promise.resolve(json({}));
        });
    });

    afterEach(() => { cleanup(); });

    it('keeps a Settings save when the next canvas edit is committed', async () => {
        await mountShell();

        // 1. A canvas edit seeds state.draft (moving a node is enough).
        const moved = { ...buildTab.scopedDef, steps: [{ ...buildTab.scopedDef.steps[0], position: { x: 120, y: 40 } }] };
        act(() => { buildTab.onVisualEdit(moved); });
        await flushDebouncedSave();

        // 2. Settings tab: enable "on success" notifications and Save. This is
        //    the exact payload SettingsTab.onApply builds — server definition +
        //    the notification/trigger-payload fields.
        act(() => { header.onTabChange('settings'); });
        await waitFor(() => expect(settings).toBeTruthy());
        const settingsDef = { ...row.definition, manualTriggerPayload: null, notificationSettings: { onSuccess: true } };
        await act(async () => {
            await settings.onSave({ title: 'Weekly digest', description: null, definition: settingsDef });
        });
        expect(row.definition.notificationSettings).toEqual({ onSuccess: true });

        // 3. Back to the editor, add any step. The commit wraps the CURRENT
        //    draft — which used to still be the pre-Settings one, so this write
        //    reverted the setting with no error anywhere.
        act(() => { header.onTabChange('build'); });
        await waitFor(() => expect(buildTab.scopedDef).toBeTruthy());
        expect(buildTab.scopedDef.notificationSettings).toEqual({ onSuccess: true });

        const withStep = {
            ...buildTab.scopedDef,
            steps: [...buildTab.scopedDef.steps, { id: 's2', type: 'ai_step', label: 'Send it', position: { x: 300, y: 40 } }],
        };
        act(() => { buildTab.onVisualEdit(withStep); });
        await flushDebouncedSave();

        expect(lastPutDefinition().notificationSettings).toEqual({ onSuccess: true });
        expect(row.definition.notificationSettings).toEqual({ onSuccess: true });
        expect(row.definition.steps.map(s => s.id)).toEqual(['s1', 's2']);
    });

    it('does not adopt the server definition on a title-only rename', async () => {
        await mountShell();

        // A canvas edit that has NOT been persisted yet (debounce still pending)
        // is newer than the row a rename reads back — adopting it would revert
        // the canvas.
        const moved = { ...buildTab.scopedDef, steps: [{ ...buildTab.scopedDef.steps[0], position: { x: 500, y: 90 } }] };
        act(() => { buildTab.onVisualEdit(moved); });
        await act(async () => { await header.onRename('Renamed'); });

        expect(buildTab.rootDef.steps[0].position).toEqual({ x: 500, y: 90 });
        await flushDebouncedSave();
        expect(row.definition.steps[0].position).toEqual({ x: 500, y: 90 });
    });

    it('releases the running state when the run-start request throws (BFSF-360)', async () => {
        activeRuns = [{ automationId: 'a1', runId: 'run-x', status: 'running', startedAt: 1 }];
        await mountShell();

        act(() => { header.onDryRun(); });
        // watchActiveRun discovers the queued run and shows the progress stub;
        // this is what disables every ▶ Execute button while a run is going.
        await waitFor(() => expect(buildTab.state.dryRun?.status).toBe('running'));

        await act(async () => {
            dryRunGate.rej(new Error('Network down'));
            for (let i = 0; i < 8; i++) await Promise.resolve();
        });

        // Nothing else will ever settle this stub — no run record is coming.
        expect(buildTab.state.dryRun.status).toBe('error');
        expect(buildTab.fatalError).toBe('Network down');
    });

    it('puts a step-inspector save into undo/redo history so Redo cannot revert it', async () => {
        await mountShell();

        // 1. Canvas edit → history entry.
        const moved = { ...buildTab.scopedDef, steps: [{ ...buildTab.scopedDef.steps[0], position: { x: 200, y: 0 } }] };
        act(() => { buildTab.onVisualEdit(moved); });
        await flushDebouncedSave();

        // 2. Undo it — this is what loads the redo stack.
        act(() => { header.onUndo(); });
        await flushDebouncedSave();
        expect(header.canRedo).toBe(true);

        // 3. Now save from the node inspector.
        const beforeInspectorPuts = putCount();
        const edited = { ...buildTab.scopedDef, steps: [{ ...buildTab.scopedDef.steps[0], prompt: 'inspector wrote this' }] };
        await act(async () => { await buildTab.onSaveStep(edited); });
        expect(row.definition.steps[0].prompt).toBe('inspector wrote this');

        // The inspector's edit is a new branch: it clears the redo stack rather
        // than leaving a stale `future` entry that Redo would restore over it.
        expect(header.canRedo).toBe(false);
        act(() => { header.onRedo(); });
        await flushDebouncedSave();
        expect(buildTab.rootDef.steps[0].prompt).toBe('inspector wrote this');

        // Undo still works, and reaches the pre-inspector definition.
        expect(header.canUndo).toBe(true);
        act(() => { header.onUndo(); });
        await flushDebouncedSave();
        expect(buildTab.rootDef.steps[0].prompt).toBe('hi');

        // Committing to history must not double-write: the inspector persists
        // the definition itself, so applyVisualDraft's debounced PUT is skipped.
        // (The undo above is a local edit and legitimately persists once.)
        expect(putCount() - beforeInspectorPuts).toBe(2);
    });
});
