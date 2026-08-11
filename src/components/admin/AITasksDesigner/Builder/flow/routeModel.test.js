import { describe, it, expect } from 'vitest';
import { readRoute, writeRoute, routePorts, slotForEdge, isRouteStep, uniqueRuleName, readMatchMode } from './routeModel';

const CONDITION = { id: 'c1', type: 'condition', expr: 'trigger.output.amount > 100' };
const FILTER = { id: 'f1', type: 'filter', arrayRef: 'steps.g.output.results', expr: 'item.amount > 100' };
const RULE_SWITCH = {
    id: 's1', type: 'switch',
    cases: [{ name: 'big', expr: 'x > 10' }, { name: 'small', expr: 'x <= 10' }],
    defaultBranch: null,
};
const VALUE_SWITCH = {
    id: 's2', type: 'switch',
    expr: 'trigger.output.plan',
    cases: [{ name: 'pro', value: 'Pro' }, { name: 'free', value: 'Free' }],
};

describe('isRouteStep', () => {
    it('claims exactly the four merged deciding steps', () => {
        expect(['condition', 'switch', 'filter'].every(t => isRouteStep({ type: t }))).toBe(true);
        expect(isRouteStep({ type: 'loop' })).toBe(false);
        expect(isRouteStep(null)).toBe(false);
    });
});

describe('readRoute / writeRoute round-trips', () => {
    const roundTrip = (step) => writeRoute(readRoute(step));

    it('an If stays an If', () => {
        expect(roundTrip(CONDITION)).toMatchObject({ type: 'condition', expr: CONDITION.expr });
    });

    it('a Filter stays a Filter', () => {
        expect(roundTrip(FILTER)).toMatchObject({ type: 'filter', arrayRef: FILTER.arrayRef, expr: FILTER.expr });
    });

    it('a rule Switch stays a rule Switch', () => {
        expect(roundTrip(RULE_SWITCH)).toMatchObject({ type: 'switch', cases: RULE_SWITCH.cases });
    });

    it('a legacy value Switch keeps its value matching', () => {
        const out = roundTrip(VALUE_SWITCH);
        expect(out).toMatchObject({ type: 'switch', expr: 'trigger.output.plan' });
        expect(out.cases).toEqual([{ name: 'pro', value: 'Pro' }, { name: 'free', value: 'Free' }]);
    });

    it('reading a switch with an arrayRef reports list mode; without one, branch mode', () => {
        expect(readRoute({ ...RULE_SWITCH, arrayRef: 'steps.g.output.results' }).mode).toBe('items');
        expect(readRoute(RULE_SWITCH).mode).toBe('branch');
        // '' is "list mode, source not picked yet" — not branch mode.
        expect(readRoute({ ...RULE_SWITCH, arrayRef: '' }).mode).toBe('items');
    });
});

