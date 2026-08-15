/**
 * The Apps picker and the catalogue behind it.
 *
 * Both live outside InputArea now so the Cowork composer can render the same
 * picker. These tests pin the two things that were previously only implicit in
 * a 220-line block of JSX: what the availability filter actually decides, and
 * that the overlay opens in a direction that fits on screen.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AppsPicker from './AppsPicker';
import {
    APP_DEFS, buildAppCatalog, filterAvailableApps, seedTextForApp,
} from './appCatalog';

const GOOGLE = { isGoogleUser: true, isMicrosoftUser: false };

function pickerWith(apps, overrides = {}) {
    const props = {
        apps,
        isAppEnabled: () => true,
        toggleApp: vi.fn(),
        onPick: vi.fn(),
        ...overrides,
    };
    render(<AppsPicker {...props} />);
    return props;
}

const byId = (apps, id) => apps.find(a => a.id === id);

describe('appCatalog — what the user can reach', () => {
    it('hides Google apps from an account with no Google connection', () => {
        const available = filterAvailableApps(APP_DEFS, { integrationStatus: {} });
        expect(byId(available, 'google-drive')).toBeUndefined();
        expect(byId(available, 'gmail')).toBeUndefined();
    });

    it('shows them once Google is connected', () => {
        const available = filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE });
        expect(byId(available, 'google-drive')).toBeDefined();
        expect(byId(available, 'outlook')).toBeUndefined();
    });

    it('drops anything the org has not enabled', () => {
        const available = filterAvailableApps(APP_DEFS, {
            integrationStatus: GOOGLE,
            orgEnabledIntegrations: ['gmail'],
        });
        expect(byId(available, 'gmail')).toBeDefined();
        expect(byId(available, 'google-drive')).toBeUndefined();
    });

    it('narrows further to the agent’s own integrations, and only in agent chat', () => {
        const opts = { integrationStatus: GOOGLE };
        // No agent (the Cowork page, direct chat) → no agent-level filter.
        expect(byId(filterAvailableApps(APP_DEFS, opts), 'google-drive')).toBeDefined();
        // With an agent that only has Gmail, Drive goes.
        const scoped = filterAvailableApps(APP_DEFS, { ...opts, agentIntegrations: ['gmail'] });
        expect(byId(scoped, 'gmail')).toBeDefined();
        expect(byId(scoped, 'google-drive')).toBeUndefined();
    });

    it('folds n8n workflows, MCP servers and Steps in beside the built-ins', () => {
        const catalog = buildAppCatalog({
            n8nWorkflows: [{ slug: 'digest', name: 'Digest', enabled: true }],
            mcpServers: [{ id: 'srv1', name: 'Soverin', toolCount: 3, allConfigured: true }],
            exposedSteps: [{ id: 's1', title: 'Summarise', category: 'Writing' }],
        });
        expect(byId(catalog, 'n8n_run_digest')?.isN8n).toBe(true);
        expect(byId(catalog, 'mcp_srv1')?.isMcp).toBe(true);
        expect(byId(catalog, 'step_s1')?.isStep).toBe(true);
    });

    it('keeps Steps visible regardless of the org list — their own toggle gates them', () => {
        const catalog = buildAppCatalog({ exposedSteps: [{ id: 's1', title: 'Summarise' }] });
        const available = filterAvailableApps(catalog, {
            integrationStatus: {},
            orgEnabledIntegrations: [],
        });
        expect(byId(available, 'step_s1')).toBeDefined();
    });

    it('seeds a sentence for every kind of app, including the two that open a picker in chat', () => {
        expect(seedTextForApp({ id: 'google-calendar' })).toMatch(/calendar/i);
        // Drive and Gmail attach files in chat; a cowork brief needs words.
        expect(seedTextForApp({ id: 'google-drive' })).toBeTruthy();
        expect(seedTextForApp({ id: 'gmail' })).toBeTruthy();
        expect(seedTextForApp({ isN8n: true, label: 'Digest' })).toContain('Digest');
        expect(seedTextForApp({ isStep: true, label: 'Summarise' })).toContain('Summarise');
        expect(seedTextForApp({ id: 'unknown-thing' })).toBeNull();
    });
});

describe('AppsPicker', () => {
    afterEach(() => vi.restoreAllMocks());

    it('renders nothing at all when there are no apps', () => {
        const { container } = render(
            <AppsPicker apps={[]} isAppEnabled={() => true} toggleApp={vi.fn()} onPick={vi.fn()} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('hands the picked app back to the host', () => {
        const props = pickerWith(filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE }));
        fireEvent.click(screen.getByTestId('apps-picker-button'));
        fireEvent.click(screen.getAllByTestId('apps-picker-item').find(el => el.dataset.appId === 'gmail'));
        expect(props.onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'gmail' }));
    });

    it('will not pick a disabled app', () => {
        const props = pickerWith(
            filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE }),
            { isAppEnabled: () => false },
        );
        fireEvent.click(screen.getByTestId('apps-picker-button'));
        fireEvent.click(screen.getAllByTestId('apps-picker-item')[0]);
        expect(props.onPick).not.toHaveBeenCalled();
    });

    it('filters on the search box', () => {
        pickerWith(filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE }));
        fireEvent.click(screen.getByTestId('apps-picker-button'));
        fireEvent.change(screen.getByLabelText('Search apps'), { target: { value: 'calendar' } });
        const ids = screen.getAllByTestId('apps-picker-item').map(el => el.dataset.appId);
        expect(ids).toContain('google-calendar');
        expect(ids).not.toContain('gmail');
    });

    it('drops the overlay below the button when there is no room above it', () => {
        // In chat the composer sits at the bottom, so the panel opens upward.
        // On the Cowork page it sits under the hero, where upward runs it off
        // the top of the viewport — the same bug the When sheet had.
        const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        rect.mockReturnValue({ top: -140, bottom: 0, left: 0, right: 0, width: 320, height: 400, x: 0, y: -140, toJSON: () => ({}) });
        pickerWith(filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE }));
        fireEvent.click(screen.getByTestId('apps-picker-button'));
        expect(screen.getByTestId('apps-picker-panel').className).toContain('top-full');
    });

    it('keeps the overlay above the button when it fits', () => {
        const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        rect.mockReturnValue({ top: 300, bottom: 700, left: 0, right: 0, width: 320, height: 400, x: 0, y: 300, toJSON: () => ({}) });
        pickerWith(filterAvailableApps(APP_DEFS, { integrationStatus: GOOGLE }));
        fireEvent.click(screen.getByTestId('apps-picker-button'));
        expect(screen.getByTestId('apps-picker-panel').className).toContain('bottom-full');
    });
});
