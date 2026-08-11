import { describe, it, expect } from 'vitest';
import { computeUpstreamGroups } from './upstream';

/**
 * Picker truth — node-audit C21-C25. Every path the variable picker offers
 * must exist at run time; these lock the describers to the executors' REAL
 * output shapes.
 */
const catalog = {
    apps: [{ actions: [{ name: 'gmail_search', outputSample: { results: [{ subject: 'Re: hi', from: 'a@b.c' }] } }] }],
    triggerOutputs: { __manual: { fields: [], sample: {} } },
};

function defWith(steps, edges) {
    return {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
        steps,
        edges,
    };
}

const groupById = (groups, id) => groups.find(g => g.id === id);

describe('describeAiStep (C21)', () => {
    it('without a schema offers ONE honest leaf binding the whole output — no phantom text/toolCalls', () => {
        const def = defWith(
            [{ id: 'ai1', type: 'ai_step', prompt: 'p' }, { id: 'n1', type: 'notification', title: 't' }],
            [{ from: 'trg', to: 'ai1' }, { from: 'ai1', to: 'n1' }],
        );
        const g = groupById(computeUpstreamGroups(def, 'n1', catalog), 'ai1');
        expect(g.fields).toHaveLength(1);
        expect(g.fields[0].path).toBe('steps.ai1.output');
        expect(g.fields.some(f => f.key === 'text' || f.key === 'toolCalls')).toBe(false);
    });

    it('with a declared schema still offers the schema fields', () => {
        const def = defWith(
            [
                { id: 'ai1', type: 'ai_step', prompt: 'p', outputSchema: { type: 'object', properties: { verdict: { type: 'string' } } } },
                { id: 'n1', type: 'notification', title: 't' },
            ],
            [{ from: 'trg', to: 'ai1' }, { from: 'ai1', to: 'n1' }],
        );
        const g = groupById(computeUpstreamGroups(def, 'n1', catalog), 'ai1');
        expect(g.fields.some(f => f.path === 'steps.ai1.output.verdict')).toBe(true);
    });
});

describe('describeNotification (C22)', () => {
    it('offers delivered.title/body/channels and no phantom `sent`', () => {
        const def = defWith(
            [{ id: 'nt1', type: 'notification', title: 'Hi' }, { id: 'n2', type: 'notification', title: 't' }],
            [{ from: 'trg', to: 'nt1' }, { from: 'nt1', to: 'n2' }],
        );
        const g = groupById(computeUpstreamGroups(def, 'n2', catalog), 'nt1');
        const paths = g.fields.map(f => f.path);
        expect(paths.some(p => p.includes('delivered'))).toBe(true);
        expect(paths.some(p => p.endsWith('.sent'))).toBe(false);
    });
});

