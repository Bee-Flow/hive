/**
 * The App Studio demo must be USABLE, not just mounted: the kanban drag, the
 * autosave round trip, the version restore and the scripted AI reply are the
 * interactions a visitor actually tries. DemoHost.test.jsx already proves the
 * editor renders; these call the ROUTES handlers directly (the
 * interactions.test.js pattern) and pin that the handlers DO something and
 * that the numbers reconcile.
 *
 * Run: cd agent-hub && npx vitest run src/demo/fixtures/appStudio.test.js
 */
import { describe, it, expect } from 'vitest';
import * as mod from './appStudio';

const APP = 'app_demo_pipeline';

const call = (route, args) => {
    const handler = mod.ROUTES[route];
    expect(handler, `${route} is not fixtured`).toBeTypeOf('function');
    return handler({ params: {}, body: {}, query: new URLSearchParams(), ...args });
};

describe('definition save round trip', () => {
    it('bumps the version and hands the saved definition back on the next GET', () => {
        const state = mod.createState();
        const before = call('GET /api/studio-apps/:id', { state, params: { id: APP } });
        // The handler returns the LIVE state row, so read the version out as a
        // number before mutating — before.app aliases the row the PUT bumps.
        const baseVersion = before.app.definitionVersion;
        const edited = JSON.parse(JSON.stringify(before.app.definition));
        edited.screens[0].sections[0].children[0].props.text = 'Edited by the visitor';

        const saved = call('PUT /api/studio-apps/:id/definition', {
            state, params: { id: APP },
            body: { definition: edited, baseVersion },
        });
        expect(saved.success).toBe(true);
        expect(saved.version).toBe(baseVersion + 1);

        const after = call('GET /api/studio-apps/:id', { state, params: { id: APP } });
        expect(after.app.definitionVersion).toBe(saved.version);
        expect(after.app.definition.screens[0].sections[0].children[0].props.text)
            .toBe('Edited by the visitor');
    });
});

describe('the kanban move (preview-mode /step)', () => {
    it('writes the new stage to the record, visible on the next records read', () => {
        const state = mod.createState();
        const deal = state.records.tbl_crmdl.find(d => d.stage === 'proposal');

        const res = call('POST /api/studio-apps/:id/actions/:actionId/step', {
            state, params: { id: APP, actionId: 'act_crmmove' },
            // Exactly what AppKanban sends on a drop (see AppKanban.jsx header).
            body: { stepIndex: 0, formValues: { item: deal, value: 'won' }, vars: {} },
        });
        expect(res.ok).toBe(true);
        expect(res.result.record.stage).toBe('won');

        const read = call('GET /api/studio-apps/:id/data/tables/:tableId/records', {
            state, params: { id: APP, tableId: 'tbl_crmdl' },
        });
        expect(read.records.find(r => r.id === deal.id).stage).toBe('won');
    });

    it('the fixture action ends in a refresh step — the runner does not refetch on its own', () => {
        const state = mod.createState();
        const action = state.apps[APP].definition.actions.act_crmmove;
        expect(action.steps[action.steps.length - 1].kind).toBe('refresh');
    });
});

describe('numbers reconcile', () => {
    it('the stage aggregate equals the per-stage record counts', () => {
        const state = mod.createState();
        const { rows } = call('POST /api/studio-apps/:id/data/query', {
            state, params: { id: APP },
            body: { tableId: 'tbl_crmdl', groupBy: [{ field: 'stage' }], aggregates: [{ fn: 'count' }] },
        });
        const counted = new Map(rows.map(r => [r.stage, r.count]));
        for (const stage of ['lead', 'qualified', 'proposal', 'won', 'lost']) {
            const expected = state.records.tbl_crmdl.filter(d => d.stage === stage).length;
            expect(counted.get(stage) ?? 0, stage).toBe(expected);
        }
        expect([...counted.values()].reduce((s, n) => s + n, 0)).toBe(state.records.tbl_crmdl.length);
    });

    it('storage usage derives from the row counts', () => {
        const state = mod.createState();
        const { apps } = call('GET /api/studio-apps/mine', { state });
        const rows = Object.values(state.records).reduce((s, arr) => s + arr.length, 0);
        for (const app of apps) {
            expect(app.usage.dbBytes).toBe(rows * 4096);
            expect(app.usage.dbRatio).toBeCloseTo(app.usage.dbBytes / (256 * 1024 * 1024));
        }
    });
});

