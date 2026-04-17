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

    // Flag policy-removed messages so the UI can render them differently.
    // Kept here so every hydration site gets the same treatment.
    if (msg.content === '[Message removed - policy violation]') {
        msg = { ...msg, isDeleted: true };
    }

    // Only assistant messages carry thinking; fast-path the rest.
    if (msg.role !== 'assistant') return msg;

    const parts = partsFromRaw(msg.thinking ?? msg.thinkingParts);
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
