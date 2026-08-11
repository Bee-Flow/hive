import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { editor, editors, editorValue, editorWithValue, typeInEditor } from '../../../../../test/refEditor';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { extractFormState, buildPatch, sanitizeOperations } from './settings/formState';
import { FormDensityContext } from './settings/formDensity';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * The "Edit data" (set) editor — two modes derived from `arrayRef` presence.
 * Single mode must stay byte-compatible with every saved routine; list mode
 * adds the per-row fields (Current row scope) and the Table tools.
 */

const noIssues = { errors: [], warnings: [] };

const RESULTS = [{ subject: 'Nextcloud ISV contract', from_email: 'a@b.nl', body: '{"order":{"total":42}}' }];
const GMAIL_GROUP = {
    id: 'g', label: 'gmail search', kind: 'integration_action', basePath: 'steps.g.output',
    sample: { results: RESULTS },
    fields: [{ key: 'results', path: 'steps.g.output.results', sample: RESULTS }],
};
const SAMPLE_ROOT = { steps: { g: { output: { results: RESULTS } } } };

function renderForm(step, { onPatch = vi.fn(), groups = [GMAIL_GROUP], previewSample = SAMPLE_ROOT, density = 'full' } = {}) {
    render(
        <FormDensityContext.Provider value={{ density, onHiddenSection: null }}>
            <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={new Map([['g', 'gmail search']])}>
                <SettingsForm
                    step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null}
                    onPatch={onPatch} catalog={null} groups={groups} previewSample={previewSample}
                />
            </VariablePickerProvider>
        </FormDensityContext.Provider>,
    );
    return { onPatch };
}

const save = () => fireEvent.click(screen.getByText('Save'));

const SINGLE_STEP = { id: 's1', type: 'set', fields: { name: { kind: 'literal', value: 'Alice' } } };
const LIST_STEP = {
    id: 's1', type: 'set', arrayRef: 'steps.g.output.results',
    fields: { sender: { kind: 'ref', path: 'item.from_email' } },
    operations: [{ op: 'rowId', target: 'id' }],
};

describe('formState — set draft/patch shapes', () => {
    it('extracts legacy single-mode defaults (arrayRef null, operations [])', () => {
        const d = extractFormState(SINGLE_STEP);
        expect(d.arrayRef).toBeNull();
        expect(d.operations).toEqual([]);
        expect(d.maxItems).toBe('');
    });

    it('an untouched legacy save emits NO list-mode keys at all', () => {
        const d = extractFormState(SINGLE_STEP);
        const patch = buildPatch(SINGLE_STEP, d);
        expect('arrayRef' in patch).toBe(false);
        expect('operations' in patch).toBe(false);
        expect('maxItems' in patch).toBe(false);
    });

    it('list mode persists arrayRef + operations; forEach is cleared explicitly', () => {
        const legacy = { ...SINGLE_STEP, forEach: { overRef: 'steps.g.output.results', itemVar: 'item' } };
        const d = { ...extractFormState(legacy), arrayRef: 'steps.g.output.results', operations: [{ op: 'rowId', target: 'id' }] };
        const patch = buildPatch(legacy, d);
        expect(patch.arrayRef).toBe('steps.g.output.results');
        expect(patch.operations).toEqual([{ op: 'rowId', target: 'id' }]);
        expect(patch.forEach).toBeNull();
    });

    it('switching back to single mode deletes the list keys via explicit undefined', () => {
        const d = { ...extractFormState(LIST_STEP), arrayRef: null };
        const patch = buildPatch(LIST_STEP, d);
        expect('arrayRef' in patch).toBe(true);
        expect(patch.arrayRef).toBeUndefined();
        expect(patch.operations).toBeUndefined();
    });

    it('sanitizeOperations keeps half-typed rows, drops junk, normalises shapes', () => {
        expect(sanitizeOperations([
            { op: 'groupId', target: '', keys: [' to ', ''] },      // incomplete → survives, keys trimmed
            { op: 'rowId', target: 'id', start: '' },               // '' start → omitted (not 0!)
            { op: 'rowId', target: 'id', start: 5 },
            { op: 'sort', key: 'a', direction: 'weird' },           // direction normalised to asc (omitted)
            { op: 'explode' },                                      // unknown op → dropped
            'junk', null,
        ])).toEqual([
            { op: 'groupId', target: '', keys: ['to'] },
            { op: 'rowId', target: 'id' },
            { op: 'rowId', target: 'id', start: 5 },
            { op: 'sort', key: 'a' },
        ]);
    });
});

