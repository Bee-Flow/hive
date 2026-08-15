import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { collectVariableUsage, declarableUnknowns, describeSite } from './variableUsage';
import { KITCHEN_SINK, V2_RICH } from './sampleDefinitions';

const require = createRequire(import.meta.url);
const { collectVariableWrites } = require('../../../../../../../server/appStudio/collectVariableRefs.js');

/**
 * The usage walk decides three user-visible things: the "used N×" chip, what
 * the delete dialog warns about, and which names the "nothing gives this a
 * value" banner offers to declare. A site it misses is a variable someone
 * deletes believing it is idle.
 */

function app({ children = [], actions = {}, variables } = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        homeScreenId: 'scr_a',
        screens: [{ id: 'scr_a', name: 'Inbox', sections: [{ id: 'sec_a', children }] }],
        actions,
        ...(variables ? { variables } : {}),
    };
}

const formula = (expr) => ({ kind: 'formula', expr });
const readNames = (usage) => [...usage.reads.keys()].sort();
const writeNames = (usage) => [...usage.writes.keys()].sort();

describe('collectVariableUsage — reads', () => {
    it('finds a read in every place a formula can hide', () => {
        const usage = collectVariableUsage(app({
            children: [
                { id: 'c1', type: 'list', props: { source: { kind: 'records', tableId: 't', filter: [{ field: 'a', op: 'eq', value: formula('vars.inFilter') }] } } },
                { id: 'c2', type: 'text', props: {}, computed: { text: formula('vars.inComputed') } },
                { id: 'c3', type: 'text', props: {}, visibleWhen: 'vars.inVisible' },
                { id: 'c4', type: 'text', props: {}, enabledWhen: 'vars.inEnabled' },
                { id: 'c5', type: 'input_text', props: { name: 'x' }, validations: [{ type: 'formula', expr: 'vars.inValidation' }] },
                { id: 'c6', type: 'table', props: { source: { kind: 'connector', connectorId: 'k', params: { q: formula('vars.inParam') } } } },
            ],
            actions: {
                act_a: { kind: 'navigate', screenId: 'scr_a', params: { id: formula('vars.inNavParam') } },
                act_b: { kind: 'sequence', steps: [{ kind: 'condition', expr: 'vars.inCondition', then: [] }] },
            },
        }));
        expect(readNames(usage)).toEqual([
            'inComputed', 'inCondition', 'inEnabled', 'inFilter', 'inNavParam', 'inParam', 'inValidation', 'inVisible',
        ]);
    });

    it('finds a read inside a nested component', () => {
        const usage = collectVariableUsage(app({
            children: [{ id: 'c1', type: 'card', children: [{ id: 'c2', type: 'text', props: {}, computed: { text: formula('vars.deep') } }] }],
        }));
        expect(readNames(usage)).toEqual(['deep']);
    });

    it('records where the read is, so “Show me” can go there', () => {
        const usage = collectVariableUsage(app({
            children: [{ id: 'cmp_x', type: 'text', props: {}, computed: { text: formula('vars.a') } }],
        }));
        const [site] = usage.reads.get('a');
        expect(site).toMatchObject({ nodeId: 'cmp_x', screenId: 'scr_a', screenName: 'Inbox' });
        expect(describeSite(site)).toContain('Inbox');
    });
});

describe('collectVariableUsage — writes', () => {
    it('finds a write at every nesting depth', () => {
        const usage = collectVariableUsage(app({
            actions: {
                act_a: {
                    kind: 'sequence',
                    steps: [
                        { kind: 'set_variable', name: 'top' },
                        { kind: 'condition', then: [{ kind: 'set_variable', name: 'inThen' }], else: [{ kind: 'set_variable', name: 'inElse' }] },
                        { kind: 'switch', cases: [{ steps: [{ kind: 'set_variable', name: 'inCase' }] }], default: [{ kind: 'set_variable', name: 'inDefault' }] },
                        { kind: 'loop', itemVar: 'row', indexVar: 'i', steps: [{ kind: 'run_automation', resultVar: 'res' }] },
                    ],
                },
            },
        }));
        expect(writeNames(usage)).toEqual(['i', 'inCase', 'inDefault', 'inElse', 'inThen', 'res', 'row', 'top']);
    });

    it('a filter bar claims the reserved name', () => {
        const usage = collectVariableUsage(app({
            children: [{ id: 'c1', type: 'filter_bar', props: { fields: [{ name: 'q' }] } }],
        }));
        expect(usage.writes.has('filters')).toBe(true);
    });
});

describe('collectVariableUsage — unknown names', () => {
    it('a read with no declaration and no write is unknown', () => {
        const usage = collectVariableUsage(app({
            variables: [{ name: 'statusFilter', label: '', type: 'text', default: '', description: '' }],
            children: [{ id: 'c1', type: 'text', props: {}, computed: { text: formula('vars.statusfilter') } }],
        }));
        expect([...usage.unknown]).toEqual(['statusfilter']);
        expect(declarableUnknowns(usage)).toEqual(['statusfilter']);
    });

    it('a name something writes is not unknown, declared or not', () => {
        const usage = collectVariableUsage(app({
            children: [{ id: 'c1', type: 'text', props: {}, computed: { text: formula('vars.written') } }],
            actions: { act_a: { kind: 'sequence', steps: [{ kind: 'set_variable', name: 'written' }] } },
        }));
        expect(usage.unknown.size).toBe(0);
    });

    it('vars.filters is never unknown', () => {
        const usage = collectVariableUsage(app({
            children: [{ id: 'c1', type: 'text', props: {}, computed: { text: formula('vars.filters.q') } }],
        }));
        expect(usage.unknown.size).toBe(0);
    });
});

