import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, X, Sparkles, Users, Lock } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import useTranslation from '../../../../hooks/useTranslation';

// Same icons as SkillFormModal for consistency
const ICONS = ['⚡', '🎯', '📝', '📧', '📊', '🔍', '💡', '🚀', '🎨', '🤝', '📋', '🏆', '🔧', '⚙️', '🌟', '💬', '📞', '🖊️', '🗂️', '🔑'];
const INSTRUCTION_LIMIT = 4000;

const TABS = [
    { id: 'instructions', label: 'Instructions', hint: 'What should the AI do? Be specific and detailed.', placeholder: 'e.g. When asked to summarize a meeting, extract all key decisions, action items with owners, and open questions...' },
    { id: 'workflow',     label: 'Workflow',     hint: 'Step-by-step process to follow.',                placeholder: 'e.g.\n1. Read the transcript\n2. Extract action items\n3. List decisions made\n4. Output in structured format...' },
    { id: 'rules',        label: 'Rules',        hint: "Tone, format rules, dos and don'ts.",            placeholder: 'e.g.\n- Always use bullet points\n- Keep summaries under 300 words\n- Highlight action items in bold...' },
    { id: 'examples',     label: 'Examples',     hint: 'Example outputs or input/output pairs.',         placeholder: 'e.g. Input: "Meeting transcript..."\nOutput: "## Summary\n..."' },
];

