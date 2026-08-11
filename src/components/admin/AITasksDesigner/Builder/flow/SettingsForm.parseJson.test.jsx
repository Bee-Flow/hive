import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { editor, editors, editorValue, editorWithValue, typeInEditor } from '../../../../../test/refEditor';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';
import { extractFormState, buildPatch, sanitizeParseJsonFields } from './settings/formState';
import { buildStepFromPayload } from '../DiagramPane';
import { DATA_ITEMS } from './stepPalette';

const api = {
    mapJsonFields: vi.fn(async () => ({
        fields: [
            { name: 'email', path: 'order.email', description: 'Customer email', verified: true, sampleValue: 'a@b.c' },
            { name: 'ghost', path: 'nope.x', description: 'Not in sample', verified: false },
            { name: 'existing', path: 'dupe', description: 'Already present', verified: true },
        ],
    })),
};
vi.mock('../../../../../hooks/useAutomationApi', async (importOriginal) => {
    const mod = await importOriginal();
    return { ...mod, default: () => api };
});

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn(), previewSample = null, groups = [] } = {}) {
    return render(
        <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={groups} previewSample={previewSample} />
        </VariablePickerProvider>,
    );
}

// previewSample shaped like the runtime runState — the parse_json source is
// an http_request body STRING, exercising the auto-JSON.parse path.
const SAMPLE = {
    trigger: { output: {} },
    steps: { h1: { output: { body: '{"order":{"email":"a@b.c"},"items":[{"sku":"X1"}]}' } } },
};

describe('parse_json — form state round-trip', () => {
    it('extractFormState fills sane defaults for a fresh step', () => {
        const step = buildStepFromPayload({ kind: 'parse_json', label: 'Parse JSON' });
        expect(step.type).toBe('parse_json');
        const draft = extractFormState(step);
        expect(draft.sourceRef).toBe('');
        expect(draft.mode).toBe('paths');
        expect(draft.fields).toEqual([]);
    });

    it('buildPatch persists sourceRef/mode/fields and clamps a bogus mode', () => {
        const step = { id: 'p1', type: 'parse_json' };
        const patch = buildPatch(step, {
            sourceRef: 'steps.h1.output.body',
            mode: 'yolo',
            fields: [{ name: 'email', path: 'order.email' }],
        });
        expect(patch.sourceRef).toBe('steps.h1.output.body');
        expect(patch.mode).toBe('paths');
        expect(patch.fields).toEqual([{ name: 'email', path: 'order.email' }]);
    });

    it('sanitizeParseJsonFields drops blank-name rows but KEEPS named rows with an empty path', () => {
        const rows = sanitizeParseJsonFields([
            { name: '  ', path: 'x' },            // blank name → dropped
            { name: 'pending', path: '' },        // half-edited → survives autosave
            { name: ' trimmed ', path: 'a.b', description: '  ', fallback: null },
            null,
            'garbage',
        ]);
        expect(rows).toEqual([
            { name: 'pending', path: '' },
            { name: 'trimmed', path: 'a.b', fallback: null }, // blank description stripped, fallback null kept
        ]);
    });

    it('mode:"ai" round-trips through extract + patch', () => {
        const step = { id: 'p1', type: 'parse_json', mode: 'ai', sourceRef: '', fields: [] };
        expect(extractFormState(step).mode).toBe('ai');
        const patch = buildPatch({ id: 'p1', type: 'parse_json' }, { ...extractFormState(step) });
        expect(patch.mode).toBe('ai');
    });
});

