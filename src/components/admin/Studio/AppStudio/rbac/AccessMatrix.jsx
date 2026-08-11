import { Check, LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import useAppRoles from './useAppRoles';
import EmptyState from '../../../../shared/EmptyState';
import { getComponentEntry } from '../runtime/componentRegistry';
import { getVisibleToRoles, setVisibleToRoles } from '../state/definitionOps';

/**
 * AccessMatrix — the "who sees what" grid: screens + their top-level components
 * down the side, roles across the top. A checked cell means that role can see
 * that screen/component; toggling writes screen/node.visibleToRoles into the
 * DEFINITION via onCommit + setVisibleToRoles.
 *
 * Gate semantics mirror the schema: an EMPTY visibleToRoles means "everyone"
 * (all cells checked). Unchecking a role converts that into an explicit
 * allow-list of the other roles; re-checking until every role is covered
 * normalises back to "everyone" (empty). Clearing the LAST role means "nobody",
 * which an empty list cannot express — that writes the NOBODY sentinel, a key
 * no viewer's role can ever equal (role keys start with a lowercase letter), so
 * roleAllows() matches no one. This is PRESENTATIONAL — the real boundary is
 * row-level security on the data, enforced server-side.
 */

const NOBODY = '__nobody__';

function nodeLabel(node) {
    const entry = getComponentEntry(node.type);
    const props = node.props || {};
    const text = props.label || props.title || props.text || props.heading;
    const base = entry?.label || node.type;
    if (typeof text === 'string' && text.trim()) return `${base} · ${text.trim().slice(0, 24)}`;
    return base;
}

function buildItems(def) {
    const items = [];
    for (const screen of def?.screens || []) {
        items.push({ id: screen.id, kind: 'screen', label: screen.name || 'Screen', depth: 0 });
        for (const section of screen.sections || []) {
            for (const node of section.children || []) {
                items.push({ id: node.id, kind: 'node', label: nodeLabel(node), depth: 1 });
            }
        }
    }
    return items;
}

export default function AccessMatrix({ appId, definition = null, onCommit = null }) {
    const { roles } = useAppRoles(appId);
    const roleKeys = useMemo(() => roles.map((r) => r.key), [roles]);
    const items = useMemo(() => buildItems(definition), [definition]);

    const isChecked = (itemId, roleKey) => {
        const gate = getVisibleToRoles(definition, itemId);
        return gate.length === 0 || gate.includes(roleKey);
    };

    const hiddenFromAll = (itemId) => {
        const gate = getVisibleToRoles(definition, itemId);
        return gate.length > 0 && gate.every((k) => k === NOBODY);
    };

    const toggle = (itemId, roleKey) => {
        if (!onCommit || !definition) return;
        const gate = getVisibleToRoles(definition, itemId);
        const allowed = gate.filter((k) => k !== NOBODY);
        const next = new Set(gate.length === 0 ? roleKeys : allowed);
        if (gate.length === 0) next.delete(roleKey); // was "everyone" → drop this role
        else if (next.has(roleKey)) next.delete(roleKey);
        else next.add(roleKey);
        let keys = [...next];
        // Covering every role == no restriction — normalise to "everyone".
        if (roleKeys.length && roleKeys.every((k) => next.has(k))) keys = [];
        else if (keys.length === 0) keys = [NOBODY]; // cleared every role == nobody
        const nextDef = setVisibleToRoles(definition, itemId, keys);
        if (nextDef !== definition) onCommit(nextDef);
    };

    if (!definition) return null;
    if (roleKeys.length === 0) {
        return (
            <EmptyState
                icon={<LayoutGrid className="h-8 w-8" aria-hidden="true" />}
                title="No roles yet"
                description="Create roles on the Roles tab first — then you can choose which screens and components each role sees here."
            />
        );
    }

    return (
        <div data-testid="access-matrix" className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                A checked cell means that role can see the screen or component. Cleared cells hide it from that role,
                and clearing every role hides it from everyone. This is a preview aid — data access is always enforced
                by row-level security.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-10 px-2 py-2 text-left text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                Screen / component
                            </th>
                            {roles.map((r) => (
                                <th key={r.key} className="px-3 py-2 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                    {r.label || r.key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <td
                                    className="sticky left-0 z-10 px-2 py-1.5"
                                    style={{ background: 'var(--bg-secondary)', paddingLeft: item.depth ? '1.25rem' : '0.5rem' }}
                                >
                                    <span
                                        className="truncate"
                                        style={{ color: item.kind === 'screen' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: item.kind === 'screen' ? 600 : 400 }}
                                    >
                                        {item.label}
                                    </span>
                                    {hiddenFromAll(item.id) ? (
                                        <span className="ml-2 text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>
                                            Hidden from everyone
                                        </span>
                                    ) : null}
                                </td>
                                {roles.map((r) => {
                                    const checked = isChecked(item.id, r.key);
                                    return (
                                        <td key={r.key} className="px-3 py-1.5 text-center">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={checked}
                                                aria-label={`${item.label} visible to ${r.label || r.key}`}
                                                onClick={() => toggle(item.id, r.key)}
                                                className="inline-flex h-5 w-5 items-center justify-center rounded border transition-colors"
                                                style={checked
                                                    ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#fff' }
                                                    : { background: 'transparent', borderColor: 'var(--border-default)', color: 'transparent' }}
                                            >
                                                <Check className="h-3.5 w-3.5" aria-hidden="true" style={{ opacity: checked ? 1 : 0 }} />
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
