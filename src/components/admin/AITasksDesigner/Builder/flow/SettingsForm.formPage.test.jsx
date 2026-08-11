import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { editor, editors, editorValue, editorWithValue, typeInEditor } from '../../../../../test/refEditor';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import { extractFormState, buildPatch } from './settings/formState';
import { describeNode } from '../mapping/upstream';
import scopedStorage from '../../../../../utils/scopedStorage';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listFormPages: vi.fn(async () => ({ forms: [] })), createFormPage: vi.fn(), rotateFormPage: vi.fn() }),
}));

const noIssues = { errors: [], warnings: [] };

const inputPage = (extra = {}) => ({
    id: 'fp1', type: 'form_page', mode: 'input', waitSeconds: 3600,
    form: {
        title: 'One more thing',
        description: '',
        submitLabel: 'Continue',
        successMessage: 'Thanks!',
        fields: [{ name: 'address', type: 'text', label: 'Your address', required: true }],
        theme: null,
    },
    ...extra,
});

const endingPage = () => ({
    id: 'bye', type: 'form_page', mode: 'ending',
    form: { title: 'All done', description: 'We created {{steps.t.output.number}}.', fields: [], theme: null },
});

/** One upstream step whose output a later page can quote. */
const TICKET_GROUP = {
    id: 't',
    label: 'Create ticket',
    basePath: 'steps.t.output',
    fields: [{ key: 'number', path: 'steps.t.output.number', sample: 'INC-4471' }],
    sample: { number: 'INC-4471' },
};
const TICKET_SAMPLE = { steps: { t: { output: { number: 'INC-4471' } } } };

function renderStep(step, { onPatch = vi.fn(), groups = [], previewSample = null } = {}) {
    render(
        <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={new Map()}>
            <SettingsForm
                step={step}
                modelTiers={{}}
                stepIssues={noIssues}
                saving={false}
                saveError={null}
                onPatch={onPatch}
                catalog={null}
                groups={groups}
                previewSample={previewSample}
                automation={{ id: 'a1', definition: { trigger: { id: 'trg', kind: 'form' }, steps: [step], edges: [] } }}
            />
        </VariablePickerProvider>,
    );
    return { onPatch };
}

