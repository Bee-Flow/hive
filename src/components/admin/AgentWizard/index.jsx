import React, { useState, useEffect } from 'react';
import { ArrowUp, MessageCircle, Calendar, Tag } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import ModelTierSelector from '../../ModelTierSelector';
import beeFlowIcon from '../../../assets/BeeFlow-logo-Icon-2026.svg';
import BuilderSplit from './BuilderSplit';

// Landing-only wizard. The legacy "review/plan card" stage has been removed:
// the landing flow now creates a placeholder agent and hands the first prompt
// straight to BuilderSplit as `initialRefinement`. The old submitPrompt,
// refine, commitAndBuild, submitFollowUp helpers plus the review JSX they
// powered were unreachable code; deleted in this pass to keep the wizard
// surface honest about the flow it actually runs.
export default function AgentWizard({ user, onClose, onPublished, onSwitchToManual }) {
    const { t, locale } = useTranslation();
    const examples = [
        { icon: <MessageCircle size={16} />, title: t('agent_wizard.example_qna_title'), sub: t('agent_wizard.example_qna_sub') },
        { icon: <Calendar size={16} />, title: t('agent_wizard.example_planner_title'), sub: t('agent_wizard.example_planner_sub') },
        { icon: <Tag size={16} />, title: t('agent_wizard.example_bug_title'), sub: t('agent_wizard.example_bug_sub') },
    ];
    const [stage, setStage] = useState('landing'); // landing | builder
    const [prompt, setPrompt] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [agent, setAgent] = useState(null);
    const [tiers, setTiers] = useState({});
    const [tier, setTier] = useState('fast');
    // The first prompt is handed to BuilderSplit which fires its own
    // /wizard/refine on mount — keeps the conversation in one place.
    const [pendingRefinement, setPendingRefinement] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (res.ok) setTiers(await res.json());
            } catch (_) { /* ignore */ }
        })();
    }, []);

    const submitPromptInstant = async (text) => {
        const trimmed = (text || '').toString().trim();
        if (!trimmed || busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/agents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t('agent_studio.untitled') || 'Untitled',
                    description: '',
                    systemPrompt: '',
                    config: {
                        avatar: '🤖',
                        enabledIntegrations: [],
                        knowledge_base_ids: [],
                        attachedSkillIds: [],
                        memoryEnabled: false,
                    },
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const newAgent = await res.json();
            setAgent(newAgent);
            setPendingRefinement(trimmed);
            setStage('builder');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    if (stage === 'builder' && agent) {
        return (
            <BuilderSplit
                agent={agent}
                plan={null}
                history={[]}
                tier={tier}
                locale={locale}
                initialRefinement={pendingRefinement}
                onBack={() => { setStage('landing'); setAgent(null); setPendingRefinement(null); }}
                onPublished={(updated) => {
                    if (onPublished) onPublished(updated);
                    else if (onClose) onClose();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                <img src={beeFlowIcon} alt="Bee Flow" className="w-14 h-14 mb-3" />
                <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">{t('agent_wizard.title')}</h1>
                <div className="w-full max-w-xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
                    <div className="p-4">
                        <PromptInput
                            value={prompt}
                            onChange={setPrompt}
                            onSubmit={() => submitPromptInstant(prompt)}
                            busy={busy}
                            tiers={tiers}
                            tier={tier}
                            onTierChange={setTier}
                            placeholder={t('agent_wizard.placeholder_initial')}
                            noBorder
                        />
                    </div>
                </div>
                <div className="w-full max-w-xl mt-6">
                    <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">{t('agent_wizard.or_template') || 'Or start from a template'}</div>
                    <div className="flex flex-col gap-2">
                        {examples.map((ex) => (
                            <button
                                key={ex.title}
                                onClick={() => submitPromptInstant(`${ex.title}: ${ex.sub}`)}
                                className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card,#fff)] hover:bg-[var(--bg-secondary)] transition shadow-sm"
                            >
                                <span className="text-[var(--text-tertiary)]">{ex.icon}</span>
                                <span className="text-sm text-[var(--text-primary)] font-medium">{ex.title}</span>
                                <span className="text-sm text-[var(--text-tertiary)] truncate">{ex.sub}</span>
                            </button>
                        ))}
                    </div>
                </div>
                {error && <div className="mt-4 text-sm text-red-500 max-w-xl">{error}</div>}
            </div>
        </div>
    );
}

function PromptInput({ value, onChange, onSubmit, busy, placeholder, tiers, tier, onTierChange, noBorder }) {
    return (
        <div className={`w-full max-w-xl px-1 py-1 ${noBorder ? '' : 'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3'}`}>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                rows={2}
                placeholder={placeholder}
                className="w-full bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none"
                disabled={busy}
            />
            <div className="flex items-center justify-end mt-1 gap-2">
                {onTierChange && (
                    <ModelTierSelector tiers={tiers || {}} value={tier} onChange={onTierChange} dropDirection="up" variant="input" />
                )}
                <button
                    onClick={onSubmit}
                    disabled={busy || !value.trim()}
                    className="w-9 h-9 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center disabled:opacity-30"
                >
                    <ArrowUp size={16} />
                </button>
            </div>
        </div>
    );
}
