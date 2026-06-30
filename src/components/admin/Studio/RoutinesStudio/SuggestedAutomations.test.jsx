import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stable mock API object (hoisted so it exists before the vi.mock factory runs).
const { api } = vi.hoisted(() => ({
    api: {
        getCatalog: vi.fn(),
        suggestAutomationsStream: vi.fn(),
        getLastScan: vi.fn(),
        recordSuggestionFeedback: vi.fn(),
    },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

// In-memory scopedStorage so we can assert the last-scan cache + dismiss
// ledger deterministically (mirrors the HistoryTab/EmptyState test pattern).
const { store } = vi.hoisted(() => ({ store: new Map() }));
vi.mock('../../../../utils/scopedStorage', () => ({
    default: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, v); },
        removeItem: (k) => { store.delete(k); },
        getJSON: (k, fb = null) => {
            if (!store.has(k)) return fb;
            try { return JSON.parse(store.get(k)); } catch { return fb; }
        },
        setJSON: (k, v) => { store.set(k, JSON.stringify(v)); },
    },
}));

import SuggestedAutomations from './SuggestedAutomations.jsx';

const catalog = (apps) => ({
    apps: apps || [
        { id: 'gmail', label: 'Gmail', available: true },
        { id: 'google-sheets', label: 'Google Sheets', available: true },
        { id: 'youtrack', label: 'YouTrack', available: false },
    ],
});

// Drives the SSE callback with a scripted sequence of (event, data).
const driveScan = (events) => async (_body, onEvent) => { for (const [e, d] of events) onEvent(e, d); };

