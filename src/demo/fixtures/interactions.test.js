/**
 * The demos are meant to be USED, not just looked at.
 *
 * Every earlier test here answers "does it render". These answer "does it do
 * anything when you click" — the three interactions a visitor is most likely
 * to try, each of which previously dead-ended:
 *
 *   ▶ on an automation node   → "No run output for this step yet" forever
 *   the agent refine pane     → a red "Not available in the demo"
 *   the shield's round trip   → covered in privacyShield.test.js
 *
 * Run: cd agent-hub && npx vitest run src/demo/fixtures/interactions.test.js
 */
import { describe, it, expect } from 'vitest';
import * as routines from './routines';
import * as agents from './agents';

const call = async (mod, route, args) => {
    const handler = mod.ROUTES[route];
    expect(handler, `${route} is not fixtured`).toBeTypeOf('function');
    return handler({ state: mod.createState(), params: {}, body: {}, ...args });
};

describe('executing an automation step', () => {
    const ROUTE = 'POST /api/automation/:id/steps/:stepId/run';

    it('returns output for the step you pressed play on', async () => {
        const res = await call(routines, ROUTE, {
            params: { id: 'auto_demo_spend_report', stepId: 'search_invoices' },
            body: { mode: 'only' },
        });

        expect(res.steps).toHaveLength(1);
        const [row] = res.steps;
        expect(row.stepId).toBe('search_invoices');
        expect(row.status).toBe('success');
        // The panel renders `runStep.output` — an empty object would look
        // identical to "never run" to a visitor.
        expect(row.output.messages.length).toBeGreaterThan(0);
        expect(row.output.messages[0]).toHaveProperty('subject');
        expect(res.stepRecord.stepId).toBe('search_invoices');
    });

    it('the numbers are consistent across steps, so the flow reads as one story', async () => {
        const state = routines.createState();
        const one = (stepId) => routines.ROUTES[ROUTE]({
            state, params: { id: 'auto_demo_spend_report', stepId }, body: { mode: 'only' },
        }).steps[0].output;

        const invoiceCount = one('search_invoices').messages.length;
        const loop = one('read_each');
        const totals = one('total_per_vendor');

        expect(loop.iterations).toBe(invoiceCount);
        expect(loop.results).toHaveLength(invoiceCount);

        const summed = Number(loop.results.reduce((n, l) => n + l.amount, 0).toFixed(2));
        expect(totals.total).toBe(summed);
        // …and the condition tests that same total rather than a made-up one.
        expect(one('over_budget').evaluated.startsWith(String(summed))).toBe(true);
    });

    it('mode "from" runs the step and everything downstream', async () => {
        const res = await call(routines, ROUTE, {
            params: { id: 'auto_demo_spend_report', stepId: 'total_per_vendor' },
            body: { mode: 'from' },
        });
        const ids = res.steps.map(s => s.stepId);
        expect(ids[0]).toBe('total_per_vendor');
        expect(ids).toContain('notify_finance');
        expect(ids).not.toContain('search_invoices');   // upstream is left alone
    });

    it('never claims the notification was actually delivered', async () => {
        const res = await call(routines, ROUTE, {
            params: { id: 'auto_demo_spend_report', stepId: 'notify_finance' },
            body: { mode: 'only' },
        });
        const out = res.steps[0].output;
        expect(out.delivered).toBe(false);
        expect(out.demo).toMatch(/no email was sent/i);
    });

    it('running the whole flow lights up every node', async () => {
        const res = await call(routines, 'POST /api/automation/:id/run', {
            params: { id: 'auto_demo_spend_report' },
        });
        expect(res.steps.length).toBeGreaterThanOrEqual(6);
        expect(res.steps.every(s => s.status === 'success')).toBe(true);
        expect(res.run.demo).toBe(true);
    });
});

describe('refining an agent', () => {
    const ROUTE = 'POST /agents/wizard/refine';
    const CURRENT = 'Je bent de LinkedIn-contentschrijver voor ons bedrijf.';

    const refine = (refinement) => routines && agents.ROUTES[ROUTE]({
        state: agents.createState(),
        params: {},
        body: {
            plan: { name: 'LinkedIn Schrijver', description: 'd', avatar: '', systemPrompt: CURRENT, capabilities: [] },
            current: { model: 'tier:fast', enabledIntegrations: ['gmail'], attachedSkills: [{ id: 'skill_demo_tone' }], knowledge_base_ids: ['kb_demo_brand'] },
            refinement,
        },
    });

    it('actually rewrites the instructions', () => {
        const res = refine('Antwoord altijd in het Nederlands, tenzij anders gevraagd');
        expect(res.plan.systemPrompt).not.toBe(CURRENT);
        expect(res.plan.systemPrompt).toContain(CURRENT);          // keeps what was there
        expect(res.plan.systemPrompt).toMatch(/Nederlands/);
    });

    it('recognises a tone request rather than pasting it verbatim', () => {
        const res = refine('Make the tone more friendly');
        expect(res.plan.systemPrompt).toMatch(/toon warm en toegankelijk/i);
    });

    it('falls back to appending an unrecognised request as an explicit rule', () => {
        // Deliberately avoids every recognised keyword — an earlier draft of
        // this test said "…in de afsluiting", which matched the summary rule
        // and tested the opposite of what it claimed.
        const res = refine('gebruik nooit uitroeptekens');
        expect(res.plan.systemPrompt).toMatch(/Gebruik nooit uitroeptekens/);
    });

    it('is idempotent — asking twice does not duplicate the rule', () => {
        const once = refine('in het Nederlands').plan.systemPrompt;
        const twice = agents.ROUTES[ROUTE]({
            state: agents.createState(), params: {},
            body: {
                plan: { systemPrompt: once, name: '', description: '', avatar: '', capabilities: [] },
                current: {}, refinement: 'in het Nederlands',
            },
        }).plan.systemPrompt;
        expect(twice).toBe(once);
    });

    it('preserves the curated config, so a tone tweak cannot wipe the model or skills', () => {
        const res = refine('korter graag');
        expect(res.preserved.model).toBe('tier:fast');
        expect(res.preserved.enabledIntegrations).toEqual(['gmail']);
        expect(res.preserved.attachedSkills).toEqual([{ id: 'skill_demo_tone' }]);
        expect(res.preserved.knowledge_base_ids).toEqual(['kb_demo_brand']);
    });

    it('leaves the prompt alone when the request is empty', () => {
        expect(refine('   ').plan.systemPrompt).toBe(CURRENT);
    });
});
