import {
    Sparkles, GitBranch, Repeat, Code, Bell, Webhook, Clock, MousePointer2, Zap, Bot,
    Pencil, Hourglass, OctagonX, Split, Filter, ChevronsDown, Copy, Layers, Sigma, LogOut, Box,
} from 'lucide-react';
import { STEP_ICON_MAP } from './stepIcons';
import { resolveIntegrationFromTool } from '../../../../../utils/integrationIcons';
import { INTEGRATION_CATALOG, CATEGORY_ORDER as INTEGRATION_CATEGORY_ORDER } from '../../../../../config/integrationCatalog';

/**
 * Shared step-catalog data + search/grouping for the routines builder's
 * "Add step" surfaces. Presentation-free (icons are lucide COMPONENT refs,
 * never rendered here) so it can feed both the top ribbon (AddStepRibbon)
 * and the edge-drop popover (AddStepMenu). Payload shapes are unchanged from
 * the old NodePalette, so `handleAddNode` / `buildStepFromPayload` keep working.
 */

// ─── Trigger types (empty-canvas state) ─────────────────────────────────
export const TRIGGERS = [
    { id: 'manual', icon: MousePointer2, label: 'Trigger manually', desc: 'Run from a button click',
      keywords: 'manual click run button', payload: { kind: 'trigger', triggerKind: 'manual', label: 'Manual' } },
    { id: 'schedule', icon: Clock, label: 'On a schedule', desc: 'Run on a recurring time (cron)',
      keywords: 'schedule cron time recurring daily hourly', payload: { kind: 'trigger', triggerKind: 'schedule', label: 'Schedule' } },
    { id: 'webhook', icon: Webhook, label: 'On webhook call', desc: 'Run when an HTTP request arrives',
      keywords: 'webhook http post request inbound', payload: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook' } },
    { id: 'app_event', icon: Zap, label: 'On app event', desc: 'Run when something happens in Gmail, Calendar, Drive, Nextcloud',
      keywords: 'app event push gmail nextcloud github calendar drive', payload: { kind: 'trigger', triggerKind: 'app_event', label: 'App event' } },
    { id: 'agent_call', icon: Bot, label: 'When an agent calls it', desc: 'Expose as a tool an AI agent can call from chat',
      keywords: 'agent chat tool function call assistant direct', payload: { kind: 'trigger', triggerKind: 'agent_call', label: 'Agent' } },
];

// ─── Step types ─────────────────────────────────────────────────────────
export const AI_STEP = {
    id: 'ai_step', icon: Sparkles, label: 'AI step', desc: 'Reason and call tools with AI',
    keywords: 'ai prompt llm claude reason', payload: { kind: 'ai_step', label: 'AI step' },
};

export const DATA_ITEMS = [
    { id: 'set', icon: Pencil, label: 'Edit Fields (Set)', desc: 'Build an object from explicit field bindings',
      keywords: 'set edit fields assign rename restructure mapping', payload: { kind: 'set', label: 'Edit fields' } },
    { id: 'datetime', icon: Clock, label: 'Date & Time', desc: 'Now, parse, format, add/subtract, diff, extract',
      keywords: 'date time datetime format parse add days hours minutes diff extract', payload: { kind: 'datetime', label: 'Date & Time' } },
];

export const COLLECTION_ITEMS = [
    { id: 'filter', icon: Filter, label: 'Filter (collection)', desc: 'Keep items matching a condition',
      keywords: 'filter where keep items collection array', payload: { kind: 'filter', label: 'Filter' } },
    { id: 'limit', icon: ChevronsDown, label: 'Limit', desc: 'First or last N items of an array',
      keywords: 'limit take first last slice top', payload: { kind: 'limit', label: 'Limit' } },
    { id: 'dedupe', icon: Copy, label: 'Remove Duplicates', desc: 'Drop duplicate items (by field or deep-equal)',
      keywords: 'dedupe duplicates unique distinct', payload: { kind: 'dedupe', label: 'Remove duplicates' } },
    { id: 'aggregate', icon: Layers, label: 'Aggregate', desc: 'Pull one field across items into a flat list',
      keywords: 'aggregate collect pluck pick field values', payload: { kind: 'aggregate', label: 'Aggregate' } },
    { id: 'summarize', icon: Sigma, label: 'Summarize', desc: 'Sum, count, avg, min, or max of a field',
      keywords: 'summarize sum count avg min max statistics aggregate', payload: { kind: 'summarize', label: 'Summarize' } },
];

// Flow control. `filter_route` is an alias of `condition` with a clearer label.
export const LOGIC_ITEMS = [
    { id: 'condition', icon: GitBranch, label: 'If', desc: 'Route items to then/else branches',
      keywords: 'condition branch if else expression conditional', payload: { kind: 'condition', label: 'If' } },
    { id: 'switch', icon: Split, label: 'Switch', desc: 'Multi-way branch by case name',
      keywords: 'switch case route multiway match', payload: { kind: 'switch', label: 'Switch' } },
    { id: 'filter_route', icon: Filter, label: 'Filter (route)', desc: 'Drop the run when expression is false',
      keywords: 'filter route stop drop guard', payload: { kind: 'condition', label: 'Filter (route)' } },
    { id: 'loop', icon: Repeat, label: 'Loop Over Items', desc: 'Iterate over an array',
      keywords: 'loop foreach iterate array items', payload: { kind: 'loop', label: 'Loop Over Items' } },
    { id: 'wait', icon: Hourglass, label: 'Wait', desc: 'Pause the run for N seconds',
      keywords: 'wait sleep delay pause timer', payload: { kind: 'wait', label: 'Wait' } },
    { id: 'stop_error', icon: OctagonX, label: 'Stop and Error', desc: 'Halt the run with an error message',
      keywords: 'stop error throw halt fail abort guardrail', payload: { kind: 'stop_error', label: 'Stop and error' } },
    { id: 'notification', icon: Bell, label: 'Notification', desc: 'Send a message or alert',
      keywords: 'notification notify alert message', payload: { kind: 'notification', label: 'Notification' } },
];

export const CODE_ITEM = {
    id: 'code', icon: Code, label: 'Code', desc: 'Run custom JavaScript',
    keywords: 'code javascript js script custom', payload: { kind: 'code', label: 'Code' },
};

export const CREATE_LAYER_ITEM = {
    id: '__create_layer', icon: Layers, label: 'Create flowlet', desc: 'Group steps into a reusable sub-flow',
    keywords: 'flowlet create new subflow sub-automation group reusable', payload: { kind: 'create_layer' },
};

export const LAYER_OUTPUT_ITEM = {
    id: '__layer_output', icon: LogOut, label: 'Flowlet output', desc: 'Return data from this flowlet to its caller',
    keywords: 'flowlet output return result respond finish end', payload: { kind: 'layer_output', label: 'Return' },
};

export const CATEGORY_ORDER = [...INTEGRATION_CATEGORY_ORDER, 'Other'];

// ─── Dynamic item builders ──────────────────────────────────────────────
export function inlineLayerItem(l) {
    const nParams = (l.params || []).length;
    return {
        id: l.key, icon: Layers, label: l.title || l.key,
        desc: `${nParams} input${nParams === 1 ? '' : 's'}`,
        keywords: 'flowlet subflow sub-automation reusable group',
        payload: { kind: 'call_layer', layerKey: l.key, label: l.title || l.key },
    };
}

export function blockItem(b) {
    const nIn = (b.params || []).length;
    const nOut = (b.outputFields || []).length;
    // Show the Step's own symbol in the palette (resolve its Lucide name to a
    // component), falling back to the generic Box.
    return {
        id: `block_${b.id}`, icon: STEP_ICON_MAP[b.icon] || Box, label: b.title || 'Step',
        desc: `${nIn} in · ${nOut} out`,
        keywords: `step block reusable building-block call ${b.title || ''}`,
        payload: { kind: 'call_block', blockId: b.id, label: b.title || 'Step', icon: b.icon || null },
    };
}

export function prettifyToolName(name) {
    return name ? String(name).replace(/_/g, ' ') : '';
}

const UNCATEGORISED = 'Uncategorised';

/**
 * Group reusable Steps into the user-set categories shown in the add-step
 * menu's "Steps" dropdown. Returns section descriptors ({key,title,items}) —
 * named categories alphabetical, the catch-all ('Uncategorised') last.
 */
export function groupBlocksByCategory(blocks) {
    const map = new Map();
    for (const b of blocks) {
        const cat = (b.category && b.category.trim()) || UNCATEGORISED;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(b);
    }
    const cats = [...map.keys()].sort((a, c) => {
        if (a === UNCATEGORISED) return 1;
        if (c === UNCATEGORISED) return -1;
        return a.localeCompare(c);
    });
    return cats.map(cat => ({
        key: `step_cat_${cat}`,
        title: cat,
        items: map.get(cat)
            .slice()
            .sort((x, y) => (x.title || '').localeCompare(y.title || ''))
            .map(blockItem),
    }));
}

function normalizeId(id) {
    return String(id || '').toLowerCase().replace(/-/g, '_');
}

function buildCategoryMap() {
    const map = new Map();
    for (const entry of INTEGRATION_CATALOG) map.set(normalizeId(entry.id), entry.category || 'Other');
    return map;
}

/** Group the catalog's apps by integration category → [{id,label,integrationId,actions,connected}]. */
export function groupAppsByCategory(catalog) {
    if (!catalog?.apps) return {};
    const catMap = buildCategoryMap();
    const out = {};
    for (const a of catalog.apps) {
        if (!a.available) continue;
        const allActions = (a.actions || []).map(act => ({
            kind: 'integration_action',
            tool: act.name,
            label: act.label || prettifyToolName(act.name),
            description: act.description,
            integrationId: act.integrationId || resolveIntegrationFromTool(act.name) || a.id,
            sideEffect: act.sideEffect,
        }));
        if (allActions.length === 0) continue;
        const integrationId = allActions[0].integrationId || a.id;
        const category = catMap.get(normalizeId(a.id)) || catMap.get(normalizeId(integrationId)) || 'Other';
        const entry = { id: a.id, label: a.label, integrationId, actions: allActions, connected: a.connected !== false };
        (out[category] = out[category] || []).push(entry);
    }
    for (const k of Object.keys(out)) out[k].sort((x, y) => x.label.localeCompare(y.label));
    return out;
}

/** Ordered apps list flattened across categories (for the Action dropdown). */
export function orderedAppCategories(catalog) {
    const grouped = groupAppsByCategory(catalog);
    return CATEGORY_ORDER
        .map(cat => ({ category: cat, apps: grouped[cat] || [] }))
        .filter(g => g.apps.length > 0);
}

/**
 * Build the ordered groups the ribbon + menu render. Each group is one of:
 *   { key, title, items: Item[] }                              — flat group
 *   { key:'action', title, kind:'apps', categories:[{category,apps}] }
 *   { key:'flow',  title, kind:'sections', sections:[{key,title,items}] }
 * Flow control + Data + Lists + Code are consolidated into the single "Flow"
 * group (as category sections) so the builder isn't hunting across several
 * overlapping menus. `opts`: { catalog, layers, inLayer, canAddLayerOutput, isBlockRoot }.
 */
export function buildStepGroups({ catalog = null, layers = [], inLayer = false, canAddLayerOutput = false, isBlockRoot = false } = {}) {
    const blocks = isBlockRoot ? [] : (catalog?.steps || []).filter(s => s && s.available !== false);
    const flowlets = [
        ...(canAddLayerOutput ? [LAYER_OUTPUT_ITEM] : []),
        CREATE_LAYER_ITEM,
        ...(layers || []).map(inlineLayerItem),
    ];
    const flowSections = [
        { key: 'flow_control', title: 'Flow control', items: LOGIC_ITEMS.filter(it => !inLayer || it.payload.kind !== 'approval') },
        { key: 'data', title: 'Data', items: DATA_ITEMS },
        { key: 'lists', title: 'Lists', items: COLLECTION_ITEMS },
    ];
    if (catalog?.flags?.code) flowSections.push({ key: 'code', title: 'Code', items: [CODE_ITEM] });
    const groups = [
        { key: 'ai', title: 'AI', items: [AI_STEP] },
        { key: 'action', title: 'Action', kind: 'apps', categories: orderedAppCategories(catalog) },
        { key: 'flow', title: 'Flow', kind: 'sections', sections: flowSections },
        { key: 'flowlets', title: 'Flowlets', items: flowlets },
    ];
    if (blocks.length > 0) {
        const sections = groupBlocksByCategory(blocks);
        // A single uncategorised bucket reads better flat (no redundant heading);
        // otherwise show one sub-heading per category.
        const flat = sections.length === 1 && sections[0].title === UNCATEGORISED;
        groups.push(flat
            ? { key: 'steps', title: 'Steps', items: sections[0].items }
            : { key: 'steps', title: 'Steps', kind: 'sections', sections });
    }
    return groups;
}

/** Look up a catalog item by id from a flat item list (for ribbon inline buttons). */
export function pickItem(items, id) {
    return (items || []).find(it => it.id === id) || null;
}

const ALL_STATIC_ITEMS = [AI_STEP, ...DATA_ITEMS, ...COLLECTION_ITEMS, ...LOGIC_ITEMS, CODE_ITEM];

/**
 * Resolve a stepUsage usage-key ('step:loop', 'action:gmail_send',
 * 'flowlet:<key>', 'block:<id>', 'layer:create') back to a render-ready
 * search-result item ({key, Icon|integrationId+tool, label, secondary, payload})
 * for the smart "Suggested" / "Frequently used" sections — or null if it can't
 * be resolved in the current scope (app unavailable, deleted flowlet, etc.).
 * `trigger:*` resolves to null (you don't add a trigger from the step menu).
 */
export function itemForKey(key, { catalog = null, layers = [] } = {}) {
    if (!key || typeof key !== 'string') return null;
    const i = key.indexOf(':');
    if (i < 0) return null;
    const type = key.slice(0, i);
    const rest = key.slice(i + 1);
    const asResult = (it) => (it
        ? { key: it.id, Icon: it.icon, label: it.label, secondary: it.desc, payload: it.payload }
        : null);

    if (type === 'step') {
        return asResult(ALL_STATIC_ITEMS.find(x => x.id === rest) || ALL_STATIC_ITEMS.find(x => x.payload.kind === rest));
    }
    if (type === 'layer' && rest === 'create') return asResult(CREATE_LAYER_ITEM);
    if (type === 'flowlet') {
        const l = (layers || []).find(x => x.key === rest);
        return l ? asResult(inlineLayerItem(l)) : null;
    }
    if (type === 'block') {
        const b = (catalog?.steps || []).find(x => String(x.id) === rest && x.available !== false);
        return b ? asResult(blockItem(b)) : null;
    }
    if (type === 'action') {
        for (const a of (catalog?.apps || [])) {
            if (a.available === false) continue;
            const act = (a.actions || []).find(x => x.name === rest);
            if (!act) continue;
            const integrationId = act.integrationId || resolveIntegrationFromTool(act.name) || a.id;
            const label = act.label || prettifyToolName(act.name);
            return {
                key: act.name, Icon: null, integrationId, tool: act.name, label, secondary: a.label,
                payload: { kind: 'integration_action', tool: act.name, label, appId: integrationId, sideEffect: act.sideEffect },
            };
        }
        return null;
    }
    return null;
}

/**
 * Flat ranked search across every addable thing. Returns DATA only
 * (Icon = lucide component or null + integrationId/tool for app logos) —
 * the renderer builds the actual icon element. Buckets:
 *   0 exact label · 1 label startsWith · 2 label includes · 3 desc/keywords/tool includes
 */
export function buildSearchResults(query, { catalog = null, mode = 'step', layers = [], inLayer = false, canAddLayerOutput = false, isBlockRoot = false } = {}) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const blocks = isBlockRoot ? [] : (catalog?.steps || []).filter(s => s && s.available !== false);
    const candidates = [];

    const pushItem = (it, context) => candidates.push({
        key: it.id, Icon: it.icon, label: it.label, secondary: it.desc,
        keywords: it.keywords, context, payload: it.payload,
    });

    if (canAddLayerOutput) pushItem(LAYER_OUTPUT_ITEM, 'Flowlet');

    if (mode === 'trigger') {
        for (const t of TRIGGERS) pushItem(t, 'Trigger');
        return rank(candidates, q);
    }

    pushItem(AI_STEP, 'AI');
    for (const it of DATA_ITEMS) pushItem(it, 'Data');
    for (const it of COLLECTION_ITEMS) pushItem(it, 'Collection');
    for (const it of LOGIC_ITEMS) { if (inLayer && it.payload.kind === 'approval') continue; pushItem(it, 'Flow'); }
    if (catalog?.flags?.code) pushItem(CODE_ITEM, 'Code');
    for (const l of (layers || [])) pushItem(inlineLayerItem(l), 'Flowlet');
    for (const b of blocks) pushItem(blockItem(b), (b.category && b.category.trim()) || 'Step');

    if (catalog?.apps) {
        for (const a of catalog.apps) {
            if (!a.available) continue;
            for (const act of (a.actions || [])) {
                const integrationId = act.integrationId || resolveIntegrationFromTool(act.name) || a.id;
                const label = act.label || prettifyToolName(act.name);
                candidates.push({
                    key: act.name, Icon: null, integrationId, tool: act.name,
                    label, secondary: a.label, description: act.description, context: a.label,
                    payload: { kind: 'integration_action', tool: act.name, label, appId: integrationId, sideEffect: act.sideEffect },
                });
            }
        }
    }

    return rank(candidates, q);
}

function rank(candidates, q) {
    const ranked = [];
    for (const c of candidates) {
        const label = (c.label || '').toLowerCase();
        const desc = (c.secondary || c.description || '').toLowerCase();
        const tool = (c.tool || '').toLowerCase();
        const kw = (c.keywords || '').toLowerCase();
        let bucket = -1;
        if (label === q) bucket = 0;
        else if (label.startsWith(q)) bucket = 1;
        else if (label.includes(q)) bucket = 2;
        else if (desc.includes(q) || kw.includes(q) || tool.includes(q)) bucket = 3;
        if (bucket === -1) continue;
        ranked.push({ ...c, _bucket: bucket });
    }
    ranked.sort((a, b) => a._bucket - b._bucket);
    return ranked;
}
