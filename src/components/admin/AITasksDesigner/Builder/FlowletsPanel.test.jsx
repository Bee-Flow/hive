import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FlowletsPanel from './FlowletsPanel.jsx';

const rootDef = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
    steps: [],
    edges: [],
    layers: {
        enrich: {
            title: 'Enrich contact',
            description: 'Looks up the contact and scores them.',
            trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [{ name: 'email' }] },
            steps: [
                { id: 's1', type: 'integration_action', tool: 'hubspot_lookup', label: 'Look up contact' },
                { id: 'out', type: 'layer_output', fields: { score: { kind: 'literal', value: 1 } } },
            ],
            edges: [],
        },
        digest: {
            title: 'Send digest',
            trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] },
            steps: [{ id: 'out', type: 'layer_output', fields: {} }],
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
    ...overrides,
});

describe('FlowletsPanel', () => {
    beforeEach(() => cleanup());

    it('renders a row per layer with the at-a-glance meta', () => {
        render(<FlowletsPanel {...baseProps()} />);
        expect(screen.getByText('Enrich contact')).toBeTruthy();
        expect(screen.getByText('Send digest')).toBeTruthy();
        // stepCount excludes layer_output → "1 step · 1 in · 1 out".
        expect(screen.getByText(/1 step · 1 in · 1 out/)).toBeTruthy();
    });

    it('shows the friendly empty state when there are no layers', () => {
        render(<FlowletsPanel {...baseProps({ rootDef: { ...rootDef, layers: {} } })} />);
        expect(screen.getByText(/No flowlets yet/)).toBeTruthy();
        // The Main flow row is always present, even with no layers.
        expect(screen.getByText('Main flow')).toBeTruthy();
    });

    it('always shows a Main flow row and navigates to root (null) on click', () => {
        const props = baseProps({ currentScopeKey: 'enrich' });
        render(<FlowletsPanel {...props} />);
        fireEvent.click(screen.getByText('Main flow'));
        expect(props.onOpenLayer).toHaveBeenCalledWith(null);
    });

    it('shows dependency chips and lets you jump between related layers', () => {
        // digest calls enrich; the main flow calls digest.
        const depDef = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [{ id: 'cl0', type: 'call_layer', layerKey: 'digest' }],
            edges: [],
            layers: {
                enrich: { title: 'Enrich contact', trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] }, steps: [{ id: 'out', type: 'layer_output', fields: {} }], edges: [] },
                digest: { title: 'Send digest', trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', params: [] }, steps: [{ id: 'd1', type: 'call_layer', layerKey: 'enrich' }, { id: 'out', type: 'layer_output', fields: {} }], edges: [] },
            },
        };
        const props = baseProps({ rootDef: depDef });
        render(<FlowletsPanel {...props} />);
        // "Go to Send digest" chips appear in Main flow (Calls) + enrich (Used by).
        fireEvent.click(screen.getAllByTitle('Go to Send digest')[0]);
        expect(props.onOpenLayer).toHaveBeenCalledWith('digest');
        // digest "Calls" enrich → exactly one chip.
        fireEvent.click(screen.getByTitle('Go to Enrich contact'));
        expect(props.onOpenLayer).toHaveBeenCalledWith('enrich');
    });

    it('hides every AI affordance when aiEnabled is false', () => {
        render(<FlowletsPanel {...baseProps({ aiEnabled: false })} />);
        expect(screen.queryByText(/Summarize|Regenerate/)).toBeNull();
        // The saved description must not leak onto the canvas while AI is off.
        expect(screen.queryByText('Looks up the contact and scores them.')).toBeNull();
    });

    it('shows Summarize/description only when aiEnabled is true', () => {
        const props = baseProps({ aiEnabled: true });
        render(<FlowletsPanel {...props} />);
        // enrich already has a description → Regenerate.
        expect(screen.getByText('Regenerate')).toBeTruthy();
        expect(screen.getByText('Looks up the contact and scores them.')).toBeTruthy();
        // "Summarize" appears for both Main flow and digest (no descriptions);
        // the last one in DOM order is digest's.
        const sums = screen.getAllByText('Summarize');
        fireEvent.click(sums[sums.length - 1]);
        expect(props.onSummarize).toHaveBeenCalledWith('digest');
    });

    it('summarizes the whole automation from the Main flow row', () => {
        const props = baseProps({
            rootDef: { trigger: { id: 'trg', type: 'trigger', kind: 'manual' }, steps: [], edges: [], layers: {} },
            aiEnabled: true,
            rootDescription: 'Pulls Claude invoices from email and files them.',
        });
        render(<FlowletsPanel {...props} />);
        // With no layers, the only AI block is the Main flow's.
        expect(screen.getByText('Pulls Claude invoices from email and files them.')).toBeTruthy();
        fireEvent.click(screen.getByText('Regenerate'));
        expect(props.onSummarizeRoot).toHaveBeenCalled();
        // The summarize click must not also navigate to the main flow.
        expect(props.onOpenLayer).not.toHaveBeenCalled();
    });

    it('opens (drills into) a layer when its row is clicked', () => {
        const props = baseProps();
        render(<FlowletsPanel {...props} />);
        fireEvent.click(screen.getByText('Send digest'));
        expect(props.onOpenLayer).toHaveBeenCalledWith('digest');
        // Clicking the row must NOT enter rename mode.
        expect(screen.queryByDisplayValue('Send digest')).toBeNull();
    });

    it('disables Delete while a layer is still referenced', () => {
        const props = baseProps({ refCountFor: vi.fn((k) => (k === 'enrich' ? 2 : 0)) });
        render(<FlowletsPanel {...props} />);
        // enrich is the first row → its delete is disabled (refCount 2).
        const del = screen.getAllByLabelText('Delete flowlet')[0];
        expect(del.disabled).toBe(true);
        fireEvent.click(del);
        expect(props.onDeleteLayer).not.toHaveBeenCalled();
    });

    it('fires create + toggle callbacks', () => {
        const props = baseProps();
        render(<FlowletsPanel {...props} />);
        fireEvent.click(screen.getByText('Create'));
        expect(props.onCreateLayer).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(props.onToggleAi).toHaveBeenCalled();
    });

    it('renames via the pencil (not a row click) and commits on Enter', () => {
        const props = baseProps();
        render(<FlowletsPanel {...props} />);
        // digest is the second row → its pencil opens its rename field.
        fireEvent.click(screen.getAllByLabelText('Rename flowlet')[1]);
        const input = screen.getByDisplayValue('Send digest');
        fireEvent.change(input, { target: { value: 'Daily digest' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(props.onRenameLayer).toHaveBeenCalledWith('digest', 'Daily digest');
        // Opening rename must not have triggered a drill-in.
        expect(props.onOpenLayer).not.toHaveBeenCalled();
    });
});
