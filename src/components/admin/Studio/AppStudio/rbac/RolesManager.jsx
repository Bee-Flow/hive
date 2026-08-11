import { Loader2, Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import useAppRoles, { useOrgDirectory } from './useAppRoles';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import toast from '../../../../shared/Toast';
import { setDefinitionRoles } from '../state/definitionOps';

/**
 * RolesManager — CRUD the per-app roles and decide who lands in each one.
 *
 * Three levers, mirroring the server's viewer-role resolution order:
 *   1. Roles          — the app's role vocabulary ({ key, label }).
 *   2. Default + group — model.roleMapping: a fallback role for everyone, and
 *                        org GROUP → role overrides.
 *   3. Members         — specific USER → role assignments (highest precedence).
 *
 * Roles + mapping are staged locally and persisted together (one whole-model
 * PUT); member add/remove hit their own endpoint immediately. Saving also
 * mirrors the roles into def.roles via onCommit so screen/node role references
 * resolve. Row security is server-enforced — this only decides identities.
 */

// The "No access" choice of the default-role select. The server reads a BLANK
// roleMapping.default as "no role at all" (rlsGateway resolveViewerRole → null
// → no data), so '' is what we persist; this sentinel only keeps the choice
// distinguishable from an unset value in local state. A real role key can never
// collide with it (keys must start with a lowercase letter).
const NO_ACCESS = '__none__';

function slugifyRoleKey(input) {
    let s = String(input || '').toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 63);
    if (!s || !/^[a-z]/.test(s)) s = `role_${s}`.replace(/_+$/g, '').slice(0, 63);
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(s)) s = `role_${Math.random().toString(36).slice(2, 8)}`;
    return s;
}

function uniqueRoleKey(base, taken) {
    let key = base;
    let n = 2;
    while (taken.has(key)) key = `${base}_${n++}`.slice(0, 63);
    return key;
}

/**
 * What a viewer holding `roleKey` may do with one table — mirrors the server's
 * scope resolution (rlsGateway resolveScope: an explicit access.roles entry
 * wins, otherwise the table's access.default) so the summary below can never
 * promise more than the gateway allows.
 */
function tableScopeFor(table, roleKey) {
    const access = (table && typeof table.access === 'object' && table.access) ? table.access : {};
    const entry = (access.roles && typeof access.roles === 'object') ? access.roles[roleKey] : null;
    if (entry && typeof entry === 'object' && typeof entry.read === 'string') {
        return { read: entry.read, create: entry.create === true || entry.create === 'all' || entry.create === 'own' };
    }
    if (access.default === 'app') return { read: 'all', create: true };
    if (access.default === 'owner') return { read: 'own', create: true };
    return { read: 'none', create: false };
}

function accessPhrase(scope) {
    if (scope.read === 'none') return null;
    if (scope.read === 'own') return scope.create ? 'add and see only their own rows in' : 'see only their own rows in';
    return scope.create ? 'see, add and edit rows in' : 'see rows in';
}

function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Plain-language tail describing what `roleKey` (null = no role) can do. */
function describeRoleAccess(roleKey, tables) {
    if (!roleKey) return 'cannot open any of this app’s data';
    if (!tables.length) return 'can open this app — there is no data to protect yet';
    const byPhrase = new Map();
    for (const t of tables) {
        const phrase = accessPhrase(tableScopeFor(t, roleKey));
        if (!phrase) continue;
        byPhrase.set(phrase, [...(byPhrase.get(phrase) || []), t.name || t.key || t.id]);
    }
    if (!byPhrase.size) return 'cannot open any of this app’s data';
    return [...byPhrase].map(([phrase, names]) => `can ${phrase} ${joinNames(names)}`).join(', and ');
}

/** The live consequence of the current default choice, in one sentence. */
function defaultConsequence(defaultKey, roles, tables) {
    if (defaultKey === NO_ACCESS) {
        return `Right now: only the groups and people you set below can open this app — everyone else ${describeRoleAccess(null, tables)}.`;
    }
    if (defaultKey === 'app') {
        return `Right now: everyone in your organisation who opens this app ${describeRoleAccess('app', tables)}.`;
    }
    const label = roles.find((r) => r.key === defaultKey)?.label || defaultKey;
    return `Right now: everyone without a role of their own counts as “${label}” and ${describeRoleAccess(defaultKey, tables)}.`;
}