export default function SkillsStudio({ user, initialSkillId = null, onNavigate, hasPermission = () => true }) {
    const { t } = useTranslation();

    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [orgGroups, setOrgGroups] = useState([]);

    // Guard so the URL-based auto-select only fires once on initial load.
    const didAutoSelect = useRef(false);

    const fetchSkills = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/skills`);
            if (res.ok) setSkills(await res.json());
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchSkills(); }, [fetchSkills]);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/groups`);
                if (res.ok) setOrgGroups(await res.json());
            } catch (_) { /* ignore */ }
        })();
    }, []);

    // Auto-select skill from URL — only on initial load, not on every list refresh.
    useEffect(() => {
        if (didAutoSelect.current || !initialSkillId || skills.length === 0) return;
        const found = skills.find(s => s.id === initialSkillId);
        if (found) { setSelected(found); didAutoSelect.current = true; }
    }, [initialSkillId, skills]);

    const createEmpty = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/skills`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t('skills_studio.untitled'),
                    description: '',
                    instructions: '',
                    workflow: '',
                    rules: '',
                    examples: '',
                    icon: '⚡',
                    isShared: false,
                    dynamicActivation: false,
                    sharedGroups: [],
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            await fetchSkills();
            setSelected(created);
            if (onNavigate) onNavigate(`studio/skills/${created.id}`);
        } catch (err) {
            alert(err.message);
        }
    };

    const requestDelete = (s) => { setPendingDelete(s); };

    const confirmDelete = async () => {
        const s = pendingDelete;
        if (!s?.id || deleting) return;
        setDeleting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/skills/${s.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            if (selected?.id === s.id) setSelected(null);
            await fetchSkills();
            setPendingDelete(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{t('skills_studio.title')}</span>
                    {hasPermission('manage_skills') && (
                        <button
                            onClick={createEmpty}
                            title={t('skills_studio.create')}
                            className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {loading && <div className="text-xs text-[var(--text-tertiary)] p-3">…</div>}
                    {!loading && skills.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">{t('skills_studio.empty')}</div>
                    )}
                    {skills.map((s) => {
                        const isSel = selected?.id === s.id;
                        return (
                            <div
                                key={s.id}
                                onClick={() => {
                                    setSelected(s);
                                    if (onNavigate) onNavigate(`studio/skills/${s.id}`);
                                }}
                                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${isSel ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                <span className="text-base flex-shrink-0">{s.icon || '⚡'}</span>
                                <span className="truncate flex-1">{s.name}</span>
                                {hasPermission('manage_skills') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); requestDelete(s); }}
                                        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* Content */}
            <section className="flex-1 min-w-0 overflow-y-auto">
                {!selected && (
                    <EmptyState t={t} onCreate={createEmpty} />
                )}
                {selected && (
                    <SkillEditor
                        key={selected.id}
                        t={t}
                        skill={selected}
                        orgGroups={orgGroups}
                        user={user}
                        onRefreshList={fetchSkills}
                    />
                )}
            </section>

            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => !deleting && setPendingDelete(null)}
                >
                    <div
                        className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-default)]">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{t('skills_studio.delete_title')}</div>
                            <button onClick={() => !deleting && setPendingDelete(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" disabled={deleting}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {t('skills_studio.delete_confirm', { name: pendingDelete.name })}
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => setPendingDelete(null)}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                            >
                                {t('agent_studio.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                {deleting ? '…' : t('agent_studio.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EmptyState({ t, onCreate }) {
    return (
        <div className="h-full flex flex-col items-center justify-center px-6 py-12">
            <Sparkles size={32} className="mb-4" style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
            <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('skills_studio.empty_title')}</div>
            <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center leading-relaxed">{t('skills_studio.empty_help')}</div>
            <button
                onClick={onCreate}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                style={{ background: 'var(--accent-primary)' }}
            >
                <Plus size={15} />
                {t('skills_studio.create')}
            </button>
        </div>
    );
}

// SkillEditor is fully self-contained: savingState is local, no parent re-renders from saving.
function SkillEditor({ t, skill, orgGroups, user, onRefreshList }) {
    const [name, setName] = useState(skill.name || '');
    const [description, setDescription] = useState(skill.description || '');
    const [instructions, setInstructions] = useState(skill.instructions || '');
    const [workflow, setWorkflow] = useState(skill.workflow || '');
    const [rules, setRules] = useState(skill.rules || '');
    const [examples, setExamples] = useState(skill.examples || '');
    const [icon, setIcon] = useState(skill.icon || '⚡');
    const [isShared, setIsShared] = useState(!!skill.isShared);
    const [dynamicActivation, setDynamicActivation] = useState(!!skill.dynamicActivation);
    const [sharedGroups, setSharedGroups] = useState(Array.isArray(skill.sharedGroups) ? skill.sharedGroups : []);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('instructions');
    // savingState is LOCAL — no parent re-renders when it changes
    const [savingState, setSavingState] = useState('idle');

    const effectiveOrgId = user?.organizationId || null;
    const orgFilteredGroups = orgGroups.filter(g => !effectiveOrgId || g.organizationId === effectiveOrgId);

    // stateRef holds the latest field values for the debounced/immediate flush.
    // We update it manually in every setter so it's always in sync — no useEffect lag.
    const stateRef = useRef({
        name, description, instructions, workflow, rules, examples,
        icon, isShared, dynamicActivation, sharedGroups,
    });

    const saveTimer = useRef(null);
    const inflightRef = useRef(false);
    const dirtyRef = useRef(false);

    const flush = useCallback(async () => {
        if (!skill.id || !dirtyRef.current) return;
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
        while (inflightRef.current) await new Promise(r => setTimeout(r, 50));
        dirtyRef.current = false;
        inflightRef.current = true;
        try {
            const res = await authFetch(`${API_BASE}/api/skills/${skill.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stateRef.current),
            });
            if (!res.ok) throw new Error(await res.text());
            setSavingState('saved');
            // Refresh the sidebar list in background — no setSelected, no re-mount.
            if (onRefreshList) onRefreshList();
        } catch (err) {
            setSavingState('error');
            console.error('Skill save failed:', err);
            dirtyRef.current = true;
        } finally {
            inflightRef.current = false;
        }
    }, [skill.id, onRefreshList]);

    const queue = useCallback((immediate = false) => {
        if (!skill.id) return;
        dirtyRef.current = true;
        setSavingState('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (immediate) { saveTimer.current = null; flush(); }
        else saveTimer.current = setTimeout(() => { saveTimer.current = null; flush(); }, 350);
    }, [skill.id, flush]);

    const flushNow = () => { if (dirtyRef.current) flush(); };

    // Text field updaters — stateRef updated synchronously, save debounced.
    const updateName = (v) => { setName(v); stateRef.current.name = v; queue(false); };
    const updateDescription = (v) => { setDescription(v); stateRef.current.description = v; queue(false); };

    const updateTabField = (tabId, value) => {
        if (tabId === 'instructions') {
            if (value.length > INSTRUCTION_LIMIT) return;
            setInstructions(value);
            stateRef.current.instructions = value;
        } else if (tabId === 'workflow') {
            setWorkflow(value);
            stateRef.current.workflow = value;
        } else if (tabId === 'rules') {
            setRules(value);
            stateRef.current.rules = value;
        } else if (tabId === 'examples') {
            setExamples(value);
            stateRef.current.examples = value;
        }
        queue(false);
    };

    // Immediate-save updaters — stateRef updated BEFORE flush to avoid staleness.
    const updateIcon = (v) => { setIcon(v); stateRef.current.icon = v; queue(true); };
    const toggleShared = () => {
        const next = !isShared;
        setIsShared(next);
        stateRef.current.isShared = next;
        queue(true);
    };
    const toggleDynamic = () => {
        const next = !dynamicActivation;
        setDynamicActivation(next);
        stateRef.current.dynamicActivation = next;
        queue(true);
    };
    const toggleGroup = (gid) => {
        setSharedGroups(prev => {
            const next = prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid];
            stateRef.current.sharedGroups = next;
            return next;
        });
        queue(true);
    };

    const tabFieldValue = (tabId) => {
        if (tabId === 'instructions') return instructions;
        if (tabId === 'workflow') return workflow;
        if (tabId === 'rules') return rules;
        if (tabId === 'examples') return examples;
        return '';
    };

    const currentTab = TABS.find(t => t.id === activeTab);

    return (
        <div
            className="flex flex-col h-full"
            style={{ background: 'var(--bg-secondary)' }}
        >
            {/* Header: icon + name + description + save status */}
            <div
                className="flex items-center gap-3 px-6 pt-5 pb-4 border-b flex-shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <div className="relative flex-shrink-0">
                    <button
                        onClick={() => setShowIconPicker(v => !v)}
                        title="Choose icon"
                        className="w-11 h-11 rounded-xl border-[1.5px] flex items-center justify-center text-[22px] transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                    >
                        {icon}
                    </button>
                    {showIconPicker && (
                        <div
                            className="absolute top-[52px] left-0 z-10 p-2 rounded-xl border shadow-xl grid grid-cols-5 gap-1 w-[180px]"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                        >
                            {ICONS.map(ic => (
                                <button
                                    key={ic}
                                    onClick={() => { updateIcon(ic); setShowIconPicker(false); }}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors ${icon === ic ? 'bg-[var(--accent-primary)]/15' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <input
                        value={name}
                        onChange={e => updateName(e.target.value)}
                        onBlur={flushNow}
                        placeholder={t('skills_studio.field.name_placeholder')}
                        className="w-full text-base font-bold bg-transparent outline-none border-none"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    <input
                        value={description}
                        onChange={e => updateDescription(e.target.value)}
                        onBlur={flushNow}
                        placeholder={t('skills_studio.field.description_placeholder')}
                        className="w-full text-[13px] bg-transparent outline-none border-none mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                    />
                </div>

                <div className="flex-shrink-0">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {savingState === 'saving' && t('agent_wizard.builder.save_saving')}
                        {savingState === 'saved' && t('agent_wizard.builder.save_saved')}
                        {savingState === 'error' && t('agent_wizard.builder.save_error')}
                    </span>
                </div>
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
                    {activeTab === 'instructions' && (
                        <span
                            className={`text-[11px] tabular-nums ${instructions.length / INSTRUCTION_LIMIT > 0.9 ? 'text-red-500' : instructions.length / INSTRUCTION_LIMIT > 0.75 ? 'text-amber-500' : ''}`}
                            style={instructions.length / INSTRUCTION_LIMIT <= 0.75 ? { color: 'var(--text-tertiary)' } : undefined}
                        >
                            {INSTRUCTION_LIMIT - instructions.length} left
                        </span>
                    )}
                </div>
                <textarea
                    value={tabFieldValue(activeTab)}
                    onChange={e => updateTabField(activeTab, e.target.value)}
                    onBlur={flushNow}
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

            {/* Group sharing (only when shared and org has groups) */}
            {isShared && orgFilteredGroups.length > 0 && (
                <div className="px-6 pb-3 pt-1 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <label className="text-[11px] mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                        {t('skills_studio.field.shared_groups')} (leave empty for all org members)
                    </label>
                    <div className="space-y-1 max-h-32 overflow-auto">
                        {orgFilteredGroups.map(group => (
                            <label key={group.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={sharedGroups.includes(group.id)}
                                    onChange={() => toggleGroup(group.id)}
                                    className="rounded"
                                />
                                <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{group.name}</span>
                                {group.description && (
                                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>— {group.description}</span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer: sharing toggle + dynamic activation */}
            <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                    onClick={toggleShared}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] text-[13px] font-medium transition-all ${isShared
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-500'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                >
                    {isShared ? <Users size={14} /> : <Lock size={14} />}
                    {isShared
                        ? (sharedGroups.length > 0
                            ? `Shared (${sharedGroups.length} group${sharedGroups.length === 1 ? '' : 's'})`
                            : 'Shared with org')
                        : 'Private'}
                </button>

                <button
                    onClick={toggleDynamic}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] text-[13px] font-medium transition-all ${dynamicActivation
                        ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                >
                    {t('skills_studio.field.dynamic_label')}
                </button>
            </div>
        </div>
    );
}
