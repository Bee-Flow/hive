/**
 * Display naming for integration apps and their actions on the add-step
 * surfaces (ribbon Apps tab, app dropdowns, the edge-drop menu's apps tree).
 *
 * Two facts about `GET /api/automation/catalog` drive everything in here:
 *
 *  1. Action labels are MECHANICAL. The server sets them to
 *     `name.replace(/_/g, ' ')` (server/routes/automation/catalog.js), so the
 *     ribbon was printing raw tool names: "nextcloud talk list rooms", listed
 *     under an app already called "Nextcloud Talk", inside a cluster already
 *     captioned NEXTCLOUD. The app was named three times and the actual verb
 *     once, at the end, where the 8rem truncation reaches it first.
 *  2. Action descriptions are the LLM tool-schema descriptions. They are good
 *     prose, but they are addressed to the MODEL, not to the author: "The user
 *     has approved this — go ahead", "Call this first to find a table id".
 *     Shown verbatim to a non-technical author they read as nonsense, which is
 *     part of why the ribbon showed no description at all.
 *
 * So: shorten names by dropping what the surrounding chrome already says, and
 * trim descriptions to the part that is about the action.
 *
 * NOTHING HERE TOUCHES A PAYLOAD. A node dropped on the canvas keeps the full
 * "Nextcloud Calendar" name — there is no cluster caption above a node to
 * supply the missing word, and existing definitions refer to these labels.
 */

/**
 * The vendor word a category already puts on screen: "Google Workspace" →
 * "Google", "Nextcloud" → "Nextcloud", "Microsoft 365" → "Microsoft".
 */
function vendorWord(category) {
    return String(category || '').trim().split(/\s+/)[0] || '';
}

/**
 * The vendor's own core app has no distinguishing word left once the vendor
 * word goes, so it needs a name of its own. Keyed by integration id, and
 * deliberately tiny — every other app is named by what survives the strip.
 *
 * 'nextcloud' is the files/WebDAV integration; the server's own Nextcloud
 * catalog already calls it "Files & WebDAV" (server/core/ncIntegrationCatalog.js).
 */
const BASE_APP_LABEL = {
    nextcloud: 'Files',
};

/**
 * What an app is called INSIDE its category cluster.
 *
 * The caption above the buttons already reads NEXTCLOUD, so spending the width
 * of the word on all fourteen buttons buys nothing — and it is what pushed the
 * Apps ribbon onto a second row, doubling its height, on every screen narrower
 * than about 2000px.
 */
export function shortAppLabel(label, category, integrationId = null) {
    const full = String(label || '').trim();
    const vendor = vendorWord(category);
    if (!full || !vendor) return full;
    if (full.toLowerCase() === vendor.toLowerCase()) {
        return BASE_APP_LABEL[integrationId] || full;
    }
    if (full.toLowerCase().startsWith(`${vendor.toLowerCase()} `)) {
        return full.slice(vendor.length + 1).trim() || full;
    }
    return full;
}

/** The label the server generates when it has nothing human to say. */
function isMechanicalLabel(action) {
    if (!action?.label) return true;
    return String(action.label).trim() === String(action.tool || '').replace(/_/g, ' ');
}

/**
 * The longest leading run of underscore-separated tokens shared by every tool
 * name — `nextcloud_talk_*` for Talk, `nextcloud_` for Files, `gmail_` for
 * Gmail. Never consumes a whole name (something has to be left to show), and
 * needs at least two names to be a prefix rather than a coincidence.
 */
function commonTokenPrefix(names) {
    if (names.length < 2) return 0;
    const split = names.map(n => String(n).split('_'));
    const cap = Math.min(...split.map(s => s.length)) - 1; // leave ≥1 token
    let i = 0;
    while (i < cap && split.every(s => s[i] === split[0][i])) i += 1;
    return i;
}

function sentenceCase(text) {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * tool name → the label to SHOW for it, given the whole action list of the app
 * it belongs to (the prefix can only be found across siblings).
 *
 * A label the server did not generate mechanically is a human's choice and is
 * returned untouched — so if the catalog ever gains curated action labels, this
 * stops guessing and defers to them.
 */
export function actionLabelMap(actions = []) {
    const list = (actions || []).filter(a => a && a.tool);
    const derivable = list.filter(isMechanicalLabel);
    const skip = commonTokenPrefix(derivable.map(a => a.tool));
    const out = new Map();
    for (const a of list) {
        if (!isMechanicalLabel(a)) { out.set(a.tool, a.label); continue; }
        const rest = String(a.tool).split('_').slice(skip).join(' ');
        out.set(a.tool, sentenceCase(rest) || String(a.label || a.tool));
    }
    return out;
}

/** Convenience for a single action when its siblings are already to hand. */
export function actionLabel(action, labelMap) {
    return labelMap?.get(action?.tool) || action?.label || '';
}

// Sentences written AT the model. They are instructions about how to call the
// tool, not statements about what it does, and mean nothing to an author
// reading a menu.
const MODEL_DIRECTED = [
    /\bthe user has (already )?approved\b/i,
    /^go ahead\b/i,
    /^(always )?call (this|the)\b/i,
    /^use this (tool )?(first|when|only)\b/i,
];

// Two sentences is what the screen tip can show without becoming a paragraph;
// the char cap catches the one-sentence-but-enormous cases (upload_file lists
// its two content sources inline).
const MAX_SENTENCES = 2;
const MAX_CHARS = 180;

/**
 * An action's description, as an author should read it.
 *
 * Splits on sentence ends that are followed by a capital or a digit, so "e.g."
 * and "1)" mid-sentence don't cut it in half.
 */
export function uiDescription(desc) {
    const flat = String(desc || '').replace(/\s+/g, ' ').trim();
    if (!flat) return '';
    const kept = flat
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .filter(s => !MODEL_DIRECTED.some(re => re.test(s.trim())))
        .slice(0, MAX_SENTENCES)
        .join(' ')
        .trim()
        // A dropped clause can leave the dangling dash it hung off.
        .replace(/\s*[—-]\s*$/, '');
    if (!kept) return '';
    if (kept.length <= MAX_CHARS) return kept;
    const cut = kept.slice(0, MAX_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}
