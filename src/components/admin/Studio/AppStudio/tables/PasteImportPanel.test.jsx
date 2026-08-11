import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasteImportPanel from './PasteImportPanel';

/**
 * The import is the only bulk way into a table, and it sends rows ONE AT A TIME
 * through a rate-limited endpoint. These tests pin that a value which cannot
 * convert is refused before anything is sent, that the outcome is reported in
 * plain numbers, and that the per-minute write limit pauses the import instead
 * of losing the rows still to come.
 */

const TABLE = {
    id: 'tbl_a',
    key: 'people',
    name: 'People',
    fields: [
        { id: 'f1', key: 'name', name: 'Name', type: 'text' },
        { id: 'f2', key: 'amount', name: 'Amount', type: 'number' },
    ],
};

const PASTE = 'Name\tAmount\nAnna\t12\nBram\t8\n';

function renderPanel(onCreate) {
    const onImported = vi.fn();
    const onClose = vi.fn();
    const utils = render(
        <PasteImportPanel table={TABLE} onCreate={onCreate} onImported={onImported} onClose={onClose} />,
    );
    return { onImported, onClose, ...utils };
}

function paste(text) {
    fireEvent.change(screen.getByLabelText('Pasted rows'), { target: { value: text } });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('PasteImportPanel', () => {
    it('pre-matches the pasted columns to the fields and previews the rows', () => {
        renderPanel(vi.fn());
        paste(PASTE);

        expect(screen.getByLabelText('Where does “Name” go?').value).toBe('name');
        expect(screen.getByLabelText('Where does “Amount” go?').value).toBe('amount');
        expect(screen.getByText(/The first 2 of 2 rows/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Import 2 rows/ })).toBeTruthy();
    });

    it('flags a value that will not convert and imports the rest, reporting both', async () => {
        const onCreate = vi.fn().mockResolvedValue({ record: { id: 'rec_1' } });
        const { onImported } = renderPanel(onCreate);
        paste('Name\tAmount\nAnna\t12\nBram\tnope\n');

        expect(screen.getByText('“nope” is not a number')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Import 1 row$/ }));

        expect(await screen.findByText('1 row added, 1 skipped — see why')).toBeTruthy();
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate).toHaveBeenCalledWith({ name: 'Anna', amount: 12 });
        fireEvent.click(screen.getByText(/Why 1 row was skipped/));
        expect(screen.getByText(/Row 3: Amount: “nope” is not a number/)).toBeTruthy();
        expect(onImported).toHaveBeenCalledWith([{ id: 'rec_1' }]);
    });

    it('sends a column to the field the user picks, not the one it was named after', async () => {
        const onCreate = vi.fn().mockResolvedValue({});
        renderPanel(onCreate);
        paste('Name\tAmount\nAnna\t12\n');

        fireEvent.change(screen.getByLabelText('Where does “Amount” go?'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /Import 1 row$/ }));

        await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'Anna' }));
    });

    it('pauses on the per-minute write limit and adds the rest when the wait is over', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const tooMany = new Error('Too many requests — limit is 20 per 60s. Retry in ~2s.');
        tooMany.status = 429;
        tooMany.retryAfter = 2;
        const onCreate = vi.fn()
            .mockResolvedValueOnce({ record: { id: 'rec_1' } })
            .mockRejectedValueOnce(tooMany)
            .mockResolvedValueOnce({ record: { id: 'rec_2' } });
        renderPanel(onCreate);
        paste(PASTE);
        fireEvent.click(screen.getByRole('button', { name: /Import 2 rows/ }));

        expect(await screen.findByText('1 row added')).toBeTruthy();
        const rest = screen.getByRole('button', { name: /Add the rest/ });
        expect(rest.disabled).toBe(true);
        expect(screen.getByText(/1 row to go/)).toBeTruthy();

        await vi.advanceTimersByTimeAsync(2000);
        await waitFor(() => expect(screen.getByRole('button', { name: /Add the rest/ }).disabled).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: /Add the rest/ }));

        expect(await screen.findByText('2 rows added')).toBeTruthy();
        expect(onCreate).toHaveBeenCalledTimes(3);
    });

    it('keeps a row that the server itself refuses out of the added count, with its reason', async () => {
        const refused = new Error('Amount must be filled in');
        refused.status = 422;
        const onCreate = vi.fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(refused);
        renderPanel(onCreate);
        paste(PASTE);
        fireEvent.click(screen.getByRole('button', { name: /Import 2 rows/ }));

        expect(await screen.findByText('1 row added, 1 skipped — see why')).toBeTruthy();
        fireEvent.click(screen.getByText(/Why 1 row was skipped/));
        expect(screen.getByText('Row 3: Amount must be filled in')).toBeTruthy();
    });
});