describe('SettingsForm — ParseJsonFields', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        scopedStorage.setCurrentUser('parse-json-test-user');
        try { localStorage.clear(); } catch {}
    });

    const getStep = () => ({ ...buildStepFromPayload({ kind: 'parse_json', label: 'Parse JSON' }), id: 'p1' });

    it('adds, edits, and removes field rows', () => {
        renderForm(getStep());
        fireEvent.click(screen.getByText('Add field'));
        const name = screen.getByLabelText('Field name');
        const path = screen.getByLabelText('Field path');
        fireEvent.change(name, { target: { value: 'email' } });
        fireEvent.change(path, { target: { value: 'order.email' } });
        expect(name.value).toBe('email');
        expect(path.value).toBe('order.email');
        fireEvent.click(screen.getByTitle('Remove field'));
        expect(screen.queryByLabelText('Field name')).toBeNull();
    });

    it('saves edited rows through onPatch (blank-name row dropped, incomplete row kept)', async () => {
        const onPatch = vi.fn(async () => {});
        renderForm(getStep(), { onPatch });
        fireEvent.click(screen.getByText('Add field'));
        fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'pending' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].fields).toEqual([{ name: 'pending', path: '' }]);
    });

    it('the Options toggle persists mode:"ai"', async () => {
        const onPatch = vi.fn(async () => {});
        renderForm(getStep(), { onPatch });
        fireEvent.click(screen.getByText('Options'));
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].mode).toBe('ai');
    });

    it('Map with AI is disabled without a usable sample (hint shown)', () => {
        renderForm(getStep());
        fireEvent.change(screen.getByPlaceholderText(/Describe the fields you want/), { target: { value: 'the email' } });
        const btn = screen.getByRole('button', { name: /Map with AI/ });
        expect(btn.disabled).toBe(true);
        expect(screen.getByText("Run or pin the previous step's output first.")).toBeTruthy();
    });

    it('Map with AI merges returned rows, skips existing names, and badges unverified rows', async () => {
        const step = { ...getStep(), sourceRef: 'steps.h1.output.body', fields: [{ name: 'existing', path: 'dupe' }] };
        renderForm(step, { previewSample: SAMPLE });
        fireEvent.change(screen.getByPlaceholderText(/Describe the fields you want/), { target: { value: 'email + ghost' } });
        const btn = screen.getByRole('button', { name: /Map with AI/ });
        expect(btn.disabled).toBe(false);
        fireEvent.click(btn);
        await waitFor(() => expect(api.mapJsonFields).toHaveBeenCalledTimes(1));
        const [sample, instruction, existingFields] = api.mapJsonFields.mock.calls[0];
        expect(sample).toEqual({ order: { email: 'a@b.c' }, items: [{ sku: 'X1' }] }); // parsed, not the raw string
        expect(instruction).toBe('email + ghost');
        expect(existingFields).toEqual([{ name: 'existing', path: 'dupe', description: '' }]);
        // Merged rows appear (existing name NOT duplicated).
        await waitFor(() => expect(screen.getByDisplayValue('order.email')).toBeTruthy());
        expect(screen.getByDisplayValue('nope.x')).toBeTruthy();
        expect(screen.getAllByDisplayValue('existing').length).toBe(1);
        // Unverified row gets the amber badge.
        expect(screen.getByText('not found in sample')).toBeTruthy();
    });

    it('shows a live preview per row against the resolved (auto-parsed) sample', () => {
        const step = { ...getStep(), sourceRef: 'steps.h1.output.body', fields: [{ name: 'email', path: 'order.email' }, { name: 'bad', path: 'zz.q' }] };
        renderForm(step, { previewSample: SAMPLE });
        // 'a@b.c' also appears as the tree row's inline preview — assert at
        // least one occurrence rather than uniqueness.
        expect(screen.getAllByText('a@b.c').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('no match in sample')).toBeTruthy();
    });

    it('offers "Pick from sample" and appends a row with a suggested unique name', () => {
        const step = { ...getStep(), sourceRef: 'steps.h1.output.body' };
        renderForm(step, { previewSample: SAMPLE });
        // The tree renders the parsed source; click the nested email leaf.
        fireEvent.click(screen.getByText('email'));
        expect(screen.getByDisplayValue('order.email')).toBeTruthy();
        expect(screen.getByDisplayValue('email')).toBeTruthy(); // suggested name
    });

    it('shows the "Use HTTP response body" shortcut when the nearest upstream is http_request', () => {
        const groups = [
            { id: 'trg', kind: 'trigger', basePath: 'trigger.output', sample: {}, fields: [] },
            { id: 'h1', kind: 'http_request', basePath: 'steps.h1.output', sample: {}, fields: [] },
        ];
        renderForm(getStep(), { groups, previewSample: SAMPLE });
        fireEvent.click(screen.getByText('Use HTTP response body'));
        expect(editorWithValue(document.body, 'steps.h1.output.body')).toBeTruthy();
    });
});

