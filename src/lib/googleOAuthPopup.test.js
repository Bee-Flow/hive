import { afterEach, describe, expect, it, vi } from 'vitest';
import { openGoogleOAuthPopup } from './googleOAuthPopup';

const okAuthFetch = (url = 'https://accounts.google.com/o/oauth2/auth?x=1') =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) });

// A real browser always stamps postMessage with the sender's origin; jsdom
// defaults it to ''. The callback page is served from the API origin, which
// for apiBase '/base' resolves to the app's own origin.
const postCallback = (data, origin = window.location.origin) => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('openGoogleOAuthPopup', () => {
    it('opens the popup and resolves with success after the callback message', async () => {
        const authFetch = okAuthFetch();
        const open = vi.spyOn(window, 'open').mockReturnValue({ closed: false });
        const onOpened = vi.fn();
        const onDone = vi.fn();

        const promise = openGoogleOAuthPopup({ authFetch, apiBase: '/base', onOpened, onDone });
        await vi.waitFor(() => expect(open).toHaveBeenCalled());
        expect(authFetch).toHaveBeenCalledWith('/base/api/integrations/google/auth-url');
        expect(open.mock.calls[0][0]).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
        expect(open.mock.calls[0][1]).toBe('google-oauth');
        expect(onOpened).toHaveBeenCalledTimes(1);
        expect(onDone).not.toHaveBeenCalled();

        postCallback({ type: 'google-callback', success: true });
        await expect(promise).resolves.toEqual({ success: true });
        expect(onDone).toHaveBeenCalledWith({ success: true });
    });

    it('ignores unrelated messages and removes its listener after settling', async () => {
        const authFetch = okAuthFetch();
        vi.spyOn(window, 'open').mockReturnValue({ closed: false });
        const onDone = vi.fn();

        const promise = openGoogleOAuthPopup({ authFetch, apiBase: '/base', onDone });
        await vi.waitFor(() => expect(window.open).toHaveBeenCalled());

        postCallback({ type: 'linkedin-callback', success: true });
        expect(onDone).not.toHaveBeenCalled();

        postCallback({ type: 'google-callback', success: false });
        await expect(promise).resolves.toEqual({ success: false });

        // A second callback after settling must not re-fire onDone.
        postCallback({ type: 'google-callback', success: true });
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('rejects with auth_url_failed and the server message when the auth-url call fails', async () => {
        const authFetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Google is not configured' }) });
        const open = vi.spyOn(window, 'open');

        await expect(openGoogleOAuthPopup({ authFetch, apiBase: '/base' }))
            .rejects.toMatchObject({ code: 'auth_url_failed', message: 'Google is not configured' });
        expect(open).not.toHaveBeenCalled();
    });

    it('rejects with an empty message when the auth-url request throws', async () => {
        const authFetch = vi.fn().mockRejectedValue(new Error('network down'));

        await expect(openGoogleOAuthPopup({ authFetch, apiBase: '/base' }))
            .rejects.toMatchObject({ code: 'auth_url_failed', message: '' });
    });

    it('rejects with popup_blocked when window.open returns null', async () => {
        const authFetch = okAuthFetch();
        vi.spyOn(window, 'open').mockReturnValue(null);
        const onDone = vi.fn();

        await expect(openGoogleOAuthPopup({ authFetch, apiBase: '/base', onDone }))
            .rejects.toMatchObject({ code: 'popup_blocked' });
        expect(onDone).not.toHaveBeenCalled();
    });

    it('resolves { success: false, closed: true } when the popup closes without a callback', async () => {
        vi.useFakeTimers();
        const authFetch = okAuthFetch();
        const popup = { closed: false };
        vi.spyOn(window, 'open').mockReturnValue(popup);
        const onDone = vi.fn();

        const promise = openGoogleOAuthPopup({ authFetch, apiBase: '/base', onDone });
        // Let the auth-url fetch resolve and the popup open.
        await vi.advanceTimersByTimeAsync(0);
        popup.closed = true;
        // 500ms close-poll + 1000ms grace for an in-flight message.
        await vi.advanceTimersByTimeAsync(1600);

        await expect(promise).resolves.toEqual({ success: false, closed: true });
        expect(onDone).toHaveBeenCalledWith({ success: false, closed: true });
    });

    it('still resolves via the callback message when it lands during the close grace period', async () => {
        vi.useFakeTimers();
        const authFetch = okAuthFetch();
        const popup = { closed: false };
        vi.spyOn(window, 'open').mockReturnValue(popup);
        const onDone = vi.fn();

        const promise = openGoogleOAuthPopup({ authFetch, apiBase: '/base', onDone });
        await vi.advanceTimersByTimeAsync(0);
        popup.closed = true;
        await vi.advanceTimersByTimeAsync(600); // close detected, grace running
        postCallback({ type: 'google-callback', success: true });
        await vi.advanceTimersByTimeAsync(1200); // grace timer fires afterwards

        await expect(promise).resolves.toEqual({ success: true });
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith({ success: true });
    });

    // Without an origin check, any window holding a handle on this one could
    // post a forged { type:'google-callback', success:true } and make the UI
    // report a Google connection that was never established.
    it('ignores a callback message from a foreign origin', async () => {
        vi.useFakeTimers();
        const authFetch = okAuthFetch();
        const popup = { closed: false };
        vi.spyOn(window, 'open').mockReturnValue(popup);
        const onDone = vi.fn();

        const promise = openGoogleOAuthPopup({ authFetch, apiBase: '/base', onDone });
        await vi.advanceTimersByTimeAsync(0);

        postCallback({ type: 'google-callback', success: true }, 'https://evil.example.com');
        await vi.advanceTimersByTimeAsync(100);
        expect(onDone).not.toHaveBeenCalled();

        // The genuine message still settles the flow.
        postCallback({ type: 'google-callback', success: true });
        await vi.advanceTimersByTimeAsync(0);
        await expect(promise).resolves.toEqual({ success: true });
    });
});
