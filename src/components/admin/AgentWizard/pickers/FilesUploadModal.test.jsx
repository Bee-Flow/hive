/**
 * BFSF-270 — the Upload files modal must work for UNSAVED drafts.
 *
 * The button used to silently no-op for drafts (render gate on agent?.id).
 * Pins: (a) the draft notice renders for drafts and not for saved agents,
 * (b) uploading on a draft lazily creates a KB named after the LIVE typed
 * agent name (not the stale "Untitled" shell) and ingests into it, staging
 * the link via onKnowledgeBaseIdsChange, (c) upload failures surface in the
 * inline error line.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/AgentWizard/pickers/FilesUploadModal.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchCalls = [];
let failIngest = false;

vi.mock('../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async (url, opts = {}) => {
        fetchCalls.push({ url, method: opts.method || 'GET', body: opts.body });
        if (url === '/api/kb' && opts.method === 'POST') {
            return { ok: true, json: async () => ({ id: 'kb-new' }) };
        }
        if (/\/api\/kb\/kb-new\/ingest\/file$/.test(url)) {
            return failIngest
                ? { ok: false, text: async () => 'ingest exploded' }
                : { ok: true, json: async () => ({ success: true }) };
        }
        if (/\/api\/kb\/kb-new\/documents/.test(url)) {
            return { ok: true, json: async () => ({ items: [{ id: 'd1', filename: 'notes.txt' }] }) };
        }
        return { ok: true, json: async () => ({}) };
    }),
}));

import FilesUploadModal from './FilesUploadModal';

const t = (key, fallback) => fallback || key;

function renderModal({ agent, agentName }) {
    const onKnowledgeBaseIdsChange = vi.fn();
    const utils = render(
        <FilesUploadModal
            t={t}
            agent={agent}
            agentName={agentName}
            knowledgeBaseIds={[]}
            onKnowledgeBaseIdsChange={onKnowledgeBaseIdsChange}
            strictKnowledge={false}
            onStrictKnowledgeChange={() => {}}
            includeSourceReferences={false}
            onIncludeSourceReferencesChange={() => {}}
            allKbs={[]}
            onToggleKbLink={() => {}}
            onCreateKb={() => {}}
            onClose={() => {}}
        />
    );
    return { ...utils, onKnowledgeBaseIdsChange };
}

const DRAFT = { id: null, name: 'Untitled agent', config: {} };
const NOTICE = /Files are stored in a knowledge base right away/;

beforeEach(() => {
    fetchCalls.length = 0;
    failIngest = false;
});

describe('FilesUploadModal — draft support (BFSF-270)', () => {
    it('shows the draft notice for unsaved drafts, hides it for saved agents', () => {
        const { unmount } = renderModal({ agent: DRAFT, agentName: 'Sales Coach' });
        expect(screen.getByText(NOTICE)).toBeTruthy();
        unmount();

        renderModal({ agent: { id: 'a1', name: 'Saved', config: {} }, agentName: 'Saved' });
        expect(screen.queryByText(NOTICE)).toBeNull();
    });

    it('drop on a draft creates a KB named after the LIVE typed name, ingests, stages the link', async () => {
        const { container, onKnowledgeBaseIdsChange } = renderModal({ agent: DRAFT, agentName: 'Sales Coach' });

        const dropZone = container.querySelector('[class*="border-dashed"]') || container.firstChild;
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

        await waitFor(() => {
            expect(fetchCalls.some(c => c.url === '/api/kb' && c.method === 'POST')).toBe(true);
            expect(fetchCalls.some(c => /\/ingest\/file$/.test(c.url))).toBe(true);
        });

        const kbCreate = fetchCalls.find(c => c.url === '/api/kb' && c.method === 'POST');
        const body = JSON.parse(kbCreate.body);
        expect(body.name).toBe('Sales Coach');
        expect(body.description).toContain('Sales Coach');
        expect(body.name).not.toBe('Untitled agent');

        expect(onKnowledgeBaseIdsChange).toHaveBeenCalledWith(['kb-new']);
    });

    it('surfaces ingest failures in the inline error line', async () => {
        failIngest = true;
        const { container } = renderModal({ agent: DRAFT, agentName: 'Sales Coach' });
        const dropZone = container.querySelector('[class*="border-dashed"]') || container.firstChild;
        fireEvent.drop(dropZone, { dataTransfer: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] } });

        await waitFor(() => {
            expect(screen.getByText(/ingest exploded/)).toBeTruthy();
        });
    });
});
