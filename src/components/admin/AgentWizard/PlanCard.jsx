import React from 'react';
import { BookOpen, FileText, Search, Sparkles, Plug, Plus } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';

const CAPABILITY_ICONS = [
    <BookOpen size={16} key="b" />,
    <FileText size={16} key="f" />,
    <Search size={16} key="s" />,
];

const INTEGRATION_BY_ID = new Map(INTEGRATION_CATALOG.map(i => [i.id, i]));

export default function PlanCard({ plan, onAdjust, onBuild, busy, t: tOverride }) {
    const { t: tHook } = useTranslation();
    const t = tOverride || tHook;
    if (!plan) return null;
    return (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 max-w-xl">
            <div className="text-xs uppercase tracking-wide text-[var(--accent)] mb-1">{t('agent_wizard.plan_label')}</div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{plan.description}</p>

            {plan.capabilities?.length > 0 && (
                <div className="mt-5">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">{t('agent_wizard.capabilities')}</div>
                    <div className="divide-y divide-[var(--border-default)] border-t border-b border-[var(--border-default)]">
                        {plan.capabilities.map((cap, i) => (
                            <div key={i} className="flex items-center gap-3 py-2.5 text-sm text-[var(--text-primary)]">
                                <span className="text-[var(--accent)]">{CAPABILITY_ICONS[i % CAPABILITY_ICONS.length]}</span>
                                <span>{cap}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {plan.enabledIntegrations?.length > 0 && (
                <div className="mt-5">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">{t('agent_wizard.integrations')}</div>
                    <div className="divide-y divide-[var(--border-default)] border-t border-b border-[var(--border-default)]">
                        {plan.enabledIntegrations.map((id) => {
                            const item = INTEGRATION_BY_ID.get(id);
                            return (
                                <div key={id} className="flex items-center gap-3 py-2.5 text-sm text-[var(--text-primary)]">
                                    <span className="text-[var(--accent)]"><Plug size={16} /></span>
                                    <span>{item?.label || id}</span>
                                    {item?.description && <span className="text-xs text-[var(--text-tertiary)] ml-auto truncate">{item.description}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {plan.skills?.length > 0 && (
                <div className="mt-5">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">{t('agent_wizard.skills_label')}</div>
                    <div className="divide-y divide-[var(--border-default)] border-t border-b border-[var(--border-default)]">
                        {plan.skills.map((s, i) => (
                            <div key={s.id || i} className="flex items-center gap-3 py-2.5 text-sm text-[var(--text-primary)]">
                                <span className="text-[var(--accent)]">{s.id ? <Sparkles size={16} /> : <Plus size={16} />}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="truncate">{s.name}</div>
                                    {s.description && <div className="text-xs text-[var(--text-tertiary)] truncate">{s.description}</div>}
                                </div>
                                {!s.id && (
                                    <span className="text-[10px] uppercase tracking-wide text-[var(--accent)]">{t('agent_wizard.skills_new_badge')}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={onBuild}
                    disabled={busy}
                    className="px-4 py-2 rounded-full text-sm bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                    {busy ? t('agent_wizard.busy') : t('agent_wizard.build')}
                </button>
            </div>
        </div>
    );
}