describe('SettingsForm — form page step', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('form-page-test-user');
        try { localStorage.clear(); } catch { /* jsdom without storage */ }
    });

    it('an input page edits its questions', () => {
        renderStep(inputPage());
        expect(editorWithValue(document.body, 'One more thing')).toBeTruthy();
        expect(editorWithValue(document.body, 'Your address')).toBeTruthy();
        expect(screen.getByLabelText('Question 1 type').value).toBe('text');
    });

    /**
     * The same invariant as the trigger's: `name` is what every downstream
     * steps.<id>.output.<name> binding points at, so renaming the QUESTION
     * must not touch it. Re-deriving would break bindings with nothing to see.
     */
    it('editing a label leaves the binding name alone', () => {
        const { onPatch } = renderStep(inputPage());
        typeInEditor(screen.getByLabelText('Question 1 label'), 'Delivery address');
        fireEvent.click(screen.getByText('Save'));

        const patch = onPatch.mock.calls.at(-1)[0];
        expect(patch.form.fields[0].label).toBe('Delivery address');
        expect(patch.form.fields[0].name).toBe('address');
    });

    it('a closing page has no questions and no submit button to configure', () => {
        renderStep(endingPage());
        expect(editorWithValue(document.body, 'All done')).toBeTruthy();
        expect(screen.queryByText('Add a question')).toBeNull();
        expect(screen.queryByText('Button text')).toBeNull();
        // …and no wait window: there is nothing to wait for.
        expect(screen.queryByRole('combobox', { name: 'Wait for an answer' })).toBeNull();
    });

    it('the wait window is editable on an input page and clamped on save', () => {
        const { onPatch } = renderStep(inputPage());
        fireEvent.change(screen.getByRole('combobox', { name: 'Wait for an answer' }), { target: { value: '900' } });
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch.mock.calls.at(-1)[0].waitSeconds).toBe(900);
    });

    it('the preview renders the same component the visitor gets', () => {
        renderStep(inputPage());
        fireEvent.click(screen.getByText('Preview the form'));
        const preview = screen.getByTestId('form-preview');
        expect(within(preview).getByText('One more thing')).toBeTruthy();
        expect(within(preview).getByRole('button', { name: 'Continue' })).toBeTruthy();
    });

    it('a closing page previews as the ending card, not as a form', () => {
        renderStep(endingPage());
        fireEvent.click(screen.getByText('Preview the form'));
        const preview = screen.getByTestId('form-preview');
        expect(within(preview).getByText('All done')).toBeTruthy();
        // With no sample data to resolve against, the raw binding stays put —
        // an unresolvable path must never silently become a blank line.
        expect(within(preview).getByText(/We created \{\{steps\.t\.output\.number\}\}\./)).toBeTruthy();
        expect(within(preview).queryByRole('button')).toBeNull();
    });

    it('a page defaults to the first page\'s styling, and overriding is one click', () => {
        const { onPatch } = renderStep(inputPage());
        const inherit = screen.getByLabelText('Match the first page');
        expect(inherit.checked).toBe(true);
        // While inheriting, the theme controls stay out of the way.
        expect(screen.queryByLabelText('Custom accent colour')).toBeNull();

        fireEvent.click(inherit);
        expect(screen.getByLabelText('Custom accent colour')).toBeTruthy();
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch.mock.calls.at(-1)[0].form.theme).toMatchObject({ primary: expect.any(String) });
    });

    it('a page with no declaration yet offers to create one, and creating it does not break hooks', () => {
        // Same #310 shape as the trigger: "no declaration" and "declaration"
        // are both renders this component can be in.
        function Harness() {
            const [step, setStep] = React.useState({ id: 'fp1', type: 'form_page', mode: 'input' });
            return (
                <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                    <SettingsForm
                        key="stable"
                        step={step}
                        modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null}
                        onPatch={(p) => setStep(s => ({ ...s, ...p }))}
                        catalog={null} groups={[]}
                        automation={{ id: 'a1', definition: { trigger: { id: 'trg', kind: 'form' }, steps: [], edges: [] } }}
                    />
                </VariablePickerProvider>
            );
        }
        render(<Harness />);
        fireEvent.click(screen.getByText('Create the page'));
        expect(editorWithValue(document.body, 'One more thing')).toBeTruthy();
        expect(screen.queryByText('Create the page')).toBeNull();
    });

    it('extractFormState reads the step; buildPatch writes back only what changed', () => {
        const step = inputPage();
        const draft = extractFormState(step);
        expect(draft.mode).toBe('input');
        expect(draft.waitSeconds).toBe(3600);
        expect(draft.form.fields).toHaveLength(1);

        const patch = buildPatch(step, { ...draft, form: { ...draft.form, title: 'New title' } });
        expect(patch.form.title).toBe('New title');
        // buildPatch sends the DIFF, so untouched keys stay out of the way of a
        // concurrent AI-builder edit.
        expect('mode' in patch).toBe(false);
        expect('waitSeconds' in patch).toBe(false);
    });

    it('switching a page to a closing page clears its wait window', () => {
        // Otherwise a stale waitSeconds would sit on a step that never waits.
        const step = inputPage();
        const patch = buildPatch(step, { ...extractFormState(step), mode: 'ending' });
        expect(patch.mode).toBe('ending');
        expect(patch.waitSeconds).toBeNull();
    });

    it('a new wait window is clamped to the range the server accepts', () => {
        const step = inputPage();
        expect(buildPatch(step, { ...extractFormState(step), waitSeconds: 5 }).waitSeconds).toBe(60);
        expect(buildPatch(step, { ...extractFormState(step), waitSeconds: 99 * 24 * 3600 }).waitSeconds).toBe(7 * 24 * 3600);
    });

    /**
     * The client-side mirror of execFormPage's return shape. If these drift, a
     * downstream step offers bindings the run never produces.
     */
    it('describeNode exposes an input page\'s answers as bindable variables', () => {
        const group = describeNode(inputPage({
            form: { title: 'x', fields: [
                { name: 'address', type: 'text', label: 'Your address' },
                { name: 'agree', type: 'checkbox', label: 'Agree' },
            ] },
        }));
        expect(group.basePath).toBe('steps.fp1.output');
        expect(group.fields.map(f => f.path)).toEqual(['steps.fp1.output.address', 'steps.fp1.output.agree']);
        expect(group.sample.agree).toBe(true);
    });

    it('an ending page contributes no variables — it has no answers', () => {
        expect(describeNode(endingPage())).toBeNull();
    });
});

