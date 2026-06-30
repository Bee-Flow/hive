import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FlowletsPanel from './FlowletsPanel.jsx';

const rootDef = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
    steps: [],
    edges: [],
    layers: {
        enrich: {
            title: 'Enrich contact',
            trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [{ name: 'email' }] },
            steps: [
                { id: 's1', type: 'integration_action', label: 'Look up' },
                { id: 'out', type: 'layer_output', fields: {} },
            ],
            edges: [],
        },
    },
};

const baseProps = (overrides = {}) => ({
    onClose: vi.fn(),
    rootDef,
    currentScopeKey: null,
    onOpenLayer: vi.fn(),
    onRenameLayer: vi.fn(),
    onDeleteLayer: vi.fn(),
    refCountFor: vi.fn(() => 0),
    onCreateLayer: vi.fn(),
    aiEnabled: false,
    onToggleAi: vi.fn(),
    onSummarize: vi.fn(),
    summarizingKey: null,
    rootDescription: '',
    onSummarizeRoot: vi.fn(),
    summarizingRoot: false,
    // New AI layer builder props.
    onBuildLayer: vi.fn(() => Promise.resolve(true)),
    onRefineLayer: vi.fn(() => Promise.resolve(true)),
    layerAgentState: { running: false, mode: 'create', activeKey: null, toolCalls: [] },
    ...overrides,
});

describe('FlowletsPanel — AI layer builder', () => {
    beforeEach(() => cleanup());

    it('builds a new layer from the composer and passes the typed instruction', async () => {
        const props = baseProps();
        render(<FlowletsPanel {...props} />);

        // The affordance renders when onBuildLayer is provided.
        fireEvent.click(screen.getByText('Build a flowlet with AI'));

        // Clicking reveals a textarea.
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Look up a contact by email' } });

        fireEvent.click(screen.getByText('Build'));
        expect(props.onBuildLayer).toHaveBeenCalledWith('Look up a contact by email');
    });

    it('shows the live building state and disables the composer while running', () => {
        const props = baseProps({
            layerAgentState: {
                running: true,
                mode: 'create',
                activeKey: null,
                toolCalls: [{ name: 'builder_add_action' }, { name: 'builder_set_layer_contract' }],
            },
        });
        render(<FlowletsPanel {...props} />);

        // The composer auto-opens while creating and shows the "Building…" submit state.
        expect(screen.getByText('Building…')).toBeTruthy();
        // Progress line reflects the streamed step count.
        expect(screen.getByText(/2 step/)).toBeTruthy();
        // The textarea + submit button are disabled while running.
        expect(screen.getByRole('textbox').disabled).toBe(true);
        expect(screen.getByText('Building…').closest('button').disabled).toBe(true);
    });

    it('refines an existing layer and passes (layerKey, instruction)', async () => {
        const props = baseProps();
        render(<FlowletsPanel {...props} />);

        // Each layer row exposes a "Refine with AI" control.
        const refineBtn = screen.getByLabelText('Refine with AI');
        fireEvent.click(refineBtn);

        // Reveals a textarea — scope to the layer row to avoid the build composer.
        const row = refineBtn.closest('div.rounded-lg');
        const textarea = within(row).getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'also return the company size' } });

        fireEvent.click(within(row).getByText('Refine'));
        expect(props.onRefineLayer).toHaveBeenCalledWith('enrich', 'also return the company size');
        // The refine interaction must not drill into the layer.
        expect(props.onOpenLayer).not.toHaveBeenCalled();
    });
});
