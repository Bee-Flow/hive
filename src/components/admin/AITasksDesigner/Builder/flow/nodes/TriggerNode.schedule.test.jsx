import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import TriggerNode from './TriggerNode';
import { NodeRuntimeContext } from '../NodeRuntimeContext';

/**
 * A schedule trigger has to say how often it runs in words the author can
 * read. The canvas used to print the raw pattern (`0 9 * * *`), which is the
 * one thing most people who build routines have never seen.
 */
function renderTrigger(step) {
    return render(
        <ReactFlowProvider>
            <NodeRuntimeContext.Provider value={{
                pinnedById: new Set(), disabledById: new Set(),
                triggerIds: new Set(['trg']), primaryTriggerId: 'trg', attachedIds: new Set(),
            }}>
                <TriggerNode id="trg" data={{ step }} />
            </NodeRuntimeContext.Provider>
        </ReactFlowProvider>,
    );
}

const scheduled = (cron) => ({
    id: 'trg', type: 'trigger', kind: 'schedule', label: 'Schedule',
    schedule: { cron, tz: 'Europe/Amsterdam' },
});

beforeEach(cleanup);

describe('TriggerNode — schedule readability', () => {
    it('says how often it runs instead of printing the pattern', () => {
        const { container } = renderTrigger(scheduled('0 9 * * *'));
        expect(screen.getByText('Every day at 09:00')).toBeTruthy();
        expect(container.textContent).not.toContain('* * *');
        // The pattern is still one hover away for whoever wants it.
        expect(container.querySelector('[title="0 9 * * *"]')).toBeTruthy();
    });

    it('reads a weekly and an every-N-minutes schedule too', () => {
        renderTrigger(scheduled('30 8 * * 1,3'));
        expect(screen.getByText(/Weekly on Mon, Wed at 08:30/)).toBeTruthy();
        cleanup();
        renderTrigger(scheduled('*/15 * * * *'));
        expect(screen.getByText('Every 15 minutes')).toBeTruthy();
    });

    it('keeps showing the timezone next to it', () => {
        renderTrigger(scheduled('0 9 * * *'));
        expect(screen.getByText('Europe/Amsterdam')).toBeTruthy();
    });
});
