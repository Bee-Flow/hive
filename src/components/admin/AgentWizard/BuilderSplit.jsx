import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, MessageCircle, Slack, Sparkles, Upload, Brain, AppWindow, ArrowLeft } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import PlanCard from './PlanCard';

const CHANNELS = [
    { id: 'chatgpt', label: 'ChatGPT', sub: 'Je agent aanpassen en delen', icon: <MessageCircle size={18} /> },
    { id: 'slack', label: 'Slack', sub: 'Gebruik je agent in Slack', icon: <Slack size={18} /> },
];

export default function BuilderSplit({ agent: initialAgent, plan, history, onBack, onPublished }) {
    const [agent, setAgent] = useState(initialAgent);
    const [name, setName] = useState(initialAgent?.name || plan?.name || 'Naam van agent');
    const [avatar, setAvatar] = useState(plan?.avatar || initialAgent?.config?.avatar || '🤖');
    const [instructions, setInstructions] = useState(initialAgent?.system_prompt || plan?.systemPrompt || '');
    const [channels, setChannels] = useState(plan?.channels || ['chatgpt']);
    const [memoryEnabled, setMemoryEnabled] = useState(false);
    const [skills, setSkills] = useState(plan?.suggestedSkills?.map(s => s.name) || []);
    const [savingState, setSavingState] = useState('idle'); // idle | saving | saved | error
    const [publishing, setPublishing] = useState(false);

    const [chat, setChat] = useState(history || []);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatScrollRef = useRef(null);

    useEffect(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chat]);

    // Debounced auto-save
    const saveTimer = useRef(null);
    const queueSave = useCallback((patch) => {
        if (!agent?.id) return;
        setSavingState('saving');
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/${agent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                });
                if (!res.ok) throw new Error(await res.text());
                const updated = await res.json();
                setAgent(updated);
                setSavingState('saved');
            } catch (err) {
                console.error('Auto-save failed:', err);
                setSavingState('error');
            }
        }, 600);
    }, [agent?.id]);

    const updateName = (v) => { setName(v); queueSave({ name: v }); };
    const updateAvatar = (v) => {
        setAvatar(v);
        queueSave({ config: { ...(agent?.config || {}), avatar: v } });
    };
    const updateInstructions = (v) => { setInstructions(v); queueSave({ systemPrompt: v }); };
    const toggleChannel = (id) => {
        const next = channels.includes(id) ? channels.filter(c => c !== id) : [...channels, id];
        setChannels(next);
        queueSave({ config: { ...(agent?.config || {}), wizard: { ...(agent?.config?.wizard || {}), channels: next } } });
    };
    const toggleMemory = () => {
        const next = !memoryEnabled;
        setMemoryEnabled(next);
        queueSave({ config: { ...(agent?.config || {}), wizard: { ...(agent?.config?.wizard || {}), memoryEnabled: next } } });
    };

    const handleRefine = async () => {
        const text = chatInput.trim();
        if (!text || chatBusy) return;
        setChat(prev => [...prev, { role: 'user', content: text }]);
        setChatInput('');
        setChatBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: chat[0]?.content || '',
                    plan: { name, description: agent?.description || '', avatar, channels, capabilities: plan?.capabilities || [], systemPrompt: instructions },
                    refinement: text,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { plan: updated } = await res.json();
            setName(updated.name);
            setAvatar(updated.avatar || avatar);
            setInstructions(updated.systemPrompt || instructions);
            setChannels(updated.channels || channels);
            queueSave({
                name: updated.name,
                description: updated.description,
                systemPrompt: updated.systemPrompt,
                config: { ...(agent?.config || {}), avatar: updated.avatar || avatar, wizard: { channels: updated.channels, capabilities: updated.capabilities, suggestedSkills: updated.suggestedSkills, memoryEnabled } },
            });
            setChat(prev => [...prev, { role: 'plan', plan: updated }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'error', content: err.message }]);
        } finally {
            setChatBusy(false);
        }
    };

    const handlePublish = async () => {
        if (!agent?.id) return;
        setPublishing(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/${agent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: { ...(agent?.config || {}), published: true } }),
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();
            if (onPublished) onPublished(updated);
        } catch (err) {
            console.error('Publish failed:', err);
            alert('Publiceren mislukt: ' + err.message);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Left chat panel */}
            <aside className="w-[380px] flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                    <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <ArrowLeft size={16} /> Terug
                    </button>
                    <span className="text-xs text-[var(--text-tertiary)]">
                        {savingState === 'saving' && 'Opslaan…'}
                        {savingState === 'saved' && 'Opgeslagen'}
                        {savingState === 'error' && 'Opslaan mislukt'}
                    </span>
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {chat.map((m, i) => {
                        if (m.role === 'user') {
                            return (
                                <div key={i} className="flex justify-end">
                                    <div className="max-w-[80%] rounded-2xl bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)]">{m.content}</div>
                                </div>
                            );
                        }
                        if (m.role === 'plan') {
                            return <div key={i}><PlanCard plan={m.plan} onAdjust={() => {}} onBuild={() => {}} busy /></div>;
                        }
                        if (m.role === 'error') {
                            return <div key={i} className="text-xs text-red-500">{m.content}</div>;
                        }
                        return <div key={i} className="text-sm text-[var(--text-secondary)]">{m.content}</div>;
                    })}
                </div>
                <div className="p-3 border-t border-[var(--border-default)]">
                    <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2">
                        <Plus size={16} className="text-[var(--text-tertiary)]" />
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                            placeholder="Vraag maar raak, @ voor context"
                            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                            disabled={chatBusy}
                        />
                        <button
                            onClick={handleRefine}
                            disabled={chatBusy || !chatInput.trim()}
                            className="w-8 h-8 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center disabled:opacity-30"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Right config panel */}
            <main className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-[var(--border-default)]">
                    <button
                        onClick={handlePublish}
                        disabled={publishing}
                        className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                        {publishing ? 'Bezig…' : 'Maken'}
                    </button>
                </div>

                <div className="max-w-3xl mx-auto px-8 py-8">
                    <div className="flex items-start gap-4 mb-6">
                        <button
                            onClick={() => {
                                const v = window.prompt('Avatar emoji', avatar);
                                if (v) updateAvatar(v.trim().slice(0, 4));
                            }}
                            className="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-2xl flex items-center justify-center hover:bg-[var(--bg-tertiary)]"
                            title="Avatar wijzigen"
                        >
                            {avatar}
                        </button>
                        <input
                            value={name}
                            onChange={(e) => updateName(e.target.value)}
                            className="flex-1 text-2xl font-semibold bg-transparent outline-none text-[var(--text-primary)] border-b border-transparent focus:border-[var(--border-default)] py-1"
                            placeholder="Naam van agent"
                        />
                    </div>

                    <div className="mb-8">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Kanalen</div>
                        <div className="grid grid-cols-2 gap-3">
                            {CHANNELS.map(ch => {
                                const active = channels.includes(ch.id);
                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => toggleChannel(ch.id)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft,var(--bg-secondary))]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        <span className="text-[var(--text-primary)]">{ch.icon}</span>
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-primary)]">{ch.label}</div>
                                            <div className="text-xs text-[var(--text-tertiary)]">{ch.sub}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-8">
                        <ActionPill icon={<AppWindow size={14} />} label="Bladeren door apps" onClick={() => alert('App browser komt eraan')} />
                        <ActionPill icon={<Sparkles size={14} />} label="Skill toevoegen" onClick={() => {
                            const v = window.prompt('Skill naam');
                            if (v) {
                                const next = [...skills, v.trim()];
                                setSkills(next);
                                queueSave({ config: { ...(agent?.config || {}), wizard: { ...(agent?.config?.wizard || {}), suggestedSkills: next.map(n => ({ name: n })) } } });
                            }
                        }} />
                        <ActionPill icon={<Upload size={14} />} label="Bestanden uploaden" onClick={() => alert('Upload via Kennis-paneel — open de agent na "Maken".')} />
                        <ActionPill icon={<Brain size={14} />} label={`Geheugen${memoryEnabled ? ' • aan' : ''}`} onClick={toggleMemory} active={memoryEnabled} />
                    </div>

                    {skills.length > 0 && (
                        <div className="mb-8">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">Skills</div>
                            <div className="flex flex-wrap gap-2">
                                {skills.map((s, i) => (
                                    <span key={i} className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)]">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-sm text-[var(--text-secondary)] mb-2">Instructies</div>
                        <textarea
                            value={instructions}
                            onChange={(e) => updateInstructions(e.target.value)}
                            rows={10}
                            placeholder="Geef je agent instructies over hoe deze moet werken."
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

function ActionPill({ icon, label, onClick, active }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition ${active ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
        >
            {icon}{label}
        </button>
    );
}
