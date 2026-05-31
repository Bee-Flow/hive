import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Webhook, Zap, MousePointer, AlertTriangle } from 'lucide-react';
import ModelTierSelector from '../../../ModelTierSelector';
import TriggerFilterBuilder from './TriggerFilterBuilder';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * Structured form for the simple "one trigger + one step" automation.
 *
 * Power users get the full DAG via the AI builder; this form covers the
 * 80%-case ("every weekday at 9am, prompt agent X") without requiring a
 * chat interaction. The `definition` produced here is the same shape the
 * server validator accepts, so saving from Quick mode is byte-equivalent
 * to building the same automation through the chat builder.
 *
 * If the existing definition contains step types Quick mode can't show
 * (loops, conditions, code, multi-step compositions), the form refuses to
 * touch them and renders a banner asking the user to switch to AI/Expert
 * mode. Silent overwrite would be a foot-gun that destroys advanced work.
 */

const TRIGGER_OPTIONS = [
    { value: 'schedule', label: 'On a schedule', icon: <Clock size={14} /> },
    { value: 'app_event', label: 'When something happens', icon: <Zap size={14} /> },
    { value: 'webhook', label: 'Incoming webhook', icon: <Webhook size={14} /> },
    { value: 'manual', label: 'Manual run only', icon: <MousePointer size={14} /> },
];

const STEP_OPTIONS = [
    { value: 'ai_step', label: 'Run an AI prompt' },
    { value: 'integration_action', label: 'Call an integration' },
    { value: 'notification', label: 'Send a notification' },
];

const APP_EVENT_PROVIDERS = [
    { value: 'gmail', events: ['mail.new', 'label.added'], label: 'Gmail' },
    { value: 'google-calendar', events: ['event.changed', 'event.upcoming'], label: 'Google Calendar' },
    { value: 'google-drive', events: ['file.new'], label: 'Google Drive' },
    { value: 'msgraph', events: ['mail.new', 'mail.flagged', 'event.created', 'event.updated', 'file.changed'], label: 'Microsoft 365' },
    {
        value: 'nextcloud',
        label: 'Nextcloud',
        events: [
            'file.new', 'file.changed', 'file.deleted', 'file.renamed',
            'file.commented', 'file.tagged',
            'share.created', 'share.received', 'share.accepted', 'share.deleted',
            'calendar.event.created', 'calendar.event.changed', 'calendar.event.deleted', 'calendar.event.upcoming',
            'deck.card.created', 'deck.card.changed', 'deck.card.deleted', 'deck.card.moved', 'deck.card.completed',
            'talk.message.received', 'talk.mention.received',
            'task.created', 'task.completed', 'task.due',
            'activity.new', 'notification.new', 'user.status.changed',
        ],
    },
    { value: 'ticket-assistant', events: ['ticket.new', 'sync.completed'], label: 'Ticket Assistant' },
];

// Cron presets that the existing prompt-task editor uses; reusing them
// here keeps the two surfaces feeling consistent.
const SCHEDULE_PRESETS = [
    { value: 'daily',     label: 'Every day' },
    { value: 'weekdays',  label: 'Weekdays (Mon–Fri)' },
    { value: 'weekly',    label: 'Every week' },
    { value: 'monthly',   label: 'Every month' },
    { value: 'custom',    label: 'Custom cron…' },
];

function presetToCron(preset, timeStr) {
    const [hRaw, mRaw] = String(timeStr || '09:00').split(':');
    const hParsed = parseInt(hRaw, 10);
    const mParsed = parseInt(mRaw, 10);
    const h = Number.isFinite(hParsed) && hParsed >= 0 && hParsed <= 23 ? hParsed : 9;
    const m = Number.isFinite(mParsed) && mParsed >= 0 && mParsed <= 59 ? mParsed : 0;
    if (preset === 'daily')    return `${m} ${h} * * *`;
    if (preset === 'weekdays') return `${m} ${h} * * 1-5`;
    if (preset === 'weekly')   return `${m} ${h} * * 1`;
    if (preset === 'monthly')  return `${m} ${h} 1 * *`;
    return null;
}

// Crude but useful cron validation — 5 whitespace-separated fields, each
// allowing digits, named tokens (mon, jan, ...), '*', '/', ',', '-'.
// Catches typos and missing fields without pulling in a parser library.
const CRON_TOKEN = /^(?:\d+|\*|[a-zA-Z]{3})(?:[-,/](?:\d+|\*|[a-zA-Z]{3}))*$/;
function isValidCron(expr) {
    if (typeof expr !== 'string') return false;
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    return parts.every((p) => CRON_TOKEN.test(p));
}

