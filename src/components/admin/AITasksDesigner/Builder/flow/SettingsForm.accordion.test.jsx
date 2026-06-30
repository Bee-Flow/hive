import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { stepIssues = noIssues, onPatch = vi.fn(), catalog = null } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm
                step={step}
                modelTiers={{}}
                stepIssues={stepIssues}
                saving={false}
                saveError={null}
                onPatch={onPatch}
                catalog={catalog}
                groups={[]}
            />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

describe('SettingsForm — accordion sections', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('keeps the AI prompt flat and collapses the empty Inputs section by default', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'My AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        // Prompt is always visible (flat, not in an accordion).
        expect(screen.getByPlaceholderText(/Summarise this email/)).toBeTruthy();
        // Section headers exist…
        expect(screen.getByRole('button', { name: 'Inputs' })).toBeTruthy();
        // …but the empty Inputs body is collapsed.
        expect(screen.queryByText(/No inputs yet/)).toBeNull();
    });

    it('force-opens the section that contains a validation error', () => {
        renderForm(
            { id: 's1', type: 'ai_step', label: 'My AI', prompt: 'Do X', inputs: {}, outputFields: [] },
            { stepIssues: { errors: [{ path: 'steps[s1].inputs.foo', severity: 'error' }], warnings: [] } },
        );
        // Inputs is forced open even though it is empty → its body renders.
        expect(screen.getByText(/No inputs yet/)).toBeTruthy();
    });

    // Only accordion headers carry aria-expanded (the FieldHint ⓘ button does
    // not), so this reliably picks a section header by title.
    const sectionHeader = (title) =>
        screen.getAllByRole('button').find(b => b.hasAttribute('aria-expanded') && b.textContent.trim() === title);

    it('opens a populated Inputs section by default for integration_action', () => {
        renderForm({ id: 'i1', type: 'integration_action', label: 'Send', tool: 'gmail_send', inputs: { to: { kind: 'literal', value: 'a@b.com' } } });
        expect(sectionHeader('Basics')).toBeTruthy();
        expect(sectionHeader('Inputs')).toBeTruthy();
        // The populated field row is visible (section open by default).
        expect(screen.getByDisplayValue('to')).toBeTruthy();
    });

    it('persists a collapsed section across remounts', () => {
        const step = { id: 'i1', type: 'integration_action', label: 'Send', tool: 'gmail_send', inputs: { to: { kind: 'literal', value: 'a@b.com' } } };
        renderForm(step);
        expect(screen.getByDisplayValue('to')).toBeTruthy();
        fireEvent.click(sectionHeader('Inputs'));
        expect(scopedStorage.getItem('collapse.inspector.integration_action.inputs')).toBe('0');
        cleanup();
        renderForm(step);
        // Re-mounted: the persisted collapsed state hides the field row.
        expect(screen.queryByDisplayValue('to')).toBeNull();
    });

    it('still autosaves edits (section state is decoupled from the draft)', async () => {
        const { onPatch } = renderForm({ id: 's1', type: 'ai_step', label: 'My AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        const label = screen.getByDisplayValue('My AI');
        fireEvent.change(label, { target: { value: 'Renamed AI' } });
        await waitFor(() => expect(onPatch).toHaveBeenCalled(), { timeout: 2000 });
    });

    it('AI step exposes a "Run once per item" loop toggle under Advanced', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'My AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        // The loop control lives inside the AI step's Advanced section.
        expect(screen.queryByText('Run once per item')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
        expect(screen.getByText('Run once per item')).toBeTruthy();
    });
});
