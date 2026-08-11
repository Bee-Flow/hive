/**
 * Display helpers — turn machine identifiers (tool names, step refs, field
 * paths, rule expressions) into human-readable text. Originally canvas-only;
 * the Condition node's field picker uses `humanizeFieldKey` in the inspector too,
 * because a non-technical author should read "Subject", never `item.subject`.
 */
import { parseExprToRows, labelFor, isUnaryOp } from '../utils/conditionModel';

// Hand-curated proper-noun casing so 'gmail' renders as 'Gmail' instead
// of 'Gmail' is fine but 'github' should render as 'GitHub', 'youtrack'
// as 'YouTrack', etc. Anything not listed falls through to title-case.
const PROPER_CASE = {
    gmail: 'Gmail',
    github: 'GitHub',
    youtrack: 'YouTrack',
    afas: 'AFAS',
    nmbrs: 'NMBRS',
    nextcloud: 'Nextcloud',
    google: 'Google',
    docs: 'Docs',
    sheets: 'Sheets',
    slides: 'Slides',
    drive: 'Drive',
    calendar: 'Calendar',
    contacts: 'Contacts',
    keep: 'Keep',
    groups: 'Groups',
    maps: 'Maps',
    outlook: 'Outlook',
    onedrive: 'OneDrive',
    ms: 'Microsoft',
    fireflies: 'Fireflies',
    elevenlabs: 'ElevenLabs',
    linkedin: 'LinkedIn',
    signrequest: 'SignRequest',
    n8n: 'n8n',
    kb: 'Knowledge Base',
    deck: 'Deck',
    talk: 'Talk',
    tasks: 'Tasks',
    notes: 'Notes',
    mail: 'Mail',
    activity: 'Activity',
    notifications: 'Notifications',
    status: 'Status',
    tts: 'TTS',
    sfx: 'SFX',
    ai: 'AI',
    pdf: 'PDF',
};

function pretty(token) {
    if (!token) return '';
    const lower = token.toLowerCase();
    if (PROPER_CASE[lower]) return PROPER_CASE[lower];
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Convert a tool name to a friendly subtitle. Splits on underscores,
 * applies proper-noun casing, joins with spaces.
 *
 *   gmail_send                  → 'Gmail Send'
 *   nextcloud_tasks_create      → 'Nextcloud Tasks Create'
 *   nextcloud_notifications_send → 'Nextcloud Notifications Send'
 *   generate_image              → 'Generate Image'
 *   elevenlabs_tts              → 'ElevenLabs TTS'
 */
export function humanizeToolName(toolName) {
    if (!toolName || typeof toolName !== 'string') return '';
    return toolName.split('_').filter(Boolean).map(pretty).join(' ');
}

/**
 * An integration action as a person reads it: "Gmail: Search" when the tool
 * catalog knows it, "Gmail Search" when it doesn't. The raw tool id
 * (`gmail_search`) is never the right thing to put in front of someone — it
 * was what the node-config header showed for any unnamed action (BFSF-333).
 */
export function actionDisplayLabel(tool, catalog = null) {
    const name = String(tool || '');
    if (!name) return '';
    for (const app of (catalog?.apps || [])) {
        const action = (app?.actions || []).find(a => a?.name === name);
        if (!action) continue;
        const appLabel = app.label || action.integrationLabel || '';
        const actionLabel = action.label || humanizeToolName(name);
        return appLabel ? `${appLabel}: ${actionLabel}` : actionLabel;
    }
    return humanizeToolName(name);
}

/**
 * A data field's key rendered as a plain English name — `subject` → "Subject",
 * `from_email` → "From email", `messageId` → "Message id", `htmlUrl` → "HTML url".
 *
 * Used wherever a non-technical user picks a field: they should read the name of
 * the thing ("Subject"), never its path (`item.subject`). Reuses the same
 * proper-noun table as the tool-name humanizer, so `pdf` stays "PDF".
 */
export function humanizeFieldKey(key) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    const words = raw
        .replace(/[_\-.]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase → camel Case
        .split(/\s+/)
        .filter(Boolean);
    if (!words.length) return raw;
    return words
        .map((w, i) => {
            const known = PROPER_CASE[w.toLowerCase()];
            if (known) return known;
            // Only the first word is capitalised — "From email", not "From Email";
            // sentence case reads as a label, title case reads as a heading.
            return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
        })
        .join(' ');
}

/**
 * The readable tail of a field path: the last named segment, humanised.
 * `results[*].from_email` → "From email", `items[0].id` → "Id".
 * Indexes and wildcards are dropped — whoever needs the exact path finds it
 * in the chip's `title`, and `items[0].id` is not a name anyone reads
 * (BFSF-330).
 */
export function humanizeFieldTail(fieldPath) {
    const cleaned = String(fieldPath || '').replace(/\[[^\]]*\]/g, '');
    const seg = cleaned.split('.').filter(Boolean).pop();
    return seg ? humanizeFieldKey(seg) : '';
}

