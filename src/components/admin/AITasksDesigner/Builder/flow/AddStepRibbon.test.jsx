import { nodeLabel } from './nodeDefs';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AddStepRibbon, { ribbonTabsForScope, RibbonSearch, RIBBON_APPS_PER_CLUSTER } from './AddStepRibbon';
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

// The shape the real catalog serves for Nextcloud: fourteen apps in ONE
// category, every action labelled mechanically (`name.replace(/_/g,' ')`) and
// described in the words of the LLM tool schema. This is the case that made the
// ribbon two rows tall and printed the app name three times per action.
const ncTalkActions = [
    { name: 'nextcloud_talk_list_rooms', label: 'nextcloud talk list rooms', integrationId: 'nextcloud-talk',
      description: "List the user's Nextcloud Talk conversations (rooms). Returns token, type, name, unread count." },
    { name: 'nextcloud_talk_send_message', label: 'nextcloud talk send message', integrationId: 'nextcloud-talk',
      description: 'Post a message to a Talk room. The user has approved sending this message — go ahead.' },
    { name: 'nextcloud_talk_create_room', label: 'nextcloud talk create room', integrationId: 'nextcloud-talk',
      description: 'Create a new Talk room.' },
];
const NC_APP_IDS = [
    'nextcloud', 'nextcloud-talk', 'nextcloud-calendar', 'nextcloud-deck', 'nextcloud-tables',
    'nextcloud-forms', 'nextcloud-mail', 'nextcloud-tasks', 'nextcloud-notes', 'nextcloud-contacts',
    'nextcloud-teams', 'nextcloud-notifications', 'nextcloud-activity', 'nextcloud-status',
];
const NC_LABELS = {
    nextcloud: 'Nextcloud', 'nextcloud-status': 'Nextcloud User Status',
};
const nextcloudScope = {
    catalog: {
        apps: NC_APP_IDS.map(id => ({
            id,
            label: NC_LABELS[id] || `Nextcloud ${id.replace('nextcloud-', '').replace(/^./, c => c.toUpperCase())}`,
            available: true,
            connected: true,
            actions: id === 'nextcloud-talk'
                ? ncTalkActions
                // Two actions, so every app opens a dropdown rather than
                // adding directly — the case the Apps tab is really about.
                : [
                    { name: `${id.replace(/-/g, '_')}_list`, label: `${id.replace(/-/g, ' ')} list`, integrationId: id, description: 'List them.' },
                    { name: `${id.replace(/-/g, '_')}_create`, label: `${id.replace(/-/g, ' ')} create`, integrationId: id, description: 'Create one.' },
                ],
        })),
        steps: [], flags: {},
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

    it('adds Condition, Loop and Edit data from the Flow dropdown', () => {
        const { onAddNode } = renderRibbon();
        const openFlow = () => fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
        openFlow();
        fireEvent.click(screen.getByText(nodeLabel('condition')));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'condition' }));
        openFlow();
        fireEvent.click(screen.getByText(nodeLabel('loop')));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'loop' }));
        openFlow();
        fireEvent.click(screen.getByText(nodeLabel('set')));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'set' }));
    });

    it('opens the consolidated Flow dropdown and adds an item from it', () => {
        const { onAddNode } = renderRibbon();
        // Data + Collection are folded into Flow; "Limit" lives in its Lists section.
        fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
        fireEvent.click(screen.getByText(nodeLabel('limit')));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'limit' }));
    });

    it('keeps only AI step inline — Condition / Repeat / Edit data are not inline buttons', () => {
        renderRibbon();
        expect(screen.getByText('AI step')).toBeTruthy();
        // With the dropdown closed, the flow items are not rendered at all.
        expect(screen.queryByText(nodeLabel('condition'))).toBeNull();
        expect(screen.queryByText(nodeLabel('loop'))).toBeNull();
        expect(screen.queryByText(nodeLabel('set'))).toBeNull();
    });

    it('search finds and adds a step', () => {
        const { onAddNode } = renderRibbon();
        fireEvent.click(screen.getByRole('button', { name: /Search/ }));
        const box = screen.getByPlaceholderText('Search steps…');
        // Match via keywords ('datetime') so the label isn't split by <mark>.
        fireEvent.change(box, { target: { value: 'datetime' } });
        fireEvent.click(screen.getByText(nodeLabel('datetime')));
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'datetime' }));
    });

    it('finds the Privacy Shield by the words people actually search for', () => {
        // Nobody types "guard". They type what they are worried about.
        // The entry is called "Privacy Shield" since BFSF-355 merged the three
        // privacy steps into one moded node — the label names the family, the
        // payload still adds a guard — but every keyword of all three has to
        // keep working, or the consolidation has just hidden the feature.
        const { onAddNode } = renderRibbon();
        fireEvent.click(screen.getByRole('button', { name: /Search/ }));
        const box = screen.getByPlaceholderText('Search steps…');
        // Keyword-only terms: a term that also appears in the LABEL gets
        // <mark>-split by the highlighter and stops matching as one text node.
        for (const term of ['pii', 'gdpr', 'avg', 'sensitive', 'tokenize', 'unmask', 'redact']) {
            fireEvent.change(box, { target: { value: term } });
            expect(screen.queryAllByText('Privacy Shield').length, `"${term}" finds the Privacy Shield`).toBeGreaterThan(0);
        }
        fireEvent.change(box, { target: { value: 'bsn' } });
        fireEvent.click(screen.getAllByText('Privacy Shield')[0]);
        expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'guard' }));
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
            // 'Data' and 'Lists' used to be two adjacent captions with no rule
            // an author could apply to guess which one held Condition, Filter
            // or Edit data (BFSF-361). They are one group now.
            expect(screen.getByText('Data & lists')).toBeTruthy();
        });

        it('adds flow steps directly from visible command buttons (no dropdown)', () => {
            const { onAddNode } = renderRibbon({ embedded: true });
            fireEvent.click(screen.getByText(nodeLabel('condition')));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'condition' }));
            fireEvent.click(screen.getByText(nodeLabel('loop')));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'loop' }));
            fireEvent.click(screen.getByText(nodeLabel('set')));
            expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'set' }));
        });

        it('surfaces personal frequent steps as a Frequent cluster', () => {
            const frequentItems = [
                { key: 'switch', Icon: () => null, label: 'Switch', payload: { kind: 'switch', label: 'Switch' } },
            ];
            const { onAddNode } = renderRibbon({ embedded: true, frequentItems });
            const caption = screen.getByText('Frequent');
            expect(caption).toBeTruthy();
            // 'Switch' can also appear elsewhere on the ribbon, so scope the
            // click to the Frequent cluster itself (the caption's own panel).
            // It used to be scoped by the button's `title`, which the screen
            // tip replaced — a tip is a portalled node, not an attribute.
            fireEvent.click(within(caption.parentElement).getByText('Switch'));
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

        describe('a category with a lot of apps (Nextcloud)', () => {
            const openApps = () => fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));

            it('drops the vendor word the cluster caption already carries', () => {
                renderRibbon({ embedded: true, scope: nextcloudScope });
                openApps();
                expect(screen.getByText('Nextcloud')).toBeTruthy(); // the caption
                // Fourteen buttons that each began with "Nextcloud " is what
                // made the strip wider than the window.
                expect(screen.getByText('Talk')).toBeTruthy();
                expect(screen.queryByText('Nextcloud Talk')).toBeNull();
                // The vendor's core app keeps a name of its own rather than
                // being stripped to nothing.
                expect(screen.getByText('Files')).toBeTruthy();
            });

            it('folds the overflow into one command instead of a second ribbon row', () => {
                renderRibbon({ embedded: true, scope: nextcloudScope });
                openApps();
                // The "more" command occupies a cell, so it displaces one more
                // app rather than widening the cluster by a column.
                const hidden = NC_APP_IDS.length - (RIBBON_APPS_PER_CLUSTER - 1);
                expect(hidden).toBeGreaterThan(0);
                expect(screen.getByText(`${hidden} more`)).toBeTruthy();
                // The ones folded away are the LOWEST-ranked, not whatever the
                // alphabet put last: Files and Talk stay on the ribbon, User
                // Status and Activity are the ones that go.
                expect(screen.getByText('Files')).toBeTruthy();
                expect(screen.getByText('Talk')).toBeTruthy();
                expect(screen.queryByText('User Status')).toBeNull();
                expect(screen.queryByText('Activity')).toBeNull();
            });

            it('the folded-away apps are still one click away, with their actions', () => {
                const { onAddNode } = renderRibbon({ embedded: true, scope: nextcloudScope });
                openApps();
                fireEvent.click(screen.getByText(/\d+ more/));
                fireEvent.click(screen.getByText('User Status'));
                fireEvent.click(screen.getByText('List'));
                expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({
                    kind: 'integration_action', tool: 'nextcloud_status_list',
                }));
            });

            it('names an action by what it does, and says what it does', () => {
                renderRibbon({ embedded: true, scope: nextcloudScope });
                openApps();
                fireEvent.click(screen.getByText('Talk'));
                // Was "nextcloud talk list rooms", under a heading already
                // reading NEXTCLOUD TALK, with no description at all.
                expect(screen.getByText('List rooms')).toBeTruthy();
                expect(screen.queryByText('nextcloud talk list rooms')).toBeNull();
                expect(screen.getByText(/Returns token, type, name, unread count/)).toBeTruthy();
                // …and the half of the description addressed to the model
                // rather than the author does not reach the menu.
                expect(screen.queryByText(/approved sending this message/)).toBeNull();
            });

            it('adds the action with the catalog label on the payload', () => {
                const { onAddNode } = renderRibbon({ embedded: true, scope: nextcloudScope });
                openApps();
                fireEvent.click(screen.getByText('Talk'));
                fireEvent.click(screen.getByText('Send message'));
                expect(onAddNode).toHaveBeenCalledWith(expect.objectContaining({
                    kind: 'integration_action',
                    tool: 'nextcloud_talk_send_message',
                    label: 'nextcloud talk send message',
                }));
            });

            it('offers a filter once an app has more actions than anyone will scan', () => {
                const many = Array.from({ length: 12 }, (_, i) => ({
                    name: `nextcloud_files_op${i}`, label: `nextcloud files op${i}`,
                    integrationId: 'nextcloud', description: `Does thing ${i}.`,
                }));
                const scoped = {
                    ...nextcloudScope,
                    catalog: {
                        ...nextcloudScope.catalog,
                        apps: nextcloudScope.catalog.apps.map(a => (a.id === 'nextcloud' ? { ...a, actions: many } : a)),
                    },
                };
                renderRibbon({ embedded: true, scope: scoped });
                openApps();
                fireEvent.click(screen.getByText('Files'));
                const filter = screen.getByPlaceholderText('Filter 12 actions…');
                fireEvent.change(filter, { target: { value: 'op7' } });
                expect(screen.getByText('Op7')).toBeTruthy();
                expect(screen.queryByText('Op3')).toBeNull();
            });
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