describe('collectVariableUsage — counting', () => {
    it('countOf adds reads and writes together', () => {
        const usage = collectVariableUsage(app({
            children: [
                { id: 'c1', type: 'text', props: {}, computed: { text: formula('vars.a') } },
                { id: 'c2', type: 'text', props: {}, visibleWhen: 'vars.a' },
            ],
            actions: { act_a: { kind: 'sequence', steps: [{ kind: 'set_variable', name: 'a' }] } },
        }));
        expect(usage.countOf('a')).toBe(3);
        expect(usage.countOf('nope')).toBe(0);
    });
});

describe('collectVariableUsage — robustness', () => {
    it('survives garbage without throwing', () => {
        for (const def of [null, undefined, {}, { screens: 'x', actions: 5 }]) {
            const usage = collectVariableUsage(def);
            expect(usage.reads.size).toBe(0);
            expect(usage.writes.size).toBe(0);
        }
    });
});

/**
 * The two collectors have to agree on WRITES, or validate.js would warn about a
 * name the manager shows as used (or vice versa). Reads are client-only by
 * design — validate records those as a side effect of its own walk.
 */
describe('write-name lockstep with the server collector', () => {
    const FIXTURES = { KITCHEN_SINK, V2_RICH };
    for (const [name, def] of Object.entries(FIXTURES)) {
        it(`${name}: the same write names on both sides`, () => {
            const client = [...collectVariableUsage(def).writes.keys()].sort();
            const server = [...collectVariableWrites(def).names].sort();
            expect(client).toEqual(server);
        });
    }

    it('a definition exercising every write kind agrees too', () => {
        const def = app({
            children: [{ id: 'c1', type: 'filter_bar', props: { fields: [{ name: 'q' }] } }],
            actions: {
                act_a: {
                    kind: 'sequence',
                    steps: [
                        { kind: 'set_variable', name: 'a' },
                        { kind: 'loop', itemVar: 'row', indexVar: 'i', steps: [{ kind: 'ai_generate', resultVar: 'draft' }] },
                        { kind: 'switch', cases: [{ steps: [{ kind: 'set_variable', name: 'b' }] }], default: [] },
                    ],
                },
                act_b: { kind: 'kb_query', resultVar: 'hits' },
            },
        });
        expect([...collectVariableUsage(def).writes.keys()].sort())
            .toEqual([...collectVariableWrites(def).names].sort());
    });
});

/**
 * visibleWhen / enabledWhen / visible / readOnly reach this walk as
 * {kind:'formula',expr} — the only expression shape canonicalize keeps. They
 * were read as plain strings, so they found nothing: a variable used ONLY to
 * decide what is shown counted as unused, the manager offered to delete it with
 * no confirmation at all, and every rule built on it silently stopped working.
 */
describe('collectVariableUsage — logic flags are reads too', () => {
    const withNode = (node) => ({
        screens: [{ id: 'scr_a', name: 'Home', sections: [{ id: 'sec_a', children: [{ id: 'cmp_a', type: 'card', ...node }] }] }],
        actions: {},
    });

    it.each([
        ['visibleWhen', 'when it is shown'],
        ['enabledWhen', 'when it is enabled'],
        ['readOnly', 'when it is read-only'],
        ['visible', 'when it is shown'],
    ])('counts a variable read by %s', (flag, label) => {
        const usage = collectVariableUsage(withNode({ [flag]: { kind: 'formula', expr: "vars.statusFilter == 'open'" } }));
        const sites = usage.reads.get('statusFilter') || [];
        expect(sites).toHaveLength(1);
        expect(sites[0].label).toBe(label);
        expect(usage.countOf('statusFilter')).toBe(1);
    });

    it('still reads the legacy bare string', () => {
        const usage = collectVariableUsage(withNode({ visibleWhen: 'vars.legacy == true' }));
        expect(usage.countOf('legacy')).toBe(1);
    });

    it('is not fooled by a boolean flag', () => {
        const usage = collectVariableUsage(withNode({ visible: false, enabledWhen: true }));
        expect([...usage.reads.keys()]).toEqual([]);
    });
});

/**
 * A bare action is walked as a one-step sequence, which already records its
 * resultVar. Adding it again at the top counted one write twice: "used 2x" for
 * a single action, and the same site listed on two rows of the delete dialog.
 */
describe('collectVariableUsage — a result variable is counted once', () => {
    it('counts a bare action’s resultVar exactly once', () => {
        const usage = collectVariableUsage({
            screens: [],
            actions: { act_b: { kind: 'kb_query', resultVar: 'hits', query: { kind: 'static', value: 'x' }, knowledgeBaseIds: [] } },
        });
        expect(usage.countOf('hits')).toBe(1);
        expect(usage.writes.get('hits')).toHaveLength(1);
    });

    it('still counts a step’s resultVar inside a sequence once', () => {
        const usage = collectVariableUsage({
            screens: [],
            actions: { act_c: { kind: 'sequence', steps: [{ kind: 'kb_query', resultVar: 'hits' }] } },
        });
        expect(usage.countOf('hits')).toBe(1);
    });
});
