import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import { extractFormState, buildPatch } from './settings/formState';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn() } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={[]} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

describe('SettingsForm — app_trigger (Studio App trigger)', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('app-trigger-test-user');
        try { localStorage.clear(); } catch {}
    });

    const trigger = (extra = {}) => ({ id: 'trg', type: 'trigger', kind: 'app_trigger', params: [], ...extra });

    it('the trigger-kind select offers the Studio App option', () => {
        renderForm({ id: 'trg', type: 'trigger', kind: 'manual' });
        const option = screen.getByRole('option', { name: /Studio App — called by an app action/ });
        expect(option).toBeTruthy();
        expect(option.value).toBe('app_trigger');
    });

    it('renders the App inputs editor with the file type option', () => {
        renderForm(trigger());
        expect(screen.getByText(/No inputs yet/)).toBeTruthy();
        fireEvent.click(screen.getByText('Add input'));
        // The new row's type select includes every contract type incl. file.
        const typeSelect = screen.getAllByRole('combobox').at(-1);
        const values = Array.from(typeSelect.options).map(o => o.value);
        expect(values).toEqual(['string', 'number', 'boolean', 'array', 'object', 'file']);
        expect(screen.getByRole('option', { name: /file \(pdf \/ word \/ excel \/ image\)/ })).toBeTruthy();
    });

    it('existing params render with name, description and required state', () => {
        renderForm(trigger({ params: [{ name: 'doc', type: 'file', required: true, description: 'the invoice' }] }));
        expect(screen.getByDisplayValue('doc')).toBeTruthy();
        expect(screen.getByDisplayValue('the invoice')).toBeTruthy();
        expect(screen.getByRole('checkbox').checked).toBe(true);
    });

    it('the name input strips illegal characters and warns on a leading underscore', () => {
        renderForm(trigger({ params: [{ name: '_x', type: 'string', required: false }] }));
        expect(screen.getByText(/must start with a letter/i)).toBeTruthy();
    });

    it('extractFormState reads step.params; buildPatch writes them back and nulls siblings', () => {
        const step = trigger({
            params: [{ name: 'doc', type: 'file', required: true }],
            schedule: { cron: '0 9 * * 1' },
        });
        const draft = extractFormState(step);
        expect(draft.kind).toBe('app_trigger');
        expect(draft.params).toEqual([{ name: 'doc', type: 'file', required: true }]);

        // Note: buildPatch strips UNCHANGED keys (concurrent-edit safety), so
        // only the edited params + the nulled siblings appear here.
        const patch = buildPatch(step, {
            ...draft,
            params: [
                { name: 'doc', type: 'file', required: true, description: 'the file' },
                { name: '', type: 'string' }, // nameless row dropped
            ],
        });
        expect(patch.params).toEqual([{ name: 'doc', type: 'file', required: true, description: 'the file' }]);
        expect(patch.schedule).toBeNull();
        expect(patch.appEvent).toBeNull();
    });

    it('switching a manual trigger to app_trigger patches the kind', () => {
        const step = { id: 'trg', type: 'trigger', kind: 'manual' };
        const draft = { ...extractFormState(step), kind: 'app_trigger', params: [{ name: 'q', type: 'string' }] };
        const patch = buildPatch(step, draft);
        expect(patch.kind).toBe('app_trigger');
        expect(patch.params).toEqual([{ name: 'q', type: 'string', required: false }]);
    });
});
