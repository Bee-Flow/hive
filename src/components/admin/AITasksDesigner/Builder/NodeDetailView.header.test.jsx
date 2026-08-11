import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

const CATALOG = {
    apps: [{
        id: 'gmail',
        label: 'Gmail',
        available: true,
        actions: [{ name: 'gmail_search', label: 'Search' }],
    }],
    triggerOutputs: {},
};

const { api } = vi.hoisted(() => ({
    api: {
        getCatalog: vi.fn(),
        listFormPages: vi.fn().mockResolvedValue({ forms: [] }),
    },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

const NodeDetailView = (await import('./NodeDetailView')).default;

/**
 * The node-config header: what node am I looking at, and is my work saved?
 * Both were reported as unreadable — the title showed a raw tool id
 * (BFSF-333), and the only save feedback was the Save button greying out
 * (BFSF-338).
 */
function props(step, extra = {}) {
    const trigger = { id: 'trg', type: 'trigger', kind: 'schedule', output: {} };
    const steps = step.type === 'trigger' ? [] : [step];
    const definition = { trigger, steps, edges: steps.length ? [{ from: 'trg', to: step.id }] : [] };
    return {
        step: step.type === 'trigger' ? trigger : step,
        runStep: null,
        runSteps: [],
        definition,
        rootDefinition: definition,
        automation: { id: 'a1', definition },
        onSaveStep: vi.fn().mockResolvedValue(undefined),
        validation: { errors: [], warnings: [] },
        modelTiers: {},
        catalog: CATALOG,
        onClose: vi.fn(),
        ...extra,
    };
}

const gmailStep = (over = {}) => ({ id: 's1', type: 'integration_action', tool: 'gmail_search', inputs: {}, ...over });
const title = () => screen.getByTestId('ndv-title').textContent.trim();
/** Type into the step-name field so the form is dirty and Save is live. */
const makeDirty = (value) => fireEvent.change(screen.getByLabelText('Step name'), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => { cleanup(); api.getCatalog.mockResolvedValue(CATALOG); try { localStorage.clear(); } catch { /* ignore */ } });

describe('NodeDetailView — header identity', () => {
    it('names an unlabelled action the way the catalog does, not by its tool id', async () => {
        await act(async () => { render(<NodeDetailView {...props(gmailStep())} />); });
        expect(title()).toBe('Gmail: Search');
    });

    it('falls back to a humanised tool name when the catalog has no entry', async () => {
        await act(async () => {
            render(<NodeDetailView {...props(gmailStep({ tool: 'gmail_forward' }))} />);
        });
        expect(title()).toBe('Gmail Forward');
    });

    it('prefers the name the user gave the step', async () => {
        await act(async () => {
            render(<NodeDetailView {...props(gmailStep({ label: 'Find the invoice' }))} />);
        });
        expect(title()).toBe('Find the invoice');
    });

    it('never shows a bare step id for an unnamed trigger', async () => {
        await act(async () => {
            render(<NodeDetailView {...props({ id: 'trg', type: 'trigger' })} />);
        });
        expect(title()).toBe('Schedule');                           // the name
        expect(screen.getByText('Schedule trigger')).toBeTruthy();  // the kicker
    });
});

describe('NodeDetailView — paging through the flow', () => {
    // Three steps behind the trigger, wired in a line but authored out of
    // order, so the paging can only be right if it follows the edges.
    const lineProps = (openOn, extra = {}) => {
        const trigger = { id: 'trg', type: 'trigger', kind: 'schedule', output: {} };
        const steps = [gmailStep({ id: 'c', label: 'Third' }), gmailStep({ id: 'b', label: 'Second' }), gmailStep({ id: 'a', label: 'First' })];
        const definition = {
            trigger,
            steps,
            edges: [{ from: 'trg', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
        };
        return {
            step: openOn === 'trg' ? trigger : steps.find(s => s.id === openOn),
            runStep: null, runSteps: [], definition, rootDefinition: definition,
            automation: { id: 'a1', definition },
            onSaveStep: vi.fn().mockResolvedValue(undefined),
            validation: { errors: [], warnings: [] },
            modelTiers: {}, catalog: CATALOG,
            onClose: vi.fn(),
            onNavigate: vi.fn(),
            ...extra,
        };
    };

    it('reports the position in EXECUTION order and moves both ways', async () => {
        const p = lineProps('b');
        await act(async () => { render(<NodeDetailView {...p} />); });
        expect(screen.getByText('Step 3 of 4')).toBeTruthy();

        await act(async () => { fireEvent.click(screen.getByLabelText('Previous step')); });
        expect(p.onNavigate).toHaveBeenCalledWith('a');
        await act(async () => { fireEvent.click(screen.getByLabelText('Next step')); });
        expect(p.onNavigate).toHaveBeenCalledWith('c');
    });

    it('disables the arrow at each end', async () => {
        await act(async () => { render(<NodeDetailView {...lineProps('trg')} />); });
        expect(screen.getByLabelText('Previous step').disabled).toBe(true);
        expect(screen.getByLabelText('Next step').disabled).toBe(false);
        cleanup();
        await act(async () => { render(<NodeDetailView {...lineProps('c')} />); });
        expect(screen.getByLabelText('Next step').disabled).toBe(true);
    });

    it('answers Alt+arrow but leaves the bare arrows to the fields', async () => {
        const p = lineProps('b');
        await act(async () => { render(<NodeDetailView {...p} />); });
        await act(async () => { fireEvent.keyDown(document, { key: 'ArrowRight' }); });
        expect(p.onNavigate).not.toHaveBeenCalled();
        await act(async () => { fireEvent.keyDown(document, { key: 'ArrowRight', altKey: true }); });
        expect(p.onNavigate).toHaveBeenCalledWith('c');
    });

    it('stays out of the quick view', async () => {
        await act(async () => { render(<NodeDetailView {...lineProps('b')} density="quick" />); });
        expect(screen.queryByLabelText('Next step')).toBeNull();
    });
});

describe('NodeDetailView — save status', () => {
    it('reports a landed save and keeps saying so at rest', async () => {
        const onSaveStep = vi.fn().mockResolvedValue(undefined);
        await act(async () => {
            render(<NodeDetailView {...props(gmailStep({ label: 'Find it' }), { onSaveStep })} />);
        });
        // Nothing saved yet in this session — no claim is made.
        expect(screen.queryByRole('status')).toBeNull();

        await act(async () => { makeDirty('Find the invoice'); });
        await act(async () => { fireEvent.click(saveButton()); });
        expect(onSaveStep).toHaveBeenCalled();
        // …and unlike the old chip, it does not vanish a second and a half later.
        expect(screen.getByRole('status').textContent).toMatch(/Saved/);
    });

    it('offers a retry when the save failed, and re-sends the same patch', async () => {
        const onSaveStep = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
        await act(async () => {
            render(<NodeDetailView {...props(gmailStep({ label: 'Find it' }), { onSaveStep })} />);
        });
        await act(async () => { makeDirty('Find the invoice'); });
        await act(async () => { fireEvent.click(saveButton()); });

        const retry = screen.getByRole('button', { name: /save failed/i });
        await act(async () => { fireEvent.click(retry); });
        expect(onSaveStep).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('status').textContent).toMatch(/Saved/);
    });
});
