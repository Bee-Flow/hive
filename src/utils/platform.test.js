import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMac, modKeyLabel } from './platform';

/** Swap navigator.platform for one assertion (restored by afterEach). */
function withPlatform(platform) {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('platform', () => {
    it('detects a Mac from navigator.platform', () => {
        withPlatform('MacIntel');
        expect(isMac()).toBe(true);
        expect(modKeyLabel()).toBe('⌘');
    });

    it('reports Ctrl on Windows and Linux', () => {
        withPlatform('Win32');
        expect(isMac()).toBe(false);
        expect(modKeyLabel()).toBe('Ctrl');

        withPlatform('Linux x86_64');
        expect(modKeyLabel()).toBe('Ctrl');
    });

    it('prefers userAgentData.platform when the browser exposes it', () => {
        withPlatform('Win32'); // legacy field lies on some UA-reduction builds
        Object.defineProperty(navigator, 'userAgentData', {
            value: { platform: 'macOS' }, configurable: true,
        });
        try {
            expect(isMac()).toBe(true);
        } finally {
            delete navigator.userAgentData;
        }
    });

    it('never claims a ⌘ key without a navigator (SSR)', () => {
        const original = globalThis.navigator;
        Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
        try {
            expect(isMac()).toBe(false);
            expect(modKeyLabel()).toBe('Ctrl');
        } finally {
            Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
        }
    });
});
