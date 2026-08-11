/**
 * Message-shape normaliser.
 *
 * An assistant message can arrive in three flavours depending on origin:
 *   1. Live SSE stream (via useChatEngine)     → msg.thinkingParts is an array
 *                                                  of structured parts with
 *                                                  {id,text,startedAt,endedAt,
 *                                                  signature?,redacted?}
 *   2. Persisted then reloaded (new shape)     → msg.thinking is that same
 *                                                  array, stored in meta_json.
 *   3. Persisted then reloaded (legacy shape)  → msg.thinking is a plain string.
 *
 * This normaliser picks whichever shape is present and returns a consistent
 * message where `thinkingParts` is always the canonical array (possibly empty)
 * and `thinking` remains the legacy concatenated string for any downstream
 * consumer that still reads it.
 *
 * Timestamps: when a legacy string is lifted to a single part, start/end are
 * set to null because the server never recorded them. The UI panel handles
 * null timestamps by hiding the "Thought for Ns" label.
 */

/**
 * Message content, as displayable text.
 *
 * `content` is normally a string, but can be an array of provider content
 * blocks (`{type:'text',text}` / `{type:'image_url',image_url:{url}}`) — that is
 * the shape the LLM sees, and BFSF-307 persisted it into conversation history.
 *
 * The old code did `String(content)`, which on an array yields the literal
 * "[object Object],[object Object]" users reported. Never do that: read content
 * through this helper, always.
 *
 * Note the deliberate absence of `String(obj)` in every branch — an unknown
 * object is JSON-stringified so shape drift stays diagnosable instead of
 * silently rendering as [object Object] again.
 */
export function messageContentToText(content) {
    if (typeof content === 'string') return content;          // 99% path, no allocation
    if (content === null || content === undefined) return '';
    if (Array.isArray(content)) {
        return content
            .filter(b => b && b.type === 'text' && typeof b.text === 'string')
            .map(b => b.text)
            .join('\n\n');
    }
    if (typeof content === 'object') {
        if (content.type === 'text' && typeof content.text === 'string') return content.text;
        try { return JSON.stringify(content); } catch { return ''; }
    }
    return String(content);   // number / boolean — a JSON round-trip can produce these
}

/** Image URLs carried inside block content (both shapes providers emit). */
export function messageContentImages(content) {
    if (!Array.isArray(content)) return [];
    return content
        .filter(b => b && b.type === 'image_url')
        .map(b => (typeof b.image_url === 'string' ? b.image_url : b.image_url?.url))
        .filter(Boolean)
        .map(url => ({ url }));
}

/**
 * Should this message be rendered at all?
 *
 * Replaces the `typeof m.content === 'string' && m.content.trim().length > 0`
 * predicates in AgentHub. Those were added to stop a
 * `m.content.trim is not a function` crash, and in doing so converted a crash
 * into SILENT DELETION: a message with block content was dropped from the view
 * entirely. That is the "whole turns vanish on reload" half of BFSF-307.
 *
 * INVARIANT: this function touches `msg.content` ONLY through
 * `messageContentToText`, which is what keeps the original crash from coming
 * back. Pinned by a test over junk inputs.
 *
 * Strictly wider than the old predicate for block content, and no wider for
 * anything else — every empty shape ('', '   ', [], [{text:''}]) still fails.
 */
// Payloads MessageItem renders on their own, without any text. `mapEmbeds`,
// `linkedInDrafts` and `keepDrafts` appeared in NEITHER old filter, so an
// assistant turn carrying only one of them was deleted on reload.
const RENDERABLE_PAYLOAD_KEYS = [
    'images', 'audioFiles', 'videoFiles', 'attachments', 'mapEmbeds',
    'sheetsResults', 'sheetsDrafts', 'sheetsReports',
    'emailDrafts', 'calendarDrafts', 'contactsDrafts',
    'linkedInDrafts', 'keepDrafts',
];

export function hasRenderableContent(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (messageContentToText(msg.content).trim().length > 0) return true;
    if (messageContentImages(msg.content).length > 0) return true;
    return RENDERABLE_PAYLOAD_KEYS.some(k => {
        const v = msg[k];
        return Array.isArray(v) ? v.length > 0 : !!v;
    });
}

