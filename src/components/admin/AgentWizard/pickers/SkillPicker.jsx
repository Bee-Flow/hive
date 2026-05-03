import React, { useState } from 'react';
import { Plus, Search, Sparkles, X } from 'lucide-react';

export default function SkillPicker({ skills, selectedIds, automations = [], search, onSearch, onClose, onToggle, onCreate, t }) {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newInstr, setNewInstr] = useState('');
    const [newAutomationId, setNewAutomationId] = useState('');
    const [busy, setBusy] = useState(false);
    const filtered = (skills || []).filter(s =>
        !search || (s.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const submit = async () => {
        if (!newName.trim() || busy) return;
        setBusy(true);
        const created = await onCreate({
            name: newName.trim(),
            description: newDesc.trim(),
            instructions: newInstr.trim(),
            automationId: newAutomationId || null,
        });
        setBusy(false);
        if (created) {
            setNewName(''); setNewDesc(''); setNewInstr(''); setNewAutomationId(''); setCreating(false);
        }
    };

    return (
        <div className="absolute z-20 top-full left-0 mt-2 w-[460px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-3">
            {!creating && (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <Search size={14} className="text-[var(--text-tertiary)]" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder={t('agent_wizard.skills.search')}
                            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                        />
                        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
                    </div>
                    <button
                        onClick={() => { setCreating(true); setNewName(search); }}
                        className="w-full flex items-center gap-2 py-2 px-2 mb-1 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--bg-secondary)]"
                    >
                        <Plus size={14} /> {t('agent_wizard.skills.create_new')}
                    </button>
                    <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-default)]">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] py-3 text-center">
                                {t('agent_wizard.skills.empty')}
                            </div>
                        )}
                        {filtered.map((s) => {
                            const checked = selectedIds.includes(s.id);
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => onToggle(s.id)}
                                    className="w-full flex items-center gap-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-lg px-2"
                                >
                                    <span className="text-base">{s.icon || '✨'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-[var(--text-primary)] truncate flex items-center gap-1.5">
                                            {s.name}
                                            {s.automationId && (
                                                <span title={t('agent_wizard.skills.linked_automation') || 'Linked to an automation'} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center gap-1">
                                                    <Sparkles size={10} /> Flow
                                                </span>
                                            )}
                                        </div>
                                        {s.description && <div className="text-xs text-[var(--text-tertiary)] truncate">{s.description}</div>}
                                    </div>
                                    <span className={`w-4 h-4 rounded-sm border flex items-center justify-center ${checked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border-default)]'}`}>
                                        {checked && '✓'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
            {creating && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.skills.create_new')}</div>
                        <button onClick={() => setCreating(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
                    </div>
                    <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('agent_wizard.skills.field_name')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <input
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder={t('agent_wizard.skills.field_description')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    {!newAutomationId && (
                        <textarea
                            value={newInstr}
                            onChange={(e) => setNewInstr(e.target.value)}
                            rows={4}
                            placeholder={t('agent_wizard.skills.field_instructions')}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    )}
                    {automations && automations.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                {t('agent_wizard.skills.linked_automation_label') || 'Linked automation (optional)'}
                            </div>
                            <select
                                value={newAutomationId}
                                onChange={(e) => setNewAutomationId(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] cursor-pointer"
                            >
                                <option value="">{t('agent_wizard.skills.linked_automation_none') || '— No automation, use instructions above —'}</option>
                                {automations.map(a => (
                                    <option key={a.id} value={a.id}>{a.title || '(untitled)'}</option>
                                ))}
                            </select>
                            {newAutomationId && (
                                <div className="text-[11px] text-[var(--text-tertiary)] pl-1">
                                    {t('agent_wizard.skills.linked_automation_help') || 'When the agent activates this skill, the linked automation runs and its result is returned to the agent.'}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            {t('agent_wizard.skills.cancel')}
                        </button>
                        <button onClick={submit} disabled={!newName.trim() || busy} className="px-3 py-1.5 rounded-full text-sm bg-[var(--accent)] text-white disabled:opacity-50">
                            {busy ? t('agent_wizard.busy') : t('agent_wizard.skills.create_attach')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
