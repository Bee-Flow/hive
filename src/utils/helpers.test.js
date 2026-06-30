import { describe, it, expect } from 'vitest';
import { parseSaveError } from './helpers';

// parseSaveError only consumes res.status and res.text(); a minimal mock
// keeps the test independent of the fetch Response implementation.
const mockRes = (status, body) => ({ status, text: async () => body });

describe('parseSaveError', () => {
    it('extracts the message from a JSON {error} body', async () => {
        const info = await parseSaveError(mockRes(403, JSON.stringify({ error: 'Permission denied' })));
        expect(info.message).toBe('Permission denied');
        expect(info.isLimit).toBe(false);
    });

    it('extracts the message from a JSON {message} body', async () => {
        const info = await parseSaveError(mockRes(500, JSON.stringify({ message: 'Internal error' })));
        expect(info.message).toBe('Internal error');
    });

    it('passes a plain-text body through as the message', async () => {
        const info = await parseSaveError(mockRes(502, 'Bad Gateway'));
        expect(info.message).toBe('Bad Gateway');
    });

    it('falls back to "Save failed (<status>)" for an empty body', async () => {
        const info = await parseSaveError(mockRes(405, ''));
        expect(info.message).toBe('Save failed (405)');
    });

    it('flags 403 + code limit_reached as a limit error and carries code/resource', async () => {
        const info = await parseSaveError(mockRes(403, JSON.stringify({
            error: 'Organization has reached its limit of 5 agents',
            code: 'limit_reached',
            resource: 'agents',
        })));
        expect(info.isLimit).toBe(true);
        expect(info.code).toBe('limit_reached');
        expect(info.resource).toBe('agents');
    });
});
