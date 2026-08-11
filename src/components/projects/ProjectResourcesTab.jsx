import { BookOpen, AppWindow, Workflow, AlertTriangle, Loader2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Notebooks, apps and routines that live in this project.
 *
 * Each of these was previously reachable only by its owner (notebooks had no
 * sharing mechanism of any kind, and the routines↔projects link was dead code).
 * A NULL project_id still means standalone and owner-only — membership here is
 * additive, never a move that takes something away from whoever made it.
 */

const SECTIONS = [
    { key: 'notebooks', icon: BookOpen, labelKey: 'projects.notebooks', kind: 'notebook' },
    { key: 'apps', icon: AppWindow, labelKey: 'projects.apps', kind: 'app' },
    { key: 'automations', icon: Workflow, labelKey: 'projects.routines', kind: 'automation' },
];

function itemLabel(item) {
    return item.name || item.title || 'Untitled';
}

export default function ProjectResourcesTab({
    resources,
    loading,
    role,
    currentUserId,
    onOpen,
    onRemove,
}) {
    const { t } = useTranslation();
    const canEdit = role === 'owner' || role === 'editor';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {SECTIONS.map(({ key, icon: Icon, labelKey, kind }) => {
                const items = resources?.[key];

                return (
                    <div key={key}>
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {t(labelKey)}
                            </h3>
                            {Array.isArray(items) && items.length > 0 && (
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{items.length}</span>
                            )}
                        </div>

                        {/* null and [] mean different things and must not look
                            the same: the server returns null when a store could
                            not be reached, and showing that as "none" would tell
                            the user their work had disappeared. */}
                        {items === null || items === undefined ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
                                 style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {t('projects.section_unavailable', 'Could not load this section. Your items are safe — try again shortly.')}
                            </div>
                        ) : items.length === 0 ? (
                            <p className="px-3 py-2.5 rounded-lg text-xs"
                               style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                                {t('projects.section_empty', 'Nothing here yet.')}
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {items.map((item) => {
                                    const isMine = (item.userId || item.ownerId) === currentUserId;
                                    return (
                                        <div key={item.id}
                                             className="flex items-center gap-3 px-3 py-2 rounded-lg group"
                                             style={{ background: 'var(--bg-secondary)' }}>
                                            <button
                                                onClick={() => onOpen?.(kind, item)}
                                                className="flex-1 min-w-0 text-left text-sm truncate"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {itemLabel(item)}
                                            </button>
                                            {/* Only the owner may pull something back
                                                out — the stores match on user_id, so
                                                offering it to anyone else would just
                                                produce a 404. */}
                                            {canEdit && isMine && (
                                                <button
                                                    onClick={() => onRemove?.(kind, item)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                    title={t('projects.remove_from_project')}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {!canEdit && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('projects.viewer_readonly')}
                </p>
            )}
        </div>
    );
}