/**
 * Collapse a block-content message to text, lifting any images into the sidecar
 * the UI already knows how to render. Server-side normalisation does this for
 * agent conversations; this is the belt to that braces and also covers the
 * embed / notebook / legal surfaces, which read the store directly.
 */
function flattenBlockContent(msg) {
    const images = messageContentImages(msg.content);
    const out = { ...msg, content: messageContentToText(msg.content), contentWasBlocks: true };
    if (images.length === 0) return out;
    // Only synthesise a sidecar when there isn't a real one — the persisted
    // attachments carry durable storage keys and must never be clobbered.
    if (out.role === 'user') {
        if (!out.attachments?.length) {
            out.attachments = images.map((img, i) => ({ name: `image-${i + 1}`, type: 'image/*', url: img.url }));
        }
    } else if (!out.images?.length) {
        out.images = images;
    }
    return out;
}

function partsFromRaw(raw) {
    // Array already — trust it (already the canonical shape).
    if (Array.isArray(raw)) return raw;
    // Legacy string — lift into a single untimed part.
    if (typeof raw === 'string' && raw.length > 0) {
        return [{ id: 'legacy-0', text: raw, startedAt: null, endedAt: null }];
    }
    return [];
}

/**
 * Normalise a single message loaded from a persistence endpoint.
 * Safe to call on user/tool/system messages too — it's a no-op for them.
 */
export function normalizeLoadedMessage(msg) {
    if (!msg || typeof msg !== 'object') return msg;

    // BFSF-307: flatten block content to text FIRST, so every downstream
    // consumer — filters, copy, markdown export, edit textarea, retry history —
    // sees a plain string and none of them need to know arrays ever existed.
    // Guarded on Array.isArray so the string path stays a single type check.
    if (Array.isArray(msg.content)) msg = flattenBlockContent(msg);

    // Flag policy-removed messages so the UI can render them differently.
    // Kept here so every hydration site gets the same treatment.
    if (msg.content === '[Message removed - policy violation]') {
        msg = { ...msg, isDeleted: true };
    }

    // Only assistant messages carry thinking; fast-path the rest.
    if (msg.role !== 'assistant') return msg;

    // BFSF-263: conversations persisted BEFORE the server-side <think>
    // extraction may carry leaked reasoning inline in content. Lift complete
    // <think>…</think> pairs (and a leading unclosed block) out into thinking
    // parts so reloading an old conversation self-heals. Must run BEFORE the
    // parts.length early-return below — leaked messages typically have no
    // thinking parts at all. Cheap indexOf pre-check keeps the render path
    // fast for the 99% of messages without tags.
    let extractedParts = [];
    if (typeof msg.content === 'string' && msg.content.indexOf('<think') !== -1) {
        const pairRe = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
        const collected = [];
        let cleaned = msg.content.replace(pairRe, (_, inner) => { collected.push(inner); return ''; });
        const leading = cleaned.match(/^\s*<think(?:ing)?>([\s\S]*)$/i);
        if (leading) { collected.push(leading[1]); cleaned = ''; }
        // Only self-heal when a visible answer REMAINS — a legacy message that
        // was entirely leaked reasoning would otherwise render as a blank
        // bubble, which reads as more broken than the historic leak itself.
        if (collected.length > 0 && cleaned.trim()) {
            msg = { ...msg, content: cleaned.replace(/^\s+/, '') };
            extractedParts = collected
                .map((text, i) => ({ id: `leak-${i}`, text: text.trim(), startedAt: null, endedAt: null }))
                .filter(p => p.text);
        }
    }

    const parts = [...extractedParts, ...partsFromRaw(msg.thinking ?? msg.thinkingParts)];
    if (parts.length === 0) return msg;

    const thinkingString = parts.map(p => p.text || '').join('\n\n');
    const starts = parts.map(p => p.startedAt).filter(n => typeof n === 'number');
    const ends = parts.map(p => p.endedAt).filter(n => typeof n === 'number');

    return {
        ...msg,
        thinkingParts: parts,
        thinking: thinkingString,
        thinkingStartedAt: starts.length ? Math.min(...starts) : null,
        thinkingEndedAt: ends.length ? Math.max(...ends) : null,
    };
}

/**
 * Apply `normalizeLoadedMessage` to each element of an array. Convenience
 * wrapper for hydration sites.
 */
export function normalizeLoadedMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages.map(normalizeLoadedMessage);
}

export default normalizeLoadedMessage;
