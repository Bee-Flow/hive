import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, User, Building2, Users } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import useTranslation from '../../../hooks/useTranslation';
import * as api from '../lib/transcriptionsApi';

/**
 * Create / edit a custom summary-regeneration template.
 *
 * Reused from three surfaces: the Regenerate menu (meeting detail), the
 * personal "My templates" settings section, and the org-admin panel. It calls
 * the API itself and reports back via onSaved / onDeleted so each host only has
 * to refresh its list.
 *
 * Scope options:
 *   - "Just me"            (user)  — any authenticated user
 *   - "Whole organization" (org)   — org admins only
 *   - "Specific group"     (group) — org admins only, needs a group
 * Org/group options only render when `canManageOrg` is true. Scope is immutable
 * once created (matches the backend), so editing an existing template locks it.
 */
export default function TemplateEditor({
    open,
    onClose,
    initial = null,          // existing template row, or null to create
    builtins = [],           // [{ id, name, prompt }] — for "start from"
    canManageOrg = false,
    defaultScope = 'user',
    onSaved,
    onDeleted,
}) {
    const { t } = useTranslation();
    const isEdit = !!(initial && initial.id);

    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [scope, setScope] = useState('user');
    const [groupId, setGroupId] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [seedId, setSeedId] = useState('');
    const [groups, setGroups] = useState([]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

    // (Re)initialise whenever the editor opens or targets a different template.
    useEffect(() => {
        if (!open) return;
        setError(null);
        setSeedId('');
        if (isEdit) {
            setName(initial.name || '');
            setPrompt(initial.prompt || '');
            setScope(initial.scope || 'user');
            setGroupId(initial.groupId || '');
            setIsDefault(!!initial.isDefault);
        } else {
            setName('');
            setPrompt('');
            setScope(canManageOrg ? defaultScope : 'user');
            setGroupId('');
            setIsDefault(false);
        }
    }, [open, initial, isEdit, canManageOrg, defaultScope]);

    // Groups are only needed for the "Specific group" scope, and only admins
    // see that option — fetch lazily when the editor opens for an admin.
    useEffect(() => {
        if (!open || !canManageOrg) return undefined;
        let mounted = true;
        api.listOrgGroups().then((g) => { if (mounted) setGroups(Array.isArray(g) ? g : []); }).catch(() => {});
        return () => { mounted = false; };
    }, [open, canManageOrg]);

    const scopeOptions = useMemo(() => {
        const opts = [{ id: 'user', label: t('meeting_notes.template_scope_user', 'Just me'), icon: User }];
        if (canManageOrg) {
            opts.push({ id: 'org', label: t('meeting_notes.template_scope_org', 'Whole organization'), icon: Building2 });
            opts.push({ id: 'group', label: t('meeting_notes.template_scope_group', 'Specific group'), icon: Users });
        }
        return opts;
    }, [canManageOrg, t]);

    function applySeed(id) {
        setSeedId(id);
        const b = builtins.find((x) => x.id === id);
        if (b) {
            setPrompt(b.prompt || '');
            if (!name.trim()) setName(b.name || '');
        }
    }

    const canSave = name.trim() && prompt.trim() && !(scope === 'group' && !groupId) && !saving && !deleting;

    async function handleSave() {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        try {
            let saved;
            if (isEdit) {
                saved = await api.updateSummaryTemplate(initial.id, { name: name.trim(), prompt: prompt.trim(), isDefault });
            } else {
                saved = await api.createSummaryTemplate({
                    scope,
                    name: name.trim(),
                    prompt: prompt.trim(),
                    groupId: scope === 'group' ? groupId : undefined,
                    isDefault,
                });
            }
            onSaved?.(saved);
            onClose?.();
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!isEdit) return;
        if (!window.confirm(t('meeting_notes.template_delete_confirm', 'Delete this template? This cannot be undone.'))) return;
        setDeleting(true);
        setError(null);
        try {
            await api.deleteSummaryTemplate(initial.id);
            onDeleted?.(initial.id);
            onClose?.();
        } catch (e) {
            setError(e.message || String(e));
            setDeleting(false);
        }
    }

    const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' };

    const footer = (
        <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-3 min-w-0">
                {isEdit && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving || deleting}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {t('meeting_notes.template_delete', 'Delete')}
                    </button>
                )}
                {error && <span className="text-xs text-rose-500 truncate">{error}</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    {t('meeting_notes.template_cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t('meeting_notes.template_save', 'Save template')}
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title={isEdit ? t('meeting_notes.template_edit_title', 'Edit template') : t('meeting_notes.template_new_title', 'New summary template')}
            description={t('meeting_notes.template_editor_desc', 'Write the instructions the AI follows when it generates this summary style.')}
            footer={footer}
        >
            <div className="flex flex-col gap-4">
                {/* Name */}
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('meeting_notes.template_name', 'Name')}</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('meeting_notes.template_name_ph', 'e.g. Board summary, Klant-review NL')}
                        className="px-3 py-2 rounded-lg text-sm border outline-none"
                        style={inputStyle}
                    />
                </label>

                {/* Start from (create only) */}
                {!isEdit && builtins.length > 0 && (
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('meeting_notes.template_start_from', 'Start from a built-in (optional)')}</span>
                        <select
                            value={seedId}
                            onChange={(e) => applySeed(e.target.value)}
                            className="px-3 py-2 rounded-lg text-sm border outline-none"
                            style={inputStyle}
                        >
                            <option value="">{t('meeting_notes.template_start_blank', 'Blank')}</option>
                            {builtins.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </label>
                )}

                {/* Prompt */}
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('meeting_notes.template_prompt', 'Prompt')}</span>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={10}
                        placeholder={t('meeting_notes.template_prompt_ph', 'Describe the summary you want — sections, tone, what to focus on…')}
                        className="px-3 py-2 rounded-lg text-sm border outline-none font-mono leading-relaxed resize-y"
                        style={inputStyle}
                    />
                </label>

                {/* Scope */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('meeting_notes.template_visible_to', 'Visible to')}</span>
                    <div className="flex flex-wrap gap-2">
                        {scopeOptions.map((opt) => {
                            const Icon = opt.icon;
                            const active = scope === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    disabled={isEdit}
                                    onClick={() => setScope(opt.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isEdit ? 'opacity-60 cursor-default' : ''}`}
                                    style={active
                                        ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#fff' }
                                        : { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    {isEdit && (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('meeting_notes.template_scope_locked', 'Scope can\'t be changed after creation.')}</span>
                    )}
                </div>

                {/* Group picker */}
                {scope === 'group' && (
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('meeting_notes.template_group', 'Group')}</span>
                        <select
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                            disabled={isEdit}
                            className="px-3 py-2 rounded-lg text-sm border outline-none"
                            style={inputStyle}
                        >
                            <option value="">{t('meeting_notes.template_group_choose', 'Choose a group…')}</option>
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </label>
                )}

                {/* Default toggle */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="mt-0.5 accent-[var(--accent-primary)] w-4 h-4"
                    />
                    <span className="flex flex-col">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('meeting_notes.template_set_default', 'Use as the default for new meetings')}</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {scope === 'user'
                                ? t('meeting_notes.template_default_user_hint', 'New meetings you create get this summary style automatically.')
                                : scope === 'org'
                                    ? t('meeting_notes.template_default_org_hint', 'New meetings in your organization get this style unless a member or group default overrides it.')
                                    : t('meeting_notes.template_default_group_hint', 'New meetings by this group\'s members get this style unless they set a personal default.')}
                        </span>
                    </span>
                </label>
            </div>
        </Modal>
    );
}