/**
 * Replace `steps.<id>.output.<path>` references inside an expression
 * with a human marker `‹Step Label›.path`. Quoted strings are left
 * untouched so we don't mangle literal strings that happen to contain
 * the word `steps`.
 *
 *   steps.ai_a9afb3.output.urgentie == "hoog"
 *     →  ‹Classificeer document›.urgentie == "hoog"
 *
 * If `stepLabelById` is missing or has no entry for an id, the original
 * id is preserved so the user can still trace it.
 */
export function humanizeExpression(expr, stepLabelById = null) {
    if (!expr || typeof expr !== 'string') return '';
    return expr
        .replace(
            /steps\.([A-Za-z0-9_]+)\.output(?:\.([A-Za-z0-9_.[\]]+))?/g,
            (_, stepId, path) => {
                const label = stepLabelById?.get?.(stepId) || stepId;
                return path ? `‹${label}›.${path}` : `‹${label}›`;
            },
        )
        .replace(
            /\bloop\.([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_.[\]]+))?/g,
            (_, itemVar, path) => {
                const head = itemVar ? `‹Loop item · ${itemVar}›` : '‹Loop item›';
                return path ? `${head}.${path}` : head;
            },
        )
        .replace(
            /\btrigger(?:\.([A-Za-z0-9_.[\]]+))?/g,
            (_, path) => (path ? `‹Trigger›.${path}` : '‹Trigger›'),
        );
}

/**
 * A rule expression as a readable sentence for the node body:
 *
 *   contains(item.subject, "isv")            → Subject contains “isv”
 *   item.amount > 1000 && item.paid == false → Amount greater than 1000 and Paid is false
 *
 * Anything the clickable model can't parse (hand-written expressions, function
 * composition) falls back to `humanizeExpression`, which at least swaps step
 * ids for their labels. The canvas never shows a raw `item.<key>` path.
 */
export function describeRuleExpr(expr, stepLabelById = null) {
    const src = String(expr || '').trim();
    if (!src) return '';
    const parsed = parseExprToRows(src);
    if (!parsed?.rows?.length) return humanizeExpression(src, stepLabelById);
    const joiner = parsed.join === '||' ? ' or ' : ' and ';
    const parts = parsed.rows.map((row) => {
        const path = row.field?.kind === 'ref' ? row.field.path : '';
        if (!path) return null;
        const name = humanizeFieldKey(lastPathSegment(path));
        const op = labelFor(row.op, 'unknown');
        if (isUnaryOp(row.op)) return `${name} ${op}`;
        const v = row.value;
        if (v?.kind === 'ref' && v.path) return `${name} ${op} ${humanizeFieldKey(lastPathSegment(v.path))}`;
        const raw = v?.kind === 'literal' ? v.value : v?.value;
        if (raw === '' || raw == null) return `${name} ${op}`;
        return typeof raw === 'string' ? `${name} ${op} “${raw}”` : `${name} ${op} ${raw}`;
    }).filter(Boolean);
    return parts.length ? parts.join(joiner) : humanizeExpression(src, stepLabelById);
}

/** `steps.g1.output.results[*].subject` → `subject` (array markers stripped). */
function lastPathSegment(path) {
    const cleaned = String(path || '').replace(/\[(?:\*|\d+)\]/g, '');
    const seg = cleaned.split('.').filter(Boolean).pop() || '';
    return seg;
}

/**
 * Build the lookup map the helpers above need from a definition.
 * Trigger + steps both contribute; falls back to id when a step has
 * no `label` set.
 */
export function buildStepLabelMap(def) {
    const m = new Map();
    if (!def) return m;
    const all = [def.trigger, ...(def.steps || [])].filter(Boolean);
    for (const s of all) m.set(s.id, s.label || s.id);
    return m;
}

/**
 * Which known step a validation record is about. Records carry an id-based
 * `path` like `steps[<id>].expr` (server/automation/validate.js) — same
 * substring-match technique as matchValidationToStep.js/sectionForIssue.js.
 * Prefers the LONGEST matching id so a short id can't shadow a longer one
 * that happens to contain it as a substring.
 */
export function resolveOwningStepId(record, def) {
    const path = record?.path;
    if (typeof path !== 'string' || !def) return null;
    const allIds = [def.trigger?.id, ...(def.steps || []).map(s => s.id)].filter(Boolean);
    let best = null;
    for (const id of allIds) {
        if (path.includes(id) && (!best || id.length > best.length)) best = id;
    }
    return best;
}

/**
 * Replace any KNOWN step id appearing literally in a validation message
 * (e.g. `Step cond_7f748746: unknown type...`, `runPartial: step
 * cond_7f748746 not found`) with its human label, quoted for readability.
 * Ids with no entry in `labelById` (e.g. a stale reference to an already-
 * deleted step) are left as-is — there's no real name to substitute, and
 * that's itself part of what the message is reporting.
 */
export function humanizeIssueText(text, labelById) {
    if (!text || typeof text !== 'string' || !labelById?.size) return text;
    const ids = [...labelById.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
    if (!ids.length) return text;
    const pattern = new RegExp(`\\b(${ids.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
    return text.replace(pattern, (id) => `"${labelById.get(id) || id}"`);
}
