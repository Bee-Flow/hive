/**
 * The published-version signal: how a long-open session learns that the owner
 * republished. Before this, such a session kept rendering an old definition
 * against the new schema and RLS with nothing on screen saying so.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportAppVersion, subscribeAppVersion, _resetAppVersionSignal } from './appVersionSignal';

beforeEach(() => _resetAppVersionSignal());

describe('appVersionSignal', () => {
    it('notifies subscribers when the reported version CHANGES', () => {
        const seen = vi.fn();
        subscribeAppVersion('app1', seen);

        reportAppVersion('app1', 7);
        expect(seen).toHaveBeenCalledWith(7);

        // The same version arrives on every poll — that must stay silent, or
        // the banner would flap on a 30-second refresh.
        reportAppVersion('app1', 7);
        expect(seen).toHaveBeenCalledTimes(1);

        reportAppVersion('app1', 8);
        expect(seen).toHaveBeenCalledTimes(2);
        expect(seen).toHaveBeenLastCalledWith(8);
    });

    it('scopes by app and stops on unsubscribe', () => {
        const a = vi.fn();
        const b = vi.fn();
        const stop = subscribeAppVersion('app1', a);
        subscribeAppVersion('app2', b);

        reportAppVersion('app1', 2);
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).not.toHaveBeenCalled();

        stop();
        reportAppVersion('app1', 3);
        expect(a).toHaveBeenCalledTimes(1);
    });

    it('ignores absent versions and never lets a listener break the caller', () => {
        const boom = vi.fn(() => { throw new Error('listener exploded'); });
        subscribeAppVersion('app1', boom);

        expect(() => reportAppVersion('app1', undefined)).not.toThrow();
        expect(() => reportAppVersion('app1', null)).not.toThrow();
        expect(boom).not.toHaveBeenCalled();

        // A fetch must complete even when a subscriber is broken.
        expect(() => reportAppVersion('app1', 4)).not.toThrow();
        expect(boom).toHaveBeenCalled();
    });
});
