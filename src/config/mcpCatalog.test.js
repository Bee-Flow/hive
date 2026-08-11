import { describe, it, expect } from 'vitest';
import { MCP_REGISTRY, CATEGORIES } from './mcpCatalog';

// Mirrors the server-side id derivation in routes/ai/config.js (name → id).
const slugify = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

describe('MCP catalog invariants', () => {
    it('has unique ids', () => {
        const ids = MCP_REGISTRY.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('only uses categories the filter bar renders', () => {
        const known = new Set(CATEGORIES.map(c => c.id));
        for (const server of MCP_REGISTRY) {
            expect(known.has(server.category), `${server.id} → ${server.category}`).toBe(true);
        }
    });

    it('gives every stdio entry a command and every http entry a url', () => {
        for (const server of MCP_REGISTRY) {
            if (server.transport === 'http') expect(server.url, server.id).toBeTruthy();
            else expect(server.command, server.id).toBeTruthy();
        }
    });
});

describe('bundled first-party servers', () => {
    const bundled = MCP_REGISTRY.filter(s => s.bundled);

    it('ships the Soverin and Tuya servers', () => {
        expect(bundled.map(s => s.id)).toEqual(expect.arrayContaining(['soverin', 'tuya']));
    });

    it('runs node against a path mcpManager.resolveBundledArgs() rewrites', () => {
        for (const server of bundled) {
            expect(server.command, server.id).toBe('node');
            expect(server.args?.length, server.id).toBe(1);
            // The `mcpServers/` prefix is what the manager keys on when turning
            // the repo-relative path into an absolute one before spawning.
            expect(server.args[0].startsWith('mcpServers/'), server.id).toBe(true);
            expect(server.transport, server.id).toBe('stdio');
        }
    });
});

describe('Soverin entry', () => {
    const soverin = MCP_REGISTRY.find(s => s.id === 'soverin');

    it('keeps its id in step with the id the backend derives from the name', () => {
        // McpMarketplace matches installed servers on either, so a drift would
        // show an already-installed server as installable.
        expect(slugify(soverin.name)).toBe(soverin.id);
    });

    it('asks for exactly the credentials the server process reads from env', () => {
        expect(soverin.required_credentials.map(c => c.key)).toEqual(['SOVERIN_EMAIL', 'SOVERIN_PASSWORD']);
    });

    it('points at the bundled entrypoint', () => {
        expect(soverin.args).toEqual(['mcpServers/soverin/index.mjs']);
        expect(soverin.category).toBe('communication');
    });
});

describe('Tuya entry', () => {
    const tuya = MCP_REGISTRY.find(s => s.id === 'tuya');

    it('keeps its id in step with the id the backend derives from the name', () => {
        expect(slugify(tuya.name)).toBe(tuya.id);
    });

    it('asks for exactly the credentials the server process reads from env', () => {
        // Mirrors readConfig() in server/mcpServers/tuya/tuya.js.
        expect(tuya.required_credentials.map(c => c.key)).toEqual([
            'TUYA_ACCESS_ID',
            'TUYA_ACCESS_SECRET',
            'TUYA_UID',
            'TUYA_REGION',
        ]);
    });

    it('points at the bundled entrypoint', () => {
        expect(tuya.args).toEqual(['mcpServers/tuya/index.mjs']);
        expect(tuya.category).toBe('iot');
    });
});
