import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../lib/transcriptionsApi', () => ({
    listOrgGroups: vi.fn(),
    createSummaryTemplate: vi.fn(),
    updateSummaryTemplate: vi.fn(),
    deleteSummaryTemplate: vi.fn(),
}));

import TemplateEditor from './TemplateEditor';
import * as api from '../lib/transcriptionsApi';

describe('TemplateEditor', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        api.listOrgGroups.mockResolvedValue([{ id: 'g1', name: 'Sales' }]);
        api.createSummaryTemplate.mockResolvedValue({ id: 'new-1', scope: 'user', name: 'X', prompt: 'Y' });
        api.updateSummaryTemplate.mockResolvedValue({ id: 'tpl-1', name: 'Renamed' });
    });

    it('hides organization/group scope for non-admins', () => {
        render(<TemplateEditor open onClose={() => {}} canManageOrg={false} builtins={[]} />);
        expect(screen.getByText('Just me')).toBeTruthy();
        expect(screen.queryByText('Whole organization')).toBeNull();
        expect(screen.queryByText('Specific group')).toBeNull();
    });

    it('shows all three scopes for org admins', () => {
        render(<TemplateEditor open onClose={() => {}} canManageOrg builtins={[]} />);
        expect(screen.getByText('Just me')).toBeTruthy();
        expect(screen.getByText('Whole organization')).toBeTruthy();
        expect(screen.getByText('Specific group')).toBeTruthy();
    });

    it('disables Save until a name and prompt are provided', () => {
        render(<TemplateEditor open onClose={() => {}} canManageOrg={false} builtins={[]} />);
        const save = screen.getByRole('button', { name: /Save template/i });
        expect(save.disabled).toBe(true);
        fireEvent.change(screen.getByPlaceholderText(/Board summary/i), { target: { value: 'My style' } });
        fireEvent.change(screen.getByPlaceholderText(/Describe the summary/i), { target: { value: 'Summarise it' } });
        expect(save.disabled).toBe(false);
    });

    it('creates a personal template and reports it via onSaved', async () => {
        const onSaved = vi.fn();
        const onClose = vi.fn();
        render(<TemplateEditor open onClose={onClose} canManageOrg={false} builtins={[]} onSaved={onSaved} />);
        fireEvent.change(screen.getByPlaceholderText(/Board summary/i), { target: { value: 'My style' } });
        fireEvent.change(screen.getByPlaceholderText(/Describe the summary/i), { target: { value: 'Summarise it' } });
        fireEvent.click(screen.getByRole('button', { name: /Save template/i }));
        await waitFor(() => expect(api.createSummaryTemplate).toHaveBeenCalled());
        expect(api.createSummaryTemplate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'user', name: 'My style', prompt: 'Summarise it' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
    });

    it('editing an existing template PATCHes and locks the scope', async () => {
        const initial = { id: 'tpl-1', scope: 'org', name: 'Org tmpl', prompt: 'Body', organizationId: 'o1', isDefault: false };
        render(<TemplateEditor open onClose={() => {}} canManageOrg initial={initial} builtins={[]} onSaved={() => {}} />);
        // Scope buttons are disabled when editing.
        expect(screen.getByText('Whole organization').closest('button').disabled).toBe(true);
        fireEvent.change(screen.getByPlaceholderText(/Board summary/i), { target: { value: 'Org tmpl v2' } });
        fireEvent.click(screen.getByRole('button', { name: /Save template/i }));
        await waitFor(() => expect(api.updateSummaryTemplate).toHaveBeenCalledWith('tpl-1', expect.objectContaining({ name: 'Org tmpl v2' })));
    });
});
