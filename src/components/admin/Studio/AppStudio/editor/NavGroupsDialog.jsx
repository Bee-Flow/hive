import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from '../../../../shared/Modal';
import { IconField } from '../inspector/panels/kit';
import { updateNav, updateScreen } from '../state/definitionOps';

/**
 * NavGroupsDialog — "Manage navigation": edit definition.nav.groups. Groups
 * are ordered sections in the sidebar shell (and flattened after ungrouped
 * screens in tabs mode). Each group: label (≤40 chars), optional icon, and a
 * multi-select over ALL screens; a screen can live in ONE group, so a
 * checkbox claimed elsewhere is disabled with a hint naming the group.
 *
 * A screen that joins a group also gets its one-line DESCRIPTION here, because
 * this is where someone is thinking about the menu. It is the same
 * screen.description the inspector edits — the mega panel, the mobile drawer
 * and the collapsed sidebar all read it.
 *
 * Edits are local state and persist in one commit on Save (nav groups via
 * updateNav, descriptions via updateScreen) — cancelling loses nothing.
 */

const MAX_GROUPS = 10;
const MAX_LABEL = 40;
const MAX_DESCRIPTION = 120;

function newGroupId(taken) {
    let id;
    do {
        let s = '';
        while (s.length < 6) s += Math.random().toString(36).slice(2);
        id = `nvg_${s.slice(0, 6)}`;
    } while (taken.has(id));
    taken.add(id);
    return id;
}

function cloneGroups(definition) {
    const groups = Array.isArray(definition?.nav?.groups) ? definition.nav.groups : [];
    return groups.map((g) => ({
        id: g.id,
        label: g.label || '',
        icon: g.icon || null,
        screens: Array.isArray(g.screens) ? [...g.screens] : [],
    }));
}

export default function NavGroupsDialog({ open, definition, onCommit, onClose }) {
    const [groups, setGroups] = useState([]);
    const [descriptions, setDescriptions] = useState({});

    // Re-seed the working copy each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setGroups(cloneGroups(definition));
        const seeded = {};
        for (const s of definition?.screens || []) seeded[s.id] = s.description || '';
        setDescriptions(seeded);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const screens = definition?.screens || [];

    const patchGroup = (id, patch) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    };

    const toggleScreen = (groupId, screenId, checked) => {
        setGroups((prev) => prev.map((g) => {
            if (g.id !== groupId) return g;
            const screens_ = g.screens.filter((s) => s !== screenId);
            return { ...g, screens: checked ? [...screens_, screenId] : screens_ };
        }));
    };

    const addGroup = () => {
        setGroups((prev) => {
            if (prev.length >= MAX_GROUPS) return prev;
            const taken = new Set(prev.map((g) => g.id));
            return [...prev, {
                id: newGroupId(taken),
                label: `Group ${prev.length + 1}`,
                icon: null,
                screens: [],
            }];
        });
    };

    const removeGroup = (id) => {
        setGroups((prev) => prev.filter((g) => g.id !== id));
    };

    const save = () => {
        // Blank labels would be dropped by the server canonicalizer — keep the
        // group alive with a placeholder instead of silently losing it.
        const cleaned = groups.map((g, i) => ({
            ...g,
            label: (g.label || '').trim().slice(0, MAX_LABEL) || `Group ${i + 1}`,
        }));
        let next = updateNav(definition, { groups: cleaned });
        // One commit for the whole dialog: groups and the descriptions written
        // beside them. updateScreen is a no-op when nothing changed, so a save
        // that only touched groups still produces a single new definition.
        for (const screen of definition?.screens || []) {
            const typed = (descriptions[screen.id] || '').trim().slice(0, MAX_DESCRIPTION);
            const current = screen.description || '';
            if (typed !== current) next = updateScreen(next, screen.id, { description: typed || null });
        }
        if (next !== definition) onCommit?.(next);
        onClose();
    };

    // screenId → owning group (for the one-group-per-screen hint).
    const owner = new Map();
    for (const g of groups) {
        for (const sid of g.screens) {
            if (!owner.has(sid)) owner.set(sid, g);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Manage navigation"
            description="Group screens into sections. Grouped screens appear under their section in the sidebar; the tab bar shows them after the ungrouped ones."
            size="lg"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] bg-white/5 hover:bg-[var(--bg-card-hover)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent-primary)] hover:opacity-90"
                    >
                        Save
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {groups.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No groups yet. Ungrouped screens are listed directly; add a group to
                        collect screens under a section label.
                    </p>
                ) : null}

                {groups.map((group) => (
                    <div
                        key={group.id}
                        className="rounded-lg border p-3 flex flex-col gap-3"
                        style={{ borderColor: 'var(--border-default)' }}
                        data-nav-group-editor={group.id}
                    >
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <input
                                    value={group.label}
                                    maxLength={MAX_LABEL}
                                    onChange={(e) => patchGroup(group.id, { label: e.target.value })}
                                    aria-label="Group label"
                                    placeholder="Group label"
                                    className="w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] focus:border-[var(--accent-primary)]"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeGroup(group.id)}
                                aria-label={`Delete group ${group.label || 'Group'}`}
                                title="Delete group"
                                className="p-2 rounded-md hover:bg-[var(--bg-card-hover)] shrink-0"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <IconField
                            label="Icon"
                            value={group.icon}
                            onChange={(v) => patchGroup(group.id, { icon: v || null })}
                        />

                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                Screens in this group
                            </span>
                            {screens.map((screen) => {
                                const owning = owner.get(screen.id);
                                const claimedElsewhere = owning && owning.id !== group.id;
                                const included = group.screens.includes(screen.id);
                                return (
                                    <div key={screen.id}>
                                        <label
                                            className={`flex items-center gap-2 text-sm px-1 py-0.5 rounded ${claimedElsewhere ? 'opacity-50' : ''}`}
                                            style={{ color: 'var(--text-primary)' }}
                                            title={claimedElsewhere ? `Already in "${owning.label || 'another group'}" — a screen can be in one group.` : undefined}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={included}
                                                disabled={claimedElsewhere}
                                                onChange={(e) => toggleScreen(group.id, screen.id, e.target.checked)}
                                                aria-label={`${screen.name || 'Screen'} in ${group.label || 'group'}`}
                                            />
                                            <span className="truncate">{screen.name || 'Screen'}</span>
                                            {screen.showInNav === false ? (
                                                <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                                    hidden
                                                </span>
                                            ) : null}
                                        </label>
                                        {included ? (
                                            <input
                                                value={descriptions[screen.id] || ''}
                                                maxLength={MAX_DESCRIPTION}
                                                onChange={(e) => setDescriptions((prev) => ({ ...prev, [screen.id]: e.target.value }))}
                                                aria-label={`Menu description for ${screen.name || 'screen'}`}
                                                placeholder="One line: what this screen is for"
                                                className="ml-6 mt-0.5 mb-1 w-[calc(100%-1.5rem)] px-2 py-1 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] focus:border-[var(--accent-primary)]"
                                            />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addGroup}
                    disabled={groups.length >= MAX_GROUPS}
                    className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-md border text-sm hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    title={groups.length >= MAX_GROUPS ? `At most ${MAX_GROUPS} groups` : undefined}
                >
                    <Plus className="w-4 h-4" /> Add group
                </button>
            </div>
        </Modal>
    );
}
