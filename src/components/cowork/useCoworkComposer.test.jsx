/**
 * The composer reads the user's sentence and fills in the blanks — but never
 * overrules a decision the user already made by hand.
 *
 * That split is the whole contract: "elke ochtend" should become a daily 08:00
 * schedule without the user touching a chip, while a chip they *did* touch has
 * to survive whatever the model thinks.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCoworkComposer from './useCoworkComposer';

const composeCowork = vi.fn();
const createCowork = vi.fn();

vi.mock('./coworkApi', () => ({
    composeCowork: (...a) => composeCowork(...a),
    createCowork: (...a) => createCowork(...a),
    listCoworkAgents: async () => [],
}));

vi.mock('../EntitlementsContext', () => ({
    useEntitlements: () => ({ loading: false, can: () => false }),
}));

// Drives the hook from tests without a UI.
function harness() {
    const api = {};
    function Probe() {
        Object.assign(api, useCoworkComposer({ onCreated: () => {} }));
        return null;
    }
    render(<Probe />);
    return api;
}

beforeEach(() => {
    vi.clearAllMocks();
    createCowork.mockImplementation(async (payload) => ({ id: 'cw1', ...payload }));
    composeCowork.mockResolvedValue({
        title: 'Goedemorgen-bericht',
        prompt: 'Schrijf een kort, warm goedemorgenbericht.',
        repeatInterval: 'daily',
        daysOfWeek: null,
        timeOfDay: '08:00',
        runOnce: false,
        agentId: null,
        composed: true,
    });
});

const BRIEF = 'Ik wil dat je elke ochtend een goede morgen wenst';

describe('useCoworkComposer — composing from the brief', () => {
    it('sends the brief to be composed', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        expect(composeCowork).toHaveBeenCalledWith(BRIEF);
    });

    it('uses the composed title and instruction, not the raw brief', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        const payload = createCowork.mock.calls[0][0];
        expect(payload.title).toBe('Goedemorgen-bericht');
        expect(payload.prompt).toBe('Schrijf een kort, warm goedemorgenbericht.');
    });

    it('turns "every morning" into a daily repeat at the composed time', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        const payload = createCowork.mock.calls[0][0];
        expect(payload.repeatInterval).toBe('daily');
        expect(new Date(payload.nextRunAt).getHours()).toBe(8);
        expect(new Date(payload.nextRunAt).getMinutes()).toBe(0);
    });

    it('schedules the first run in the future, never in the past', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        const payload = createCowork.mock.calls[0][0];
        expect(new Date(payload.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('passes composed weekdays through', async () => {
        composeCowork.mockResolvedValue({
            title: 'T', prompt: 'P', repeatInterval: 'weekly',
            daysOfWeek: ['mon', 'wed'], timeOfDay: '09:00', agentId: null,
        });
        const api = harness();
        await act(async () => { await api.submit('elke maandag en woensdag om 9 uur'); });
        expect(createCowork.mock.calls[0][0].daysOfWeek).toEqual(['mon', 'wed']);
    });

    it('links the agent the composer picked', async () => {
        composeCowork.mockResolvedValue({
            title: 'T', prompt: 'P', repeatInterval: null,
            daysOfWeek: null, timeOfDay: null, agentId: 'a-bugs',
        });
        const api = harness();
        await act(async () => { await api.submit('laat de Bugs Agent dit doen'); });
        expect(createCowork.mock.calls[0][0].agentId).toBe('a-bugs');
    });

    it('leaves work agent-less when the composer picked none', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork.mock.calls[0][0].agentId).toBeUndefined();
    });
});

describe('useCoworkComposer — the user always wins', () => {
    it('a hand-picked repeat beats the composed one', async () => {
        const api = harness();
        await act(async () => { api.setRepeatInterval('weekly'); });
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork.mock.calls[0][0].repeatInterval).toBe('weekly');
    });

    it('a hand-picked "once" is not overwritten by a composed repeat', async () => {
        const api = harness();
        // Explicitly choosing no repeat is a decision, not an empty default.
        await act(async () => { api.setRepeatInterval(''); });
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork.mock.calls[0][0].repeatInterval).toBeNull();
    });

    it('a hand-picked moment beats the composed time', async () => {
        const api = harness();
        await act(async () => { api.setWhen({ presetId: 'now', date: '', time: '' }); });
        await act(async () => { await api.submit(BRIEF); });
        const payload = createCowork.mock.calls[0][0];
        expect(payload.startNow).toBe(true);
        expect(payload.daysOfWeek).toBeUndefined();
    });

    it('a seeded agent (from an agent chat) beats the composed one', async () => {
        composeCowork.mockResolvedValue({
            title: 'T', prompt: 'P', repeatInterval: null, daysOfWeek: null,
            timeOfDay: null, agentId: 'a-composed',
        });
        const api = harness();
        await act(async () => { api.setAgentId('a-from-chat'); });
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork.mock.calls[0][0].agentId).toBe('a-from-chat');
    });
});

describe('useCoworkComposer — the composer is never load-bearing', () => {
    it('a failed compose still creates the work from the raw brief', async () => {
        composeCowork.mockRejectedValue(new Error('model down'));
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork).toHaveBeenCalled();
        const payload = createCowork.mock.calls[0][0];
        expect(payload.prompt).toBe(BRIEF);
        expect(payload.startNow).toBe(true);
    });

    it('a failed create surfaces the error and creates nothing', async () => {
        createCowork.mockRejectedValue(new Error('Maximum number of cowork schedules reached (10).'));
        const api = harness();
        let result;
        await act(async () => { result = await api.submit(BRIEF); });
        expect(result).toBeNull();
        expect(api.error).toMatch(/Maximum number/);
    });

    it('an empty brief does nothing at all', async () => {
        const api = harness();
        await act(async () => { await api.submit('   '); });
        expect(composeCowork).not.toHaveBeenCalled();
        expect(createCowork).not.toHaveBeenCalled();
    });

    it('resets the chips after a successful create', async () => {
        const api = harness();
        await act(async () => { api.setRepeatInterval('weekly'); });
        await act(async () => { await api.submit(BRIEF); });
        expect(api.repeatInterval).toBe('');
        expect(api.touched.repeat).toBe(false);
    });

    it('carries the caller’s model tier into the payload', async () => {
        // Both composers pass their own tier here. The Cowork page passed
        // nothing at all for a while, so everything it scheduled quietly ran
        // on 'auto' while the chat side honoured the picker.
        const api = harness();
        await act(async () => { await api.submit(BRIEF, { modelTier: 'thinking' }); });
        expect(createCowork.mock.calls[0][0].modelTier).toBe('thinking');
    });

    it('falls back to auto when no tier is offered', async () => {
        const api = harness();
        await act(async () => { await api.submit(BRIEF); });
        expect(createCowork.mock.calls[0][0].modelTier).toBe('auto');
    });

    it('lets the agent bring its own model instead of a tier', async () => {
        composeCowork.mockResolvedValue({ title: 'T', prompt: 'P', agentId: 'a1' });
        const api = harness();
        await act(async () => { await api.submit(BRIEF, { modelTier: 'thinking' }); });
        expect(createCowork.mock.calls[0][0].modelTier).toBe('auto');
    });
});
