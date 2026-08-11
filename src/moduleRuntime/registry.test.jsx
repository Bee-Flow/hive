import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { Puzzle, Gauge } from 'lucide-react';

// registry pulls RemoteStudioApp → useTranslation (default). A minimal mock lets
// us import registry without a provider; authFetch is the whole network layer.
vi.mock('../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../hooks/useTranslation', () => {
    const useTranslation = () => ({ t: (k) => k, locale: 'en' });
    return { default: useTranslation, useTranslation };
});

import { authFetch } from '../utils/helpers';
import {
    toDescriptor,
    loadRemoteModules,
    getRuntimeStudioApps,
    useRuntimeStudioApps,
    __resetRuntimeForTests,
} from './registry';

const jsonRes = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const frontendModule = (over = {}) => ({
    id: 'uptime_monitor',
    version: '1.2.0',
    studioApp: {
        urlSegment: 'uptime',
        labels: { en: 'Uptime', nl: 'Uptime NL' },
        icon: 'gauge',
        gateCapability: 'cap_uptime',
    },
    entryUrl: '/api/module-assets/uptime_monitor/1.2.0/frontend/entry.js',
    cssUrls: ['/api/module-assets/uptime_monitor/1.2.0/frontend/style.css'],
    ...over,
});

describe('moduleRuntime/registry — toDescriptor', () => {
    beforeEach(() => { cleanup(); __resetRuntimeForTests(); authFetch.mockReset(); });

    it('builds a Studio-app descriptor from a /modules/frontend entry', () => {
        const d = toDescriptor(frontendModule());
        expect(d.id).toBe('uptime_monitor');
        expect(d.urlSegment).toBe('uptime');
        expect(d.version).toBe('1.2.0');
        expect(d.runtime).toBe(true);
        expect(d.gateCapability).toBe('cap_uptime');
        expect(typeof d.Component).toBe('function');
        expect(typeof d.getProps).toBe('function');
    });

    it('resolves labels by locale with an English fallback', () => {
        const d = toDescriptor(frontendModule());
        const t = (k) => k;
        expect(d.label(t, 'en')).toBe('Uptime');
        expect(d.label(t, 'nl')).toBe('Uptime NL');
        // Unknown locale → English fallback.
        expect(d.label(t, 'de')).toBe('Uptime');
        // Missing labels entirely → module id.
        const bare = toDescriptor(frontendModule({ studioApp: { urlSegment: 'x', gateCapability: null } }));
        expect(bare.label(t, 'en')).toBe('uptime_monitor');
    });

    it('gates on the entitlement capability via ctx.can', () => {
        const d = toDescriptor(frontendModule());
        expect(d.gate({ can: (id) => id === 'cap_uptime' })).toBe(true);
        expect(d.gate({ can: () => false })).toBe(false);
        // No capability → always visible.
        const open = toDescriptor(frontendModule({ studioApp: { urlSegment: 'x', gateCapability: null } }));
        expect(open.gate({ can: () => false })).toBe(true);
    });

    it('maps known icons and falls back to Puzzle', () => {
        expect(toDescriptor(frontendModule()).Icon).toBe(Gauge);
        expect(toDescriptor(frontendModule({ studioApp: { urlSegment: 'x', icon: 'not-a-real-icon' } })).Icon).toBe(Puzzle);
        expect(toDescriptor(frontendModule({ studioApp: { urlSegment: 'x' } })).Icon).toBe(Puzzle);
    });

    it('rejects malformed entries', () => {
        expect(toDescriptor(null)).toBeNull();
        expect(toDescriptor({ id: 'x' })).toBeNull();                       // no studioApp
        expect(toDescriptor({ id: 'x', studioApp: {} })).toBeNull();        // no entryUrl
        expect(toDescriptor({ studioApp: {}, entryUrl: '/x' })).toBeNull(); // no id
    });
});

describe('moduleRuntime/registry — store & loadRemoteModules', () => {
    beforeEach(() => { cleanup(); __resetRuntimeForTests(); authFetch.mockReset(); });

    it('populates the store and broadcasts beeflow:modules-changed on load', async () => {
        const onChanged = vi.fn();
        window.addEventListener('beeflow:modules-changed', onChanged);
        authFetch.mockResolvedValueOnce(jsonRes({ modules: [frontendModule()] }));

        await act(async () => { await loadRemoteModules(); });

        const apps = getRuntimeStudioApps();
        expect(apps).toHaveLength(1);
        expect(apps[0].id).toBe('uptime_monitor');
        expect(onChanged).toHaveBeenCalled();
        window.removeEventListener('beeflow:modules-changed', onChanged);
    });

    it('clears the store on 401/403 (signed out)', async () => {
        authFetch.mockResolvedValueOnce(jsonRes({ modules: [frontendModule()] }));
        await act(async () => { await loadRemoteModules(); });
        expect(getRuntimeStudioApps()).toHaveLength(1);

        authFetch.mockResolvedValueOnce(jsonRes({ error: 'unauthorized' }, 401));
        await act(async () => { await loadRemoteModules(); });
        expect(getRuntimeStudioApps()).toHaveLength(0);
    });

    it('keeps the last-good set on a transient failure', async () => {
        authFetch.mockResolvedValueOnce(jsonRes({ modules: [frontendModule()] }));
        await act(async () => { await loadRemoteModules(); });
        expect(getRuntimeStudioApps()).toHaveLength(1);

        authFetch.mockResolvedValueOnce(jsonRes({ error: 'boom' }, 503));
        await act(async () => { await loadRemoteModules(); });
        expect(getRuntimeStudioApps()).toHaveLength(1); // unchanged

        authFetch.mockRejectedValueOnce(new Error('network'));
        await act(async () => { await loadRemoteModules(); });
        expect(getRuntimeStudioApps()).toHaveLength(1); // unchanged
    });

    it('useRuntimeStudioApps re-renders subscribers on change', async () => {
        function Probe() {
            const apps = useRuntimeStudioApps();
            return <div data-testid="count">{apps.length}</div>;
        }
        render(<Probe />);
        expect(screen.getByTestId('count')).toHaveTextContent('0');

        authFetch.mockResolvedValueOnce(jsonRes({ modules: [frontendModule()] }));
        await act(async () => { await loadRemoteModules(); });
        expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
});