describe('parse_json — retired from the palette (legacy steps keep opening)', () => {
    it('has NO palette entry anymore — Edit data carries the ability', () => {
        expect(DATA_ITEMS.find(i => i.id === 'parse_json')).toBeUndefined();
        expect(DATA_ITEMS.find(i => i.id === 'set')).toBeTruthy();
    });

    it('an existing step still opens its editor, with the moved-into-Edit-data banner', () => {
        renderForm({ id: 'p1', type: 'parse_json', sourceRef: '', itemsRef: '', mode: 'paths', fields: [{ name: 'a', path: 'x' }], label: 'Parse JSON' });
        expect(screen.getByText(/This step type has moved into/)).toBeTruthy();
        expect(screen.getByText(/keeps working/)).toBeTruthy();
        // The real form is still there beneath it (accordion title + row label).
        expect(screen.getAllByText('Source').length).toBeGreaterThan(0);
    });
});

// ── grouping ("one row per entry") ──────────────────────────────────
// A calendar payload: without grouping, attendees[*].email flattens across
// ALL meetings and you lose which meeting each address belonged to.
const CAL_SAMPLE = {
    trigger: { output: {} },
    steps: {
        c1: {
            output: {
                results: [
                    { title: 'Daily Scrum', attendees: [{ email: 'a@x.nl', name: null }, { email: 'b@x.nl', name: 'Bee' }] },
                    { title: 'Weekstart', attendees: [{ email: 'c@x.nl', name: null }] },
                ],
            },
        },
    },
};

describe('parse_json — grouping by list', () => {
    it('buildPatch round-trips itemsRef and extractFormState reads it back', () => {
        const patch = buildPatch({ id: 'p1', type: 'parse_json' }, {
            sourceRef: 'steps.c1.output', itemsRef: 'results', mode: 'paths',
            fields: [{ name: 'meeting_title', path: 'title' }],
        });
        expect(patch.itemsRef).toBe('results');
        expect(extractFormState({ ...patch, id: 'p1', type: 'parse_json' }).itemsRef).toBe('results');
        // absent itemsRef stays an empty string (ungrouped), never undefined
        expect(buildPatch({ id: 'p1', type: 'parse_json' }, { fields: [] }).itemsRef).toBe('');
    });

    it('offers the sample’s lists as one-click grouping targets', async () => {
        renderForm({ id: 'p1', type: 'parse_json', sourceRef: 'steps.c1.output', fields: [] }, { previewSample: CAL_SAMPLE });
        const chip = await screen.findByRole('button', { name: 'results' });
        fireEvent.click(chip);
        await waitFor(() => expect(screen.getByPlaceholderText('results').value).toBe('results'));
    });

    it('reports entry count and shows per-row coverage for a sparse field', async () => {
        renderForm({
            id: 'p1', type: 'parse_json', sourceRef: 'steps.c1.output', itemsRef: 'results',
            fields: [{ name: 'attendee_names', path: 'attendees[*].name' }],
        }, { previewSample: CAL_SAMPLE });
        expect(await screen.findByText(/2 entries — one output row each/)).toBeTruthy();
        // preview resolves against ONE entry, not the flattened list
        expect(screen.getByText('row 1')).toBeTruthy();
        expect(screen.getByText(/filled in 2\/2/)).toBeTruthy();
    });

    it('warns when the grouping path is not a list', async () => {
        renderForm({
            id: 'p1', type: 'parse_json', sourceRef: 'steps.c1.output', itemsRef: 'results[0].title',
            fields: [{ name: 'x', path: 'a' }],
        }, { previewSample: CAL_SAMPLE });
        expect(await screen.findByText(/not a list in the sample/)).toBeTruthy();
    });

    it('applies an itemsRef proposed by Map with AI', async () => {
        api.mapJsonFields.mockResolvedValueOnce({
            itemsRef: 'results',
            fields: [{ name: 'meeting_title', path: 'title', verified: true, sampleValue: 'Daily Scrum' }],
        });
        renderForm({ id: 'p1', type: 'parse_json', sourceRef: 'steps.c1.output', fields: [] }, { previewSample: CAL_SAMPLE });
        fireEvent.change(screen.getByPlaceholderText(/Describe the fields/i), {
            target: { value: 'meeting names with their attendees, grouped per meeting' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Map with AI/i }));
        await waitFor(() => expect(screen.getByPlaceholderText('results').value).toBe('results'));
    });
});
