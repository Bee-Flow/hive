import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronDown, Loader2, Pencil, Plus, Star } from 'lucide-react';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import useTranslation from '../../../hooks/useTranslation';

// Fallback built-ins used before the server list has loaded (keeps the menu
// populated instantly and covers hosts that don't pass `templates`).
const FALLBACK_BUILTINS = [
    { id: 'general', name: 'General meeting' },
    { id: 'standup', name: 'Stand-up' },
    { id: 'sales', name: 'Sales call' },
    { id: 'interview', name: 'Interview' },
    { id: 'retrospective', name: 'Retrospective' },
];

export default function SummaryView({
    summary,
    onRegenerate,
    regenerating,
    templates = null,          // { builtins, custom, defaultTemplateId, canManageOrg }
    onNewTemplate,
    onEditTemplate,
}) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const builtins = templates?.builtins?.length ? templates.builtins : FALLBACK_BUILTINS;
    const custom = Array.isArray(templates?.custom) ? templates.custom : [];
    const defaultTemplateId = templates?.defaultTemplateId || null;
    const canManageOrg = !!templates?.canManageOrg;
    const mine = custom.filter((tpl) => tpl.scope === 'user');
    const orgTemplates = custom.filter((tpl) => tpl.scope === 'org' || tpl.scope === 'group');
    const canManageTemplates = typeof onNewTemplate === 'function';

    function pick(payload) {
        setMenuOpen(false);
        onRegenerate?.(payload);
    }

    function sectionHeader(label) {
        return (
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {label}
            </div>
        );
    }

    function customRow(tpl) {
        return (
            <div key={tpl.id} className="group flex items-center hover:bg-[var(--bg-tertiary)]">
                <button
                    type="button"
                    onClick={() => pick({ templateId: tpl.id })}
                    className="flex-1 min-w-0 text-left px-3 py-1.5 text-xs flex items-center gap-1.5"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {defaultTemplateId === tpl.id && <Star className="w-3 h-3 flex-shrink-0 fill-current" style={{ color: 'var(--accent-primary)' }} />}
                    <span className="truncate">{tpl.name}</span>
                    {tpl.scope === 'group' && (
                        <span className="ml-1 px-1 py-px rounded text-[9px] font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            {t('meeting_notes.template_badge_group', 'group')}
                        </span>
                    )}
                </button>
                {canManageTemplates && (tpl.scope === 'user' || canManageOrg) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEditTemplate?.(tpl); }}
                        className="px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={t('meeting_notes.template_edit', 'Edit template')}
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('meeting_notes.summary', 'Summary')}</h2>
                {onRegenerate && (
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen((o) => !o)}
                            disabled={regenerating}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {t('meeting_notes.regenerate', 'Regenerate')}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {menuOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 z-10 w-60 max-h-[60vh] overflow-auto rounded-lg border shadow-lg"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                            >
                                {(mine.length > 0 || orgTemplates.length > 0) && sectionHeader(t('meeting_notes.template_section_builtin', 'Built-in'))}
                                {builtins.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => pick({ template: tpl.id })}
                                        className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {tpl.nameKey ? t(tpl.nameKey, tpl.name) : tpl.name}
                                    </button>
                                ))}

                                {mine.length > 0 && sectionHeader(t('meeting_notes.template_section_mine', 'My templates'))}
                                {mine.map(customRow)}

                                {orgTemplates.length > 0 && sectionHeader(t('meeting_notes.template_section_org', 'Organization'))}
                                {orgTemplates.map(customRow)}

                                {canManageTemplates && (
                                    <>
                                        <div className="border-t my-1" style={{ borderColor: 'var(--border-subtle)' }} />
                                        <button
                                            type="button"
                                            onClick={() => { setMenuOpen(false); onNewTemplate?.(); }}
                                            className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                                            style={{ color: 'var(--accent-primary)' }}
                                        >
                                            <Plus className="w-3 h-3" />
                                            {t('meeting_notes.template_new', 'New template…')}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto rounded-xl border px-4 py-3" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                {summary ? (
                    <MarkdownRenderer content={summary} />
                ) : (
                    <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                        {t('meeting_notes.no_summary', 'No summary yet.')}
                    </div>
                )}
            </div>
        </div>
    );
}
