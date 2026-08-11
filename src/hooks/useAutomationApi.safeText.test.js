import { describe, it, expect } from 'vitest';
import { safeText } from './useAutomationApi';

/**
 * Regression for the "Save failed — Invalid definition: [object Object];
 * [object Object]" toast: the server returns `{error, details:[{message,...}]}`
 * and safeText must render the human messages, not stringify the objects.
 */
const fakeRes = (json) => ({ json: async () => json, statusText: 'Bad Request' });

describe('safeText', () => {
    it('renders the human messages from structured validator details', async () => {
        const out = await safeText(fakeRes({
            error: 'Invalid definition',
            details: [
                { code: 'switch.cases_missing', message: 'Step sw_1: switch requires at least one case.' },
                { code: 'condition.dead_branch', message: 'Step c1: condition has no then/else edges.' },
            ],
        }));
        expect(out).toBe('Invalid definition: Step sw_1: switch requires at least one case.; Step c1: condition has no then/else edges.');
        expect(out).not.toContain('[object Object]');
    });

    it('falls back to the code when a detail has no message', async () => {
        const out = await safeText(fakeRes({ error: 'Invalid definition', details: [{ code: 'switch.case_shape' }] }));
        expect(out).toBe('Invalid definition: switch.case_shape');
    });

    /**
     * BFSF-348 — every validator record carries a `message` (what is wrong)
     * AND a `hint` (what to do about it). The hint was fetched, parsed and
     * then thrown away, so the save toast stated a rule and offered no way
     * out of it: "a form step needs the routine to start with a form
     * trigger" — and then nothing.
     */
    it('keeps the hint, which is the half of the error the user can act on', async () => {
        const out = await safeText(fakeRes({
            error: 'Invalid definition',
            details: [{
                code: 'form_page.no_form_trigger',
                message: 'Step step_7: a form step needs the routine to start with a form trigger.',
                hint: 'Switch the trigger to "Form", or remove this step.',
            }],
        }));
        expect(out).toContain('needs the routine to start with a form trigger');
        expect(out).toContain('Switch the trigger to "Form", or remove this step.');
    });

    it('does not stutter when the message already spells out the hint', async () => {
        const hint = 'Add at least one case.';
        const out = await safeText(fakeRes({
            error: 'Invalid definition',
            details: [{ code: 'switch.cases_missing', message: `Step sw_1: switch requires a case. ${hint}`, hint }],
        }));
        expect(out).toBe(`Invalid definition: Step sw_1: switch requires a case. ${hint}`);
    });

    it('still renders a hint-only detail rather than dropping the row', async () => {
        const out = await safeText(fakeRes({ error: 'Invalid definition', details: [{ hint: 'Pick a tool first.' }] }));
        expect(out).toBe('Invalid definition: Pick a tool first.');
    });

    it('returns just the error when details are absent', async () => {
        expect(await safeText(fakeRes({ error: 'Forbidden' }))).toBe('Forbidden');
    });

    it('falls back to statusText when the body is not JSON', async () => {
        const out = await safeText({ json: async () => { throw new Error('not json'); }, statusText: 'Bad Gateway' });
        expect(out).toBe('Bad Gateway');
    });
});
