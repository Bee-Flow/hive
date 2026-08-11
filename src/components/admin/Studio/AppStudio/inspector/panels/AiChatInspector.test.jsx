import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AiChatInspector from './AiChatInspector';

/**
 * The starter-questions box stores an array without blank entries, so joining
 * the prop back into the textarea used to swallow the Enter that starts the
 * second question.
 */

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

beforeEach(() => {
    authFetch.mockReset();
    authFetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
});

const NODE = {
    id: 'cmp_chat1', type: 'ai_chat', visible: true,
    props: { systemPrompt: '', mode: 'chat', starters: [] },
    style: { span: 12 },
};

function renderPanel(node = NODE) {
    const definition = {
        schemaVersion: 2, meta: { name: 'T' }, theme: {}, homeScreenId: 'scr_c',
        screens: [{ id: 'scr_c', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_c', style: {}, children: [node] }] }],
        actions: {},
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onCommit = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <AiChatInspector node={node} definition={definition} onCommit={onCommit} disabled={false} />
        </QueryClientProvider>,
    );
    const lastProps = () => onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props;
    return { onCommit, lastProps, ...utils };
}

describe('AiChatInspector — starter questions', () => {
    it('keeps the newline that starts a second question', () => {
        const { getByLabelText, lastProps } = renderPanel();
        const field = getByLabelText('Starter questions');

        fireEvent.change(field, { target: { value: 'How do I file a return?' } });
        fireEvent.change(field, { target: { value: 'How do I file a return?\n' } });
        expect(field.value).toBe('How do I file a return?\n');

        fireEvent.change(field, { target: { value: 'How do I file a return?\nWhere is my order?' } });
        expect(lastProps().starters).toEqual(['How do I file a return?', 'Where is my order?']);
    });
});
