// §WS5 — task editor form, extracted verbatim from AITasksDesigner/index.jsx.
import React from 'react';
import { Check, Search, Clock, Repeat, Pause } from 'lucide-react';
import ModelTierSelector from '../../ModelTierSelector';
import { REPEAT_OPTIONS, repeatLabel } from './taskFormatters';
import AgentSelect from './AgentSelect';

export default function EditorView({
    title, setTitle, prompt, setPrompt,
    date, setDate, time, setTime,
    repeatInterval, setRepeatInterval, tier, setTier,
    modelTiers,
    agentId, setAgentId, agents = [], routinesAllowed = false,
    canSave, isNewMode, onSave, onCancel, nextRunPreview,
}) {
    return (
        <div className="px-6 py-6 max-w-4xl mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form column */}
                <div className="lg:col-span-2 space-y-5">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            Task name
                        </label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Weekly AI News Digest"
                            autoFocus
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                            style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            Prompt
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="What should the AI do? Be specific.&#10;&#10;e.g. Search for the top 5 AI news stories from the past week and summarize each with a source link, formatted as a markdown bulleted list."
                            rows={10}
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors resize-y leading-relaxed"
                            style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))', fontFamily: 'inherit' }}
                        />
                    </div>

                    {routinesAllowed && setAgentId && (
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Run as agent
                            </label>
                            <AgentSelect
                                value={agentId || ''}
                                onChange={(next) => {
                                    setAgentId(next);
                                    // Linking to an agent inherits its model,
                                    // so reset any custom routine-tier override.
                                    if (next && setTier) setTier('auto');
                                }}
                                agents={agents}
                                placeholder="No agent (general prompt)"
                            />
                            <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                {agentId
                                    ? 'The prompt runs through this agent — it can use the agent\'s skills, knowledge, and integrations.'
                                    : 'No agent selected — the prompt runs as a generic LLM call without agent skills.'}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Repeat
                            </label>
                            <select
                                value={repeatInterval}
                                onChange={e => setRepeatInterval(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            >
                                {REPEAT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Model tier
                            </label>
                            {agentId ? (
                                <div
                                    className="px-3.5 py-2.5 rounded-xl text-[13px] text-[var(--text-tertiary)] italic border bg-[var(--bg-secondary)]"
                                    style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                                    title="The linked agent provides the model. Change it in the agent editor."
                                >
                                    Inherited from agent
                                </div>
                            ) : (
                                <ModelTierSelector
                                    tiers={modelTiers || {}}
                                    value={tier}
                                    onChange={setTier}
                                    dropDirection="down"
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={!canSave}
                            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                            style={{
                                background: canSave ? 'var(--text-primary)' : 'rgba(0,0,0,0.15)',
                                boxShadow: canSave ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            <Check className="w-4 h-4" />
                            {isNewMode ? 'Create Task' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Help / preview column */}
                <aside className="space-y-4">
                    {nextRunPreview && (
                        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-primary)' }}>
                                Next run
                            </div>
                            <div className="text-[14px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
                                {nextRunPreview}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-1">
                                {repeatInterval ? `Then repeats: ${repeatLabel(repeatInterval).toLowerCase()}.` : 'Runs once, then stops.'}
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl p-4 border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.06))' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                            Tips
                        </div>
                        <ul className="text-[12px] text-[var(--text-secondary)] space-y-2 leading-relaxed list-disc pl-4">
                            <li>Be specific: tell the AI exactly what output format you want.</li>
                            <li>Pick a model tier — hover the picker for what each one's best at.</li>
                            <li>Results appear in Notifications and stay accessible for 30 days.</li>
                            <li>Pause a task any time — it won't run again until resumed.</li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}
