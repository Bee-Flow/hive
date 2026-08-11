import { describe, expect, it } from 'vitest';
import { buildStudioScope, sampleForInputType, VALUE_GROUP } from './StudioScopeProvider';
import studioFieldOptions from './studioFieldOptions';

/**
 * The picker's view of the app's scope.
 *
 * Two classes of defect lived here, both silent: roots that exist at runtime and
 * were missing from the list (so a valid formula had to be typed from memory and
 * previewed as nothing), and samples with the wrong SHAPE (so the condition
 * builder inferred "string" for every field and never offered "greater than").
 */

const DEF = {
    schemaVersion: 2,
    variables: [{ name: 'statusFilter', type: 'text', default: 'new' }],
    screens: [{
        id: 'scr_a',
        name: 'Orders',
        sections: [{
            id: 'sec_a',
            children: [
                {
                    id: 'cmp_form', type: 'form', props: { name: 'f' },
                    children: [
                        { id: 'cmp_qty', type: 'input_number', props: { name: 'quantity', label: 'Aantal' } },
                        { id: 'cmp_ok', type: 'input_checkbox', props: { name: 'agreed' } },
                        { id: 'cmp_due', type: 'input_date', props: { name: 'due' } },
                        { id: 'cmp_tags', type: 'input_multiselect', props: { name: 'tags' } },
                        { id: 'cmp_note', type: 'input_text', props: { name: 'note' } },
                    ],
                },
                { id: 'cmp_list', type: 'list', props: { source: { kind: 'records', tableId: 'tbl_orders' } } },
                { id: 'cmp_st', type: 'stat', props: { value: { kind: 'connector', connectorId: 'con_mail' } } },
            ],
        }],
    }],
    actions: {
        act_run: { kind: 'run_automation', automationId: 'auto_1' },
        act_scan: { kind: 'ai_extract', schema: [{ name: 'total' }, { name: 'invoiceNo' }] },
        act_toast: { kind: 'toast', message: 'hi' },
    },
};

const NODE = DEF.screens[0].sections[0].children[0].children[0];
const groupsOf = (scope) => Object.fromEntries(scope.groups.map((g) => [g.id, g]));
const pathsOf = (group) => (group?.fields || []).map((f) => f.path);

describe('buildStudioScope — samples carry the field’s type', () => {
    // inferType reads the sample and nothing else, so a hardcoded '' made every
    // field a string: a fresh condition row on a number field offered equals /
    // contains / starts with and no "greater than" at all.
    it('shapes each form field’s sample like the value it submits', () => {
        const { groups, previewSample } = buildStudioScope(DEF, NODE);
        const form = groupsOf({ groups }).form;
        const byKey = Object.fromEntries(form.fields.map((f) => [f.key, f.sample]));
        expect(byKey.quantity).toBe(0);
        expect(byKey.agreed).toBe(false);
        expect(byKey.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(byKey.tags).toEqual([]);
        expect(byKey.note).toBe('');
        // The live-eval sample has to agree with the picker's, or the preview
        // under a formula disagrees with the operators offered above it.
        expect(previewSample.form).toEqual({ quantity: 0, agreed: false, due: byKey.due, tags: [], note: '' });
    });

    it('keeps an authored label and humanizes a missing one', () => {
        const options = studioFieldOptions(buildStudioScope(DEF, NODE).groups);
        const byPath = Object.fromEntries(options.map((o) => [o.path, o.label]));
        expect(byPath['form.quantity']).toBe('Aantal');
        expect(byPath['form.note']).toBe('Note');
    });

    it('has a sample for every input type it knows', () => {
        expect(sampleForInputType('input_number')).toBe(0);
        expect(sampleForInputType('input_textarea')).toBe('');
        expect(sampleForInputType('something_new')).toBe('');
    });
});

describe('buildStudioScope — the roots that were missing', () => {
    it('offers every action, not only the routines', () => {
        const actions = groupsOf(buildStudioScope(DEF, NODE)).actions;
        expect(pathsOf(actions)).toEqual([
            'actions.act_run.result',
            'actions.act_scan.result',
            'actions.act_toast.result',
        ]);
    });

    // An AI action declares the shape it returns; those names were unguessable.
    it('makes an AI action’s declared fields pickable', () => {
        const options = studioFieldOptions(buildStudioScope(DEF, NODE).groups).map((o) => o.path);
        expect(options).toContain('actions.act_scan.result.total');
        expect(options).toContain('actions.act_scan.result.invoiceNo');
        // A run_automation declares nothing, so it stays a leaf rather than a
        // chevron opening onto an empty list.
        expect(options.filter((p) => p.startsWith('actions.act_run.result.'))).toEqual([]);
    });

    it('offers the tables and connections the app actually reads', () => {
        const g = groupsOf(buildStudioScope(DEF, NODE));
        expect(pathsOf(g.records)).toEqual(['records.tbl_orders']);
        expect(pathsOf(g.connectors)).toEqual(['connectors.con_mail']);
    });

    it('offers the clock', () => {
        const clock = groupsOf(buildStudioScope(DEF, NODE)).clock;
        expect(pathsOf(clock)).toEqual(['now', 'today']);
    });

    it('previews records and connectors instead of leaving them undefined', () => {
        const { previewSample } = buildStudioScope(DEF, NODE);
        expect(previewSample.records).toEqual({ tbl_orders: [] });
        expect(previewSample.connectors).toEqual({ con_mail: null });
    });

    // `value` resolves only inside a validation rule, so it is opt-in — a
    // permanent entry would preview as undefined everywhere else.
    it('adds `value` only when a caller asks for it', () => {
        expect(groupsOf(buildStudioScope(DEF, NODE)).value).toBeUndefined();
        const withValue = buildStudioScope(DEF, NODE, null, [VALUE_GROUP]);
        expect(pathsOf(groupsOf(withValue).value)).toEqual(['value']);
    });
});