export default function RolesManager({ appId, definition = null, onCommit = null, onDirtyChange = null }) {
    const {
        roles, roleMapping, members, tables = [], isLoading, hasModel,
        saveRoles, assignMember, removeMember, savingRoles, savingMember,
    } = useAppRoles(appId);
    const directory = useOrgDirectory(!!appId);

    // ---- staged roles + mapping (persisted together) -----------------------
    const [draftRoles, setDraftRoles] = useState([]);
    const [draftDefault, setDraftDefault] = useState('app');
    const [draftByGroup, setDraftByGroup] = useState({});
    const [dirty, setDirty] = useState(false);
    const [retiredKeys, setRetiredKeys] = useState(() => new Set());
    const [pendingDelete, setPendingDelete] = useState(null);
    const seededRef = useRef(false);

    // Seed from the server model once it arrives; re-seed after a clean save.
    useEffect(() => {
        if (seededRef.current || isLoading) return;
        seededRef.current = true;
        setDraftRoles(roles.map((r) => ({ key: r.key, label: r.label || r.key })));
        setDraftDefault(typeof roleMapping.default === 'string' ? (roleMapping.default || NO_ACCESS) : 'app');
        setDraftByGroup(roleMapping.byGroup && typeof roleMapping.byGroup === 'object' ? { ...roleMapping.byGroup } : {});
    }, [isLoading, roles, roleMapping]);

    // The host (the Roles & access tabs) blocks closing while there is unsaved work.
    const dirtyChangeRef = useRef(onDirtyChange);
    useEffect(() => { dirtyChangeRef.current = onDirtyChange; });
    useEffect(() => { dirtyChangeRef.current?.(dirty); }, [dirty]);
    useEffect(() => () => dirtyChangeRef.current?.(false), []);

    const takenKeys = useMemo(() => new Set(draftRoles.map((r) => r.key)), [draftRoles]);

    // Keys are never recycled: a deleted role's row rules (data model) and its
    // member rows (membership table) survive on the server, so a new role that
    // reused the key would silently inherit them.
    const reservedKeys = useMemo(() => {
        const s = new Set([...takenKeys, ...retiredKeys]);
        for (const m of members) {
            const k = m.roleKey || m.role_key;
            if (k) s.add(k);
        }
        for (const t of tables) {
            const access = (t && typeof t.access === 'object' && t.access) ? t.access : {};
            for (const k of Object.keys(access.roles || {})) s.add(k);
            for (const k of Object.keys(access.rowFilters || {})) s.add(k);
        }
        return s;
    }, [takenKeys, retiredKeys, members, tables]);

    const addRole = () => {
        const base = uniqueRoleKey('role', reservedKeys);
        setDraftRoles((prev) => [...prev, { key: base, label: 'New role' }]);
        setDirty(true);
    };

    const renameRole = (key, label) => {
        setDraftRoles((prev) => prev.map((r) => (r.key === key ? { ...r, label } : r)));
        setDirty(true);
    };

    const roleUsage = (key) => ({
        key,
        groupNames: directory.groups.filter((g) => draftByGroup[g.id] === key).map((g) => g.name || g.id),
        isDefault: draftDefault === key,
    });

    // Removing a role must never hand anyone MORE than they have today: the
    // default falls back to "No access", never to full access.
    const applyDeleteRole = (key) => {
        setDraftRoles((prev) => prev.filter((r) => r.key !== key));
        setDraftByGroup((prev) => {
            const next = { ...prev };
            for (const g of Object.keys(next)) if (next[g] === key) delete next[g];
            return next;
        });
        if (draftDefault === key) setDraftDefault(NO_ACCESS);
        setRetiredKeys((prev) => new Set([...prev, key]));
        setDirty(true);
    };

    const deleteRole = (key) => {
        const usage = roleUsage(key);
        if (!usage.groupNames.length && !usage.isDefault) { applyDeleteRole(key); return; }
        setPendingDelete(usage);
    };

    const setGroupRole = (groupId, roleKey) => {
        setDraftByGroup((prev) => {
            const next = { ...prev };
            if (!roleKey) delete next[groupId]; else next[groupId] = roleKey;
            return next;
        });
        setDirty(true);
    };

    const doSave = async () => {
        // Re-key blank labels; every role needs a valid, unique key already.
        const cleaned = draftRoles.map((r) => ({ key: r.key, label: (r.label || '').trim() || r.key }));
        const mapping = { default: draftDefault === NO_ACCESS ? '' : draftDefault, byGroup: draftByGroup };
        try {
            await saveRoles(cleaned, mapping);
            if (onCommit && definition) {
                const next = setDefinitionRoles(definition, cleaned);
                if (next !== definition) onCommit(next);
            }
            setDirty(false);
            toast.success('Roles saved.');
        } catch (err) {
            toast.error(err?.message || 'Could not save roles.');
        }
    };

    // ---- member add form ----------------------------------------------------
    const [newMemberUser, setNewMemberUser] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('');
    useEffect(() => {
        if (!newMemberRole && draftRoles.length) setNewMemberRole(draftRoles[0].key);
    }, [draftRoles, newMemberRole]);

    // Only roles the server already knows can take members — assigning a
    // freshly added, unsaved role answers 422 invalid_role.
    const savedRoleKeys = useMemo(() => new Set([...roles.map((r) => r.key), 'member']), [roles]);
    const memberRoleUnsaved = !!newMemberRole && !savedRoleKeys.has(newMemberRole);
    const memberRoleLabel = draftRoles.find((r) => r.key === newMemberRole)?.label || newMemberRole;

    const doAddMember = async () => {
        const userId = newMemberUser.trim();
        if (!userId || !newMemberRole || memberRoleUnsaved) return;
        try {
            await assignMember(userId, newMemberRole);
            setNewMemberUser('');
            toast.success('Member assigned.');
        } catch (err) {
            const unknownRole = err?.message === 'invalid_role';
            toast.error(unknownRole
                ? 'That role isn’t saved yet — save your roles first, then assign people.'
                : (err?.message || 'Could not assign member.'));
        }
    };

    const userLabel = (userId) => {
        const u = directory.users.find((x) => x.id === userId);
        return u ? (u.displayName || u.username || u.email || u.id) : userId;
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading roles…
            </div>
        );
    }

    const roleOptions = draftRoles;

    return (
        <div className="flex flex-col gap-6" data-testid="roles-manager">
            {!hasModel ? (
                <p
                    className="rounded-md border border-dashed px-3 py-2 text-xs"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
                >
                    This app has no data yet. Roles you create here are saved with the app&rsquo;s data model and take
                    effect as soon as you add tables.
                </p>
            ) : null}

            {/* ── Roles ─────────────────────────────────────────────── */}
            <section className="flex flex-col gap-2">
                <SectionHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} title="Roles">
                    <button
                        type="button"
                        onClick={addRole}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        <Plus className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                        Add role
                    </button>
                </SectionHeader>

                {draftRoles.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        No roles yet. Everyone gets the default access below.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {draftRoles.map((r) => (
                            <li key={r.key} className="flex items-center gap-2">
                                <input
                                    value={r.label}
                                    onChange={(e) => renameRole(r.key, e.target.value)}
                                    aria-label={`Role name (${r.key})`}
                                    className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                <code className="shrink-0 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{r.key}</code>
                                <button
                                    type="button"
                                    onClick={() => deleteRole(r.key)}
                                    aria-label={`Delete role ${r.label || r.key}`}
                                    className="shrink-0 rounded p-1 hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* ── Who gets which role ───────────────────────────────── */}
            <section className="flex flex-col gap-3">
                <SectionHeader icon={<Users className="h-4 w-4" aria-hidden="true" />} title="Who gets which role" />

                <label className="flex items-center justify-between gap-3 text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Default role (everyone else)</span>
                    <select
                        value={draftDefault}
                        onChange={(e) => { setDraftDefault(e.target.value); setDirty(true); }}
                        aria-label="Default role"
                        className="rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        <option value="app">App default (full access)</option>
                        <option value={NO_ACCESS}>No access</option>
                        {roleOptions.map((r) => <option key={r.key} value={r.key}>{r.label || r.key}</option>)}
                    </select>
                </label>
                <p className="-mt-1.5 text-xs" data-testid="default-access-consequence" style={{ color: 'var(--text-tertiary)' }}>
                    {defaultConsequence(draftDefault, draftRoles, tables)}
                </p>

                <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Organisation groups</div>
                    {directory.groups.length === 0 ? (
                        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                            {directory.available
                                ? 'Your organisation has no groups yet — create them in Organisation settings.'
                                : 'Group mapping needs organisation-admin access; assign specific people below instead.'}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {directory.groups.map((g) => (
                                <li key={g.id} className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{g.name || g.id}</span>
                                    <select
                                        value={draftByGroup[g.id] || ''}
                                        onChange={(e) => setGroupRole(g.id, e.target.value)}
                                        aria-label={`Role for group ${g.name || g.id}`}
                                        className="shrink-0 rounded border px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">— no override —</option>
                                        {roleOptions.map((r) => <option key={r.key} value={r.key}>{r.label || r.key}</option>)}
                                    </select>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={doSave}
                        disabled={!dirty || savingRoles}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {savingRoles ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        {dirty ? 'Save roles' : 'Saved'}
                    </button>
                </div>
            </section>

            {/* ── Members (specific people) ─────────────────────────── */}
            <section className="flex flex-col gap-2">
                <SectionHeader icon={<UserPlus className="h-4 w-4" aria-hidden="true" />} title="Assigned people" />

                {members.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No one is assigned directly yet.</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {members.map((m) => (
                            <li key={m.userId || m.user_id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate" style={{ color: 'var(--text-primary)' }}>{userLabel(m.userId || m.user_id)}</span>
                                <span className="flex items-center gap-2">
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                        style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)' }}
                                    >
                                        {m.roleKey || m.role_key}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeMember(m.userId || m.user_id)}
                                        aria-label={`Remove ${userLabel(m.userId || m.user_id)}`}
                                        className="rounded p-1 hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex items-center gap-2 pt-1">
                    {directory.users.length ? (
                        <select
                            value={newMemberUser}
                            onChange={(e) => setNewMemberUser(e.target.value)}
                            aria-label="Person to assign"
                            className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <option value="">Choose a person…</option>
                            {directory.users.map((u) => (
                                <option key={u.id} value={u.id}>{u.displayName || u.username || u.email || u.id}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            value={newMemberUser}
                            onChange={(e) => setNewMemberUser(e.target.value)}
                            placeholder="User id"
                            aria-label="User id to assign"
                            className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    )}
                    <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        aria-label="Role to assign"
                        disabled={!roleOptions.length}
                        className="rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] disabled:opacity-50"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        {roleOptions.length === 0 ? <option value="">No roles</option>
                            : roleOptions.map((r) => <option key={r.key} value={r.key}>{r.label || r.key}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={doAddMember}
                        disabled={!newMemberUser.trim() || !newMemberRole || memberRoleUnsaved || savingMember}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        {savingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                        Assign
                    </button>
                </div>
                {roleOptions.length === 0 ? (
                    <p className="text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>Add a role above before assigning people.</p>
                ) : null}
                {memberRoleUnsaved ? (
                    <p className="text-[11px]" data-testid="member-role-unsaved" style={{ color: 'var(--text-tertiary)' }}>
                        Save your roles first — &ldquo;{memberRoleLabel}&rdquo; is not saved yet, so nobody can be put in it.
                    </p>
                ) : null}
            </section>

            <ConfirmDialog
                open={!!pendingDelete}
                title={`Delete “${draftRoles.find((r) => r.key === pendingDelete?.key)?.label || pendingDelete?.key}”?`}
                description={pendingDelete ? deleteConsequence(pendingDelete, tables) : ''}
                confirmLabel="Delete role"
                cancelLabel="Keep it"
                destructive
                onConfirm={() => { applyDeleteRole(pendingDelete.key); setPendingDelete(null); }}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    );
}

/** What deleting a role in use does, spelled out before it happens. */
function deleteConsequence(usage, tables) {
    const parts = [];
    if (usage.groupNames.length) {
        parts.push(`${joinNames(usage.groupNames)} ${usage.groupNames.length === 1 ? 'gets' : 'get'} this role right now — after deleting they fall back to the default choice above.`);
    }
    if (usage.isDefault) {
        parts.push(`It is also the default for everyone else; that switches to “No access”, so they ${describeRoleAccess(null, tables)}.`);
    }
    return parts.join(' ');
}

function SectionHeader({ icon, title, children }) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{icon}</span>
                {title}
            </h3>
            {children}
        </div>
    );
}
