import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Users, ShieldCheck, ChevronDown } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import Section from '../../../shared/Section';

/**
 * AccessTab — who in the organisation may work this inbox. Default is "everyone
 * with support access" (zero config); switching to "restricted" reveals a
 * grant-only group multi-select and a live preview of the resolved members.
 * Editable by org admins only; others see it read-only. Saves are debounced.
 */
const SAVE_DEBOUNCE_MS = 700;

export default function AccessTab({ inbox, user, onChanged }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('everyone');
    const [groupIds, setGroupIds] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [showMembers, setShowMembers] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    // Only autosave after the user actually changes something — never on load
    // (which would spam a redundant PUT + audit event every time the tab opens).
    const touched = useRef(false);

    const canEdit = !!(user?.isAdmin || user?.role === 'admin' || user?.orgRole === 'org_admin'
        || (Array.isArray(user?.permissions) && (user.permissions.includes('all') || user.permissions.includes('org_admin'))));

    const load = useCallback(async () => {
        if (!inbox) return;
        setLoading(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}/access`);
            const d = await res.json().catch(() => ({}));
            if (res.ok) {
                setMode(d.mode || 'everyone');
                setGroupIds(Array.isArray(d.sharedGroups) ? d.sharedGroups : []);
                setAvailableGroups(Array.isArray(d.availableGroups) ? d.availableGroups : []);
                setMembers(Array.isArray(d.resolvedMembers) ? d.resolvedMembers : []);
            }
        } finally { setLoading(false); }
    }, [inbox?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load]);

    const persist = useCallback(async (nextGroups) => {
        if (!inbox || !canEdit) return;
        setSaving(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}/access`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sharedGroups: nextGroups }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) { setError(d.error || t('support.access.save_failed', 'Could not save access')); return; }
            setMembers(Array.isArray(d.resolvedMembers) ? d.resolvedMembers : []);
            setMode(d.mode || (nextGroups.length ? 'groups' : 'everyone'));
            onChanged?.();
        } finally { setSaving(false); }
    }, [inbox?.id, canEdit, onChanged, t]);

    // Reset the touched guard whenever we (re)load a different inbox.
    useEffect(() => { touched.current = false; }, [inbox?.id]);

    // Debounced autosave — only after a user change, never on load.
    useEffect(() => {
        if (loading || !canEdit || !touched.current) return undefined;
        const id = setTimeout(() => { persist(mode === 'groups' ? groupIds : []); }, SAVE_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [groupIds, mode]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!inbox) return null;
    const setModeTouched = (m) => { touched.current = true; setMode(m); };
    const toggleGroup = (id) => { touched.current = true; setGroupIds(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]); };

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            <Section padded title={t('support.access.title', 'Who can work in this inbox?')}
                description={t('support.access.desc', 'Restrict this mailbox to specific organisation groups, or leave it open to your whole support team.')}
                actions={<span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"><ShieldCheck size={13} /> {t('support.access.admin_only', 'Org admins')}</span>}>
                {loading ? <div className="text-sm text-[var(--text-tertiary)]">{t('support.common.loading', 'Loading…')}</div> : (
                    <div className="space-y-3">
                        <Radio checked={mode === 'everyone'} disabled={!canEdit} onChange={() => { touched.current = true; setMode('everyone'); setGroupIds([]); }}
                            label={t('support.access.everyone', 'Everyone with support access')} hint={t('support.access.everyone_hint', 'Any teammate who can use Support can work this inbox.')} />
                        <Radio checked={mode === 'groups'} disabled={!canEdit} onChange={() => setModeTouched('groups')}
                            label={t('support.access.restricted', 'Restricted to specific groups')} hint={t('support.access.restricted_hint', 'Only members of the chosen organisation groups.')} />

                        {mode === 'groups' && (
                            <div className="pl-7 space-y-2">
                                {availableGroups.length === 0
                                    ? <div className="text-xs text-[var(--text-tertiary)] italic">{t('support.access.no_groups', 'Your organisation has no groups yet. Create groups in Organisation Settings → Users.')}</div>
                                    : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableGroups.map(g => (
                                                <button key={g.id} type="button" disabled={!canEdit} onClick={() => toggleGroup(g.id)}
                                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-60 ${groupIds.includes(g.id)
                                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-tertiary)]">
                            <button onClick={() => setShowMembers(v => !v)} className="flex items-center gap-1.5 hover:text-[var(--text-secondary)]">
                                <Users size={13} /> {t('support.access.resolves_to', 'Resolves to')} {members.length} {t('support.access.people', 'people')}
                                <ChevronDown size={12} className={`transition-transform ${showMembers ? 'rotate-180' : ''}`} />
                            </button>
                            <span>{saving ? t('support.common.saving', 'Saving…') : error ? <span className="text-rose-500">{error}</span> : t('support.access.autosaved', 'Saved automatically')}</span>
                        </div>
                        {showMembers && (
                            <div className="pl-1 flex flex-wrap gap-1.5">
                                {members.length === 0 && <span className="text-[11px] text-[var(--text-tertiary)] italic">{t('support.access.no_members', 'No support-capable members match.')}</span>}
                                {members.map(m => (
                                    <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">{m.name || m.email || m.id}</span>
                                ))}
                            </div>
                        )}
                        {!canEdit && <p className="text-[11px] text-[var(--text-tertiary)] italic">{t('support.access.read_only', 'Only an organisation admin can change inbox access.')}</p>}
                    </div>
                )}
            </Section>
        </div>
    );
}

function Radio({ checked, disabled, onChange, label, hint }) {
    return (
        <button type="button" disabled={disabled} onClick={onChange}
            className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-70 ${checked
                ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                : 'border-[var(--border-default)] hover:bg-[var(--bg-secondary)]'}`}>
            <span className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${checked ? 'border-[var(--accent-primary)]' : 'border-[var(--text-tertiary)]'}`}>
                {checked && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />}
            </span>
            <span className="min-w-0">
                <span className="block text-sm text-[var(--text-primary)]">{label}</span>
                {hint && <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">{hint}</span>}
            </span>
        </button>
    );
}
