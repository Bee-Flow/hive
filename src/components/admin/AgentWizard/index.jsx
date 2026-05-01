import React, { useState } from 'react';
import { ArrowLeft, ArrowUp, MessageCircle, Calendar, Tag } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import PlanCard from './PlanCard';
import BuilderSplit from './BuilderSplit';

const EXAMPLE_PROMPTS = [
    { icon: <MessageCircle size={16} />, title: 'Teamchat Q&A', sub: 'Beantwoord vragen in teamchat-apps met de aangeleverde documentatie' },
    { icon: <Calendar size={16} />, title: 'Ochtendplanner', sub: 'Mijn dag plannen vanuit mijn agenda, taken en open threads' },
    { icon: <Tag size={16} />, title: 'Bugtriage', sub: 'Beoordeel binnenkomende bugs, stel prioriteiten en leg ze vast in de teamtracker' },
];

export default function AgentWizard({ user, onClose, onPublished }) {
    const [stage, setStage] = useState('landing'); // landing | review | builder
    const [prompt, setPrompt] = useState('');
    const [plan, setPlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [agent, setAgent] = useState(null);

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
                body: JSON.stringify({ prompt: text, modelTier: 'fast' }),
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
                body: JSON.stringify({ prompt, plan, refinement }),
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

    const commitAndBuild = async () => {
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
                plan={plan}
                history={history}
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
            <div className="flex items-center justify-between px-6 py-4">
                <button onClick={onClose} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <ArrowLeft size={16} /> Terug
                </button>
                {stage === 'review' && (
                    <button
                        onClick={() => { setStage('landing'); setPlan(null); setHistory([]); setPrompt(''); }}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Leeg starten
                    </button>
                )}
            </div>

            {stage === 'landing' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <div className="text-5xl mb-4">🐝</div>
                    <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-8">Een nieuwe agent maken</h1>
                    <PromptInput value={prompt} onChange={setPrompt} onSubmit={() => submitPrompt(prompt)} busy={busy} />
                    {error && <div className="mt-4 text-sm text-red-500 max-w-xl">{error}</div>}
                    <div className="mt-8 w-full max-w-xl space-y-1">
                        {EXAMPLE_PROMPTS.map((ex) => (
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
                                        <p className="text-sm text-[var(--text-secondary)] mb-3">
                                            Hier is een opzet voor de agent die ik voor je kan bouwen. Laat het me weten als je nog aanpassingen hebt, dan ga ik aan de slag!
                                        </p>
                                        <PlanCard
                                            plan={m.plan}
                                            busy={busy || !isLatest}
                                            onAdjust={() => {
                                                const v = window.prompt('Welke aanpassingen?');
                                                if (v) refine(v);
                                            }}
                                            onBuild={isLatest ? commitAndBuild : undefined}
                                        />
                                    </div>
                                );
                            }
                            return null;
                        })}
                        {busy && <div className="text-sm text-[var(--text-tertiary)]">Aan het denken…</div>}
                        {error && <div className="text-sm text-red-500">{error}</div>}
                    </div>
                    <div className="w-full max-w-xl mt-8 sticky bottom-4">
                        <PromptInput
                            value={prompt}
                            onChange={setPrompt}
                            onSubmit={() => { refine(prompt); setPrompt(''); }}
                            busy={busy}
                            placeholder="Beschrijf wat de agent moet doen"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function PromptInput({ value, onChange, onSubmit, busy, placeholder }) {
    return (
        <div className="w-full max-w-xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                rows={2}
                placeholder={placeholder || 'Bouw een agent die vragen beantwoordt in Slack, ChatGPT en andere chats op basis van de documentatie die ik aanlever.'}
                className="w-full bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none"
                disabled={busy}
            />
            <div className="flex items-center justify-end mt-1">
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
