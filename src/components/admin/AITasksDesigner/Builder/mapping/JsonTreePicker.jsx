import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { previewValue, walkRelativePath } from '../../../../../utils/bindingHelpers';

/**
 * JsonTreePicker — a recursive, arbitrary-depth JSON tree whose rows emit
 * RELATIVE extraction paths (the parse_json field-path dialect resolved by
 * walkRelativePath on both client and server). Deliberately NOT built on
 * upstream.js sampleToFields, which stops at one level — this picker exists
 * so users can click into deeply nested payloads.
 *
 * Path building mirrors the server tokenizer's quoting rules:
 *   - identifier-safe object key      → `.key`
 *   - anything else                   → `["key"]` (or `['key']` when the key
 *                                       itself contains a double quote — the
 *                                       tokenizer accepts both, but supports
 *                                       no escapes)
 *   - array element                   → `[0]` or, when the array's toggle is
 *                                       set to "each item", `[*]` (flatten)
 * Root arrays are supported: paths then START with `[0]`/`[*]`.
 *
 * Props: { value, onPick(path), maxDepth = 20, maxChildren = 200 }
 */
const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function joinKeyPath(prefix, key) {
    const seg = IDENT_RE.test(key)
        ? (prefix ? `.${key}` : key)
        : (key.includes('"') ? `['${key}']` : `["${key}"]`);
    return `${prefix}${seg}`;
}

// The tokenizer supports no escapes, so some keys (containing `]`, or both
// quote styles at once) cannot be expressed as a path at all. Probe the real
// resolver instead of duplicating its parsing rules: a key is pickable only
// if a path built from it round-trips to the probe value.
const PROBE = {};
function keyPickable(key) {
    if (IDENT_RE.test(key)) return true;
    try { return walkRelativePath(joinKeyPath('', key), { [key]: PROBE }) === PROBE; }
    catch { return false; }
}

export default function JsonTreePicker({ value, onPick, maxDepth = 20, maxChildren = 200 }) {
    if (value === null || typeof value !== 'object') {
        return (
            <div className="text-[11px] italic text-[var(--text-tertiary)]">
                No object or list to pick from.
            </div>
        );
    }
    return (
        <div className="text-xs max-h-64 overflow-auto rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-1.5">
            <Children value={value} path="" depth={0} onPick={onPick} maxDepth={maxDepth} maxChildren={maxChildren} />
        </div>
    );
}

/** Rows for the members of one object/array value. */
function Children({ value, path, depth, onPick, maxDepth, maxChildren, pickable = true }) {
    // One toggle per ARRAY node: pick from the first item ([0]) or from each
    // item ([*], flattens). The first element's subtree is rendered once —
    // the toggle only changes which index the emitted paths carry.
    const [each, setEach] = useState(false);

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <div className="pl-5 text-[11px] italic text-[var(--text-tertiary)]">empty list</div>;
        }
        const idx = each ? '*' : '0';
        const chip = (label, isEach) => (
            <button
                type="button"
                onClick={() => setEach(isEach)}
                className={`px-1.5 py-0.5 rounded-full border text-[10px] transition ${each === isEach
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
                    : 'text-[var(--text-tertiary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'}`}
            >
                {label}
            </button>
        );
        return (
            <>
                <div className="flex items-center gap-1 py-0.5 pl-5">
                    {chip('first item', false)}
                    {chip('each item', true)}
                </div>
                <TreeNode
                    nodeKey={`[${idx}]`}
                    value={value[0]}
                    path={`${path}[${idx}]`}
                    pickable={pickable}
                    depth={depth}
                    onPick={onPick}
                    maxDepth={maxDepth}
                    maxChildren={maxChildren}
                />
            </>
        );
    }

    const entries = Object.entries(value);
    const shown = entries.slice(0, maxChildren);
    return (
        <>
            {shown.map(([k, v]) => (
                <TreeNode
                    key={k}
                    nodeKey={k}
                    value={v}
                    path={joinKeyPath(path, k)}
                    pickable={pickable && keyPickable(k)}
                    depth={depth}
                    onPick={onPick}
                    maxDepth={maxDepth}
                    maxChildren={maxChildren}
                />
            ))}
            {entries.length > maxChildren && (
                <div className="pl-5 text-[11px] italic text-[var(--text-tertiary)]">
                    … {entries.length - maxChildren} more
                </div>
            )}
        </>
    );
}

function TreeNode({ nodeKey, value, path, depth, onPick, maxDepth, maxChildren, pickable = true }) {
    const isObj = value !== null && typeof value === 'object';
    const hasChildren = isObj
        && depth < maxDepth
        && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
    // Collapsed by default beyond depth 2 so huge payloads open readable.
    const [open, setOpen] = useState(depth < 2);

    return (
        <div>
            <div className="flex items-center gap-0.5">
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        aria-label={`Toggle ${nodeKey}`}
                        className="shrink-0 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                ) : (
                    <span className="shrink-0 w-[17px]" />
                )}
                {pickable ? (
                    <button
                        type="button"
                        onClick={() => onPick(path)}
                        title={path}
                        className="flex-1 min-w-0 flex items-baseline gap-2 px-1 py-0.5 rounded text-left hover:bg-[var(--bg-secondary)] transition"
                    >
                        <span className="font-mono text-[var(--text-primary)] truncate">{nodeKey}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] truncate">{previewValue(value, 40)}</span>
                    </button>
                ) : (
                    <span
                        title="This key contains characters a field path cannot express — copy the value manually instead."
                        className="flex-1 min-w-0 flex items-baseline gap-2 px-1 py-0.5 rounded text-left opacity-60 cursor-not-allowed"
                    >
                        <span className="font-mono text-[var(--text-primary)] truncate">{nodeKey}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] truncate">{previewValue(value, 40)}</span>
                    </span>
                )}
            </div>
            {hasChildren && open && (
                <div className="pl-3 ml-1.5 border-l border-[var(--border-default)]">
                    <Children
                        value={value}
                        path={path}
                        pickable={pickable}
                        depth={depth + 1}
                        onPick={onPick}
                        maxDepth={maxDepth}
                        maxChildren={maxChildren}
                    />
                </div>
            )}
        </div>
    );
}
