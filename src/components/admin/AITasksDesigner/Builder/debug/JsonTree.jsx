import { ChevronDown, ChevronRight, Copy, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

/**
 * Collapsible, searchable JSON tree with hover-revealed "copy path"
 * buttons. Designed for the step inspector's Inputs / Output sub-tabs:
 * each leaf's path is generated relative to `basePath` so it can be
 * copied straight into a downstream binding (e.g.
 * `steps.s_abc.output.results[0].subject`).
 *
 * Search filters the tree to nodes whose key or stringified value
 * matches; ancestors of any match are kept so context isn't lost.
 *
 * Props:
 *   value             — the JSON to render (any type, including null)
 *   basePath          — dotted path prefix for leaf-path generation
 *   searchable        — show the top search box (default true)
 *   onCopyPath(path)  — called when the user clicks a copy-path button
 *   maxInitialDepth   — how many container levels start expanded (default 2)
 *   emptyMessage      — what to show when value is null/undefined
 */
export default function JsonTree({
    value,
    basePath = '',
    searchable = true,
    onCopyPath,
    maxInitialDepth = 2,
    emptyMessage = 'No data yet.',
}) {
    const [query, setQuery] = useState('');
    const filterFn = useMemo(() => makeFilter(query), [query]);

    const isEmpty = value === null || value === undefined;

    return (
        <div className="flex flex-col h-full min-h-0 text-xs">
            {searchable && !isEmpty && (
                <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/30 shrink-0">
                    <Search size={11} className="text-[var(--text-tertiary)]" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search keys or values…"
                        className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar font-mono py-1">
                {isEmpty ? (
                    <div className="px-3 py-4 text-[11px] text-[var(--text-tertiary)] italic">
                        {emptyMessage}
                    </div>
                ) : (
                    <TreeNode
                        name={null}
                        value={value}
                        path={basePath}
                        depth={0}
                        maxInitialDepth={maxInitialDepth}
                        onCopyPath={onCopyPath}
                        filterFn={filterFn}
                    />
                )}
            </div>
        </div>
    );
}

function TreeNode({ name, value, path, depth, maxInitialDepth, onCopyPath, filterFn }) {
    const isObj = value && typeof value === 'object' && !Array.isArray(value);
    const isArr = Array.isArray(value);
    const isContainer = isObj || isArr;
    const [open, setOpen] = useState(depth < maxInitialDepth);

    if (filterFn && !nodeMatches(name, value, filterFn)) return null;

    const indent = depth * 12;
    const labelText = name == null ? '' : String(name);

    const copyPath = (e) => {
        e.stopPropagation();
        if (path) onCopyPath?.(path);
    };

    if (!isContainer) {
        return (
            <div
                className="group flex items-center gap-1.5 py-0.5 hover:bg-[var(--bg-secondary)]"
                style={{ paddingLeft: indent + 16, paddingRight: 8 }}
            >
                {labelText && (
                    <span className="text-[var(--text-secondary)] truncate shrink-0">
                        {labelText}:
                    </span>
                )}
                <span className={`truncate min-w-0 ${leafValueClass(value)}`} title={String(value)}>
                    {formatLeafValue(value)}
                </span>
                {path && onCopyPath && (
                    <button
                        type="button"
                        onClick={copyPath}
                        title={`Copy path: ${path}`}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                        aria-label="Copy path"
                    >
                        <Copy size={10} />
                    </button>
                )}
            </div>
        );
    }

    const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
    const summary = isArr
        ? `Array(${entries.length})`
        : `{ ${entries.length === 0 ? 'empty' : `${entries.length} key${entries.length === 1 ? '' : 's'}`} }`;

    return (
        <div>
            <div
                className="group flex items-center gap-1 py-0.5 cursor-pointer select-none hover:bg-[var(--bg-secondary)]"
                style={{ paddingLeft: indent + 2, paddingRight: 8 }}
                onClick={() => setOpen(o => !o)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(o => !o);
                    }
                }}
            >
                {open
                    ? <ChevronDown size={10} className="text-[var(--text-tertiary)] shrink-0" />
                    : <ChevronRight size={10} className="text-[var(--text-tertiary)] shrink-0" />}
                {labelText && (
                    <span className="text-[var(--text-secondary)] truncate">{labelText}:</span>
                )}
                <span className="text-[var(--text-tertiary)] truncate">{summary}</span>
                {path && onCopyPath && (
                    <button
                        type="button"
                        onClick={copyPath}
                        title={`Copy path: ${path}`}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                        aria-label="Copy path"
                    >
                        <Copy size={10} />
                    </button>
                )}
            </div>
            {open && entries.map(([k, v]) => {
                const childPath = isArr
                    ? `${path}[${k}]`
                    : (path ? `${path}.${k}` : String(k));
                return (
                    <TreeNode
                        key={k}
                        name={k}
                        value={v}
                        path={childPath}
                        depth={depth + 1}
                        maxInitialDepth={maxInitialDepth}
                        onCopyPath={onCopyPath}
                        filterFn={filterFn}
                    />
                );
            })}
        </div>
    );
}

function formatLeafValue(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return `"${v}"`;
    return String(v);
}

function leafValueClass(v) {
    if (v === null || v === undefined) return 'text-[var(--text-tertiary)]';
    if (typeof v === 'string') return 'text-emerald-700 dark:text-emerald-400';
    if (typeof v === 'number') return 'text-amber-700 dark:text-amber-400';
    if (typeof v === 'boolean') return 'text-blue-700 dark:text-blue-400';
    return 'text-[var(--text-primary)]';
}

function makeFilter(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (text) => text.toLowerCase().includes(q);
}

function nodeMatches(name, value, filterFn) {
    if (!filterFn) return true;
    if (name != null && filterFn(String(name))) return true;
    if (value === null || value === undefined) return false;
    if (typeof value === 'object') {
        const entries = Array.isArray(value)
            ? value.map((v, i) => [i, v])
            : Object.entries(value);
        return entries.some(([k, v]) => nodeMatches(k, v, filterFn));
    }
    return filterFn(String(value));
}