describe('writeRoute picks the narrowest runtime type', () => {
    it('a second rule turns an If into a Switch', () => {
        const route = readRoute(CONDITION);
        route.rules = [...route.rules, { name: 'rule2', expr: 'trigger.output.amount > 1000', value: '' }];
        const out = writeRoute(route);
        expect(out.type).toBe('switch');
        expect(out.cases).toEqual([
            { name: 'rule1', expr: CONDITION.expr },
            { name: 'rule2', expr: 'trigger.output.amount > 1000' },
        ]);
        // Stale single-rule keys must be cleared, or the If's `expr` would
        // linger and the switch would match against it.
        expect(out.arrayRef).toBeUndefined();
    });

    it('dropping back to one rule turns a Switch into an If', () => {
        const route = readRoute(RULE_SWITCH);
        route.rules = route.rules.slice(0, 1);
        const out = writeRoute(route);
        expect(out).toMatchObject({ type: 'condition', expr: 'x > 10' });
        expect(out.cases).toBeUndefined();
        expect(out.defaultBranch).toBeUndefined();
    });

    it('switching an If to list mode makes it a Filter', () => {
        const route = { ...readRoute(CONDITION), mode: 'items', source: 'steps.g.output.results' };
        expect(writeRoute(route)).toMatchObject({
            type: 'filter', arrayRef: 'steps.g.output.results', expr: CONDITION.expr,
        });
    });

    it('a second rule is what gives a list its "otherwise" output — not a setting', () => {
        // One rule keeps the matches and drops the rest (a Filter); adding a
        // rule turns it into a list-mode Switch, whose default port carries
        // whatever matched nothing. There is no `otherwise` option to pick.
        const route = readRoute(FILTER);
        expect(writeRoute(route).type).toBe('filter');
        route.rules = [...route.rules, { name: 'rest', expr: 'item.amount <= 100', value: '' }];
        const out = writeRoute(route);
        expect(out).toMatchObject({ type: 'switch', arrayRef: FILTER.arrayRef });
        expect(out.cases).toEqual([
            { name: 'keep', expr: FILTER.expr },
            { name: 'rest', expr: 'item.amount <= 100' },
        ]);
    });

    it('rules with no name never become a port', () => {
        const out = writeRoute({ mode: 'branch', style: 'rules', rules: [{ name: 'a', expr: '1' }, { name: '', expr: '2' }] });
        expect(out.cases).toBeUndefined(); // one usable rule ⇒ plain If
        expect(out.type).toBe('condition');
    });

    it('a named rule with no predicate yet still gets its port (a draft is a legal state)', () => {
        // Deliberate: the port has to exist before the author can wire it, and
        // the server downgrades the resulting switch.expr_missing to a warning
        // while the routine is a draft. Dropping the rule here would delete the
        // edge already drawn from that port.
        const out = writeRoute({
            mode: 'branch', style: 'rules',
            rules: [{ name: 'rule1', expr: 'x > 10', value: '' }, { name: 'rule2', expr: '', value: '' }],
        });
        expect(out.type).toBe('switch');
        expect(out.cases).toEqual([{ name: 'rule1', expr: 'x > 10' }, { name: 'rule2', expr: '' }]);
    });

    it('an "otherwise" pointing at a removed rule is cleared, not left dangling', () => {
        const out = writeRoute({
            mode: 'branch', style: 'rules', defaultBranch: 'gone',
            rules: [{ name: 'a', expr: '1' }, { name: 'b', expr: '2' }],
        });
        expect(out.defaultBranch).toBe(null);
    });
});

/**
 * BFSF-356 — the silent config wipe.
 *
 * The editor's style used to be re-derived from the cases on every open. One
 * rule still blank (which is exactly what "+ Add rule" gives you) made
 * `cases.every(isRuleCase)` false, so the node reopened in 'value' style and
 * the NEXT save rewrote every case as `{name, value}` — every rule expression
 * gone, silently, with nothing to undo.
 */