// Cached IANA tz list; supportedValuesOf is a 2022+ API but works in all
// browsers we target. The fallback is a small hand-picked set so the
// datalist still helps users on the rare older runtime.
let _tzList = null;
function getTimezoneList() {
    if (_tzList) return _tzList;
    try {
        if (typeof Intl.supportedValuesOf === 'function') {
            _tzList = Intl.supportedValuesOf('timeZone');
            return _tzList;
        }
    } catch { /* fall through */ }
    _tzList = ['UTC', 'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
        'America/New_York', 'America/Los_Angeles', 'America/Chicago',
        'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'];
    return _tzList;
}
function isValidTimezone(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try {
        // Constructor throws RangeError on invalid zones.
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

// Webpage-context tools need an explicit webpageId input from the user.
// `webpage_create` (creates a new one) and `webpages_list` (returns the
// list itself) don't, so they're excluded.
const TOOLS_WITHOUT_WEBPAGE_INPUT = new Set(['webpage_create', 'webpages_list']);
function toolNeedsWebpageInput(toolName) {
    if (typeof toolName !== 'string') return false;
    if (!toolName.startsWith('webpage_')) return false;
    return !TOOLS_WITHOUT_WEBPAGE_INPUT.has(toolName);
}

// The catalog endpoint can return either a flat `tools[]` (newer) or a
// nested `apps[].actions[]` (older). Normalize to a flat list of
// `{ name, label }` so the dropdown doesn't have to know which shape it
// got. Returns [] when the catalog is missing — caller renders an error
// banner separately when the fetch failed.
function normalizeToolCatalog(catalog) {
    if (!catalog) return [];
    if (Array.isArray(catalog.tools) && catalog.tools.length) {
        return catalog.tools.map((t) => ({
            name: t.name || t.id,
            label: t.label || t.name || t.id,
        }));
    }
    const apps = Array.isArray(catalog.apps) ? catalog.apps : [];
    return apps
        .filter((a) => a.available)
        .flatMap((a) => (a.actions || []).map((act) => ({
            name: act.name,
            label: `${a.label}: ${act.label || act.name}`,
        })));
}

function cronToPreset(cron) {
    if (!cron) return { preset: 'daily', time: '09:00' };
    const m = cron.match(/^(\d+) (\d+) (\S+) (\S+) (\S+)$/);
    if (!m) return { preset: 'custom', time: '09:00' };
    const [, mm, hh, dom, mon, dow] = m;
    const time = `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
    if (dom === '*' && mon === '*' && dow === '*') return { preset: 'daily', time };
    if (dom === '*' && mon === '*' && dow === '1-5') return { preset: 'weekdays', time };
    if (dom === '*' && mon === '*' && dow === '1') return { preset: 'weekly', time };
    if (dom === '1' && mon === '*' && dow === '*') return { preset: 'monthly', time };
    return { preset: 'custom', time };
}

function makeStepId() {
    return `s_${Math.random().toString(36).slice(2, 8)}`;
}

const QUICK_SUPPORTED_STEP_TYPES = new Set(['ai_step', 'integration_action', 'notification']);

/**
 * Decide whether the current definition is editable by Quick mode. Quick
 * mode supports 0–1 primary steps + an optional notification chained off
 * the first. Anything else (loops, conditions, code, multiple branches)
 * gets the diverged banner.
 */
function isQuickEligible(def) {
    if (!def) return true;
    const steps = Array.isArray(def.steps) ? def.steps : [];
    if (steps.length === 0) return true;
    // All step types Quick can render?
    for (const s of steps) {
        if (!QUICK_SUPPORTED_STEP_TYPES.has(s.type)) return false;
    }
    // No more than 2 steps (primary + optional notification).
    if (steps.length > 2) return false;
    return true;
}

function inputClass() {
    return 'w-full px-3 py-2 rounded-lg border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors';
}
function inputStyle() {
    return { borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' };
}

export default function QuickEditForm({
    definition,
    onChange,
    expert = false,
    agents = [],
    modelTiers = {},
    publicWebhookUrl = null,    // optional; the panel that owns the webhook list passes it down
}) {
    const eligible = useMemo(() => isQuickEligible(definition), [definition]);

    // Local mirror of the definition. We commit upward via onChange whenever
    // the user changes a field. Because the server validates on save, we
    // stay loose here: missing fields are fine, the save path will catch
    // the validator error and surface it.
    const trigger = definition?.trigger || { id: 'trg', type: 'trigger', kind: 'manual' };
    const steps = Array.isArray(definition?.steps) ? definition.steps : [];
    const primary = steps.find(s => s.type !== 'notification') || null;
    const notification = steps.find(s => s.type === 'notification') || null;
    const tz = trigger.schedule?.tz || 'Europe/Amsterdam';
    const { preset: schedulePreset, time: scheduleTime } = cronToPreset(trigger.schedule?.cron);

    const [catalog, setCatalog] = useState(null);
    const [catalogLoadFailed, setCatalogLoadFailed] = useState(false);
    // Webpages the current user can target — owner + org/group-shared. Used
    // by the picker that appears when the selected tool needs a webpageId.
    const [webpages, setWebpages] = useState([]);
    // Whether the user has any Ticket Assistant connections. TA isn't part
    // of the tools catalog (it's a separate beta feature), so we probe the
    // dedicated connections endpoint to decide whether to show that
    // provider in the trigger picker.
    const [hasTaConnections, setHasTaConnections] = useState(false);
    const [taConnectionsLoaded, setTaConnectionsLoaded] = useState(false);
    useEffect(() => {
        let alive = true;
        authFetch(`${API_BASE}/api/automation/catalog`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(d => { if (alive) { setCatalog(d); setCatalogLoadFailed(false); } })
            .catch(() => { if (alive) setCatalogLoadFailed(true); });
        // 401 / 403 / 404 / network — silently treat as "no TA". The user
        // sees a provider list without TA, which is the right outcome
        // when they don't have access anyway.
        authFetch(`${API_BASE}/api/ticket-assistant/connections`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!alive) return;
                const conns = Array.isArray(d) ? d : (d?.connections || []);
                setHasTaConnections(conns.length > 0);
            })
            .catch(() => {})
            .finally(() => { if (alive) setTaConnectionsLoaded(true); });
        authFetch(`${API_BASE}/api/webpages`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!alive) return;
                const list = d?.webpages ?? [];
                setWebpages(Array.isArray(list) ? list : []);
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    // Inline validation state for fields the server would otherwise only
    // reject on save (and surface as a generic error far from the field).
    const [cronError, setCronError] = useState(null);
    const [tzError, setTzError] = useState(null);

    // Decide which app_event providers are visible to this user. The
    // catalog returns one entry per registry app with an `available`
    // flag (true when the user has at least one tool from that app
    // connected). We collapse multiple registry entries into a single
    // surface where it makes sense:
    //   - 'msgraph' is shown when ANY of outlook / ms-calendar / onedrive
    //     is available (those three together cover the events msgraph
    //     emits in our trigger taxonomy).
    //   - 'nextcloud' is shown when ANY nextcloud-prefixed app is
    //     available (file events live under the bare 'nextcloud' app id,
    //     calendar/talk/deck events under their dedicated apps).
    //   - 'ticket-assistant' is shown when the user has at least one TA
    //     connection.
    // Until the catalog loads we keep the picker empty rather than show
    // a list the user can't use — picking an unavailable provider would
    // fail at activate-time anyway.
    const enabledProviders = useMemo(() => {
        // Until BOTH the catalog and TA-connections probe resolve, return
        // an empty list — otherwise the dropdown can flicker entries on/off
        // as the two fetches resolve at different times.
        if (!catalog || !taConnectionsLoaded) return [];
        const apps = Array.isArray(catalog?.apps) ? catalog.apps : [];
        const isAvailable = (id) => apps.find(a => a.id === id)?.available;
        const anyAvailable = (ids) => ids.some(isAvailable);
        return APP_EVENT_PROVIDERS.filter((p) => {
            if (p.value === 'msgraph') return anyAvailable(['outlook', 'ms-calendar', 'onedrive']);
            if (p.value === 'nextcloud') {
                return apps.some(a => typeof a.id === 'string' && a.id.startsWith('nextcloud') && a.available);
            }
            if (p.value === 'ticket-assistant') return hasTaConnections;
            return isAvailable(p.value);
        });
    }, [catalog, hasTaConnections, taConnectionsLoaded]);

    const commit = (next) => {
        onChange?.(next);
    };

    const updateTrigger = (patch) => {
        const next = { ...definition, trigger: { ...trigger, ...patch } };
        // Maintain edges so the diagram still draws (trigger → primary).
        next.edges = ensureEdges(next);
        commit(next);
    };

    const updatePrimary = (patch) => {
        const id = primary?.id || makeStepId();
        const merged = { id, type: 'ai_step', ...primary, ...patch };
        const others = steps.filter(s => s !== primary);
        const next = { ...definition, steps: [merged, ...others] };
        next.edges = ensureEdges(next);
        commit(next);
    };

    const setPrimaryType = (type) => {
        const id = primary?.id || makeStepId();
        let nextStep;
        if (type === 'ai_step') {
            nextStep = { id, type, prompt: primary?.prompt || '', tier: primary?.tier || 'auto', agentId: primary?.agentId || null };
        } else if (type === 'integration_action') {
            nextStep = { id, type, tool: '', inputs: {} };
        } else if (type === 'notification') {
            nextStep = { id, type, title: '', body: '' };
        } else {
            return;
        }
        const others = steps.filter(s => s !== primary);
        const next = { ...definition, steps: [nextStep, ...others] };
        next.edges = ensureEdges(next);
        commit(next);
    };

    const setNotificationEnabled = (enabled) => {
        if (enabled === !!notification) return;
        if (enabled) {
            const note = { id: makeStepId(), type: 'notification', title: 'Automation finished', body: '{{trigger.output}}' };
            const next = { ...definition, steps: [...steps, note] };
            next.edges = ensureEdges(next);
            commit(next);
        } else {
            const next = { ...definition, steps: steps.filter(s => s !== notification) };
            next.edges = ensureEdges(next);
            commit(next);
        }
    };

    if (!eligible) {
        return (
            <div className="p-4">
                <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[13px]">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="font-medium">This automation has advanced steps.</div>
                        <div className="mt-1 text-[var(--text-secondary)]">
                            Quick mode shows a single trigger and a single action. Switch to <strong>Build with AI</strong> or <strong>Expert</strong> mode to keep your loops, conditions, code steps or multi-step composition intact.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-5">
            {/* TRIGGER */}
            <section>
                <div className="text-[13px] font-medium text-[var(--text-primary)] mb-2">Trigger</div>
                <div className="grid grid-cols-2 gap-2">
                    {TRIGGER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                if (opt.value === trigger.kind) return; // already selected — no-op (don't fire a save)
                                updateTrigger({ kind: opt.value });
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] text-left transition ${
                                trigger.kind === opt.value
                                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            {opt.icon}
                            {opt.label}
                        </button>
                    ))}
                </div>

                {trigger.kind === 'schedule' && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Repeat</label>
                            <select
                                value={schedulePreset}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    if (next === 'custom') {
                                        updateTrigger({ schedule: { cron: trigger.schedule?.cron || '0 9 * * *', tz } });
                                    } else {
                                        updateTrigger({ schedule: { cron: presetToCron(next, scheduleTime), tz } });
                                    }
                                }}
                                className={inputClass()}
                                style={inputStyle()}
                            >
                                {SCHEDULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Time</label>
                            <input
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    if (schedulePreset === 'custom') return;
                                    updateTrigger({ schedule: { cron: presetToCron(schedulePreset, next), tz } });
                                }}
                                disabled={schedulePreset === 'custom'}
                                className={inputClass()}
                                style={inputStyle()}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Timezone</label>
                            <input
                                type="text"
                                value={tz}
                                list="bf-tz-list"
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setTzError(null); // clear while typing
                                    updateTrigger({ schedule: { cron: trigger.schedule?.cron || '0 9 * * *', tz: v } });
                                }}
                                onBlur={(e) => {
                                    const v = e.target.value;
                                    if (v && !isValidTimezone(v)) {
                                        setTzError(`"${v}" is not a known IANA timezone (e.g. Europe/Amsterdam).`);
                                    } else {
                                        setTzError(null);
                                    }
                                }}
                                placeholder="Europe/Amsterdam"
                                className={inputClass()}
                                style={inputStyle()}
                            />
                            <datalist id="bf-tz-list">
                                {getTimezoneList().map((z) => <option key={z} value={z} />)}
                            </datalist>
                            {tzError && (
                                <div className="text-[11px] text-red-600 mt-1">{tzError}</div>
                            )}
                        </div>
                        {(expert || schedulePreset === 'custom') && (
                            <div className="col-span-2">
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Cron expression (expert)</label>
                                <input
                                    type="text"
                                    value={trigger.schedule?.cron || ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v.trim() === '' || isValidCron(v)) {
                                            setCronError(null);
                                        } else {
                                            setCronError('Cron must be 5 fields (minute hour day-of-month month day-of-week).');
                                        }
                                        updateTrigger({ schedule: { cron: v, tz } });
                                    }}
                                    placeholder="0 9 * * 1"
                                    className={inputClass()}
                                    style={inputStyle()}
                                />
                                {cronError && (
                                    <div className="text-[11px] text-red-600 mt-1">{cronError}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {trigger.kind === 'app_event' && (
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Provider</label>
                                <select
                                    value={trigger.appEvent?.provider || ''}
                                    onChange={(e) => updateTrigger({ appEvent: { provider: e.target.value, event: '', filter: {} } })}
                                    className={inputClass()}
                                    style={inputStyle()}
                                >
                                    <option value="">
                                        {catalog === null
                                            ? 'Loading providers…'
                                            : enabledProviders.length === 0
                                                ? 'No connected integrations'
                                                : '— pick a provider —'}
                                    </option>
                                    {/* Catalog has loaded but the saved provider on this
                                        automation is no longer enabled (user revoked the
                                        integration). Surface it as "(no longer connected)"
                                        so the dropdown still shows the current value
                                        instead of silently snapping back to "pick a
                                        provider". */}
                                    {trigger.appEvent?.provider
                                        && enabledProviders.length > 0
                                        && !enabledProviders.find(p => p.value === trigger.appEvent.provider) && (
                                            <option value={trigger.appEvent.provider} disabled>
                                                {trigger.appEvent.provider} (no longer connected)
                                            </option>
                                        )}
                                    {enabledProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Event</label>
                                <select
                                    value={trigger.appEvent?.event || ''}
                                    onChange={(e) => {
                                        const nextEvent = e.target.value;
                                        // Reset filter when event type changes — different
                                        // events have different valid filter keys (e.g.
                                        // Nextcloud file events use `inFolder`, deck events
                                        // use `boardId`). Carrying keys across event types
                                        // serializes nonsense into the trigger.
                                        const sameEvent = nextEvent === trigger.appEvent?.event;
                                        updateTrigger({
                                            appEvent: {
                                                provider: trigger.appEvent?.provider,
                                                event: nextEvent,
                                                filter: sameEvent ? (trigger.appEvent?.filter || {}) : {},
                                            },
                                        });
                                    }}
                                    disabled={!trigger.appEvent?.provider}
                                    className={inputClass()}
                                    style={inputStyle()}
                                >
                                    <option value="">— pick an event —</option>
                                    {(APP_EVENT_PROVIDERS.find(p => p.value === trigger.appEvent?.provider)?.events || []).map(ev => (
                                        <option key={ev} value={ev}>{ev}</option>
                                    ))}
                                </select>
                                {/* Honest hint: NC push-only events need the (pending)
                                    Bee Flow ExApp connector. Sourced from /catalog
                                    deliverability — visual only, amber (no purple). */}
                                {trigger.appEvent?.provider === 'nextcloud'
                                    && trigger.appEvent?.event
                                    && (catalog?.deliverability?.pushPending?.nextcloud || []).includes(trigger.appEvent.event) && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">connector</span>
                                            Needs the Bee Flow ExApp connector — pending validation. Use a poller-backed event (e.g. file.new) to fire today.
                                        </div>
                                    )}
                            </div>
                        </div>
                        {trigger.appEvent?.provider && trigger.appEvent?.event && (
                            <TriggerFilterBuilder
                                provider={trigger.appEvent.provider}
                                eventType={trigger.appEvent.event}
                                filter={trigger.appEvent.filter || {}}
                                onChange={(filter) => updateTrigger({ appEvent: { ...trigger.appEvent, filter } })}
                                expert={expert}
                            />
                        )}
                    </div>
                )}

                {trigger.kind === 'webhook' && (
                    <div className="mt-3 text-[12px] text-[var(--text-secondary)]">
                        {publicWebhookUrl ? (
                            <div>
                                Public URL: <code className="text-[var(--text-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">{publicWebhookUrl}</code>
                            </div>
                        ) : (
                            <div>Open the Webhooks panel below to create a signed URL.</div>
                        )}
                    </div>
                )}
            </section>

            {/* ACTION */}
            <section>
                <div className="text-[13px] font-medium text-[var(--text-primary)] mb-2">Action</div>
                <select
                    value={primary?.type || 'ai_step'}
                    onChange={(e) => setPrimaryType(e.target.value)}
                    className={inputClass()}
                    style={inputStyle()}
                >
                    {STEP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {(primary?.type || 'ai_step') === 'ai_step' && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Prompt</label>
                            <textarea
                                value={primary?.prompt || ''}
                                onChange={(e) => updatePrimary({ prompt: e.target.value })}
                                rows={4}
                                placeholder="What should the AI do? Use {{trigger.output.subject}} to reference the trigger payload."
                                className={inputClass()}
                                style={inputStyle()}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Agent (optional)</label>
                                <select
                                    value={primary?.agentId || ''}
                                    onChange={(e) => updatePrimary({ agentId: e.target.value || null })}
                                    className={inputClass()}
                                    style={inputStyle()}
                                >
                                    <option value="">— No agent —</option>
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name || '(untitled)'}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Model tier</label>
                                <ModelTierSelector
                                    value={primary?.tier || 'auto'}
                                    onChange={(tier) => updatePrimary({ tier })}
                                    tiers={modelTiers}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {primary?.type === 'integration_action' && (
                    <div className="mt-3 space-y-2">
                        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Tool</label>
                        {catalogLoadFailed && (
                            <div className="text-[11px] text-red-600 mb-1">
                                Failed to load the tool catalog. Refresh the page to retry.
                            </div>
                        )}
                        <select
                            value={primary?.tool || ''}
                            onChange={(e) => updatePrimary({ tool: e.target.value })}
                            className={inputClass()}
                            style={inputStyle()}
                        >
                            <option value="">— pick a tool —</option>
                            {normalizeToolCatalog(catalog).map(t => (
                                <option key={t.name} value={t.name}>{t.label}</option>
                            ))}
                        </select>
                        {toolNeedsWebpageInput(primary?.tool) && (
                            <div className="mt-2">
                                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Webpage</label>
                                <select
                                    value={primary?.inputs?.webpageId?.value || ''}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        const nextInputs = { ...(primary?.inputs || {}) };
                                        if (id) nextInputs.webpageId = { kind: 'literal', value: id };
                                        else delete nextInputs.webpageId;
                                        updatePrimary({ inputs: nextInputs });
                                    }}
                                    className={inputClass()}
                                    style={inputStyle()}
                                >
                                    <option value="">— pick a webpage —</option>
                                    {webpages.map(wp => (
                                        <option key={wp.id} value={wp.id}>{wp.name || '(untitled)'}</option>
                                    ))}
                                </select>
                                <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                    The AI builder can override this at run time via <code>webpages_list</code>.
                                </div>
                            </div>
                        )}
                        <div className="text-[11px] text-[var(--text-tertiary)]">
                            Inputs are best filled in via the AI builder — Quick mode just picks the tool.
                            Switch to Build with AI when you're ready to wire arguments.
                        </div>
                    </div>
                )}

                {primary?.type === 'notification' && (
                    <div className="mt-3 space-y-2">
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Title</label>
                            <input
                                type="text"
                                value={primary?.title || ''}
                                onChange={(e) => updatePrimary({ title: e.target.value })}
                                className={inputClass()}
                                style={inputStyle()}
                            />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Body</label>
                            <textarea
                                value={primary?.body || ''}
                                onChange={(e) => updatePrimary({ body: e.target.value })}
                                rows={3}
                                className={inputClass()}
                                style={inputStyle()}
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* OPTIONAL FOLLOW-UP NOTIFICATION */}
            {primary?.type !== 'notification' && (
                <section>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                        <input
                            type="checkbox"
                            checked={!!notification}
                            onChange={(e) => setNotificationEnabled(e.target.checked)}
                        />
                        Notify me when it finishes
                    </label>
                </section>
            )}
        </div>
    );
}

/**
 * Rebuild the edges list to be: trigger → primary → (notification if any).
 * Idempotent and stable, so a small change anywhere doesn't shuffle the
 * graph layout in the diagram pane.
 */
function ensureEdges(def) {
    const trigger = def?.trigger || { id: 'trg' };
    const steps = Array.isArray(def?.steps) ? def.steps : [];
    const primary = steps.find(s => s.type !== 'notification') || null;
    const notification = steps.find(s => s.type === 'notification') || null;
    const edges = [];
    if (primary) edges.push({ from: trigger.id || 'trg', to: primary.id });
    else if (notification) edges.push({ from: trigger.id || 'trg', to: notification.id });
    if (primary && notification) edges.push({ from: primary.id, to: notification.id });
    return edges;
}