describe('the records filter interpreter', () => {
    const read = (state, filter) => call('GET /api/studio-apps/:id/data/tables/:tableId/records', {
        state, params: { id: APP, tableId: 'tbl_crmdl' },
        query: new URLSearchParams(filter ? { filter: JSON.stringify(filter) } : {}),
    });

    it('contains narrows, an empty value passes everything', () => {
        const state = mod.createState();
        expect(read(state, [{ field: 'title', op: 'contains', value: 'Vermeulen' }]).records.length).toBe(2);
        expect(read(state, [{ field: 'title', op: 'contains', value: '' }]).records.length)
            .toBe(state.records.tbl_crmdl.length);
        expect(read(state).records.length).toBe(state.records.tbl_crmdl.length);
    });

    it('id eq returns exactly the record the detail screen asks for', () => {
        const state = mod.createState();
        const { records } = read(state, [{ field: 'id', op: 'eq', value: 'rec_dl02' }]);
        expect(records).toHaveLength(1);
        expect(records[0].title).toMatch(/De Ruiter/);
    });
});

describe('the AI-builder pane', () => {
    it('the session snapshot only carries shapes the hook restores', () => {
        const state = mod.createState();
        const { snapshot } = call('GET /api/studio-apps/builder/session/:appId', {
            state, params: { appId: APP },
        });
        expect(snapshot.sessionId).toBeTruthy();
        for (const m of snapshot.messages) {
            const legal = Boolean(m.kind === 'tool' && m.name && m.label)
                || Boolean(['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
            expect(legal, JSON.stringify(m)).toBe(true);
        }
        // The conversation must end with the assistant, not a dangling tool chip.
        expect(snapshot.messages[snapshot.messages.length - 1].role).toBe('assistant');
    });

    it('a sibling app has no session — 404, the hook treats that as "fresh chat"', () => {
        const state = mod.createState();
        const res = call('GET /api/studio-apps/builder/session/:appId', {
            state, params: { appId: 'app_demo_onboard' },
        });
        expect(res).toBeInstanceOf(Response);
        expect(res.status).toBe(404);
    });

    it('the stream is real SSE, self-labels as scripted, and ends with done', async () => {
        const res = call('POST /api/studio-apps/builder/stream', {
            state: mod.createState(), body: { message: 'Add a chart of premiums per stage' },
        });
        expect(res).toBeInstanceOf(Response);
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        const text = await res.text();

        // Parseable by the hook's own framing: event line + JSON data line.
        const events = [...text.matchAll(/event: (\w+)\ndata: (.+)\n/g)]
            .map(([, ev, data]) => [ev, JSON.parse(data)]);
        expect(events.length).toBeGreaterThan(2);
        expect(events[events.length - 1][0]).toBe('done');

        const message = events.find(([ev]) => ev === 'message')[1].content;
        expect(message).toMatch(/script/i);
        expect(message).toMatch(/premiums per stage/); // echoes the visitor's text
        // Never a draft (would clobber the visitor's canvas), never an error.
        expect(events.some(([ev]) => ev === 'draft')).toBe(false);
        expect(events.some(([ev]) => ev === 'error')).toBe(false);
    });
});

describe('version history', () => {
    it('restore swaps in the stored snapshot and bumps the version', () => {
        const state = mod.createState();
        const before = state.apps[APP].definitionVersion;

        const res = call('POST /api/studio-apps/:id/versions/:versionId/restore', {
            state, params: { id: APP, versionId: 'ver_demo_03' },
        });
        expect(res.success).toBe(true);
        expect(res.version).toBe(before + 1);
        // The v1 snapshot predates the search bar and the detail screen.
        const def = state.apps[APP].definition;
        expect(def.screens).toHaveLength(1);
        expect(JSON.stringify(def)).not.toContain('cmp_crmfil');
    });
});
