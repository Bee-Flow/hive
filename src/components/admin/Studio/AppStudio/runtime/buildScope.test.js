import { describe, it, expect } from 'vitest';
import { dataCacheKey } from './resolveBinding';
import { buildScope } from './RuntimeContext';

const ROOT_KEYS = [
    'actions', 'form', 'forms', 'screen', 'vars', 'item', 'index', 'value',
    'currentUser', 'records', 'datasets', 'now', 'today',
];

describe('buildScope — shared scope root', () => {
    it('exposes exactly the shared-engine root keys', () => {
        const scope = buildScope({});
        for (const k of ROOT_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(scope, k), `missing scope.${k}`).toBe(true);
        }
    });

    it('maps actionState → actions and dataState → records/datasets', () => {
        const actionState = { a1: { status: 'success', result: { open: 4 } } };
        const dataState = {
            'records:t1:x': { status: 'success', result: [{ a: 1 }], tableId: 't1' },
            'dataset:d1': { status: 'success', result: { k: 9 }, datasetId: 'd1' },
        };
        const scope = buildScope({ actionState, dataState });
        expect(scope.actions).toBe(actionState);
        expect(scope.actions.a1.result.open).toBe(4);
        expect(scope.records.t1).toEqual([{ a: 1 }]);
        expect(scope.datasets.d1).toEqual({ k: 9 });
    });

    it('two queries on one table keep their own result (no last-write-wins)', () => {
        const all = dataCacheKey({ kind: 'records', tableId: 't1' });
        const open = dataCacheKey({ kind: 'records', tableId: 't1', filter: [{ field: 'status', op: 'eq', value: 'open' }] });
        const scope = buildScope({
            dataState: {
                [all]: { status: 'success', result: [{ id: 'a' }, { id: 'b' }], tableId: 't1' },
                [open]: { status: 'success', result: [{ id: 'open-1' }], tableId: 't1' },
            },
        });
        expect(scope.records[open]).toEqual([{ id: 'open-1' }]);
        expect(scope.records[all]).toEqual([{ id: 'a' }, { id: 'b' }]);
        // The unfiltered list owns records.<tableId>, whatever the write order.
        expect(scope.records.t1).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('a single-record lookup never steals records.<tableId> from the list', () => {
        const list = dataCacheKey({ kind: 'records', tableId: 't1' });
        const one = dataCacheKey({ kind: 'record', tableId: 't1' });
        const scope = buildScope({
            dataState: {
                [list]: { status: 'success', result: [{ id: 'r1' }], tableId: 't1' },
                [one]: { status: 'success', result: { id: 'r1' }, tableId: 't1' },
            },
        });
        expect(scope.records.t1).toEqual([{ id: 'r1' }]);
        expect(scope.records[one]).toEqual({ id: 'r1' });
    });

    it('two connector runs with different params keep their own rows', () => {
        const plain = dataCacheKey({ kind: 'connector', connectorId: 'c1' });
        const withParams = dataCacheKey({ kind: 'connector', connectorId: 'c1', params: { q: 'bee' } });
        const scope = buildScope({
            dataState: {
                [plain]: { status: 'success', result: [], connectorId: 'c1' },
                [withParams]: { status: 'success', result: [{ id: 'q1' }], connectorId: 'c1' },
            },
        });
        expect(scope.connectors[withParams]).toEqual([{ id: 'q1' }]);
        expect(scope.connectors.c1).toEqual([]);
    });

    it('passes through form/screen/vars/currentUser and per-row item/index/value', () => {
        const scope = buildScope({
            form: { subject: 'Hi' },
            screen: { id: 's1', params: { tab: 2 } },
            vars: { threshold: 10 },
            currentUser: { id: 'u1', email: 'u@x.io' },
            item: { name: 'A' }, index: 3, value: 'A',
        });
        expect(scope.form.subject).toBe('Hi');
        expect(scope.screen.params.tab).toBe(2);
        expect(scope.vars.threshold).toBe(10);
        expect(scope.currentUser.email).toBe('u@x.io');
        expect(scope.item).toEqual({ name: 'A' });
        expect(scope.index).toBe(3);
        expect(scope.value).toBe('A');
    });

    it('exposes the forms map for form-container child scopes and forms.<name>.* reads', () => {
        const scope = buildScope({
            forms: { contact: { email: 'vera@example.test' }, other: { note: 'x' } },
        });
        expect(scope.forms.contact.email).toBe('vera@example.test');
        expect(scope.forms.other.note).toBe('x');
        // form (singular) stays independent — the renderer overlays it per form
        // container ({ ...scope, form: forms[name] }), same as repeater item.
        expect(scope.form).toEqual({});
        const inForm = { ...scope, form: scope.forms.contact };
        expect(inForm.form.email).toBe('vera@example.test');
    });

    it('defaults every collection root to an empty object and currentUser to null', () => {
        const scope = buildScope({});
        for (const k of ['actions', 'form', 'forms', 'screen', 'vars', 'records', 'datasets']) {
            expect(scope[k]).toEqual({});
        }
        expect(scope.currentUser).toBeNull();
    });

    it('stamps now (ISO) / today (date) — provided values used verbatim', () => {
        const scope = buildScope({ now: '2026-07-04T12:00:00.000Z' });
        expect(scope.now).toBe('2026-07-04T12:00:00.000Z');
        expect(scope.today).toBe('2026-07-04');

        const fresh = buildScope({});
        expect(typeof fresh.now).toBe('string');
        expect(fresh.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(fresh.today).toBe(fresh.now.slice(0, 10));
    });
});
