// Block validation + normalization for JSON imports (and the AI page
// generator). The CMS renders a CLOSED set of block types; anything else is
// dropped silently at render (marketing/ProductWebsite.jsx SECTION_REGISTRY
// filter) and at persist (server sanitizeBlock), which is what produced the
// "upload JSON → empty page, no error" bug. This module makes the boundary
// explicit: it normalizes common near-misses so foreign/AI JSON still renders,
// and reports exactly which blocks it had to drop and why.
//
// Contract is mirrored server-side by cmsStore.sanitizeBlocks so the two agree
// on what survives.

import { BLOCK_CATALOGUE } from './editors';

// The 15 canonical block types — sourced from the client catalogue so this
// stays in lockstep with the "Add block" picker and the editors.
export const KNOWN_BLOCK_TYPES = Object.keys(BLOCK_CATALOGUE);

// Fields that live at the top level of a block object (everything else is
// editable content). Used to detect the "fields not nested under content"
// near-miss and to wrap them back in.
export const STRUCTURAL_KEYS = new Set(['id', 'type', 'enabled', 'content', 'style', 'meta', 'version']);

// Forgiving aliases for the common casing/spelling variants a hand-author or
// an LLM produces for our type strings. Only safe, unambiguous mappings.
export const TYPE_ALIASES = {
    'social-proof': 'socialProof',
    socialproof: 'socialProof',
    'tech-stats': 'techStats',
    techstats: 'techStats',
    stats: 'techStats',
    mediatext: 'media-text',
    'media_text': 'media-text',
    ctabanner: 'cta-banner',
    'cta_banner': 'cta-banner',
    livecomponent: 'live-component',
    'live_component': 'live-component',
    customersupport: 'customer-support',
    'customer_support': 'customer-support',
    'call-to-action': 'cta',
    calltoaction: 'cta',
    testimonial: 'testimonials',
    faqs: 'faq',
    trustband: 'trust-band',
    'trust_band': 'trust-band',
};

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function newBlockId() {
    return `blk_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalize a single raw block toward the canonical shape
 * `{ id, type, enabled, content, style }`.
 *
 * @returns {{ block: object|null, dropped: {index,type,reason}|null, warnings: object[] }}
 */
export function normalizeBlock(raw, index) {
    const warnings = [];
    if (!isPlainObject(raw)) {
        return { block: null, dropped: { index, type: null, reason: 'not-an-object' }, warnings };
    }

    const rawType = raw.type;
    if (typeof rawType !== 'string' || !rawType.trim()) {
        return { block: null, dropped: { index, type: null, reason: 'missing-type' }, warnings };
    }
    let type = rawType.trim();
    if (!KNOWN_BLOCK_TYPES.includes(type)) {
        const aliased = TYPE_ALIASES[type] || TYPE_ALIASES[type.toLowerCase()];
        if (aliased && KNOWN_BLOCK_TYPES.includes(aliased)) {
            warnings.push({ index, type: aliased, code: 'aliased-type', message: `Renamed block type "${rawType}" → "${aliased}".` });
            type = aliased;
        } else {
            // Keep the ORIGINAL type string in the drop record so the message
            // can name what the user actually wrote.
            return { block: null, dropped: { index, type: rawType, reason: 'unknown-type' }, warnings };
        }
    }

    let id = raw.id;
    if (typeof id !== 'string' || !id.trim()) {
        id = newBlockId();
        warnings.push({ index, type, code: 'generated-id', message: 'Generated a missing block id.' });
    }

    const enabled = raw.enabled !== false;

    let content;
    if (isPlainObject(raw.content)) {
        content = raw.content;
    } else {
        // "Fields at top level" near-miss: wrap non-structural top-level keys
        // into content so the block renders instead of coming up blank.
        const topLevel = {};
        for (const k of Object.keys(raw)) {
            if (!STRUCTURAL_KEYS.has(k)) topLevel[k] = raw[k];
        }
        if (Object.keys(topLevel).length > 0) {
            content = topLevel;
            warnings.push({
                index, type, code: 'wrapped-top-level-content',
                message: `Moved ${Object.keys(topLevel).length} top-level field(s) into "content".`,
            });
        } else {
            content = {};
        }
    }

    const style = isPlainObject(raw.style) ? raw.style : {};

    return { block: { id, type, enabled, content, style }, dropped: null, warnings };
}

/**
 * Validate + normalize an array of blocks.
 *
 * @returns {{ ok: boolean, normalizedBlocks: object[], dropped: object[], warnings: object[] }}
 *   ok === (dropped.length === 0)
 */
export function validateBlocks(blocks) {
    if (!Array.isArray(blocks)) {
        return { ok: false, normalizedBlocks: [], dropped: [{ index: -1, type: null, reason: 'blocks-not-array' }], warnings: [] };
    }
    const normalizedBlocks = [];
    const dropped = [];
    const warnings = [];
    blocks.forEach((raw, index) => {
        const res = normalizeBlock(raw, index);
        if (res.block) normalizedBlocks.push(res.block);
        if (res.dropped) dropped.push(res.dropped);
        if (res.warnings.length) warnings.push(...res.warnings);
    });
    return { ok: dropped.length === 0, normalizedBlocks, dropped, warnings };
}

/**
 * Human-readable summary of dropped blocks, for a toast / inline error.
 * Lists the offending type strings and the set of valid types.
 */
export function describeDropped(dropped) {
    if (!dropped || !dropped.length) return '';
    if (dropped.length === 1 && dropped[0].reason === 'blocks-not-array') {
        return 'The file has no "blocks" array.';
    }
    const types = [...new Set(dropped.map(d => (d.type == null ? '(no type)' : `"${d.type}"`)))];
    return `${dropped.length} block(s) skipped — unrecognized type: ${types.join(', ')}. `
        + `Valid types: ${KNOWN_BLOCK_TYPES.join(', ')}.`;
}
