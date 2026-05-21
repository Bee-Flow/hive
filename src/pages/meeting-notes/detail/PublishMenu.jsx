import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Building2 } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import * as api from '../lib/transcriptionsApi';

/**
 * Publish menu mirroring the Knowledge Bases / Agents publish UX:
 *   - Personal        (isPublished = false)
 *   - Entire Org      (isPublished = true, sharedGroups = [])
 *   - Specific Groups (isPublished = true, sharedGroups = [gid, …])
 *
 * Owner-only. Non-owners should not render this — show a read-only badge instead.
 */
export default function PublishMenu({
    transcriptionId,
    isPublished: initialPublished,
    sharedGroups: initialSharedGroups,
    canManage = true,
    onChange,
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isPublished, setIsPublished] = useState(!!initialPublished);
    const [sharedGroups, setSharedGroups] = useState(Array.isArray(initialSharedGroups) ? initialSharedGroups : []);
    const [orgGroups, setOrgGroups] = useState([]);
    const menuRef = useRef(null);

    useEffect(() => {
        setIsPublished(!!initialPublished);
        setSharedGroups(Array.isArray(initialSharedGroups) ? initialSharedGroups : []);
    }, [initialPublished, initialSharedGroups]);

    useEffect(() => {
        let mounted = true;
        api.listOrgGroups().then((groups) => {
            if (mounted) setOrgGroups(Array.isArray(groups) ? groups : []);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        function handler(e) {
            if (open && menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    async function setPublishState(nextPublished, groups) {
        const nextGroups = nextPublished ? (groups || []) : [];
        setSaving(true);
        try {
            const data = await api.publishTranscription(transcriptionId, nextPublished, nextGroups);
            const finalPublished = !!data.isPublished;
            const finalGroups = Array.isArray(data.sharedGroups) ? data.sharedGroups : nextGroups;
            setIsPublished(finalPublished);
            setSharedGroups(finalGroups);
            setOpen(false);
            onChange?.({ isPublished: finalPublished, sharedGroups: finalGroups });
        } catch (e) {
            alert((t('meeting_notes.publish_failed') || 'Publish failed') + `: ${e.message}`);
        } finally {
            setSaving(false);
        }
    }

    function toggleGroup(gid) {
        setSharedGroups(prev => prev.includes(gid) ? prev.filter(g => g !== gid) : [...prev, gid]);
    }

    const mode = !isPublished
        ? 'personal'
        : (sharedGroups.length === 0 ? 'org' : 'groups');
    const buttonLabel = mode === 'personal'
        ? (t('kb_detail.visibility_personal') || 'Personal')
        : mode === 'org'
            ? (t('kb_detail.published') || 'Published')
            : (t('kb_detail.published_n_groups', { count: sharedGroups.length }) || `Published (${sharedGroups.length})`);

    if (!canManage) {
        return (
            <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
                {isPublished ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {buttonLabel}
            </span>
        );
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                    isPublished
                        ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                        : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                style={!isPublished ? { borderColor: 'var(--border-default)' } : {}}
            >
                {isPublished
                    ? <Check className="w-3.5 h-3.5" />
                    : <Lock className="w-3.5 h-3.5" />}
                {buttonLabel}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                >
                    <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.publish_to') || 'Share with'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.publish_choose_who') || 'Choose who can see this meeting.'}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setPublishState(false, [])}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,114,128,0.15)' }}>
                            <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.personal') || 'Personal'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.personal_desc') || 'Only you can see this meeting.'}</p>
                        </div>
                        {mode === 'personal' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    <button
                        type="button"
                        onClick={() => setPublishState(true, [])}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left border-t"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                            <Building2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.entire_org') || 'Entire organisation'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.entire_org_desc') || 'Everyone in your organisation can see this meeting.'}</p>
                        </div>
                        {mode === 'org' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    {orgGroups.length > 0 && (
                        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.or_specific_groups') || 'Or specific groups'}</p>
                        </div>
                    )}

                    <div className="max-h-48 overflow-auto">
                        {orgGroups.map((group) => (
                            <label
                                key={group.id}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={sharedGroups.includes(group.id)}
                                    onChange={() => toggleGroup(group.id)}
                                    className="accent-[var(--accent-primary)] w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{group.name}</p>
                                    {group.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{group.description}</p>}
                                </div>
                            </label>
                        ))}
                    </div>

                    {sharedGroups.length > 0 && (
                        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            <button
                                type="button"
                                onClick={() => setPublishState(true, sharedGroups)}
                                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                            >
                                {sharedGroups.length > 1
                                    ? (t('kb_detail.publish_to_n_groups_plural', { count: sharedGroups.length }) || `Publish to ${sharedGroups.length} groups`)
                                    : (t('kb_detail.publish_to_n_groups', { count: sharedGroups.length }) || `Publish to 1 group`)}
                            </button>
                        </div>
                    )}

                    <div className="p-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full px-3 py-1.5 rounded-lg text-xs text-center"
                            style={{ color: 'var(--text-muted)' }}
                        >{t('kb_detail.cancel') || 'Cancel'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
