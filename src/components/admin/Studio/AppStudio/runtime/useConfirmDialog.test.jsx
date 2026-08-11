import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});

import { authFetch } from '@/utils/helpers';
import useActionRunner from './useActionRunner';
import useConfirmDialog from './useConfirmDialog';

// A sequence that confirms, then creates a record (a SERVER step → hits /step).
const DEF = {
    actions: {
        act1: {
            kind: 'sequence',
            steps: [
                { kind: 'confirm', message: 'Delete this item?' },
                { kind: 'create_record', tableId: 'tbl_a', values: {} },
            ],
        },
    },
};

const stepCalls = () => authFetch.mock.calls.filter(([u]) => String(u).includes('/step'));

function Harness() {
    const { confirm, dialog } = useConfirmDialog();
    const { runAction } = useActionRunner('app-1', DEF, { confirm });
    return (
        <div>
            <button type="button" onClick={() => runAction('act1')}>run</button>
            {dialog}
        </div>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: { id: 'rec1' } }) });
});

describe('useConfirmDialog', () => {
    it('resolving the dialog lets the sequence continue to the server step', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('run'));

        // The styled confirm appears with the step's message.
        expect(await screen.findByText('Delete this item?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => expect(stepCalls().length).toBe(1)); // create_record dispatched
    });

    it('cancelling the dialog aborts the sequence before the server step', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('run'));

        await screen.findByText('Delete this item?');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        // Give any pending microtasks a chance; the create_record must NOT run.
        await waitFor(() => expect(screen.queryByText('Delete this item?')).not.toBeInTheDocument());
        expect(stepCalls().length).toBe(0);
    });
});
