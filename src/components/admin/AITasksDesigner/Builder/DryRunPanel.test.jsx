import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DryRunPanel from './DryRunPanel.jsx';

const baseProps = (overrides = {}) => ({
    run: { id: 'r1', status: 'success' },
    steps: [],
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
});

describe('DryRunPanel', () => {
    beforeEach(() => cleanup());

    it('renders nothing without a run', () => {
        const { container } = render(<DryRunPanel {...baseProps({ run: null })} />);
        expect(container.firstChild).toBeNull();
    });

    it('shows the status and step count in the header', () => {
        render(<DryRunPanel {...baseProps({ steps: [{ stepId: 's1', stepType: 'integration_action', output: {} }] })} />);
        expect(screen.getByText('Dry-run preview (success)')).toBeTruthy();
        expect(screen.getByText('· 1 step')).toBeTruthy();
    });

    it('renders step output as a friendly table by default (no raw JSON dump)', () => {
        const steps = [{
            stepId: 'act_7958de1a',
            stepType: 'integration_action',
            output: {
                subject: 'Your receipt from Anthropic, PBC',
                attachments: [{ filename: 'Invoice-Q850.pdf', size: 32050 }],
            },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        // Scalar field → clean label/value, no quotes or braces.
        expect(screen.getByText('Subject:')).toBeTruthy();
        expect(screen.getByText('Your receipt from Anthropic, PBC')).toBeTruthy();
        // Array-of-objects → a real table with humanised column headers + cell values.
        expect(screen.getByText('Filename')).toBeTruthy();
        expect(screen.getByText('Size')).toBeTruthy();
        expect(screen.getByText('Invoice-Q850.pdf')).toBeTruthy();
        // No raw JSON dump.
        expect(screen.queryByText(/"subject":/)).toBeNull();
    });

    it('can switch a step output to the raw JSON tree (no loss of detail)', () => {
        const steps = [{
            stepId: 's1',
            stepType: 'integration_action',
            output: { subject: 'Receipt', attachments: [{ filename: 'Invoice-Q850.pdf' }] },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        fireEvent.click(screen.getByText('JSON'));
        // Exact keys + collapsed array become available in the tree.
        expect(screen.getByText('subject:')).toBeTruthy();
        fireEvent.click(screen.getByText('Array(1)'));
        fireEvent.click(screen.getByText('{ 1 key }'));
        expect(screen.getByText('filename:')).toBeTruthy();
        expect(screen.getByText('"Invoice-Q850.pdf"')).toBeTruthy();
    });

    it('renders an array-of-objects field as a multi-row table (the user case)', () => {
        const steps = [{
            stepId: 's1', stepType: 'call_layer',
            output: {
                urgency: 'Medium',
                topSenders: [
                    { name: '24Accountant', want: 'Access to payroll' },
                    { name: 'Kooy Holding', want: 'System upgrade' },
                ],
            },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        // Scalar field stays a clean label/value.
        expect(screen.getByText('Urgency:')).toBeTruthy();
        expect(screen.getByText('Medium')).toBeTruthy();
        // The array-of-objects becomes a table with one row per record.
        expect(screen.getByText('Name')).toBeTruthy();
        expect(screen.getByText('Want')).toBeTruthy();
        expect(screen.getByText('24Accountant')).toBeTruthy();
        expect(screen.getByText('Kooy Holding')).toBeTruthy();
        expect(screen.getByText('System upgrade')).toBeTruthy();
    });

    it('renders an array of strings as a simple list, not a table', () => {
        const steps = [{ stepId: 's1', stepType: 'ai_step', output: { keyTopics: ['Payroll', 'Bee Flow upgrade'] } }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('Key Topics')).toBeTruthy();
        expect(screen.getByText('Payroll')).toBeTruthy();
        expect(screen.getByText('Bee Flow upgrade')).toBeTruthy();
    });

    it('hides internal dry-run meta keys from the tree but keeps the Sample data badge', () => {
        const steps = [{
            stepId: 's1',
            stepType: 'integration_action',
            output: { subject: 'Receipt', _dryRunSynthesised: true, _dryRunFallback: 'live_empty' },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('Sample data')).toBeTruthy();
        expect(screen.getByText('Subject:')).toBeTruthy();
        // Plumbing flags must not leak into the rendered output.
        expect(screen.queryByText('_dryRunSynthesised:')).toBeNull();
        expect(screen.queryByText('_dryRunFallback:')).toBeNull();
    });

    it('keeps the friendly "would notify" summary instead of a tree', () => {
        const steps = [{
            stepId: 's1',
            stepType: 'notify',
            output: { wouldNotify: { channels: ['email', 'slack'], title: 'New invoice' } },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('email, slack')).toBeTruthy();
        expect(screen.getByText('New invoice')).toBeTruthy();
    });

    it('renders the would-call args as a tree under the call line', () => {
        const steps = [{
            stepId: 's1',
            stepType: 'integration_action',
            output: { _dryRun: true, wouldHaveCalled: 'gmail_send', withArgs: { to: 'a@b.com' } },
        }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('gmail_send')).toBeTruthy();
        expect(screen.getByText('To:')).toBeTruthy();
        expect(screen.getByText('a@b.com')).toBeTruthy();
    });

    it('surfaces step errors', () => {
        const steps = [{ stepId: 's1', stepType: 'integration_action', error: 'Boom: 401 Unauthorized' }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('Boom: 401 Unauthorized')).toBeTruthy();
    });

    it('hides layer-internal sub-steps, keeping only the call_layer (its output = the layer output)', () => {
        const steps = [
            { stepId: 'cl_1', stepType: 'call_layer', output: { invoices: [{ n: 1 }] } },
            { stepId: 'cl_1/a_search', parentStepId: 'cl_1', stepType: 'integration_action', output: { results: [] } },
            { stepId: 'cl_1/ai_x', parentStepId: 'cl_1', stepType: 'ai_step', output: { ok: true } },
        ];
        const definition = { steps: [{ id: 'cl_1', type: 'call_layer', layerKey: 'enrich', label: 'Search Invoices' }], layers: { enrich: { title: 'Search Invoices' } } };
        render(<DryRunPanel {...baseProps({ steps, definition })} />);
        // Only the top-level call_layer row is counted/shown.
        expect(screen.getByText('· 1 step')).toBeTruthy();
        // Its output (the layer return) is visible; the internal steps are not.
        expect(screen.getByText('Invoices')).toBeTruthy();
    });

    it('shows the friendly step name from the definition instead of the raw id', () => {
        const steps = [{ stepId: 'a_47723b', stepType: 'integration_action', output: { total: 3 } }];
        const definition = { steps: [{ id: 'a_47723b', type: 'integration_action', tool: 'gmail_search', label: 'Search Gmail for supplier invoices' }] };
        render(<DryRunPanel {...baseProps({ steps, definition })} />);
        expect(screen.getByText('Search Gmail for supplier invoices')).toBeTruthy();
        expect(screen.queryByText('a_47723b')).toBeNull();
    });

    it('falls back to the step id when no definition/label is available', () => {
        const steps = [{ stepId: 'a_47723b', stepType: 'integration_action', output: {} }];
        render(<DryRunPanel {...baseProps({ steps })} />);
        expect(screen.getByText('a_47723b')).toBeTruthy();
    });

    it('fires collapse + close callbacks', () => {
        const props = baseProps();
        render(<DryRunPanel {...props} />);
        fireEvent.click(screen.getByTitle('Collapse dry-run preview'));
        expect(props.onToggleCollapse).toHaveBeenCalled();
        fireEvent.click(screen.getByTitle('Dismiss dry-run preview'));
        expect(props.onClose).toHaveBeenCalled();
    });
});
