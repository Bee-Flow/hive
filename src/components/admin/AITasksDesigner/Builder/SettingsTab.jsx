import React, { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';

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
