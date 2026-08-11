import React, { useState } from 'react';
import { controlSurfaceClass, CONTROL_BORDER_STRONG, FOCUS_RING } from '../../../../AITasksDesigner/Builder/flow/settings/formStyles';
import AppIcon from '../../../../../AppIcon';
import FormField from '../../../../../shared/FormField';
import IconPicker from '../../../../ProductWebsite/controls/IconPicker';
import useAppTables, { fieldsForTable } from '../../bi/useAppTables';
import { useEditorChrome } from '../../editor/EditorChromeContext';
import { updateNodeProps } from '../../state/definitionOps';

/**
 * App Studio inspector — tiny shared field kit for the per-type Content
 * panels. Keeps every panel on the same input idiom (house classes over the
 * platform CSS vars) instead of re-rolling ad-hoc inputs per file.
 *
 * All fields are controlled and commit on every change — the definition ops
 * upstream no-op identical patches and the shell coalesces history.
 */

/**
 * Returns a `patch(propsDelta)` that commits an updated definition via
 * `onCommit`, skipping no-op patches (updateNodeProps returns the same
 * reference when nothing changed). Shared by every inspector panel.
 */
export function usePatch(node, definition, onCommit) {
    return (p) => {
        const next = updateNodeProps(definition, node.id, p);
        if (next !== definition) onCommit(next);
    };
}

/**
 * The one control surface for the whole inspector.
 *
 * It used to roll its own: a --border-default edge (1.35:1 against the fill in
 * the default dark theme — under the 3:1 SC 1.4.11 asks) and, for focus, a
 * border-colour change to --accent-primary, which is #9ca3af, a neutral grey,
 * and measures 2.43:1 on the light panel. So the resting edge was nearly
 * invisible and the focus indicator failed outright.
 *
 * Both are the routine builder's measured problems too, and it already solved
 * them — formStyles is deliberately React-free so this file can share it. The
 * name stays INPUT_CLS: a dozen call sites speak it.
 */
export const INPUT_CLS = controlSurfaceClass(
    'w-full px-3 py-2 text-sm placeholder:text-[var(--text-muted)] '
    + 'disabled:opacity-50 disabled:cursor-not-allowed',
    { strongBorder: true },
);

export function TextField({ label, value, onChange, placeholder, hint, disabled = false, type = 'text' }) {
    return (
        <FormField label={label} hint={hint}>
            <input
                type={type}
                className={INPUT_CLS}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                spellCheck={false}
            />
        </FormField>
    );
}

export function TextAreaField({ label, value, onChange, placeholder, hint, rows = 3, disabled = false }) {
    return (
        <FormField label={label} hint={hint}>
            <textarea
                className={`${INPUT_CLS} resize-y`}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
            />
        </FormField>
    );
}

/** Numeric field; an empty input commits null (the "unset" prop value). */
export function NumberField({ label, value, onChange, placeholder, hint, disabled = false, step }) {
    return (
        <FormField label={label} hint={hint}>
            <input
                type="number"
                className={INPUT_CLS}
                value={value ?? ''}
                step={step}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { onChange(null); return; }
                    const n = Number(raw);
                    onChange(Number.isFinite(n) ? n : null);
                }}
                placeholder={placeholder}
                disabled={disabled}
            />
        </FormField>
    );
}

/**
 * Icon field. The preview doubles as a button opening the shared IconPicker
 * (the CMS one — searchable, grouped, with its own "any Lucide name" row), so
 * the value is discoverable; the text input stays as the power-user path.
 * Both store the same PascalCase name. Empty commits null.
 */
