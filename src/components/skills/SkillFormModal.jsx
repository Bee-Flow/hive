import React, { useState, useEffect } from 'react';
import { Sparkles, X, Users, Lock, Zap } from 'lucide-react';

export const ICONS = ['⚡', '🎯', '📝', '📧', '📊', '🔍', '💡', '🚀', '🎨', '🤝', '📋', '🏆', '🔧', '⚙️', '🌟', '💬', '📞', '🖊️', '🗂️', '🔑'];
export const INSTRUCTION_LIMIT = 4000;

const emptyForm = () => ({
    name: '',
    description: '',
    instructions: '',
    workflow: '',
    rules: '',
    examples: '',
    icon: '⚡',
    isShared: false,
    dynamicActivation: false,
});

const TABS = [
    { id: 'instructions', label: 'Instructions', hint: 'What should the AI do? Be specific and detailed.', placeholder: 'e.g. When asked to summarize a meeting, extract all key decisions, action items with owners, and open questions...' },
    { id: 'workflow', label: 'Workflow', hint: 'Step-by-step process to follow.', placeholder: 'e.g.\n1. Read the transcript\n2. Extract action items\n3. List decisions made\n4. Output in structured format...' },
    { id: 'rules', label: 'Rules', hint: 'Tone, format rules, dos and don\'ts.', placeholder: 'e.g.\n- Always use bullet points\n- Keep summaries under 300 words\n- Highlight action items in bold...' },
    { id: 'examples', label: 'Examples', hint: 'Example outputs or input/output pairs.', placeholder: 'e.g. Input: "Meeting transcript..."\nOutput: "## Summary\n..."' },
];

function CharCount({ value, limit }) {
    const len = value?.length || 0;
    const pct = len / limit;
    const color = pct > 0.9 ? 'text-red-500' : pct > 0.75 ? 'text-amber-500' : '';
    return (
        <span className={`text-[11px] tabular-nums ${color}`} style={color ? undefined : { color: 'var(--text-tertiary)' }}>
            {limit - len} left
        </span>
    );
}

export default function SkillFormModal({ skill, onSave, onCancel, saving }) {
    const [form, setForm] = useState(() => skill ? {
        name: skill.name || '',
        description: skill.description || '',
        instructions: skill.instructions || '',
        workflow: skill.workflow || '',
        rules: skill.rules || '',
        examples: skill.examples || '',
        icon: skill.icon || '⚡',
        isShared: skill.isShared ?? false,
        dynamicActivation: skill.dynamicActivation ?? false,
    } : emptyForm());
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('instructions');

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    const currentTab = TABS.find(t => t.id === activeTab);
    const canSave = form.name.trim() && !saving;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={() => setShowIconPicker(v => !v)}
                            title="Choose icon"
                            className="w-11 h-11 rounded-xl border-[1.5px] flex items-center justify-center text-[22px] transition-colors"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                        >
                            {form.icon}
                        </button>
                        {showIconPicker && (
                            <div
                                className="absolute top-[52px] left-0 z-10 p-2 rounded-xl border shadow-xl grid grid-cols-5 gap-1 w-[180px]"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                            >
                                {ICONS.map(ic => (
                                    <button
                                        key={ic}
                                        onClick={() => { setField('icon', ic); setShowIconPicker(false); }}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors ${form.icon === ic ? 'bg-[var(--accent-primary)]/15' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <input
                            value={form.name}
                            onChange={e => setField('name', e.target.value)}
                            placeholder="Skill name (e.g. meeting-summary)"
                            autoFocus
                            className="w-full text-base font-bold bg-transparent outline-none border-none"
                            style={{ color: 'var(--text-primary)' }}
                        />
                        <input
                            value={form.description}
                            onChange={e => setField('description', e.target.value)}
                            placeholder="Short description..."
                            className="w-full text-[13px] bg-transparent outline-none border-none mt-0.5"
                            style={{ color: 'var(--text-secondary)' }}
                        />
                    </div>

                    <button
                        onClick={onCancel}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b px-6 flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3.5 py-2.5 text-[13px] transition-all -mb-px border-b-2 ${activeTab === tab.id
                                ? 'font-semibold border-[var(--accent-primary)] text-[var(--accent-primary)]'
                                : 'font-normal border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab body */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            {currentTab.hint}
                        </span>
                        {activeTab === 'instructions' && <CharCount value={form.instructions} limit={INSTRUCTION_LIMIT} />}
                    </div>
                    <textarea
                        value={form[activeTab]}
                        onChange={e => {
                            if (activeTab === 'instructions' && e.target.value.length > INSTRUCTION_LIMIT) return;
                            setField(activeTab, e.target.value);
                        }}
                        placeholder={currentTab.placeholder}
                        className="w-full min-h-[200px] text-[13px] leading-relaxed rounded-xl border-[1.5px] p-3.5 resize-y outline-none transition-colors focus:border-[var(--accent-primary)]"
                        style={{
                            color: 'var(--text-primary)',
                            background: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-subtle)',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                        onClick={() => setField('isShared', !form.isShared)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] text-[13px] font-medium transition-all ${form.isShared
                            ? 'border-blue-500/40 bg-blue-500/10 text-blue-500'
                            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                    >
                        {form.isShared ? <Users size={14} /> : <Lock size={14} />}
                        {form.isShared ? 'Shared with org' : 'Private'}
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(form)}
                            disabled={!canSave}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold transition-opacity ${canSave ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            {saving ? 'Saving...' : (<><Sparkles size={14} /> {skill ? 'Update skill' : 'Create skill'}</>)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
