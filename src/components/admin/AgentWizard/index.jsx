import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUp, MessageCircle, Calendar, Tag } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import MarkdownRenderer from '../../MarkdownRenderer';
import ModelTierSelector from '../../ModelTierSelector';
import PlanCard from './PlanCard';
import BuilderSplit from './BuilderSplit';

export default function AgentWizard({ user, onClose, onPublished, onSwitchToManual }) {
    const { t, locale } = useTranslation();
    const examples = [
        { icon: <MessageCircle size={16} />, title: t('agent_wizard.example_qna_title'), sub: t('agent_wizard.example_qna_sub') },
        { icon: <Calendar size={16} />, title: t('agent_wizard.example_planner_title'), sub: t('agent_wizard.example_planner_sub') },
        { icon: <Tag size={16} />, title: t('agent_wizard.example_bug_title'), sub: t('agent_wizard.example_bug_sub') },
    ];
    const [stage, setStage] = useState('landing'); // landing | review | builder
    const [prompt, setPrompt] = useState('');
    const [plan, setPlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [agent, setAgent] = useState(null);
    const [tiers, setTiers] = useState({});
    const [tier, setTier] = useState('fast');
    // When the user types a follow-up message on the review screen we commit
    // immediately and hand the message off to BuilderSplit, which fires it
    // through its own /wizard/refine on mount. This avoids splitting the
    // conversation across two screens.
    const [pendingRefinement, setPendingRefinement] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (res.ok) setTiers(await res.json());
            } catch (_) { /* ignore */ }
        })();
    }, []);

    const submitPrompt = async (text) => {
        if (!text.trim() || busy) return;
        setBusy(true);
        setError(null);
        setHistory([{ role: 'user', content: text }]);
        setStage('review');
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, modelTier: tier, locale }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { plan: draft } = await res.json();
            setPlan(draft);
            setHistory(h => [...h, { role: 'plan', plan: draft }]);
        } catch (err) {
            setError(err.message);
            setStage('landing');
        } finally {
            setBusy(false);
        }
    };

    const refine = async (refinement) => {
        if (!plan || busy) return;
        setBusy(true);
        setError(null);
        setHistory(h => [...h, { role: 'user', content: refinement }]);
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, plan, refinement, modelTier: tier, locale }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { plan: updated } = await res.json();
            setPlan(updated);
            setHistory(h => [...h, { role: 'plan', plan: updated }]);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const commitAndBuild = async (refinement = null) => {
        if (!plan || busy) return;
        setBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { agent: newAgent } = await res.json();
            setAgent(newAgent);
            if (refinement) setPendingRefinement(refinement);
            setStage('builder');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    // From the review screen: any follow-up message commits the current plan
    // and continues the conversation inside BuilderSplit. The user sees their
    // message appear there, not here.
    const submitFollowUp = (text) => {
        const trimmed = (text || '').trim();
        if (!trimmed || busy) return;
        setPrompt('');
        commitAndBuild(trimmed);
    };

    if (stage === 'builder' && agent) {
        return (
            <BuilderSplit
                agent={agent}
                plan={plan}
                history={history}
                tier={tier}
                locale={locale}
                initialRefinement={pendingRefinement}
                onBack={() => setStage('review')}
                onPublished={(updated) => {
                    if (onPublished) onPublished(updated);
                    else if (onClose) onClose();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-default)]">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{t('agent_wizard.title')}</div>
                <div className="flex items-center gap-3">
                    {stage === 'review' && (
                        <button
                            onClick={() => { setStage('landing'); setPlan(null); setHistory([]); setPrompt(''); }}
                            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            {t('agent_wizard.start_over')}
                        </button>
                    )}
                    <button
                        onClick={() => (onSwitchToManual || onClose) && (onSwitchToManual || onClose)()}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        {t('agent_wizard.switch_manual')}
                    </button>
                </div>
            </div>

            {stage === 'landing' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <img src="/BeeFlow-logo-Icon-2026.svg" alt="Bee Flow" className="w-16 h-16 mb-4" />
                    <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-8">{t('agent_wizard.title')}</h1>
                    <PromptInput
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={() => submitPrompt(prompt)}
                        busy={busy}
                        tiers={tiers}
                        tier={tier}
                        onTierChange={setTier}
                        placeholder={t('agent_wizard.placeholder_initial')}
                    />
                    {error && <div className="mt-4 text-sm text-red-500 max-w-xl">{error}</div>}
                    <div className="mt-8 w-full max-w-xl space-y-1">
                        {examples.map((ex) => (
                            <button
                                key={ex.title}
                                onClick={() => submitPrompt(`${ex.title}: ${ex.sub}`)}
                                className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--bg-secondary)] transition"
                            >
                                <span className="text-[var(--text-tertiary)]">{ex.icon}</span>
                                <span className="text-sm text-[var(--text-primary)] font-medium">{ex.title}</span>
                                <span className="text-sm text-[var(--text-tertiary)]">{ex.sub}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {stage === 'review' && (
                <div className="flex-1 flex flex-col items-center overflow-y-auto px-6 py-4">
                    <div className="w-full max-w-xl space-y-6">
                        {history.map((m, i) => {
                            if (m.role === 'user') {
                                return (
                                    <div key={i} className="flex justify-end">
                                        <div className="max-w-[80%] rounded-2xl bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)]">{m.content}</div>
                                    </div>
                                );
                            }
                            if (m.role === 'plan') {
                                const isLatest = i === history.length - 1;
                                return (
                                    <div key={i}>
                                        <div className="text-sm text-[var(--text-secondary)] mb-3 prose prose-sm max-w-none">
                                            <MarkdownRenderer content={t('agent_wizard.intro')} />
                                        </div>
                                        <PlanCard
                                            plan={m.plan}
                                            busy={busy || !isLatest}
                                            t={t}
                                            onAdjust={() => {
                                                const v = window.prompt(t('agent_wizard.adjust_prompt'));
                                                if (v) refine(v);
                                            }}
                                            onBuild={isLatest ? commitAndBuild : undefined}
                                        />
                                    </div>
                                );
                            }
                            return null;
                        })}
                        {busy && <div className="text-sm text-[var(--text-tertiary)]">{t('agent_wizard.thinking')}</div>}
                        {error && <div className="text-sm text-red-500">{error}</div>}
                    </div>
                    <div className="w-full max-w-xl mt-8 sticky bottom-4">
                        <PromptInput
                            value={prompt}
                            onChange={setPrompt}
                            onSubmit={() => submitFollowUp(prompt)}
                            busy={busy}
                            placeholder={t('agent_wizard.placeholder_describe')}
                            tiers={tiers}
                            tier={tier}
                            onTierChange={setTier}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function PromptInput({ value, onChange, onSubmit, busy, placeholder, tiers, tier, onTierChange }) {
    return (
        <div className="w-full max-w-xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
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
                    <ModelTierSelector tiers={tiers || {}} value={tier} onChange={onTierChange} dropDirection="up" />
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