describe('SuggestedAutomations', () => {
    beforeEach(() => {
        cleanup();
        store.clear();
        api.getCatalog.mockReset();
        api.suggestAutomationsStream.mockReset();
        api.getLastScan.mockReset();
        api.recordSuggestionFeedback.mockReset();
        // No server-side last scan by default (optional endpoint).
        api.getLastScan.mockResolvedValue(null);
        api.recordSuggestionFeedback.mockResolvedValue(undefined);
    });

    it('shows only available integrations as selectable chips', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        expect(await screen.findByText('Gmail')).toBeTruthy();
        expect(screen.getByText('Google Sheets')).toBeTruthy();
        expect(screen.queryByText('YouTrack')).toBeNull(); // unavailable is filtered out
    });

    it('streams a live scan log, summary, and a card per suggestion', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['phase', { phase: 'scanning' }],
            ['scan_step', { tool: 'gmail_search', integration: 'gmail', phase: 'start' }],
            ['scan_step', { tool: 'gmail_search', integration: 'gmail', phase: 'done', ok: true, piiCategories: [] }],
            ['done', {
                suggestions: [
                    { id: 's1', title: 'Invoice to sheet', description: 'd1', complexity: 'assisted', requiredIntegrations: ['gmail'] },
                    { id: 's2', title: 'Weekly digest', description: 'd2', complexity: 'quick', requiredIntegrations: ['gmail'] },
                ],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));

        // Live log lists the inspected source…
        expect(await screen.findByText(/gmail search/)).toBeTruthy();
        // …a transparency summary…
        expect(screen.getByText(/Looked at Gmail/)).toBeTruthy();
        expect(screen.getByText(/no PII detected/)).toBeTruthy();
        // …and the suggestion cards.
        expect(screen.getByText('Invoice to sheet')).toBeTruthy();
        expect(screen.getByText('Weekly digest')).toBeTruthy();

        // Default selection is every available app.
        expect(api.suggestAutomationsStream).toHaveBeenCalledWith(
            expect.objectContaining({ integrationIds: expect.arrayContaining(['gmail', 'google-sheets']) }),
            expect.any(Function),
            expect.anything(),
        );
    });

    it('surfaces detected PII categories in the summary', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['scan_step', { tool: 'gmail_search', integration: 'gmail', phase: 'done', ok: true, piiCategories: ['Person', 'Email'] }],
            ['done', { suggestions: [], summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: ['Person', 'Email'] } }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        expect(await screen.findByText(/PII detected: Person, Email/)).toBeTruthy();
    });

    it('shows the empty-result copy when nothing repeatable is found', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', { suggestions: [], summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] } }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        expect(await screen.findByText(/No new repeating-work patterns/)).toBeTruthy();
    });

    it('shows a calm cooldown (not a hard error) when rate-limited (429)', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(async () => {
            const err = new Error('Too many requests — limit is 10 per 60s. Retry in ~20s.');
            err.status = 429;
            err.retryAfter = 20;
            throw err;
        });
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        // Calm cooldown copy with a countdown…
        expect(await screen.findByText(/scan again in \d+s/)).toBeTruthy();
        // …and NOT the red failure state.
        expect(screen.queryByText("Couldn't generate ideas")).toBeNull();
    });

    it('prompts to connect an app when none are available', async () => {
        api.getCatalog.mockResolvedValue(catalog([{ id: 'gmail', label: 'Gmail', available: false }]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        expect(await screen.findByText(/Connect an integration/)).toBeTruthy();
    });

    // ---- overhaul: rehydrate, re-scan, evidence, dismiss -------------------

    it('renders an evidence line + grounding badge when the backend provides them', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [{
                    id: 's1', title: 'Invoice to sheet', description: 'd1', complexity: 'assisted',
                    requiredIntegrations: ['gmail'], groundedIn: 'activity',
                    evidence: { summary: 'Observed 12 invoice emails this month' },
                    value: { minutesSavedPerMonth: 45 },
                }],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        expect(await screen.findByText('Invoice to sheet')).toBeTruthy();
        expect(screen.getByText('Observed 12 invoice emails this month')).toBeTruthy();
        expect(screen.getByText('Observed')).toBeTruthy();
        // The estimated time-saved value is intentionally not displayed.
        expect(screen.queryByText(/min\/mo|hr\/mo/i)).toBeNull();
    });

    it('rehydrates the last scan from storage WITHOUT firing a new stream call', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [{ id: 's1', title: 'Cached idea', description: 'd1', complexity: 'quick', requiredIntegrations: ['gmail'] }],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
                scannedAt: new Date().toISOString(),
            }],
        ]));

        // First mount: run a scan so it gets cached.
        const first = render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('Cached idea');
        expect(api.suggestAutomationsStream).toHaveBeenCalledTimes(1);
        first.unmount();
        cleanup();

        // Second mount: should paint from cache, no new stream call.
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        expect(await screen.findByText('Cached idea')).toBeTruthy();
        expect(api.suggestAutomationsStream).toHaveBeenCalledTimes(1); // unchanged
    });

    it('Re-scan triggers exactly one new stream call', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [{ id: 's1', title: 'First idea', description: 'd1', complexity: 'quick', requiredIntegrations: ['gmail'] }],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
                scannedAt: new Date().toISOString(),
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('First idea');
        expect(api.suggestAutomationsStream).toHaveBeenCalledTimes(1);

        // The last-scan header surfaces a Re-scan button.
        const rescan = await screen.findByText('Re-scan');
        fireEvent.click(rescan);
        await waitFor(() => expect(api.suggestAutomationsStream).toHaveBeenCalledTimes(2));
        // Re-scan forces a cache bypass.
        expect(api.suggestAutomationsStream).toHaveBeenLastCalledWith(
            expect.objectContaining({ force: true }),
            expect.any(Function),
            expect.anything(),
        );
    });

    it('deleting a suggestion removes it from view, records feedback, and persists', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [
                    { id: 's1', title: 'Delete me', description: 'd1', complexity: 'quick', requiredIntegrations: ['gmail'] },
                    { id: 's2', title: 'Keep me', description: 'd2', complexity: 'quick', requiredIntegrations: ['gmail'] },
                ],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
                scannedAt: new Date().toISOString(),
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('Delete me');

        // Delete the first card — it should disappear (not grey out), the other stays.
        fireEvent.click(screen.getAllByLabelText('Delete suggestion')[0]);
        await waitFor(() => expect(screen.queryByText('Delete me')).toBeNull());
        expect(screen.getByText('Keep me')).toBeTruthy();
        expect(screen.queryByText('Dismissed')).toBeNull();
        // Best-effort feedback recorded so the server strips it + suppresses it.
        expect(api.recordSuggestionFeedback).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'dismissed' }),
        );
        // Persisted to scoped storage so the delete survives a reload.
        const ledger = JSON.parse(store.get('routinesSuggestionState'));
        expect(Object.keys(ledger.dismissed).length).toBe(1);
    });

    it('records "built" feedback and calls onBuildSuggestion', async () => {
        const onBuildSuggestion = vi.fn();
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [{ id: 's1', title: 'Build me', description: 'd1', complexity: 'quick', requiredIntegrations: ['gmail'] }],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
                scannedAt: new Date().toISOString(),
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={onBuildSuggestion} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('Build me');
        fireEvent.click(screen.getByText('Build it directly'));
        expect(onBuildSuggestion).toHaveBeenCalled();
        expect(api.recordSuggestionFeedback).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'built' }),
        );
    });

    it('groups results into "From your activity" vs "Ideas" when both exist', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['done', {
                suggestions: [
                    { id: 's1', title: 'Observed one', description: 'd1', complexity: 'quick', requiredIntegrations: ['gmail'], groundedIn: 'activity' },
                    { id: 's2', title: 'Idea one', description: 'd2', complexity: 'quick', requiredIntegrations: ['gmail'], groundedIn: 'idea' },
                ],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: [] },
            }],
        ]));
        render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('Observed one');
        expect(screen.getByText(/From your activity/)).toBeTruthy();
        expect(screen.getByText(/Ideas \(1\)/)).toBeTruthy();
    });

    it('never renders purple/violet/indigo in the scan UI', async () => {
        api.getCatalog.mockResolvedValue(catalog());
        api.suggestAutomationsStream.mockImplementation(driveScan([
            ['scan_step', { tool: 'gmail_search', integration: 'gmail', phase: 'done', ok: false, reason: 'Privacy Shield' }],
            ['done', {
                suggestions: [{
                    id: 's1', title: 'Idea', description: 'd1', complexity: 'advanced', requiredIntegrations: ['gmail'],
                    groundedIn: 'activity', evidence: { summary: 'e' }, value: { minutesSavedPerMonth: 60 },
                }],
                summary: { integrations: ['gmail'], toolCalls: 1, piiCategories: ['Person'] },
            }],
        ]));
        const { container } = render(<SuggestedAutomations onBuildSuggestion={vi.fn()} onAskSuggestion={vi.fn()} />);
        await screen.findByText('Gmail');
        fireEvent.click(screen.getByText('Scan for ideas'));
        await screen.findByText('Idea');
        expect(container.innerHTML).not.toMatch(/purple|violet|indigo/);
    });
});
