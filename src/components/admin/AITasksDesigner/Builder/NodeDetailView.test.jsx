import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
});
