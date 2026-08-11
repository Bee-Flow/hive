/**
 * BFSF-307 — block content must render, not vanish or stringify to junk.
 *
 * Fixture below is the real persisted shape: attachmentProcessor concatenates
 * the extracted document into the first text block and appends an image block,
 * and that array was being written to conversation history.
 */

import { describe, it, expect } from 'vitest';
import {
    messageContentToText,
    messageContentImages,
    hasRenderableContent,
    normalizeLoadedMessage,
} from './messageShape';

const CORRUPTED_USER = {
    role: 'user',
    content: [
        { type: 'text', text: 'Kun je deze factuur samenvatten?\n\n[factuur.pdf — extracted via PDF text layer]\n---\nFactuur 2026-0042\n---\n' },
        { type: 'image_url', image_url: { url: 'https://rustfs.internal/u/abc/scan.png' } },
    ],
    timestamp: '2026-06-01T10:00:00.000Z',
};

describe('messageContentToText', () => {
    it('never produces [object Object] — the reported symptom', () => {
        const out = messageContentToText(CORRUPTED_USER.content);
        expect(out).not.toContain('[object Object]');
        expect(out).toContain('Kun je deze factuur samenvatten?');
        expect(out).toContain('Factuur 2026-0042');
    });

    it('is identity for plain strings', () => {
        expect(messageContentToText('hallo')).toBe('hallo');
    });

    it('handles every shape a JSON round-trip can produce', () => {
        expect(messageContentToText(null)).toBe('');
        expect(messageContentToText(undefined)).toBe('');
        expect(messageContentToText([])).toBe('');
        expect(messageContentToText(42)).toBe('42');          // rowToMessage un-stringifies numbers
        expect(messageContentToText(true)).toBe('true');
        expect(messageContentToText([{ type: 'image_url', image_url: { url: 'u' } }])).toBe('');
        expect(messageContentToText({ type: 'text', text: 'bare block' })).toBe('bare block');
    });

    it('joins multiple text blocks and skips non-text', () => {
        expect(messageContentToText([
            { type: 'text', text: 'een' },
            { type: 'image_url', image_url: { url: 'u' } },
            { type: 'text', text: 'twee' },
        ])).toBe('een\n\ntwee');
    });
});

describe('messageContentImages', () => {
    it('extracts urls from both provider shapes', () => {
        expect(messageContentImages(CORRUPTED_USER.content)).toEqual([
            { url: 'https://rustfs.internal/u/abc/scan.png' },
        ]);
        expect(messageContentImages([{ type: 'image_url', image_url: 'https://x/y.png' }]))
            .toEqual([{ url: 'https://x/y.png' }]);
    });

    it('returns [] for string content', () => {
        expect(messageContentImages('plain')).toEqual([]);
    });
});

describe('hasRenderableContent', () => {
    it('keeps a block-content turn — the vanishing-turn regression', () => {
        expect(hasRenderableContent(CORRUPTED_USER)).toBe(true);
    });

    it('keeps an image-only turn', () => {
        expect(hasRenderableContent({
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'https://x/y.png' } }],
        })).toBe(true);
    });

    it('still rejects every empty shape the old filter rejected', () => {
        for (const content of ['', '   ', [], [{ type: 'text', text: '' }], [{ type: 'text', text: '  ' }], null, undefined]) {
            expect(hasRenderableContent({ role: 'assistant', content })).toBe(false);
        }
    });

    it('keeps rich-payload turns the old filters dropped', () => {
        // These are rendered by MessageItem but appeared in neither filter, so an
        // assistant turn that was only one of them was deleted on reload.
        for (const key of ['linkedInDrafts', 'keepDrafts', 'mapEmbeds']) {
            expect(hasRenderableContent({ role: 'assistant', content: '', [key]: [{}] })).toBe(true);
        }
    });

    it('never throws, whatever content is — the crash guard', () => {
        // `typeof content === 'string'` was added to silence
        // "m.content.trim is not a function". This is that guarantee, kept
        // without the silent deletion that came with it.
        for (const content of [[], {}, 42, true, null, undefined, [null], [{}], 'x']) {
            expect(() => hasRenderableContent({ role: 'assistant', content })).not.toThrow();
        }
        expect(() => hasRenderableContent(null)).not.toThrow();
        expect(() => hasRenderableContent('nonsense')).not.toThrow();
    });
});

describe('normalizeLoadedMessage', () => {
    it('flattens block content and synthesises an image sidecar', () => {
        const out = normalizeLoadedMessage(CORRUPTED_USER);
        expect(typeof out.content).toBe('string');
        expect(out.contentWasBlocks).toBe(true);
        expect(out.attachments).toHaveLength(1);
        expect(out.attachments[0].url).toBe('https://rustfs.internal/u/abc/scan.png');
    });

    it('never clobbers a real attachments sidecar', () => {
        const real = [{ name: 'factuur.pdf', storageKey: 'k1', url: 'https://durable/1' }];
        const out = normalizeLoadedMessage({ ...CORRUPTED_USER, attachments: real });
        expect(out.attachments).toEqual(real);
    });

    it('puts assistant images on .images, not .attachments', () => {
        const out = normalizeLoadedMessage({
            role: 'assistant',
            content: [{ type: 'text', text: 'hier' }, { type: 'image_url', image_url: { url: 'https://x/y.png' } }],
        });
        expect(out.images).toEqual([{ url: 'https://x/y.png' }]);
    });

    it('still flags policy-removed messages when they arrive as blocks', () => {
        const out = normalizeLoadedMessage({
            role: 'user',
            content: [{ type: 'text', text: '[Message removed - policy violation]' }],
        });
        expect(out.isDeleted).toBe(true);
    });

    it('leaves string content untouched', () => {
        const msg = { role: 'user', content: 'gewoon tekst' };
        expect(normalizeLoadedMessage(msg).content).toBe('gewoon tekst');
        expect(normalizeLoadedMessage(msg).contentWasBlocks).toBeUndefined();
    });

    it('is idempotent', () => {
        const once = normalizeLoadedMessage(CORRUPTED_USER);
        expect(normalizeLoadedMessage(once)).toEqual(once);
    });
});
