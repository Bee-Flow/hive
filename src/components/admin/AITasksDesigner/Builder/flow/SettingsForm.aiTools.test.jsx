import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

const catalog = {
    apps: [
        {
            id: 'gmail', label: 'Gmail', available: true, actions: [
                { name: 'gmail_read', label: 'Read email', description: 'Read messages', sideEffect: false, integrationLabel: 'Gmail' },
                { name: 'gmail_send', label: 'Send email', description: 'Send a message', sideEffect: true, integrationLabel: 'Gmail' },
            ],
        },
        {
            id: 'agent-search', label: 'Web Search', available: true, actions: [
                { name: 'agent_search', label: 'Search the web', description: 'Run a search', sideEffect: false, integrationLabel: 'Web Search' },
            ],
        },
        {
            id: 'youtrack', label: 'YouTrack', available: false, actions: [
                { name: 'youtrack_search', label: 'Search issues', sideEffect: false },
            ],
        },
    ],
};

function renderForm(step, { onPatch = vi.fn() } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm
                step={step}
                modelTiers={{}}
                stepIssues={noIssues}
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

const openAdvanced = () => fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

describe('SettingsForm — AI step tool picker', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('shows the empty hint and a Browse tools button when no tools are selected', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        openAdvanced();
        expect(screen.getByRole('button', { name: /Browse tools/ })).toBeTruthy();
        expect(screen.getByText(/answers from its prompt only/)).toBeTruthy();
    });

    it('only lists apps the user is permitted to use (hides available:false)', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        openAdvanced();
        fireEvent.click(screen.getByRole('button', { name: /Browse tools/ }));
        expect(screen.getAllByText('Gmail').length).toBeGreaterThan(0);
        expect(screen.getByText('Web Search')).toBeTruthy();
        expect(screen.queryByText('YouTrack')).toBeNull();
    });

    it('selecting a tool persists tools[] and derives allowTools=true', async () => {
        const { onPatch } = renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', inputs: {}, outputFields: [] });
        openAdvanced();
        fireEvent.click(screen.getByRole('button', { name: /Browse tools/ }));
        fireEvent.click(screen.getByText('Read email'));
        await waitFor(() => {
            const patch = onPatch.mock.calls.at(-1)?.[0];
            expect(patch?.tools).toEqual(['gmail_read']);
            expect(patch?.allowTools).toBe(true);
        }, { timeout: 2000 });
    });

    it('renders a removable chip for each selected tool', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', tools: ['gmail_send'], allowTools: true, inputs: {}, outputFields: [] });
        openAdvanced();
        expect(screen.getByText('Gmail: Send email')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Remove Gmail: Send email/ })).toBeTruthy();
    });

    it('clearing the last tool derives allowTools=false', async () => {
        const { onPatch } = renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', tools: ['gmail_send'], allowTools: true, inputs: {}, outputFields: [] });
        openAdvanced();
        fireEvent.click(screen.getByRole('button', { name: /Remove Gmail: Send email/ }));
        await waitFor(() => {
            const patch = onPatch.mock.calls.at(-1)?.[0];
            expect(patch?.tools).toEqual([]);
            expect(patch?.allowTools).toBe(false);
        }, { timeout: 2000 });
    });

    it('renders legacy allowTools-without-tools as "All available tools"', () => {
        renderForm({ id: 's1', type: 'ai_step', label: 'AI', prompt: 'Do X', allowTools: true, inputs: {}, outputFields: [] });
        openAdvanced();
        expect(screen.getByText('All available tools')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Choose specific tools/ })).toBeTruthy();
    });
});
