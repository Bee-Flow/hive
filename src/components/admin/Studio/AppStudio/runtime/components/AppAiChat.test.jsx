import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppAiChat from './AppAiChat';
import { authFetch } from '../../../../../../utils/helpers';
import { DataProvider } from '../DataContext';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

vi.mock('../../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
}));

/** A fake SSE Response: each event becomes one `data: {...}\n\n` frame. */
function sseResponse(events) {
    const enc = new TextEncoder();
    const chunks = events.map((e) => enc.encode(`data: ${JSON.stringify(e)}\n\n`));
    let i = 0;
    return {
        ok: true,
        status: 200,
        body: {
            getReader: () => ({
                read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }),
            }),
        },
    };
}

const node = {
    id: 'cmp_chat', type: 'ai_chat', visible: true,
    props: { greeting: 'Hi there', placeholder: 'Ask…', starters: ['What is the policy?'], mode: 'chat', systemPrompt: 'be nice' },
    style: { span: 12 },
};

function renderChat({ mode = 'run', appId = 'app-1', draft = false, nodeOverride = node } = {}) {
    return render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode }}>
            <DataProvider appId={appId} draft={draft}>
                <AppAiChat node={nodeOverride} />
            </DataProvider>
        </RuntimeProvider>,
    );
}

beforeEach(() => { authFetch.mockReset(); });

describe('AppAiChat', () => {
    it('shows the greeting, placeholder and starters before the first turn', () => {
        const { getByText, getByLabelText } = renderChat();
        expect(getByText('Hi there')).toBeTruthy();
        expect(getByLabelText('Message').placeholder).toBe('Ask…');
        expect(getByText('What is the policy?')).toBeTruthy();
    });

    it('streams an answer over SSE and renders it as markdown', async () => {
        authFetch.mockResolvedValueOnce(sseResponse([
            { type: 'text', text: '**Hello**' },
            { type: 'text', text: ' world' },
            { type: 'done' },
        ]));
        const { getByLabelText, container } = renderChat();
        fireEvent.change(getByLabelText('Message'), { target: { value: 'hi' } });
        fireEvent.click(getByLabelText('Send'));

        await waitFor(() => expect(container.textContent).toContain('Hello world'));
        // markdown ran: ** ** became a <strong>, not literal asterisks
        expect(container.querySelector('strong')?.textContent).toBe('Hello');
        expect(container.textContent).not.toContain('**');

        // the request names the node and carries the transcript — never the model
        const [url, opts] = authFetch.mock.calls.at(-1);
        expect(url).toContain('/api/studio-apps/app-1/ai/chat');
        expect(JSON.parse(opts.body)).toEqual({ nodeId: 'cmp_chat', messages: [{ role: 'user', content: 'hi' }] });
    });

    it('asks the server for the DRAFT definition when previewing in the editor', async () => {
        // Without ?draft=1 the server resolves the node against the PUBLISHED
        // definition and a not-yet-published chat 404s ("Chat component not found").
        authFetch.mockResolvedValueOnce(sseResponse([{ type: 'text', text: 'ok' }, { type: 'done' }]));
        const { getByLabelText } = renderChat({ draft: true });
        fireEvent.change(getByLabelText('Message'), { target: { value: 'hi' } });
        fireEvent.click(getByLabelText('Send'));
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(authFetch.mock.calls.at(-1)[0]).toContain('/ai/chat?draft=1');
    });

    it('carries history in chat mode but sends a single turn in assistant mode', async () => {
        authFetch.mockResolvedValue(sseResponse([{ type: 'text', text: 'a1' }, { type: 'done' }]));
        const assistantNode = { ...node, props: { ...node.props, mode: 'assistant' } };
        const { getByLabelText } = renderChat({ nodeOverride: assistantNode });

        fireEvent.change(getByLabelText('Message'), { target: { value: 'q1' } });
        fireEvent.click(getByLabelText('Send'));
        await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));

        fireEvent.change(getByLabelText('Message'), { target: { value: 'q2' } });
        fireEvent.click(getByLabelText('Send'));
        await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));

        // assistant mode: the second call starts fresh (no q1/a1 history)
        expect(JSON.parse(authFetch.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: 'q2' }]);
    });

    it('surfaces a streamed error and drops the pending answer bubble', async () => {
        authFetch.mockResolvedValueOnce(sseResponse([{ type: 'error', error: 'The assistant failed to respond.' }]));
        const { getByLabelText, findByRole, container } = renderChat();
        fireEvent.change(getByLabelText('Message'), { target: { value: 'hi' } });
        fireEvent.click(getByLabelText('Send'));

        const alert = await findByRole('alert');
        expect(alert.textContent).toMatch(/failed to respond/i);
        // the user's own message stays; no empty assistant bubble is left behind
        expect(container.textContent).toContain('hi');
    });

    it('is inert in edit mode (no network, input disabled)', () => {
        const { getByLabelText } = renderChat({ mode: 'edit' });
        expect(getByLabelText('Message').disabled).toBe(true);
        fireEvent.click(getByLabelText('Send'));
        expect(authFetch).not.toHaveBeenCalled();
    });
});
