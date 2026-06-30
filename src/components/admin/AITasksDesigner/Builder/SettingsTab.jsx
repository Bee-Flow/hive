import React, { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, ChevronRight } from 'lucide-react';
import { NOTIFICATION_DEFAULTS, VALID_LEVELS, LEVEL_LABELS, CHANNEL_OPTIONS, normalizeChannels } from './notificationDefaults';
import VersionHistoryPanel from './VersionHistoryPanel';
import WebhookPanel from './WebhookPanel';
import scopedStorage from '../../../../utils/scopedStorage';

/**
 * Automation-level settings. Per-step settings live in StepInspector;
 * this tab is for everything that scopes to the whole automation:
 *
 *   - Title (read-only echo of the inline-rename)
 *   - Description
 *   - Manual trigger payload template (JSON string)
 *   - Version history (diff + restore) and inbound webhook management
 *
 * Future: retry policy, runner concurrency hints, alert thresholds.
 *
 * Mirrors the chrome of flow/SettingsForm.jsx (form rows + Save/Reset
 * footer) so the visual language stays consistent.
 */
export default function SettingsTab({ automation, onSave, onRestored }) {
    const initial = useMemo(() => ({
        title: automation?.title || '',
        description: automation?.description || '',
        triggerPayload: prettyJson(automation?.definition?.manualTriggerPayload),
        notificationSettings: mergeNotificationSettings(automation?.definition?.notificationSettings),
    }), [automation]);

    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [parseError, setParseError] = useState(null);

    // Per-user editor preference (this browser), applied immediately — it's not
    // part of the automation's saved definition, so it's outside the draft/Save
    // flow. The builder reads scopedStorage('autoMapOnConnect') on mount.
    const [autoMapOnConnect, setAutoMapOnConnect] = useState(() => scopedStorage.getItem('autoMapOnConnect') !== '0');
    const toggleAutoMap = () => setAutoMapOnConnect(v => {
        const next = !v;
        scopedStorage.setItem('autoMapOnConnect', next ? '1' : '0');
        return next;
    });

    useEffect(() => { setDraft(initial); }, [initial]);

    const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
    // Real automation title used in the notification previews so users see
    // the actual subject line, not a literal "<title>" placeholder.
    const notifyTitle = automation?.title?.trim() || 'this automation';

    const onApply = async () => {
        setSaveError(null);
        setParseError(null);
        let payload = null;
        const txt = (draft.triggerPayload || '').trim();
        if (txt) {
            try { payload = JSON.parse(txt); }
            catch (e) { setParseError(`Invalid JSON: ${e.message}`); return; }
        }
        const nextDef = {
            ...(automation?.definition || {}),
            manualTriggerPayload: payload,
            notificationSettings: draft.notificationSettings,
        };
        setSaving(true);
        try {
            await onSave({
                title: draft.title || '',
                description: draft.description || null,
                definition: nextDef,
            });
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        }
        setSaving(false);
    };

    const onReset = () => {
        setDraft(initial);
        setSaveError(null);
        setParseError(null);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
                <div className="space-y-5">
                    <Row label="Title">
                        <input
                            type="text"
                            value={draft.title}
                            onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
                            className={input()}
                        />
                    </Row>
                    <Row label="Description" hint="Optional. Shown to admins reviewing this automation.">
                        <textarea
                            rows={3}
                            value={draft.description}
                            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                            className={textarea()}
                        />
                        <div className="text-[10px] text-[var(--text-tertiary)] text-right mt-0.5">
                            {(draft.description || '').length} characters
                        </div>
                    </Row>
                    <Row label="Notifications">
                        <div className="text-[11px] text-[var(--text-tertiary)] mb-1.5 leading-snug">
                            Pick which run events alert you, how loud, and where they go. Errors and approvals
                            notify by default; success stays silent so the bell doesn't flood.
                        </div>
                        <div className="space-y-1.5">
                            {[
                                { event: 'onSuccess',  label: 'On success',  preview: `🤖 ${notifyTitle} — run summary` },
                                { event: 'onError',    label: 'On error',    preview: `⚠️ Automation failed: ${notifyTitle}` },
                                { event: 'onApproval', label: 'On approval', preview: `🛂 Approval needed: ${notifyTitle}` },
                            ].map(({ event, label, preview }) => (
                                <NotificationRow
                                    key={event}
                                    label={label}
                                    preview={preview}
                                    value={draft.notificationSettings?.[event] || NOTIFICATION_DEFAULTS[event]}
                                    onChange={(next) => setDraft(d => ({
                                        ...d,
                                        notificationSettings: {
                                            ...d.notificationSettings,
                                            [event]: next,
                                        },
                                    }))}
                                />
                            ))}
                        </div>
                    </Row>

                    <Row label="Editor" hint="Personal preference for this browser — applies to every automation you edit.">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input type="checkbox" checked={autoMapOnConnect} onChange={toggleAutoMap} />
                            <span className="text-[var(--text-primary)]">Auto-map step inputs when connecting</span>
                        </label>
                        <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">
                            When you connect two steps, automatically map the new step's inputs from the upstream step's output.
                        </div>
                    </Row>

                    <Advanced label="Advanced">
                        <Row label="Manual trigger payload (JSON)" hint='Sent as the trigger payload when you click "Run" without a server-supplied event. Useful for testing app_event automations against a fake email shape.'>
                            <textarea
                                rows={6}
                                value={draft.triggerPayload}
                                onChange={(e) => setDraft(d => ({ ...d, triggerPayload: e.target.value }))}
                                spellCheck={false}
                                className={textarea() + ' font-mono text-xs'}
                                placeholder='{"messageId": "abc", "from": "test@example.com", ...}'
                            />
                        </Row>
                    </Advanced>

                    {automation?.id && (
                        <>
                            <div className="border-t border-[var(--border-default)] pt-5">
                                <VersionHistoryPanel automation={automation} onRestored={onRestored} />
                            </div>
                            <div className="border-t border-[var(--border-default)] pt-5">
                                <WebhookPanel automation={automation} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {(parseError || saveError) && (
                <div className="px-6 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {parseError || saveError}
                </div>
            )}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <span className={`mr-auto text-[11px] ${dirty ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'No unsaved changes'}
                </span>
                <button
                    onClick={onReset}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition"
                >
                    <RotateCcw size={12} /> Reset
                </button>
                <button
                    onClick={onApply}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
                >
                    <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}

function Row({ label, hint, children }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1">{label}</div>
            {children}
            {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">{hint}</div>}
        </div>
    );
}

function input() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';
}
function textarea() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y';
}

function prettyJson(value) {
    if (!value) return '';
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

/**
 * Merge stored notification settings over the shared defaults so older
 * automations that have never opened the Settings tab still render
 * with the baseline behaviour ticked. Unknown levels fall back to the
 * default level — mirrors the runner's allowlist.
 */
function mergeNotificationSettings(stored) {
    const out = {};
    for (const event of Object.keys(NOTIFICATION_DEFAULTS)) {
        const baseline = NOTIFICATION_DEFAULTS[event];
        const v = (stored && stored[event]) || {};
        out[event] = {
            enabled: typeof v.enabled === 'boolean' ? v.enabled : baseline.enabled,
            level:   VALID_LEVELS.includes(v.level)  ? v.level   : baseline.level,
            channels: normalizeChannels(Array.isArray(v.channels) ? v.channels : baseline.channels),
        };
    }
    return out;
}

/**
 * Collapsible "Advanced" disclosure. Native <details> so it stays
 * keyboard-accessible and needs no open/close state. Used to tuck the
 * rarely-touched Manual Trigger Payload out of the default view.
 */
function Advanced({ label, children }) {
    return (
        <details className="group rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/30">
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-3 py-2 text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] flex items-center gap-1.5">
                <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                {label}
            </summary>
            <div className="px-3 pb-3 pt-1">
                {children}
            </div>
        </details>
    );
}

function NotificationRow({ label, preview, value, onChange }) {
    const enabled = !!value.enabled;
    const channels = normalizeChannels(value.channels);

    const toggleChannel = (key) => {
        const next = channels.includes(key)
            ? channels.filter(c => c !== key)
            : [...channels, key];
        onChange({ ...value, channels: normalizeChannels(next) });
    };

    return (
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
            <div className="flex items-center gap-3 py-1.5 px-2">
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Enable ${label} notification`}
                    onClick={() => onChange({ ...value, enabled: !enabled })}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition ${
                        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)]">{label}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">{preview}</div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    Severity
                    <select
                        value={value.level}
                        disabled={!enabled}
                        onChange={(e) => onChange({ ...value, level: e.target.value })}
                        className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-40"
                    >
                        {VALID_LEVELS.map(l => (
                            <option key={l} value={l}>{LEVEL_LABELS[l] || l}</option>
                        ))}
                    </select>
                </label>
            </div>
            <div className={`flex items-center flex-wrap gap-1.5 px-2 pb-2 pt-0.5 ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mr-0.5">Send to</span>
                {CHANNEL_OPTIONS.map((opt) => {
                    const active = opt.always || channels.includes(opt.key);
                    const locked = opt.always || opt.comingSoon;
                    return (
                        <button
                            key={opt.key}
                            type="button"
                            disabled={locked}
                            aria-pressed={active}
                            onClick={() => { if (!locked) toggleChannel(opt.key); }}
                            title={opt.comingSoon ? 'Coming soon' : opt.always ? 'Always on' : ''}
                            className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                                active
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            } ${opt.comingSoon ? 'opacity-50 cursor-not-allowed' : opt.always ? 'cursor-default' : ''}`}
                        >
                            {opt.label}{opt.comingSoon ? ' · soon' : ''}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
