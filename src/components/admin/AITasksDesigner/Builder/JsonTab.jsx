import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, Save, AlertCircle } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * JSON view of the entire automation. Default is read-only — for users
 * who just want to copy the full definition or send it to support — but
 * power users can switch to edit mode and PUT a hand-edited definition.
 *
 * Edit mode is gated by `editable` (only set in expert mode) AND only
 * allowed when the automation is not currently active. Active automations
 * stay read-only because a malformed save here would leave the live
 * trigger pointing at a broken graph until the next deactivate/save cycle.
 *
 * Server-side `validateDefinition` is the single source of truth for
 * whether a save is accepted; we surface the returned errors inline.
 *
 * Lazy Monaco; falls back to a `<textarea>` when the editor module fails
 * to load (offline, blocking extension, or in tests).
 */
export default function JsonTab({ automation, editable = false, onSaved }) {
    const api = useAutomationApi();

    const [Monaco, setMonaco] = useState(null);
    const [monacoFailed, setMonacoFailed] = useState(false);
    const [copied, setCopied] = useState(false);

    const initialText = useMemo(() => JSON.stringify(automation || {}, null, 2), [automation]);
    const [text, setText] = useState(initialText);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveOk, setSaveOk] = useState(false);
    const dirtyRef = useRef(false);

    useEffect(() => {
        let alive = true;
        import('@monaco-editor/react')
            .then(mod => { if (alive) setMonaco(() => mod.default); })
            .catch(() => { if (alive) setMonacoFailed(true); });
        return () => { alive = false; };
    }, []);

    // Keep the local buffer in sync with the parent automation when the
    // user is NOT editing — otherwise a server-side update mid-edit would
    // overwrite the user's typing without warning.
    useEffect(() => {
        if (!dirtyRef.current && !editing) {
            setText(initialText);
        }
    }, [initialText, editing]);

    const isActive = !!automation?.isActive;
    const canEdit = editable && !isActive;

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (_) { /* clipboard unsupported — silent */ }
    };

    const onChange = (next) => {
        setText(next);
        dirtyRef.current = true;
        if (saveOk) setSaveOk(false);
        if (saveError) setSaveError(null);
    };

    const onSave = async () => {
        if (!canEdit) return;
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            setSaveError(`Invalid JSON: ${e.message}`);
            return;
        }
        // Strip purely server-managed fields so the PUT body matches the
        // shape updateAutomation expects (definition + the few mutable
        // shorthand fields). Without this, sending the full row back leads
        // to surprising "you can't change this" errors.
        const allowed = {
            title: parsed.title,
            description: parsed.description,
            definition: parsed.definition,
            triggerType: parsed.triggerType,
            scheduleCron: parsed.scheduleCron,
            scheduleTz: parsed.scheduleTz,
            runTimeoutMs: parsed.runTimeoutMs,
        };
        // Drop undefined keys — avoids accidentally clearing fields that
        // weren't present in the JSON paste.
        for (const k of Object.keys(allowed)) if (allowed[k] === undefined) delete allowed[k];

        setSaving(true);
        setSaveError(null);
        try {
            const r = await api.updateAutomation(automation.id, allowed);
            dirtyRef.current = false;
            setEditing(false);
            setSaveOk(true);
            setTimeout(() => setSaveOk(false), 2000);
            onSaved?.(r?.automation || null);
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const beginEdit = () => {
        if (!canEdit) return;
        setText(initialText);
        dirtyRef.current = false;
        setEditing(true);
    };

    const cancelEdit = () => {
        setText(initialText);
        dirtyRef.current = false;
        setEditing(false);
        setSaveError(null);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <div className="text-xs text-[var(--text-tertiary)] flex-1 min-w-0 truncate">
                    {editing
                        ? 'Editing — server validates on save.'
                        : canEdit
                            ? 'Read-only. Click "Edit" to make raw changes.'
                            : isActive
                                ? 'Read-only. Deactivate the automation to edit raw JSON.'
                                : 'Read-only. Edit via the chat or per-step inspector.'}
                </div>
                {saveOk && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Saved
                    </span>
                )}
                {!editing && (
                    <>
                        <button
                            onClick={onCopy}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        {canEdit && (
                            <button
                                onClick={beginEdit}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-white"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                Edit
                            </button>
                        )}
                    </>
                )}
                {editing && (
                    <>
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="text-xs px-2.5 py-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-white disabled:opacity-60"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                    </>
                )}
            </div>
            {saveError && (
                <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-200 flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span className="break-words">{saveError}</span>
                </div>
            )}
            <div className="flex-1 min-h-0">
                {Monaco && !monacoFailed ? (
                    <Monaco
                        height="100%"
                        defaultLanguage="json"
                        value={text}
                        onChange={(v) => editing && onChange(v ?? '')}
                        options={{
                            readOnly: !editing,
                            minimap: { enabled: false },
                            fontSize: 12,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            renderLineHighlight: 'gutter',
                            domReadOnly: !editing,
                        }}
                        theme="vs-dark"
                    />
                ) : editing ? (
                    <textarea
                        value={text}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-full w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-xs p-4 outline-none border-0 resize-none"
                        spellCheck={false}
                    />
                ) : (
                    <pre className="h-full overflow-auto bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-xs p-4 whitespace-pre-wrap break-words">
                        {text}
                    </pre>
                )}
            </div>
        </div>
    );
}
