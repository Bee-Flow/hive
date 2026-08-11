import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Star, User, Building2, Users } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import TemplateEditor from './TemplateEditor';

/**
 * A list of summary templates with create / edit / delete, built on
 * TemplateEditor. Reused by the personal settings section (user scope) and the
 * org-admin panel (org + group scope). Presentational — the host fetches the
 * list and passes `onReload` to refresh after a change.
 */
const SCOPE_ICON = { user: User, org: Building2, group: Users };

export default function TemplateManager({
    templates = [],
    builtins = [],
    canManageOrg = false,
    defaultScope = 'user',
    groups = [],            // [{ id, name }] — to label group-scoped rows
    emptyHint,
    onReload,
}) {
    const { t } = useTranslation();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const groupName = useMemo(() => {
        const map = {};
        for (const g of groups) map[g.id] = g.name;
        return map;
    }, [groups]);

    function openNew() { setEditing(null); setEditorOpen(true); }
    function openEdit(tpl) { setEditing(tpl); setEditorOpen(true); }

    function scopeLabel(tpl) {
        if (tpl.scope === 'user') return t('meeting_notes.template_scope_user', 'Just me');
        if (tpl.scope === 'org') return t('meeting_notes.template_scope_org', 'Whole organization');
        return groupName[tpl.groupId] || t('meeting_notes.template_scope_group', 'Specific group');
    }

    return (
        <div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {templates.length === 0 && (
                    <div className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        {emptyHint || t('meeting_notes.template_empty', 'No templates yet.')}
                    </div>
                )}
                {templates.map((tpl, i) => {
                    const Icon = SCOPE_ICON[tpl.scope] || User;
                    return (
                        <div key={tpl.id}>
                            {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                            <button
                                type="button"
                                onClick={() => openEdit(tpl)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tpl.name}</span>
                                        {tpl.isDefault && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: 'var(--accent-primary)' }}>
                                                <Star className="w-3 h-3 fill-current" />
                                                {t('meeting_notes.template_default_badge', 'Default')}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{scopeLabel(tpl)}</span>
                                </div>
                                <Pencil className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-3">
                <button
                    type="button"
                    onClick={openNew}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus className="w-3.5 h-3.5" />
                    {t('meeting_notes.template_new', 'New template…')}
                </button>
            </div>

            <TemplateEditor
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                initial={editing}
                builtins={builtins}
                canManageOrg={canManageOrg}
                defaultScope={defaultScope}
                onSaved={onReload}
                onDeleted={onReload}
            />
        </div>
    );
}