describe('SettingsForm — Edit data (set)', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('set-test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('single mode is exactly the classic form — no list chrome anywhere', () => {
        renderForm(SINGLE_STEP);
        expect(screen.getAllByText('Fields').length).toBeGreaterThan(0);
        expect(screen.queryByText('Working through')).toBeNull();
        expect(screen.queryByText('Table tools')).toBeNull();
        // forEach still offered under Advanced for single mode.
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.getByText('Run once per item')).toBeTruthy();
    });

    it('list mode summarises the source in one line, under Advanced, with the change reveal', () => {
        renderForm(LIST_STEP);
        // Not in the way of the actual work: the source lives with the other
        // overrides, one line, named — never as a raw path.
        expect(screen.queryByText('Working through')).toBeNull();
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.getByText('Working through')).toBeTruthy();
        expect(screen.getByText('gmail search')).toBeTruthy();
        expect(screen.getByText('Results')).toBeTruthy();
        expect(screen.queryByDisplayValue('steps.g.output.results')).toBeNull();
        fireEvent.click(screen.getByLabelText('Change the source list'));
        expect(editorWithValue(document.body, 'steps.g.output.results')).toBeTruthy();
    });

    it('list mode hides forEach and shows the Table tools section instead', () => {
        renderForm(LIST_STEP);
        expect(screen.getByText('Table tools')).toBeTruthy();
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.queryByText('Run once per item')).toBeNull();
    });

    it('a bound field reads as a named chip — never a raw path — with a live example', async () => {
        renderForm(LIST_STEP);
        // The `sender` field is bound to item.from_email: the value slot shows
        // the humanised chip and the value it would produce, and the path
        // itself appears nowhere on screen.
        expect(screen.getByText('Current row')).toBeTruthy();
        expect(screen.getByText('▸ From email')).toBeTruthy();
        expect(await screen.findByText(/a@b\.nl/)).toBeTruthy();
        expect(screen.queryByText(/item\.from_email/)).toBeNull();
        expect(screen.queryByText(/steps\.g\.output/)).toBeNull();
        // The slots say what they are for.
        expect(screen.getByText('Column name')).toBeTruthy();
        expect(screen.getByText('What goes in it')).toBeTruthy();
    });

    it('picking data is visual: the picker offers "Current row" and lands a chip', async () => {
        const { onPatch } = renderForm({ ...LIST_STEP, fields: { sender: { kind: 'literal', value: '' } } });
        fireEvent.click(screen.getByText('Use data from a step'));
        expect(await screen.findByText('Current row')).toBeTruthy();
        fireEvent.click(await screen.findByText('subject'));
        expect(screen.getByText('▸ Subject')).toBeTruthy();
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        // `item` isn't a runtime ref ROOT, so a row path lands as the expr the
        // rest of the editor writes for it (bindingFromInput owns that call).
        expect(onPatch.mock.calls[0][0].fields.sender).toEqual({ kind: 'expr', value: 'item.subject' });
    });

    it('“Adjust it” turns a picked value into a formula without anyone typing one', async () => {
        const { onPatch } = renderForm(LIST_STEP);
        fireEvent.change(screen.getByLabelText('Adjust the value'), { target: { value: 'lower' } });
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls[0][0].fields.sender).toEqual({ kind: 'expr', value: 'lower(item.from_email)' });
    });

    it('the raw formula editor is offered in the full view only', () => {
        renderForm(LIST_STEP);
        expect(screen.getAllByLabelText('Write this value as a formula').length).toBe(1);
    });

    it('the quick view keeps the fields and the table tools, and drops the plumbing', () => {
        renderForm(LIST_STEP, { density: 'quick' });
        // What the step DOES stays…
        expect(screen.getByText('Fields added to each row')).toBeTruthy();
        expect(screen.getByText('Table tools')).toBeTruthy();
        expect(screen.getByText('Current row')).toBeTruthy();
        // …the source it was wired to, the overrides and the formula escape go.
        expect(screen.queryByText('Working through')).toBeNull();
        expect(screen.queryByText('Advanced')).toBeNull();
        expect(screen.queryByLabelText('Write this value as a formula')).toBeNull();
    });

    it('an unpicked source still shows in the quick view — hiding it would dead-end the step', () => {
        renderForm({ ...LIST_STEP, arrayRef: '' }, { density: 'quick' });
        expect(screen.getByText('Working through')).toBeTruthy();
        expect(screen.getByText('No list picked yet')).toBeTruthy();
    });

    it('the fields section names itself once, not twice', () => {
        renderForm(LIST_STEP);
        expect(screen.getAllByText('Fields added to each row').length).toBe(1);
    });

    it('every table tool round-trips through Save with the exact operations array', async () => {
        const step = { ...LIST_STEP, operations: [] };
        const { onPatch } = renderForm(step);
        const add = () => fireEvent.click(screen.getByText('Add a table tool'));

        add(); fireEvent.click(screen.getByText('Number the rows'));
        add(); fireEvent.click(screen.getByText('Give matching rows a shared ID'));
        add(); fireEvent.click(screen.getByText('Sort the rows'));

        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const patch = onPatch.mock.calls[0][0];
        expect(patch.operations).toEqual([
            { op: 'rowId', target: 'id' },
            { op: 'groupId', target: 'groupId', keys: [] },
            { op: 'sort', key: '' },
        ]);
    });

    it('the ▲▼ chevrons reorder operations in the patch', async () => {
        const step = {
            ...LIST_STEP,
            operations: [{ op: 'rowId', target: 'id' }, { op: 'sort', key: 'id' }],
        };
        const { onPatch } = renderForm(step);
        fireEvent.click(screen.getAllByLabelText('Move operation up')[1]); // move sort above rowId
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls[0][0].operations).toEqual([
            { op: 'sort', key: 'id' },
            { op: 'rowId', target: 'id' },
        ]);
    });

    it('the Advanced "Works on" select flips modes; leaving list mode warns about table tools', async () => {
        const { onPatch } = renderForm(LIST_STEP);
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.getByText(/also removes the table tools/)).toBeTruthy();
        fireEvent.change(screen.getByDisplayValue('Each row of a list'), { target: { value: 'single' } });
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const patch = onPatch.mock.calls[0][0];
        expect('arrayRef' in patch).toBe(true);
        expect(patch.arrayRef).toBeUndefined();
    });

    it('a legacy forEach in list mode shows the supersession note and is cleared on save', async () => {
        const step = { ...LIST_STEP, forEach: { overRef: 'steps.g.output.results', itemVar: 'item' } };
        const { onPatch } = renderForm(step);
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.getByText(/List mode replaces/)).toBeTruthy();
        // Make the form dirty (Save is a no-op on an untouched draft), then
        // check the save carries the explicit forEach clear along.
        fireEvent.click(screen.getByText('Add a table tool'));
        fireEvent.click(screen.getByText('Sort the rows'));
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls[0][0].forEach).toBeNull();
    });

    it('JSON text in the row offers "Pick fields from it" and a pick adds a parseJson expr field', async () => {
        const { onPatch } = renderForm(LIST_STEP);
        fireEvent.click(screen.getByText('Pick fields from it'));
        // The tree shows the parsed body of the current row: order → total.
        const total = await screen.findByText('total');
        fireEvent.click(total);
        // The new field reads as a chip in the user's words — the parseJson
        // call it actually stores is never shown as text.
        expect(screen.getByText('· from the JSON: order.total')).toBeTruthy();
        expect(screen.queryByText(/parseJson/)).toBeNull();
        save();
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const patch = onPatch.mock.calls[0][0];
        expect(patch.fields.total).toEqual({ kind: 'expr', value: 'parseJson(item.body, "order.total")' });
    });

    it('no JSON-looking sample → the affordance stays away entirely', () => {
        const plain = [{ subject: 'hi', from_email: 'a@b.nl' }];
        renderForm(
            { ...LIST_STEP, fields: {} },
            {
                groups: [{ ...GMAIL_GROUP, sample: { results: plain }, fields: [{ key: 'results', path: 'steps.g.output.results', sample: plain }] }],
                previewSample: { steps: { g: { output: { results: plain } } } },
            },
        );
        expect(screen.queryByText('Pick fields from it')).toBeNull();
    });
});
