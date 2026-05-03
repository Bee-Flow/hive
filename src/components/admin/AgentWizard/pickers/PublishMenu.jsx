import React, { useEffect, useRef } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { ToggleRow } from './_primitives';

export default function PublishMenu({ t, agent, open, onToggle, onClose, isPublished, onTogglePublished, embedEnabled, orgGroups, sharedGroups, onToggleGroup }) {
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onClose]);

    const stateLabel = isPublished
        ? (t('agent_wizard.publish.update') || 'Update')
        : (t('agent_wizard.publish.publish') || 'Publish');

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={onToggle}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition shadow-sm ${isPublished
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40 hover:bg-[var(--accent)]/25'
                    : 'bg-[var(--accent)] text-white hover:opacity-90 ring-1 ring-[var(--accent)]'}`}
            >
                {!isPublished && <Globe size={14} />}
                {stateLabel}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 right-8 top-full mt-1 w-[320px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-[var(--border-default)]">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                            {t('agent_wizard.section.publishing') || 'Publish'}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            {isPublished
                                ? (t('agent_wizard.publish.live_help') || 'This agent is live in your workspace.')
                                : (t('agent_wizard.publish.draft_help') || 'Only you can use this agent right now.')}
                        </div>
                    </div>
                    <div className="p-3 space-y-3">
                        <ToggleRow
                            label={t('agent_wizard.publishing.published_label')}
                            help={t('agent_wizard.publishing.published_help')}
                            checked={isPublished}
                            onChange={onTogglePublished}
                        />
                        {isPublished && (
                            <div>
                                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.publishing.groups')}
                                </div>
                                {orgGroups.length === 0 && (
                                    <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.publishing.no_groups')}</div>
                                )}
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {orgGroups.map(g => {
                                        const checked = sharedGroups.includes(g.id);
                                        return (
                                            <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="checkbox" checked={checked} onChange={() => onToggleGroup(g.id)} />
                                                <span className="text-[var(--text-primary)]">{g.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {embedEnabled && agent?.id && (
                            <div className="text-[11px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-default)]">
                                {t('agent_wizard.publish.embed_hint') || 'Web embed is on — manage it in Behavior.'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
