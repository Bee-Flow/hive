import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AddStepRibbon, { ribbonTabsForScope, RibbonSearch } from './AddStepRibbon';
import scopedStorage from '../../../../../utils/scopedStorage';

const scope = { catalog: { apps: [], steps: [], flags: {} }, layers: [], inLayer: false, canAddLayerOutput: false, isBlockRoot: false };

// A scope whose catalog has one multi-action integration, so the Apps ribbon
// tab appears and Gmail opens an action dropdown.
const appScope = {
    catalog: {
        apps: [{
            id: 'gmail', label: 'Gmail', available: true, connected: true,
            actions: [
                { name: 'gmail_send', label: 'Send email', integrationId: 'gmail' },
                { name: 'gmail_read', label: 'Read email', integrationId: 'gmail' },
            ],
        }],
        steps: [], flags: {},
    },
    layers: [], inLayer: false, canAddLayerOutput: false, isBlockRoot: false,
};

// A single-action app — should add directly, no dropdown. 'webpages' maps to
// the "Automation" integration category.
const singleActionScope = {
    catalog: {
        apps: [{
            id: 'webpages', label: 'Webpages', available: true, connected: true,
            actions: [{ name: 'webpages_publish', label: 'Publish page', integrationId: 'webpages' }],
        }],
        steps: [], flags: {},
    },
    layers: [], inLayer: false, canAddLayerOutput: false, isBlockRoot: false,
};

// A scope with a reusable Step (block) under a named category.
const stepScope = {
    catalog: {
        apps: [], flags: {},
        steps: [{ id: 's1', title: 'Fast websearch', category: 'Test categorie', params: [{}], outputFields: [{}], available: true }],
    },
    layers: [], inLayer: false, canAddLayerOutput: false, isBlockRoot: false,
};

function renderRibbon(props = {}) {
    const onAddNode = vi.fn();
    const utils = render(<AddStepRibbon scope={scope} hasTrigger onAddNode={onAddNode} {...props} />);
    return { onAddNode, ...utils };
}

