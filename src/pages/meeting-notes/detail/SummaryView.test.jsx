import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

// MarkdownRenderer isn't under test — stub it to plain text.
vi.mock('../../../components/MarkdownRenderer', () => ({ default: ({ content }) => <div>{content}</div> }));

import SummaryView from './SummaryView';

const TEMPLATES = {
    builtins: [
        { id: 'general', name: 'General meeting', nameKey: 'meeting_notes.template_general' },
        { id: 'standup', name: 'Stand-up', nameKey: 'meeting_notes.template_standup' },
    ],
    custom: [
        { id: 'u1', scope: 'user', name: 'My board style' },
        { id: 'o1', scope: 'org', name: 'Klant-review NL' },
        { id: 'g1', scope: 'group', name: 'Sales QBR', groupId: 'gid-1' },
    ],
    defaultTemplateId: 'u1',
    canManageOrg: true,
};

describe('SummaryView regenerate menu', () => {
    beforeEach(() => cleanup());

    function open(props = {}) {
        const onRegenerate = vi.fn();
        const onNewTemplate = vi.fn();
        const onEditTemplate = vi.fn();
        render(
            <SummaryView
                summary=""
                regenerating={false}
                onRegenerate={onRegenerate}
                onNewTemplate={onNewTemplate}
                onEditTemplate={onEditTemplate}
                templates={TEMPLATES}
                {...props}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));
        return { onRegenerate, onNewTemplate, onEditTemplate };
    }

    it('lists built-in and custom templates', () => {
        open();
        expect(screen.getByText('General meeting')).toBeTruthy();
        expect(screen.getByText('My board style')).toBeTruthy();
        expect(screen.getByText('Klant-review NL')).toBeTruthy();
        expect(screen.getByText('Sales QBR')).toBeTruthy();
    });

    it('regenerates a built-in with a { template } payload', () => {
        const { onRegenerate } = open();
        fireEvent.click(screen.getByText('Stand-up'));
        expect(onRegenerate).toHaveBeenCalledWith({ template: 'standup' });
    });

    it('regenerates a custom template with a { templateId } payload', () => {
        const { onRegenerate } = open();
        fireEvent.click(screen.getByText('Klant-review NL'));
        expect(onRegenerate).toHaveBeenCalledWith({ templateId: 'o1' });
    });

    it('offers "New template…" and invokes onNewTemplate', () => {
        const { onNewTemplate } = open();
        fireEvent.click(screen.getByText(/New template/i));
        expect(onNewTemplate).toHaveBeenCalled();
    });

    it('falls back to built-in labels when no templates are loaded', () => {
        const onRegenerate = vi.fn();
        render(<SummaryView summary="" regenerating={false} onRegenerate={onRegenerate} />);
        fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));
        expect(screen.getByText('Retrospective')).toBeTruthy();
        fireEvent.click(screen.getByText('Sales call'));
        expect(onRegenerate).toHaveBeenCalledWith({ template: 'sales' });
    });

    it('hides the whole menu when onRegenerate is not provided (non-owner)', () => {
        render(<SummaryView summary="Done." templates={TEMPLATES} />);
        expect(screen.queryByRole('button', { name: /Regenerate/i })).toBeNull();
    });
});
