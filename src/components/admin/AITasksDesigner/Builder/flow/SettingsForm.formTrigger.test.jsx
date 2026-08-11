import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import { extractFormState, buildPatch } from './settings/formState';
import scopedStorage from '../../../../../utils/scopedStorage';

// The URL panel talks to the API on mount; the form editor itself is what is
// under test here.
vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({
        listFormPages: vi.fn(async () => ({ forms: [{ id: 'tok1', url: 'https://app.test/f/tok1', submissions: 0, triggerStepId: null }] })),
        createFormPage: vi.fn(async () => ({ form: { id: 'tok1', url: 'https://app.test/f/tok1', submissions: 0 } })),
        rotateFormPage: vi.fn(async () => ({ form: { id: 'tok2', url: 'https://app.test/f/tok2', submissions: 0 } })),
    }),
}));

const noIssues = { errors: [], warnings: [] };

const FORM = {
    title: 'Get in touch',
    description: '',
    submitLabel: 'Submit',
    successMessage: 'Thanks!',
    fields: [
        { name: 'name', type: 'text', label: 'Your name', required: true },
        { name: 'email', type: 'email', label: 'Your email', required: true },
    ],
    theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'light' },
};

const trigger = (extra = {}) => ({ id: 'trg', type: 'trigger', kind: 'form', form: FORM, ...extra });
const automation = (t) => ({ id: 'a1', definition: { trigger: t, steps: [], edges: [] } });

function renderForm(step, { onPatch = vi.fn(), auto = automation(step) } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm
                step={step}
                modelTiers={{}}
                stepIssues={noIssues}
                saving={false}
                saveError={null}
                onPatch={onPatch}
                catalog={null}
                groups={[]}
                automation={auto}
            />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

describe('SettingsForm — form trigger', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('form-trigger-test-user');
        try { localStorage.clear(); } catch { /* jsdom without storage */ }
    });

    it('the trigger-kind select offers the form option', () => {
        renderForm({ id: 'trg', type: 'trigger', kind: 'manual' });
        const option = screen.getByRole('option', { name: /Form — a public page people fill in/ });
        expect(option.value).toBe('form');
    });

    /**
     * Regression: switching an existing trigger to `form` re-rendered the SAME
     * component instance with a different number of hooks, which React reports
     * as the opaque minified error #310 and the whole builder unmounts into the
     * error boundary. Rendering both states of the panel is the cheapest way to
     * catch it — a hook-order break throws during render.
     */
    it('renders with and without a declaration, and switching between them does not break hooks', () => {
        const { rerender } = render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                <SettingsForm
                    step={{ id: 'trg', type: 'trigger', kind: 'form' }}
                    modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null}
                    onPatch={vi.fn()} catalog={null} groups={[]} automation={automation({ id: 'trg', kind: 'form' })}
                />
            </VariablePickerProvider>,
        );
        expect(screen.getByText('Create the form')).toBeTruthy();

        rerender(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                <SettingsForm
                    step={trigger()}
                    modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null}
                    onPatch={vi.fn()} catalog={null} groups={[]} automation={automation(trigger())}
                />
            </VariablePickerProvider>,
        );
        expect(screen.getByDisplayValue('Get in touch')).toBeTruthy();
    });

    /**
     * The exact crash from the field report: opening a trigger with no
     * declaration renders one set of hooks, and pressing "Create the form"
     * re-renders the SAME component instance with a form. When the preview's
     * useMemo sat below the `if (!form) return`, that second render called one
     * hook more than the first — React #310, and the whole builder fell into
     * its error boundary.
     */
    it('creating the declaration in place does not change the hook count', () => {
        function Harness() {
            const [step, setStep] = React.useState({ id: 'trg', type: 'trigger', kind: 'form' });
            return (
                <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                    <SettingsForm
                        key="stable"
                        step={step}
                        modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null}
                        onPatch={(p) => setStep(s => ({ ...s, ...p }))}
                        catalog={null} groups={[]} automation={automation({ id: 'trg', kind: 'form' })}
                    />
                </VariablePickerProvider>
            );
        }
        render(<Harness />);
        fireEvent.click(screen.getByText('Create the form'));
        // The editor for the seeded declaration is on screen — no throw.
        expect(screen.getByDisplayValue('Get in touch')).toBeTruthy();
        expect(screen.getByDisplayValue('Your name')).toBeTruthy();
        expect(screen.queryByText('Create the form')).toBeNull();
    });

    it('lists the declared questions and their types', () => {
        renderForm(trigger());
        expect(screen.getByDisplayValue('Your name')).toBeTruthy();
        expect(screen.getByDisplayValue('Your email')).toBeTruthy();
        expect(screen.getByLabelText('Question 2 type').value).toBe('email');
    });

    /**
     * The single most important invariant of the editor: `name` is what every
     * downstream `trigger.output.<name>` binding points at, so renaming the
     * QUESTION must not touch it. Re-deriving it here would break bindings
     * silently, with nothing to see in the UI.
     */
    it('editing a label leaves the binding name alone', () => {
        const { onPatch } = renderForm(trigger());
        fireEvent.change(screen.getByLabelText('Question 1 label'), { target: { value: 'Full name' } });
        fireEvent.click(screen.getByText('Save'));

        const patch = onPatch.mock.calls.at(-1)[0];
        expect(patch.form.fields[0].label).toBe('Full name');
        expect(patch.form.fields[0].name).toBe('name');
    });

    it('adding a question slugs a fresh, unique binding name', () => {
        const { onPatch } = renderForm(trigger());
        fireEvent.click(screen.getByText('Add a question'));
        fireEvent.click(screen.getByText('Save'));
        const fields = onPatch.mock.calls.at(-1)[0].form.fields;
        expect(fields).toHaveLength(3);
        expect(fields[2].name).toBe('new_question');
        expect(new Set(fields.map(f => f.name)).size).toBe(3);
    });

    it('a theme preset sets all five keys at once', () => {
        const { onPatch } = renderForm(trigger());
        fireEvent.click(screen.getByRole('button', { name: /Night/ }));
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch.mock.calls.at(-1)[0].form.theme).toEqual({
            primary: '#0891B2', radius: 'lg', density: 'comfortable', fontScale: 'md', appearance: 'dark',
        });
    });

    it('the preview renders the same component the visitor gets', () => {
        renderForm(trigger());
        expect(screen.queryByTestId('form-preview')).toBeNull();
        fireEvent.click(screen.getByText('Preview the form'));
        const preview = screen.getByTestId('form-preview');
        expect(within(preview).getByText('Get in touch')).toBeTruthy();
        expect(within(preview).getByRole('button', { name: 'Submit' })).toBeTruthy();
    });

    it('extractFormState reads step.form; buildPatch writes it back and nulls siblings', () => {
        const step = trigger({ schedule: { cron: '0 9 * * 1' } });
        const draft = extractFormState(step);
        expect(draft.kind).toBe('form');
        expect(draft.form.fields).toHaveLength(2);

        const patch = buildPatch(step, { ...draft, form: { ...FORM, title: 'New title' } });
        expect(patch.form.title).toBe('New title');
        expect(patch.schedule).toBeNull();
        expect(patch.appEvent).toBeNull();
    });

    it('switching AWAY from form drops the declaration rather than leaving it behind', () => {
        const step = trigger();
        const patch = buildPatch(step, { ...extractFormState(step), kind: 'manual' });
        expect(patch.kind).toBe('manual');
        expect(patch.form).toBeNull();
    });
});
