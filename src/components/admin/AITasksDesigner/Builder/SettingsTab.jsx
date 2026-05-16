import React, { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { NOTIFICATION_DEFAULTS, VALID_LEVELS, LEVEL_LABELS } from './notificationDefaults';

/**
 * Automation-level settings. Per-step settings live in StepInspector;
 * this tab is for everything that scopes to the whole automation:
 *
 *   - Title (read-only echo of the inline-rename)
 *   - Description
 *   - Manual trigger payload template (JSON string)
 *
 * Future: retry policy, runner concurrency hints, alert thresholds.
 *
 * Mirrors the chrome of flow/SettingsForm.jsx (form rows + Save/Reset
 * footer) so the visual language stays consistent.
 */
export default function SettingsTab({ automation, onSave }) {
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

    useEffect(() => { setDraft(initial); }, [initial]);

    const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

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
                    <Row label="Title" hint="Use the inline-rename in the header for quick edits — this field is the same value.">
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
                    </Row>
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
                    <Row label="Notifications" hint="Which run events ping you in the bell, and how loud. Approval and error are loud by default; success is silent so the bell doesn't flood.">
                        <div className="space-y-1.5">
                            {[
                                { event: 'onSuccess',  label: 'On success',  preview: '"🤖 <title>" with run summary' },
                                { event: 'onError',    label: 'On error',    preview: '"⚠️ Automation failed: <title>"' },
                                { event: 'onApproval', label: 'On approval', preview: '"🛂 Approval needed: <title>"' },
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
                </div>
            </div>

            {(parseError || saveError) && (
                <div className="px-6 py-2 text-xs text-red-600 dark:text-red-400 border-t border-[var(--border-default)] bg-red-500/5">
                    {parseError || saveError}
                </div>
            )}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
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
        };
    }
    return out;
}

function NotificationRow({ label, preview, value, onChange }) {
    const enabled = !!value.enabled;
    return (
        <div className="flex items-center gap-3 py-1.5 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
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
    );
}
