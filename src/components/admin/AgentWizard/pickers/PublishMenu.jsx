import React, { useEffect, useRef } from 'react';
import { ChevronDown, Globe, Lock, Building2, Check } from 'lucide-react';

export default function PublishMenu({ t, agent, open, onToggle, onClose, isPublished, onSetPersonal, onSetEntireOrg, embedEnabled, orgGroups, sharedGroups, onToggleGroup }) {
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

    // Three explicit publish modes — derived from current state so the menu
    // can highlight the active one and a single click switches between them.
    const mode = !isPublished ? 'personal' : (sharedGroups.length === 0 ? 'org' : 'groups');
    const stateLabel = mode === 'personal'
        ? (t('agent_wizard.publish.personal') || 'Personal')
        : mode === 'org'
            ? (t('agent_wizard.publish.published') || 'Published')
            : `${t('agent_wizard.publish.published') || 'Published'} (${sharedGroups.length})`;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={onToggle}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition shadow-sm ${isPublished
                    ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] ring-1 ring-[var(--border-default)] hover:bg-[var(--bg-tertiary)]'}`}
            >
                {isPublished ? <Globe size={14} /> : <Lock size={14} />}
                {stateLabel}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 right-8 top-full mt-1 w-[320px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-xl overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-[var(--border-default)]">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                            {t('agent_wizard.publish.title') || 'Publish to…'}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            {t('agent_wizard.publish.choose_who') || 'Choose who can see this agent.'}
                        </div>
                    </div>

                    {/* Personal — only the owner can access. */}
                    <button
                        type="button"
                        onClick={onSetPersonal}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(107,114,128,0.15)' }}>
                            <Lock size={16} className="text-[var(--text-secondary)]" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.publish.personal') || 'Personal'}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.publish.personal_desc') || 'Only you can access'}</div>
                        </div>
                        {mode === 'personal' && <Check size={16} className="text-emerald-500" />}
                    </button>

                    {/* Entire Organisation — published, no group restriction. */}
                    <button
                        type="button"
                        onClick={onSetEntireOrg}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-colors text-left border-t border-[var(--border-default)]"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                            <Building2 size={16} className="text-emerald-500" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.publish.entire_org') || 'Entire Organisation'}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.publish.entire_org_desc') || 'All members can access'}</div>
                        </div>
                        {mode === 'org' && <Check size={16} className="text-emerald-500" />}
                    </button>

                    {orgGroups.length > 0 && (
                        <>
                            <div className="px-4 py-2 border-t border-[var(--border-default)]">
                                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                    {t('agent_wizard.publish.or_specific_groups') || 'Or specific groups'}
                                </div>
                            </div>
                            <div className="max-h-40 overflow-y-auto pb-2">
                                {orgGroups.map(g => {
                                    const checked = sharedGroups.includes(g.id);
                                    return (
                                        <label key={g.id} className="flex items-center gap-2 px-4 py-1.5 text-sm cursor-pointer hover:bg-[var(--bg-secondary)]">
                                            <input type="checkbox" checked={checked} onChange={() => onToggleGroup(g.id)} />
                                            <span className="text-[var(--text-primary)]">{g.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {embedEnabled && agent?.id && (
                        <div className="text-[11px] text-[var(--text-tertiary)] px-4 py-2 border-t border-[var(--border-default)]">
                            {t('agent_wizard.publish.embed_hint') || 'Web embed is on — manage it in Behavior.'}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