describe('AddStepRibbon', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('adds the AI step from the inline button', () => {
        const { onAddNode } = renderRibbon();
        fireEvent.click(screen.getByText('AI step'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ai_step' }));
    });

    it('adds If, Loop and Edit fields from the Flow dropdown', () => {
        const { onAddNode } = renderRibbon();
        const openFlow = () => fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
        openFlow();
        fireEvent.click(screen.getByText('If'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'condition' }));
        openFlow();
        fireEvent.click(screen.getByText('Loop Over Items'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'loop' }));
        openFlow();
        fireEvent.click(screen.getByText('Edit Fields (Set)'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'set' }));
    });

    it('opens the consolidated Flow dropdown and adds an item from it', () => {
        const { onAddNode } = renderRibbon();
        // Data + Collection are folded into Flow; "Limit" lives in its Lists section.
        fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
        fireEvent.click(screen.getByText('Limit'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'limit' }));
    });

    it('keeps only AI step inline — If / Loop / Edit fields are not inline buttons', () => {
        renderRibbon();
        expect(screen.getByText('AI step')).toBeTruthy();
        // With the dropdown closed, the flow items are not rendered at all.
        expect(screen.queryByText('If')).toBeNull();
        expect(screen.queryByText('Loop Over Items')).toBeNull();
        expect(screen.queryByText('Edit Fields (Set)')).toBeNull();
    });

    it('search finds and adds a step', () => {
        const { onAddNode } = renderRibbon();
        fireEvent.click(screen.getByRole('button', { name: /Search/ }));
        const box = screen.getByPlaceholderText('Search steps…');
        // Match via keywords ('datetime') so the label isn't split by <mark>.
        fireEvent.change(box, { target: { value: 'datetime' } });
        fireEvent.click(screen.getByText('Date & Time'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'datetime' }));
    });

    it('shows trigger choices when there is no trigger', () => {
        const { onAddNode } = renderRibbon({ hasTrigger: false });
        expect(screen.getByText('Start with a trigger')).toBeTruthy();
        fireEvent.click(screen.getByText('On a schedule'));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ triggerKind: 'schedule' }));
    });

    it('collapses and persists the choice', () => {
        renderRibbon();
        fireEvent.click(screen.getByLabelText('Hide the ribbon'));
        expect(screen.getByText('Add step')).toBeTruthy();
        expect(scopedStorage.getItem('routinesRibbonOpen')).toBe('0');
    });

    describe('embedded (Office ribbon strip)', () => {
        it('shows visible category captions instead of only dropdowns', () => {
            renderRibbon({ embedded: true });
            expect(screen.getByText('AI')).toBeTruthy();
            expect(screen.getByText('Flow control')).toBeTruthy();
            expect(screen.getByText('Data')).toBeTruthy();
            expect(screen.getByText('Lists')).toBeTruthy();
        });

        it('adds flow steps directly from visible command buttons (no dropdown)', () => {
            const { onAddNode } = renderRibbon({ embedded: true });
            fireEvent.click(screen.getByText('If'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'condition' }));
            fireEvent.click(screen.getByText('Loop Over Items'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'loop' }));
            fireEvent.click(screen.getByText('Edit Fields (Set)'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'set' }));
        });

        it('surfaces personal frequent steps as a Frequent cluster', () => {
            const frequentItems = [
                { key: 'switch', Icon: () => null, label: 'Switch', payload: { kind: 'switch', label: 'Switch' } },
            ];
            const { onAddNode } = renderRibbon({ embedded: true, frequentItems });
            expect(screen.getByText('Frequent')).toBeTruthy();
            // 'Switch' also lives under Flow control, so scope the click to the
            // Frequent quick-add via its "you use this a lot" title.
            fireEvent.click(screen.getByTitle('Add Switch — you use this a lot'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'switch' }));
        });

        it('renders Home / Apps / Reusable ribbon tabs', () => {
            renderRibbon({ embedded: true, scope: appScope });
            expect(screen.getByRole('tab', { name: /Home/ })).toBeTruthy();
            expect(screen.getByRole('tab', { name: /Apps/ })).toBeTruthy();
            expect(screen.getByRole('tab', { name: /Reusable/ })).toBeTruthy();
        });

        it('keeps Apps categories hidden until the Apps tab is selected', () => {
            renderRibbon({ embedded: true, scope: appScope });
            // Default = Home: core steps visible, no app category caption yet.
            expect(screen.getByText('Flow control')).toBeTruthy();
            expect(screen.queryByText('Google Workspace')).toBeNull();
            fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));
            expect(screen.getByText('Google Workspace')).toBeTruthy();
            // Switching tabs swaps the groups — Home's Flow control is gone.
            expect(screen.queryByText('Flow control')).toBeNull();
        });

        it('adds an app action from the Apps tab', () => {
            const { onAddNode } = renderRibbon({ embedded: true, scope: appScope });
            fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Gmail' }));
            fireEvent.click(screen.getByText('Send email'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'integration_action', tool: 'gmail_send' }));
        });

        it('adds a single-action app directly, without a dropdown', () => {
            const { onAddNode } = renderRibbon({ embedded: true, scope: singleActionScope });
            fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Webpages' }));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'integration_action', tool: 'webpages_publish' }));
            // No action list opened — the action label is never rendered.
            expect(screen.queryByText('Publish page')).toBeNull();
        });

        it('does not show "Browse all" when every app is already listed', () => {
            renderRibbon({ embedded: true, scope: appScope });
            fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));
            expect(screen.queryByText('Browse all')).toBeNull();
        });

        it('shows Flowlets on the Reusable tab', () => {
            renderRibbon({ embedded: true, scope: appScope });
            fireEvent.click(screen.getByRole('tab', { name: /Reusable/ }));
            expect(screen.getByText('Create flowlet')).toBeTruthy();
        });

        it('lists reusable Steps by category as direct buttons (no dropdown)', () => {
            const { onAddNode } = renderRibbon({ embedded: true, scope: stepScope });
            fireEvent.click(screen.getByRole('tab', { name: /Reusable/ }));
            expect(screen.getByText('Test categorie')).toBeTruthy(); // category caption
            // The step is shown directly (not behind a "Steps ▾" gallery).
            expect(screen.queryByRole('button', { name: /^Steps/ })).toBeNull();
            fireEvent.click(screen.getByText('Fast websearch'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'call_block', blockId: 's1' }));
        });

        it('persists the selected tab to scopedStorage', () => {
            renderRibbon({ embedded: true, scope: appScope });
            fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));
            expect(scopedStorage.getItem('routinesRibbonTab')).toBe('apps');
        });

        it('falls back to Home when the persisted tab is unavailable', () => {
            scopedStorage.setItem('routinesRibbonTab', 'apps'); // default scope has no apps
            renderRibbon({ embedded: true });
            expect(screen.queryByRole('tab', { name: /Apps/ })).toBeNull();
            expect(screen.getByText('Flow control')).toBeTruthy();
        });

        it('controlled mode hides the internal tab strip and renders the given tab', () => {
            // BuildTab passes activeTab (the tab strip lives in the header bar).
            renderRibbon({ embedded: true, scope: appScope, activeTab: 'apps' });
            expect(screen.queryByRole('tab', { name: /Apps/ })).toBeNull();
            expect(screen.getByText('Google Workspace')).toBeTruthy();
            expect(screen.queryByText('Flow control')).toBeNull();
        });

        it('controlled mode shows undo/redo at the start of the groups row', () => {
            const onUndo = vi.fn();
            renderRibbon({ embedded: true, scope: appScope, activeTab: 'home', onUndo, onRedo: vi.fn(), canUndo: true, canRedo: false });
            fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
            expect(onUndo).toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
        });

    });

    describe('RibbonSearch', () => {
        it('finds and adds a step (matched via tool/desc so no <mark> split)', () => {
            const onAddNode = vi.fn();
            render(<RibbonSearch scope={appScope} onAdd={onAddNode} />);
            fireEvent.click(screen.getByRole('button', { name: /Search/ }));
            const box = screen.getByPlaceholderText('Search steps…');
            fireEvent.change(box, { target: { value: 'gmail' } });
            fireEvent.click(screen.getByText('Send email'));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'integration_action', tool: 'gmail_send' }));
        });
    });

    describe('ribbonTabsForScope', () => {
        it('always offers Home; Apps only with integrations; Reusable with flowlets/steps', () => {
            expect(ribbonTabsForScope(scope).map(t => t.id)).toEqual(['home', 'reusable']);
            expect(ribbonTabsForScope(appScope).map(t => t.id)).toContain('apps');
            expect(ribbonTabsForScope(stepScope).map(t => t.id)).toContain('reusable');
        });
    });
});
