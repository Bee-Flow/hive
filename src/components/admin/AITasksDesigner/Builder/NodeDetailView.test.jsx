import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// NDV fetches the tool catalog on mount — stub the API.
const { api } = vi.hoisted(() => ({
    api: { getCatalog: vi.fn().mockResolvedValue({ apps: [], triggerOutputs: {} }) },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

import NodeDetailView from './NodeDetailView';

const step = { id: 's1', type: 'ai_step', label: 'My AI', prompt: 'Do X', inputs: {}, outputFields: [] };
const definition = { trigger: { id: 't1', type: 'trigger', kind: 'manual' }, steps: [step], edges: [] };

const baseProps = (overrides = {}) => ({
    step,
    runStep: null,
    runSteps: [],
    definition,
    rootDefinition: definition,
    onSaveStep: vi.fn().mockResolvedValue(undefined),
    validation: { errors: [], warnings: [] },
    modelTiers: {},
    onExecuteStep: vi.fn(),
    onRetryFromStep: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
});

describe('NodeDetailView', () => {
    beforeEach(() => { cleanup(); try { localStorage.clear(); } catch { /* ignore */ } });

    it('renders the three columns and the humanized type + name', () => {
        render(<NodeDetailView {...baseProps()} />);
        expect(screen.getByText('Input')).toBeTruthy();
        expect(screen.getByText('Parameters')).toBeTruthy();
        expect(screen.getByText('Output')).toBeTruthy();
        expect(screen.getByText('AI step')).toBeTruthy();
        // Parameters column shows the SettingsForm (Label field).
        expect(screen.getByDisplayValue('My AI')).toBeTruthy();
    });

    it('Execute calls onExecuteStep with the step id', () => {
        const onExecuteStep = vi.fn();
        render(<NodeDetailView {...baseProps({ onExecuteStep })} />);
        fireEvent.click(screen.getAllByRole('button', { name: /Execute/ })[0]);
        expect(onExecuteStep).toHaveBeenCalledWith('s1');
    });

    it('close calls onClose', () => {
        const onClose = vi.fn();
        render(<NodeDetailView {...baseProps({ onClose })} />);
        fireEvent.click(screen.getByLabelText('Close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('can hide the Input and Output columns', () => {
        render(<NodeDetailView {...baseProps()} />);
        fireEvent.click(screen.getByLabelText('Hide input'));
        expect(screen.queryByText('Input')).toBeNull();
        fireEvent.click(screen.getByLabelText('Hide output'));
        expect(screen.queryByText('Output')).toBeNull();
        // Parameters always stays.
        expect(screen.getByText('Parameters')).toBeTruthy();
    });

    /**
     * A single click on a node opens the QUICK editor: the settings the step
     * needs and nothing else. Everything it leaves out has to stay one click
     * away, or the simplification just hides features.
     */
    describe('quick density', () => {
        const quickProps = (overrides = {}) => baseProps({ density: 'quick', onDensityChange: vi.fn(), ...overrides });

        it('drops the Input column and the step plumbing', () => {
            render(<NodeDetailView {...quickProps()} />);
            expect(screen.queryByText('Input')).toBeNull();
            expect(screen.queryByText('Parameters')).toBeNull();
            expect(screen.queryByText('Disable')).toBeNull();
            expect(screen.queryByText('Duplicate')).toBeNull();
            // The settings themselves are still right there.
            expect(screen.getByDisplayValue('My AI')).toBeTruthy();
        });

        it('keeps the run result under the settings, so Execute shows something', () => {
            // Pressing Execute here used to produce nothing on screen at all —
            // the result landed in a column this dialog does not render.
            render(<NodeDetailView {...quickProps()} />);
            const panel = screen.getByTestId('ndv-quick-output');
            expect(within(panel).getByText('Output')).toBeTruthy();
            expect(within(panel).getByRole('button', { name: /pin/i })).toBeTruthy();
        });

        it('says how the run went ONCE, in the header', () => {
            const runStep = { status: 'success', output: { id: 'm1' }, durationMs: 120 };
            render(<NodeDetailView {...quickProps()} runStep={runStep} />);
            const panel = screen.getByTestId('ndv-quick-output');
            // One "Success", not one in the header and another in a strip below.
            expect(within(panel).getAllByText(/Success/)).toHaveLength(1);
            // …and no standing hint footer eating the little height there is.
            expect(within(panel).queryByText(/Switch to JSON/)).toBeNull();
        });

        it('pins the latest output, and refuses when there is nothing to pin', () => {
            const onSaveStep = vi.fn();
            const { rerender } = render(<NodeDetailView {...quickProps()} onSaveStep={onSaveStep} />);
            const pinOf = () => within(screen.getByTestId('ndv-quick-output')).getByRole('button', { name: /pin/i });
            expect(pinOf().disabled).toBe(true);

            rerender(<NodeDetailView {...quickProps()} onSaveStep={onSaveStep} runStep={{ status: 'success', output: { id: 'm1' } }} />);
            expect(pinOf().disabled).toBe(false);
            fireEvent.click(pinOf());
            expect(onSaveStep).toHaveBeenCalled();
        });

        it('hides advanced sections but keeps the primary ones', () => {
            render(<NodeDetailView {...quickProps()} />);
            expect(screen.getByText('Inputs')).toBeTruthy();
            expect(screen.queryByText('Advanced')).toBeNull();
            expect(screen.queryByText('Structured output')).toBeNull();
        });

        it('offers Execute, a data line, and a counted way into everything else', () => {
            const onExecuteStep = vi.fn();
            const onModeChange = vi.fn();
            render(<NodeDetailView {...quickProps({ onExecuteStep, onModeChange })} />);
            fireEvent.click(screen.getAllByRole('button', { name: /Execute/ })[0]);
            expect(onExecuteStep).toHaveBeenCalledWith('s1');
            // ai_step hides 2 sections in Simple (Advanced + Structured
            // output). The counted control now reveals them IN THIS dialog by
            // switching the MODE — it must not swap the window for the
            // three-column workspace (the old "More options" did, and still
            // left the sections hidden).
            fireEvent.click(screen.getByText(/Show all options \(2\)/));
            expect(onModeChange).toHaveBeenCalledWith('advanced');
        });

        it('without a mode owner, the legacy counted button still opens the full view', () => {
            const onDensityChange = vi.fn();
            render(<NodeDetailView {...quickProps({ onDensityChange })} />);
            fireEvent.click(screen.getByText(/More options \(2\)/));
            expect(onDensityChange).toHaveBeenCalledWith('full');
        });

        it('says what the step produced — or that it has not run', () => {
            cleanup();
            render(<NodeDetailView {...quickProps()} />);
            expect(screen.getByText('not run yet')).toBeTruthy();
            cleanup();
            render(<NodeDetailView {...quickProps({ runStep: { status: 'success', output: { results: [{ id: 1 }, { id: 2 }] } } })} />);
            expect(screen.getByText('2 records')).toBeTruthy();
        });

        it('the expand control switches to the full view', () => {
            const onDensityChange = vi.fn();
            render(<NodeDetailView {...quickProps({ onDensityChange })} />);
            fireEvent.click(screen.getByLabelText('Expand to the full view'));
            expect(onDensityChange).toHaveBeenCalledWith('full');
        });

        it('a validation error in an advanced section is never hidden', () => {
            // Reachability beats tidiness: the error banner must point at a
            // control the user can actually see.
            render(<NodeDetailView {...quickProps({
                validation: { errors: [{ code: 'ai_step.model_tier', path: 'steps[s1].modelTier', message: 'bad tier' }], warnings: [] },
            })} />);
            expect(screen.getByText('Advanced')).toBeTruthy();
        });
    });

    it('the full view offers a way back to the small dialog', () => {
        // "Shrink to the small dialog", not "Simple view" — the words Simple /
        // All options belong to the MODE toggle; this button only resizes.
        const onDensityChange = vi.fn();
        render(<NodeDetailView {...baseProps({ density: 'full', onDensityChange })} />);
        fireEvent.click(screen.getByLabelText('Shrink to the small dialog'));
        expect(onDensityChange).toHaveBeenCalledWith('quick');
    });

    it('the user\'s mode beats the gesture: Simple stays simple in the full view', () => {
        // A user who chose Simple keeps the simple form even in the big
        // window — mode owns content, density owns window size.
        render(<NodeDetailView {...baseProps({ density: 'full', mode: 'simple', onModeChange: vi.fn() })} />);
        expect(screen.queryByText('Advanced')).toBeNull();
        expect(screen.getByText('Inputs')).toBeTruthy();
    });

    it('switching to All options reveals the hidden sections in place', () => {
        const onModeChange = vi.fn();
        const { rerender } = render(<NodeDetailView {...baseProps({ density: 'quick', mode: 'simple', onModeChange })} />);
        expect(screen.queryByText('Advanced')).toBeNull();
        rerender(<NodeDetailView {...baseProps({ density: 'quick', mode: 'advanced', onModeChange })} />);
        expect(screen.getByText('Advanced')).toBeTruthy();
        // The counted link now reads the other way and the count drains.
        expect(screen.getByText('Show fewer options')).toBeTruthy();
    });
});