describe('readRoute keeps the style the author chose (BFSF-356)', () => {
    it('a half-typed rule does not flip a rule switch to value style, and loses no expression', () => {
        // 1. Author opens a rule switch and clicks "+ Add rule".
        const route = readRoute(RULE_SWITCH);
        route.rules = [...route.rules, { name: 'rule2', expr: '', value: '' }];

        // 2. Autosave. The blank rule rides along as a draft case, and the
        //    STYLE the author is working in is persisted alongside it.
        const saved = writeRoute(route);
        expect(saved.routeStyle).toBe('rules');
        expect(saved.cases).toEqual([
            { name: 'big', expr: 'x > 10' }, { name: 'small', expr: 'x <= 10' }, { name: 'rule2', expr: '' },
        ]);

        // 3. Author reopens the node — it must still be a rule switch.
        const reopened = readRoute({ ...RULE_SWITCH, ...saved });
        expect(reopened.style).toBe('rules');

        // 4. …and saving again keeps every expression. This is the wipe:
        //    before the fix step 3 read 'value' and step 4 wrote
        //    [{name:'big', value:''}, {name:'small', value:''}, {name:'rule2', value:''}].
        const resaved = writeRoute(reopened);
        expect(resaved.cases).toEqual([
            { name: 'big', expr: 'x > 10' }, { name: 'small', expr: 'x <= 10' }, { name: 'rule2', expr: '' },
        ]);
        expect(resaved.cases.every(c => 'expr' in c)).toBe(true);
    });

    it('a routine ALREADY saved with a half-typed rule opens as rules, not value', () => {
        // No routeStyle (saved by the old code), one blank case among real
        // rules — the exact wreckage the bug leaves behind. Deriving 'value'
        // here is what wiped the expressions on the next save.
        const legacy = { id: 's3', type: 'switch', cases: [{ name: 'big', expr: 'x > 10' }, { name: 'rule2', expr: '' }] };
        expect(readRoute(legacy).style).toBe('rules');
        expect(writeRoute(readRoute(legacy)).cases).toEqual([{ name: 'big', expr: 'x > 10' }, { name: 'rule2', expr: '' }]);
    });

    it('a persisted style beats the derivation in both directions', () => {
        expect(readRoute({ ...RULE_SWITCH, routeStyle: 'value' }).style).toBe('value');
        expect(readRoute({ ...VALUE_SWITCH, routeStyle: 'rules' }).style).toBe('rules');
    });

    it('definitions saved before the fix carry no routeStyle and open exactly as they did', () => {
        // Backwards compatibility is mandatory: no migration, no version flag.
        expect(readRoute(RULE_SWITCH).style).toBe('rules');
        expect(readRoute(VALUE_SWITCH).style).toBe('value');
        expect(readRoute({ ...RULE_SWITCH, routeStyle: 'nonsense' }).style).toBe('rules');
        // A rule case mixed with a REAL value case is a hand/AI-written shape,
        // not the bug's wreckage — it must keep deriving 'value' as before,
        // or the next save would blank out the value side instead.
        expect(readRoute({
            id: 's4', type: 'switch', expr: 'trigger.output.plan',
            cases: [{ name: 'big', expr: 'x > 10' }, { name: 'pro', value: 'Pro' }],
        }).style).toBe('value');
        // A switch with nothing but blank cases has no rule to protect.
        expect(readRoute({ id: 's5', type: 'switch', cases: [{ name: 'a', expr: '' }] }).style).toBe('value');
    });

    it('clears a stale routeStyle when the node stops being a switch', () => {
        const route = readRoute({ ...RULE_SWITCH, routeStyle: 'value' });
        route.rules = route.rules.slice(0, 1);
        route.style = 'rules';
        const out = writeRoute(route);
        expect(out.type).toBe('condition');
        expect(out.routeStyle).toBeUndefined();
    });
});

/**
 * BFSF-356 — the fan-out opt-in.
 *
 * Outputs are meant to be non-exclusive ("contains land" and "contains water"
 * both fire for a record with both), but flipping every stored router to that
 * semantic would mean duplicate mails/tickets/API writes for customers who
 * changed nothing. The ABSENT field is therefore the compatibility contract,
 * and this model layer must never write it by accident.
 */
