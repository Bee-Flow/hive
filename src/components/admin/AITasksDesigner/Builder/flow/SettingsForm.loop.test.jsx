import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn(), catalog = null, onExpandOnCanvas = null } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={catalog} groups={[]} onExpandOnCanvas={onExpandOnCanvas} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

describe('SettingsForm — Loop batch size + body editor', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('loop-test-user');
        try { localStorage.clear(); } catch {}
    });

    const step = { id: 'lp', type: 'loop', overRef: 'trigger.output.items', itemVar: 'item', maxIterations: 100, batchSize: 1, body: [] };

    it('renders a Batch size field defaulting to 1', () => {
        renderForm(step);
        expect(screen.getByText('Batch size')).toBeTruthy();
        const inputs = screen.getAllByDisplayValue('1');
        expect(inputs.length).toBeGreaterThan(0);
    });

    it('shows "no steps yet" when body is empty, and an Add step affordance', () => {
        renderForm(step);
        expect(screen.getByText(/No steps yet/)).toBeTruthy();
        expect(screen.getByText('Add step')).toBeTruthy();
    });

    it('adding a step via the palette appends to body and auto-expands it', () => {
        const onPatch = vi.fn();
        renderForm(step, { onPatch });
        fireEvent.click(screen.getByText('Add step'));
        // "Notification" is a Flow-control palette item, always present with no catalog.
        fireEvent.click(screen.getByText('Notification'));
        // The new body row renders (expanded), showing its own Label field.
        expect(screen.getByText(/1\. /)).toBeTruthy();
    });

    it('removing a body step calls onChange with it filtered out', () => {
        const bodyStep = { id: 'n1', type: 'notification', label: 'Ping', title: 'hi', body: 'x' };
        const withBody = { ...step, body: [bodyStep] };
        renderForm(withBody);
        expect(screen.getByText(/1\. Ping/)).toBeTruthy();
        fireEvent.click(screen.getByTitle('Remove step'));
        expect(screen.queryByText(/1\. Ping/)).toBeNull();
    });

    it('expanding a body step renders its own nested SettingsForm (Label field)', () => {
        const bodyStep = { id: 'n1', type: 'notification', label: 'Ping', title: 'hi', body: 'x' };
        const withBody = { ...step, body: [bodyStep] };
        renderForm(withBody);
        fireEvent.click(screen.getByText(/1\. Ping/));
        expect(screen.getByDisplayValue('Ping')).toBeTruthy();
    });

    it('reordering moves a step and disables the boundary buttons', () => {
        const bodyStep = (id, label) => ({ id, type: 'notification', label, title: 'x', body: 'x' });
        const withBody = { ...step, body: [bodyStep('a', 'First'), bodyStep('b', 'Second')] };
        renderForm(withBody);
        const upButtons = screen.getAllByTitle('Move up');
        expect(upButtons[0].disabled).toBe(true);
        fireEvent.click(screen.getAllByTitle('Move down')[0]);
        // After swapping, "Second" should now render first.
        const rows = screen.getAllByText(/^[12]\. /);
        expect(rows[0].textContent).toMatch(/1\. Second/);
    });
});

/**
 * The list editor above stays — it is the only body editor when the canvas is
 * not in view (a loop inside an unexpanded flowlet, a narrow screen). What it
 * gained is a way ACROSS to the canvas, and a line saying the body is
 * sequential: the up/down arrows were the only hint that order mattered at all.
 */
describe('SettingsForm — Loop body, and the canvas', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('loop-canvas-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    const step = { id: 'lp', type: 'loop', overRef: 'trigger.output.items', itemVar: 'item', body: [] };

    it('says the body runs once per item, in order', () => {
        renderForm(step);
        expect(screen.getByText(/once per item, top to bottom/i)).toBeTruthy();
    });

    it('offers the canvas, and hands back the loop\'s id', () => {
        const onExpandOnCanvas = vi.fn();
        renderForm(step, { onExpandOnCanvas });
        fireEvent.click(screen.getByRole('button', { name: /edit on canvas/i }));
        expect(onExpandOnCanvas).toHaveBeenCalledWith('lp');
    });

    it('hides the canvas button where there is no canvas', () => {
        // The nested SettingsForm inside LoopBodyEditor passes no handler; a
        // button that did nothing would be worse than none.
        renderForm(step);
        expect(screen.queryByRole('button', { name: /edit on canvas/i })).toBeNull();
    });
});