export function IconField({ label = 'Icon', value, onChange, hint, disabled = false }) {
    const [picking, setPicking] = useState(false);
    const name = typeof label === 'string' ? label : 'Icon';
    return (
        <FormField label={label} hint={hint ?? 'Browse the icons, or type a name.'}>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPicking(true)}
                    disabled={disabled}
                    title="Browse icons…"
                    aria-label={`${name} — browse icons`}
                    className={`shrink-0 w-9 h-9 rounded-md border ${CONTROL_BORDER_STRONG} bg-[var(--bg-secondary)] inline-flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent-primary-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`}
                >
                    {value ? <AppIcon name={value} className="w-4 h-4" /> : <span className="text-xs">—</span>}
                </button>
                <input
                    type="text"
                    className={INPUT_CLS}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value.trim() || null)}
                    placeholder="Activity"
                    disabled={disabled}
                    spellCheck={false}
                />
            </div>
            {picking ? (
                <IconPicker
                    value={value || ''}
                    onSelect={(picked) => { onChange(picked); setPicking(false); }}
                    onClose={() => setPicking(false)}
                />
            ) : null}
        </FormField>
    );
}

// ── Field-name fields ──────────────────────────────────────────────────────

const TYPE_MY_OWN = '__own';

/** Field names visible in a static source value (the first rows decide). */
function staticSourceKeys(source) {
    const rows = source && source.kind === 'static' ? source.value : source;
    if (!Array.isArray(rows)) return [];
    const out = [];
    for (const row of rows.slice(0, 5)) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        for (const k of Object.keys(row)) if (!out.includes(k)) out.push(k);
    }
    return out;
}

function FieldKeyInput({ label, value, onChange, keys, placeholder, hint, ariaLabel, disabled }) {
    const [typing, setTyping] = useState(false);
    // A value the source doesn't know about is already a typed-in name.
    const showText = !keys.length || typing || (!!value && !keys.includes(value));
    return (
        <FormField label={label} hint={hint}>
            <div className="flex flex-col gap-2">
                {keys.length ? (
                    <select
                        className={INPUT_CLS}
                        value={showText ? TYPE_MY_OWN : (value || '')}
                        onChange={(e) => {
                            if (e.target.value === TYPE_MY_OWN) { setTyping(true); return; }
                            setTyping(false);
                            onChange(e.target.value);
                        }}
                        disabled={disabled}
                        aria-label={ariaLabel}
                    >
                        <option value="">Pick a field…</option>
                        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
                        <option value={TYPE_MY_OWN}>Type a name myself…</option>
                    </select>
                ) : null}
                {showText ? (
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        spellCheck={false}
                        aria-label={`${ariaLabel} name`}
                    />
                ) : null}
            </div>
        </FormField>
    );
}

function TableFieldKeyInput({ appId, tableId, fallbackKeys, ...rest }) {
    const { tables } = useAppTables(appId);
    const keys = fieldsForTable(tables, tableId).map((f) => f.key).filter(Boolean);
    return <FieldKeyInput {...rest} keys={keys.length ? keys : fallbackKeys} />;
}

/**
 * FieldKeyField — one of the component's data fields, picked from a list
 * instead of remembered and retyped. `source` is the component's source
 * binding: a table binding resolves through the app's data model, a static
 * one through the rows themselves. "Type a name myself…" always reveals the
 * plain text input, which is also all that renders when nothing is detected.
 */
export function FieldKeyField({
    label = null, value, onChange, source = null,
    placeholder, hint, ariaLabel = 'Field', disabled = false,
}) {
    const chrome = useEditorChrome();
    const appId = chrome?.appId ?? null;
    const kind = source?.kind;
    const tableId = kind === 'record' || kind === 'records' ? (source.tableId || null) : null;
    const localKeys = staticSourceKeys(source);
    const shared = { label, value, onChange, placeholder, hint, ariaLabel, disabled };
    // useAppTables is a network hook: only mount it inside the editor shell,
    // which is exactly where an app id exists.
    if (appId && tableId) {
        return <TableFieldKeyInput appId={appId} tableId={tableId} fallbackKeys={localKeys} {...shared} />;
    }
    return <FieldKeyInput keys={localKeys} {...shared} />;
}
