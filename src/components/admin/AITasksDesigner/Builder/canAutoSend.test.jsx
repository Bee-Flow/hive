import { describe, it, expect } from 'vitest';
import { canAutoSend } from './BuilderShell.jsx';

/**
 * "Build it directly" auto-fires a suggestion's spec into a fresh builder.
 * canAutoSend is the guard the BuilderShell effect uses; the ref guard around
 * it (in the component) ensures it fires at most once per mount.
 */
describe('canAutoSend', () => {
    it('fires on a fresh builder with a spec and no messages', () => {
        expect(canAutoSend({ autoSendInput: 'Build an invoice automation', automationId: null, messageCount: 0 })).toBe(true);
    });

    it('does not fire without a spec', () => {
        expect(canAutoSend({ autoSendInput: null, automationId: null, messageCount: 0 })).toBe(false);
        expect(canAutoSend({ autoSendInput: '', automationId: null, messageCount: 0 })).toBe(false);
    });

    it('does not fire into an automation the user is already editing', () => {
        expect(canAutoSend({ autoSendInput: 'Build X', automationId: 'a1', messageCount: 0 })).toBe(false);
    });

    it('does not fire into an existing conversation', () => {
        expect(canAutoSend({ autoSendInput: 'Build X', automationId: null, messageCount: 2 })).toBe(false);
    });
});