describe('matchMode (BFSF-356)', () => {
    it('reports first-match for anything that is not exactly "all"', () => {
        expect(readMatchMode({ type: 'switch', matchMode: 'all' })).toBe('all');
        expect(readMatchMode({ type: 'switch' })).toBe('first');
        expect(readMatchMode({ type: 'switch', matchMode: 'first' })).toBe('first');
        expect(readMatchMode({ type: 'switch', matchMode: 'ALL' })).toBe('first');
        expect(readMatchMode({ type: 'switch', matchMode: null })).toBe('first');
        expect(readMatchMode(null)).toBe('first');
        expect(readRoute(RULE_SWITCH).matchMode).toBe('first');
        expect(readRoute({ ...RULE_SWITCH, matchMode: 'all' }).matchMode).toBe('all');
        // The single-output shapes have nothing to fan out to.
        expect(readRoute(CONDITION).matchMode).toBe('first');
        expect(readRoute(FILTER).matchMode).toBe('first');
    });

    it('a stored router does NOT gain the key by being opened and saved', () => {
        // The whole compatibility mechanism in one assertion: open a stored
        // first-match switch, save it back, and the field must still be absent.
        const saved = writeRoute(readRoute(RULE_SWITCH));
        expect(saved.matchMode).toBeUndefined();
        expect(writeRoute(readRoute(VALUE_SWITCH)).matchMode).toBeUndefined();
        expect(writeRoute(readRoute(CONDITION)).matchMode).toBeUndefined();
        expect(writeRoute(readRoute(FILTER)).matchMode).toBeUndefined();
    });

    it('persists "all" on a real multi-output switch, in both modes', () => {
        const route = { ...readRoute(RULE_SWITCH), matchMode: 'all' };
        expect(writeRoute(route)).toMatchObject({ type: 'switch', matchMode: 'all' });
        const list = { ...route, mode: 'items', source: 'steps.g.output.results' };
        expect(writeRoute(list)).toMatchObject({ type: 'switch', matchMode: 'all' });
    });

    it('turning fan-out off CLEARS the key instead of pinning "first" forever', () => {
        const route = { ...readRoute({ ...RULE_SWITCH, matchMode: 'all' }), matchMode: 'first' };
        expect(writeRoute(route).matchMode).toBeUndefined();
    });

    it('never writes it on a one-output node — collapsing back to one clears it', () => {
        const route = readRoute({ ...RULE_SWITCH, matchMode: 'all' });
        expect(route.matchMode).toBe('all');
        route.rules = route.rules.slice(0, 1);
        const out = writeRoute(route);
        expect(out.type).toBe('condition');
        expect(out.matchMode).toBeUndefined();
        // …and the same in list mode, where one rule is a Filter.
        const asList = { ...route, mode: 'items', source: 'steps.g.output.results' };
        expect(writeRoute(asList)).toMatchObject({ type: 'filter', matchMode: undefined });
    });

    it('a rule with no name cannot make a node "multi-output" on its own', () => {
        const out = writeRoute({
            mode: 'branch', style: 'rules', matchMode: 'all',
            rules: [{ name: 'a', expr: '1' }, { name: '', expr: '2' }],
        });
        expect(out.type).toBe('condition');
        expect(out.matchMode).toBeUndefined();
    });
});

describe('routePorts / slotForEdge', () => {
    it('describes each type\'s outputs in slot order', () => {
        expect(routePorts(CONDITION)).toEqual([
            { slot: 0, label: 'then' },
            { slot: 'otherwise', label: 'else' },
        ]);
        expect(routePorts(RULE_SWITCH)).toEqual([
            { slot: 0, label: 'case:big', caseName: 'big' },
            { slot: 1, label: 'case:small', caseName: 'small' },
            { slot: 'otherwise', label: 'case:default', caseName: 'default' },
        ]);
        expect(routePorts(FILTER)).toEqual([{ slot: 0, label: null }]);
    });

    it('maps an edge back to the slot it occupies', () => {
        expect(slotForEdge(CONDITION, { label: 'then' })).toBe(0);
        expect(slotForEdge(CONDITION, { label: 'else' })).toBe('otherwise');
        expect(slotForEdge(RULE_SWITCH, { label: 'case:small', caseName: 'small' })).toBe(1);
        expect(slotForEdge(RULE_SWITCH, { label: 'case:default' })).toBe('otherwise');
        // Legacy caseName-only rows resolve too.
        expect(slotForEdge(RULE_SWITCH, { caseName: 'big' })).toBe(0);
        expect(slotForEdge(FILTER, {})).toBe(0);
    });

    it('returns null for edges that are not one of the step\'s branch ports', () => {
        expect(slotForEdge(CONDITION, { label: 'on_error' })).toBe(null);
        expect(slotForEdge(RULE_SWITCH, { caseName: 'ghost' })).toBe(null);
        expect(slotForEdge(FILTER, { label: 'on_error' })).toBe(null);
    });
});

describe('uniqueRuleName', () => {
    it('never mints a duplicate (two ports with one handle id is unreachable)', () => {
        const rules = [{ name: 'rule1' }, { name: 'rule2' }];
        expect(uniqueRuleName(rules, 'rule3')).toBe('rule3');
        expect(uniqueRuleName(rules, 'rule1')).toBe('rule1_2');
    });
});