/**
 * A later page is rendered mid-run, so every text on it is interpolated against
 * the run state at the moment it is shown. That is what makes "show a summary"
 * possible at all — the author has to be able to reach the earlier steps.
 */
describe('SettingsForm — form page: values from earlier steps', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('form-page-test-user');
        try { localStorage.clear(); } catch { /* jsdom without storage */ }
    });

    const pickInto = (buttonIndex, path) => {
        fireEvent.click(screen.getAllByLabelText('Insert variable')[buttonIndex]);
        fireEvent.click(screen.getByTitle(path));
    };

    it('every text slot on a page offers the picker', () => {
        renderStep(inputPage(), { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        // title, intro, the one question's label, button text, thank-you text.
        expect(screen.getAllByLabelText('Insert variable')).toHaveLength(5);
    });

    it('picking a value writes a {{…}} template into the page title', () => {
        const { onPatch } = renderStep(inputPage(), { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        pickInto(0, 'steps.t.output.number');
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch.mock.calls.at(-1)[0].form.title).toContain('{{steps.t.output.number}}');
    });

    it('a question label can quote an earlier step without touching its binding name', () => {
        const { onPatch } = renderStep(inputPage(), { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        // Index 2: title, intro, then the first question's label.
        pickInto(2, 'steps.t.output.number');
        fireEvent.click(screen.getByText('Save'));

        const field = onPatch.mock.calls.at(-1)[0].form.fields[0];
        expect(field.label).toContain('{{steps.t.output.number}}');
        expect(field.name).toBe('address');
    });

    it('typing a template by hand works too, and reaches the step unchanged', () => {
        const { onPatch } = renderStep(endingPage(), { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        const message = editorWithValue(document.body, 'We created {{steps.t.output.number}}.');
        typeInEditor(message, 'Ticket {{steps.t.output.number}} is open.');
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch.mock.calls.at(-1)[0].form.description).toBe('Ticket {{steps.t.output.number}} is open.');
    });

    it('the preview shows the resolved sample value, the way the visitor will see it', () => {
        renderStep(endingPage(), { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        fireEvent.click(screen.getByText('Preview the form'));
        const preview = screen.getByTestId('form-preview');
        expect(within(preview).getByText(/We created INC-4471\./)).toBeTruthy();
    });

    /**
     * The trigger renders page one BEFORE anything has run, and the server
     * deliberately passes it no interpolator — so a `{{…}}` there would reach
     * the visitor verbatim. Offering the picker would be a promise we break.
     */
    it('the trigger\'s own page offers no picker — nothing has run yet', () => {
        renderStep({
            id: 'trg', type: 'trigger', kind: 'form',
            form: { title: 'Get in touch', fields: [{ name: 'name', type: 'text', label: 'Your name' }], theme: null },
        }, { groups: [TICKET_GROUP], previewSample: TICKET_SAMPLE });
        expect(screen.queryByLabelText('Insert variable')).toBeNull();
        // No variables here means a plain input, not the reference editor.
        expect(screen.getByDisplayValue('Get in touch')).toBeTruthy();
    });
});