describe('describeLoop downstream (C23 — the user-reported trap)', () => {
    const def = defWith(
        [
            { id: 'g1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            { id: 'lp', type: 'loop', overRef: 'steps.g1.output.results', itemVar: 'item', maxIterations: 100, body: [] },
            { id: 'after', type: 'notification', title: 't' },
        ],
        [{ from: 'trg', to: 'g1' }, { from: 'g1', to: 'lp' }, { from: 'lp', to: 'after' }],
    );
    const groups = computeUpstreamGroups(def, 'after', catalog);
    const g = groupById(groups, 'lp');

    it('offers the runtime envelope, rooted at steps.<id>.output', () => {
        expect(g.basePath).toBe('steps.lp.output');
        const paths = g.fields.map(f => f.path);
        expect(paths).toContain('steps.lp.output.iterations');
        expect(paths).toContain('steps.lp.output.results');
    });

    it('offers element fields through the [*] flatten, not the dead loop.<itemVar> scope', () => {
        const paths = g.fields.map(f => f.path);
        expect(paths).toContain('steps.lp.output.results[*].item.subject');
        expect(paths.every(p => !p.startsWith('loop.'))).toBe(true);
    });
});

describe('describeSet (C25)', () => {
    it('resolves a ref-bound field to the REAL upstream sample (arrays become visible)', () => {
        const def = defWith(
            [
                { id: 'g1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
                { id: 'set1', type: 'set', fields: { rows: { kind: 'ref', path: 'steps.g1.output.results' }, note: { kind: 'literal', value: 'x' } } },
                { id: 'after', type: 'notification', title: 't' },
            ],
            [{ from: 'trg', to: 'g1' }, { from: 'g1', to: 'set1' }, { from: 'set1', to: 'after' }],
        );
        const g = groupById(computeUpstreamGroups(def, 'after', catalog), 'set1');
        const rows = g.fields.find(f => f.key === 'rows');
        expect(Array.isArray(rows.sample)).toBe(true);
        expect(g.fields.find(f => f.key === 'note').sample).toBe('x');
    });
});

describe('describeSet — list mode ("Edit data" on a table)', () => {
    const def = (setStep) => defWith(
        [
            { id: 'g1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            setStep,
            { id: 'after', type: 'notification', title: 't' },
        ],
        [{ from: 'trg', to: 'g1' }, { from: 'g1', to: setStep.id }, { from: setStep.id, to: 'after' }],
    );

    it('offers the {items, count} envelope with source columns + computed fields per row', () => {
        const g = groupById(computeUpstreamGroups(def({
            id: 's1', type: 'set', arrayRef: 'steps.g1.output.results',
            fields: { sender: { kind: 'ref', path: 'item.from' } },
        }), 'after', catalog), 's1');
        expect(g.basePath).toBe('steps.s1.output');
        const paths = g.fields.map(f => f.path);
        expect(paths).toContain('steps.s1.output.items');
        expect(paths).toContain('steps.s1.output.count');
        const items = g.fields.find(f => f.key === 'items');
        const childPaths = items.children.map(c => c.path);
        expect(childPaths).toContain('steps.s1.output.items[*].subject');   // source column survives
        expect(childPaths).toContain('steps.s1.output.items[*].sender');    // computed field added
        // The item.* ref resolved against the element sample, not a placeholder.
        expect(items.children.find(c => c.key === 'sender').sample).toBe('a@b.c');
    });

    it('reflects the post-operations column set — renamed/removed columns are gone, targets exist', () => {
        const g = groupById(computeUpstreamGroups(def({
            id: 's1', type: 'set', arrayRef: 'steps.g1.output.results', fields: {},
            operations: [
                { op: 'rowId', target: 'id' },
                { op: 'rename', from: 'subject', to: 'title' },
                { op: 'remove', keys: ['from'] },
            ],
        }), 'after', catalog), 's1');
        const childKeys = g.fields.find(f => f.key === 'items').children.map(c => c.key);
        expect(childKeys).toContain('id');
        expect(childKeys).toContain('title');
        expect(childKeys).not.toContain('subject');
        expect(childKeys).not.toContain('from');
    });

    it('an unresolvable source still yields the bare envelope (nothing to mislead with)', () => {
        const g = groupById(computeUpstreamGroups(def({
            id: 's1', type: 'set', arrayRef: 'steps.g1.output.ghost', fields: {},
        }), 'after', catalog), 's1');
        expect(g.sample).toEqual({ items: [], count: 0 });
    });
});

describe('describeCondition (C24)', () => {
    it('offers branch, value AND expr', () => {
        const def = defWith(
            [{ id: 'c1', type: 'condition', expr: 'true' }, { id: 'n1', type: 'notification', title: 't' }],
            [{ from: 'trg', to: 'c1' }, { from: 'c1', to: 'n1', label: 'then' }],
        );
        const g = groupById(computeUpstreamGroups(def, 'n1', catalog), 'c1');
        const keys = g.fields.map(f => f.key);
        expect(keys).toEqual(expect.arrayContaining(['branch', 'value', 'expr']));
    });
});

describe('the privacy steps are pickable at all', () => {
    // Without a describer these produced NO group, so a "Show real values
    // again" dropped straight after "Hide personal data" could not be pointed
    // at the very value it exists to restore — the picker simply skipped the
    // node. Silent, and it looks like the step is broken.
    const chain = (type, label) => defWith(
        [
            { id: 'g1', type: 'integration_action', tool: 'gmail_search', inputs: {} },
            { id: 'p1', type, sourceRef: 'steps.g1.output.results', label },
            { id: 'n1', type: 'notification', title: 't' },
        ],
        [{ from: 'trg', to: 'g1' }, { from: 'g1', to: 'p1' }, { from: 'p1', to: 'n1' }],
    );

    it('tokenize offers output.text — the value everything downstream binds to', () => {
        const g = groupById(computeUpstreamGroups(chain('tokenize', 'Hide personal data'), 'n1', catalog), 'p1');
        expect(g).toBeTruthy();
        expect(g.label).toBe('Hide personal data');
        expect(g.fields.map(f => f.path)).toContain('steps.p1.output.text');
        expect(g.fields.map(f => f.path)).toContain('steps.p1.output.count');
    });

    it('untokenize offers what it restored, and what it could not', () => {
        const g = groupById(computeUpstreamGroups(chain('untokenize', 'Show real values again'), 'n1', catalog), 'p1');
        expect(g).toBeTruthy();
        const paths = g.fields.map(f => f.path);
        expect(paths).toContain('steps.p1.output.text');
        expect(paths).toContain('steps.p1.output.restored');
        // The leftover count is the one number worth seeing after a run.
        expect(paths).toContain('steps.p1.output.unresolved');
    });

    it('guard offers the branch and what it found', () => {
        const g = groupById(computeUpstreamGroups(chain('guard', 'Check for personal data'), 'n1', catalog), 'p1');
        expect(g).toBeTruthy();
        const paths = g.fields.map(f => f.path);
        expect(paths).toContain('steps.p1.output.branch');
        expect(paths).toContain('steps.p1.output.hasPii');
        expect(paths).toContain('steps.p1.output.count');
    });
});
