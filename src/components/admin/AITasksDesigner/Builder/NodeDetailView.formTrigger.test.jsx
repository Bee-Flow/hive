import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

const { api } = vi.hoisted(() => ({
    api: {
        getCatalog: vi.fn().mockResolvedValue({ apps: [], triggerOutputs: {} }),
        listFormPages: vi.fn().mockResolvedValue({ forms: [] }),
        createFormPage: vi.fn().mockResolvedValue({ form: { id: 'tok1', url: 'https://app.test/f/tok1', submissions: 0 } }),
        rotateFormPage: vi.fn(),
    },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

const NodeDetailView = (await import('./NodeDetailView')).default;

/**
 * Opening a form trigger in the NDV, end to end: the whole composition
 * (upstream variables → INPUT tree → SettingsForm → form editor → live
 * preview) on one screen.
 *
 * This exists because the builder crashed into its error boundary with React's
 * minified #310 ("Rendered more hooks than during the previous render") the
 * moment a form trigger was opened. A hook-order break throws during render, so
 * simply mounting and re-rendering this tree is the regression guard.
 */
const formTrigger = (fields) => ({
    id: 'trg',
    type: 'trigger',
    kind: 'form',
    label: 'Form',
    form: {
        title: 'Get in touch',
        description: '',
        submitLabel: 'Submit',
        successMessage: 'Thanks!',
        fields,
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'light' },
    },
});

const FIELDS = [
    { name: 'name', type: 'text', label: 'Your name', required: true },
    { name: 'email', type: 'email', label: 'Your email', required: true },
];

function props(trigger, extra = {}) {
    const step = { id: 's1', type: 'notification', label: 'Notify', channel: 'email', to: 'a@b.nl', subject: 'x', body: 'y' };
    const definition = { trigger, steps: [step], edges: [{ from: trigger.id, to: 's1' }] };
    return {
        step: trigger,
        runStep: null,
        runSteps: [],
        definition,
        rootDefinition: definition,
        automation: { id: 'a1', definition },
        onSaveStep: vi.fn().mockResolvedValue(undefined),
        validation: { errors: [], warnings: [] },
        modelTiers: {},
        onClose: vi.fn(),
        ...extra,
    };
}

describe('NodeDetailView — form trigger', () => {
    beforeEach(() => { cleanup(); try { localStorage.clear(); } catch { /* ignore */ } });

    it('opens without crashing and shows the form editor', async () => {
        await act(async () => { render(<NodeDetailView {...props(formTrigger(FIELDS))} />); });
        // The kicker names the trigger KIND, the same wording the canvas node
        // uses — a bare "Trigger" said nothing about which one you opened.
        expect(screen.getByText('Form trigger')).toBeTruthy();
        expect(screen.getByDisplayValue('Get in touch')).toBeTruthy();
        expect(screen.getByDisplayValue('Your name')).toBeTruthy();
    });

    it('survives a re-render after the declaration appears (the #310 path)', async () => {
        // A freshly-switched trigger has no `form` yet; the next autosave gives
        // it one. Both states must render the same hooks.
        const empty = { id: 'trg', type: 'trigger', kind: 'form', label: 'Form' };
        const { rerender } = render(<NodeDetailView {...props(empty)} />);
        expect(screen.getByText('Create the form')).toBeTruthy();

        await act(async () => {
            rerender(<NodeDetailView {...props(formTrigger(FIELDS))} />);
        });
        expect(screen.getByDisplayValue('Get in touch')).toBeTruthy();
    });

    it('survives adding and removing a question (the field list changes length)', async () => {
        await act(async () => { render(<NodeDetailView {...props(formTrigger(FIELDS))} />); });
        await act(async () => { fireEvent.click(screen.getByText('Add a question')); });
        expect(screen.getByDisplayValue('New question')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByLabelText('Remove Your name')); });
        expect(screen.queryByDisplayValue('Your name')).toBeNull();
    });

    it('survives toggling the live preview on and off', async () => {
        await act(async () => { render(<NodeDetailView {...props(formTrigger(FIELDS))} />); });
        await act(async () => { fireEvent.click(screen.getByText('Preview the form')); });
        expect(screen.getByTestId('form-preview')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByText('Hide preview')); });
        expect(screen.queryByTestId('form-preview')).toBeNull();
    });

    it('exposes the declared answers as bindable trigger variables in the INPUT panel', async () => {
        // The downstream step is what maps FROM the form, so open the NDV on it.
        const trigger = formTrigger(FIELDS);
        const base = props(trigger);
        await act(async () => {
            render(<NodeDetailView {...base} step={base.definition.steps[0]} />);
        });
        expect(screen.getByText('Form answers')).toBeTruthy();
        expect(screen.getByText('name')).toBeTruthy();
        expect(screen.getByText('email')).toBeTruthy();
    });

    it('a form with NO fields still opens (an empty declaration is draft-legal)', async () => {
        await act(async () => { render(<NodeDetailView {...props(formTrigger([]))} />); });
        expect(screen.getByText(/No questions yet/)).toBeTruthy();
    });
});
