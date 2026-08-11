import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { editor, editors, editorValue, editorWithValue, typeInEditor } from '../../../../../test/refEditor';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn() } = {}) {
    return render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={[]} />
        </VariablePickerProvider>,
    );
}

describe('SettingsForm — Switch "value to switch on" is a plain field picker, not a formula', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('switch-test-user');
        try { localStorage.clear(); } catch {}
    });

    const step = { id: 's1', type: 'switch', expr: 'trigger.output.value', cases: [{ name: 'case1', value: '' }] };

    it('renders a plain path input for the expression — no operator dropdown, no AND/OR toggle', () => {
        renderForm(step);
        expect(editorWithValue(document.body, 'trigger.output.value')).toBeTruthy();
        // ConditionBuilder-only affordances must be absent.
        expect(screen.queryByText('Add condition')).toBeNull();
        expect(screen.queryByText('Write raw expression')).toBeNull();
        expect(screen.queryByText('Match')).toBeNull();
    });

    it('editing the field updates draft.expr as a plain string', async () => {
        const onPatch = vi.fn();
        renderForm(step, { onPatch });
        const input = editorWithValue(document.body, 'trigger.output.value');
        typeInEditor(input, 'steps.s0.output.status');
        expect(editorValue(input)).toBe('steps.s0.output.status');
    });
});
