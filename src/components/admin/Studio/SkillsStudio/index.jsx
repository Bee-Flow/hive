import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, X, Sparkles } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import useTranslation from '../../../../hooks/useTranslation';

// Inline skill editor — same fields as the legacy SkillFormModal but mounted
// inside the Studio's split layout (list left, editor right). Auto-saves.
const ICONS = ['⚡','✨','🔮','🎯','📊','📋','📝','💡','🛠️','🔧','📚','🧠','🚀','⭐','🎨','🔍','📈','💬','🤖','🎪'];

export default function SkillsStudio({ user, initialSkillId = null, onNavigate, hasPermission = () => true }) {
    const { t } = useTranslation();

    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null); // currently-edited skill
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [savingState, setSavingState] = useState('idle');
    const [orgGroups, setOrgGroups] = useState([]);

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

    // Auto-select skill from URL
    useEffect(() => {
        if (!initialSkillId || skills.length === 0) return;
        const found = skills.find(s => s.id === initialSkillId);
        if (found) setSelected(found);
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
                        savingState={savingState}
                        setSavingState={setSavingState}
                        onSaved={async (updated) => {
                            await fetchSkills();
                            if (updated) setSelected(updated);
                        }}
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
            <Sparkles size={32} className="text-[var(--text-tertiary)] mb-4" />
            <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('skills_studio.empty_title')}</div>
            <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center">{t('skills_studio.empty_help')}</div>
            <button
                onClick={onCreate}
                className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
            >
                {t('skills_studio.create')}
            </button>
        </div>
    );
}

function SkillEditor({ t, skill, orgGroups, savingState, setSavingState, onSaved }) {
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

    const stateRef = useRef({ name, description, instructions, workflow, rules, examples, icon, isShared, dynamicActivation, sharedGroups });
    useEffect(() => { stateRef.current = { name, description, instructions, workflow, rules, examples, icon, isShared, dynamicActivation, sharedGroups }; });

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
            const updated = await res.json();
            setSavingState('saved');
            if (onSaved) onSaved(updated);
        } catch (err) {
            setSavingState('error');
            console.error('Skill save failed:', err);
            dirtyRef.current = true;
        } finally {
            inflightRef.current = false;
        }
    }, [skill.id, onSaved, setSavingState]);

    const queue = useCallback((immediate = false) => {
        if (!skill.id) return;
        dirtyRef.current = true;
        setSavingState('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (immediate) { saveTimer.current = null; flush(); }
        else saveTimer.current = setTimeout(() => { saveTimer.current = null; flush(); }, 350);
    }, [skill.id, flush, setSavingState]);

    const flushNow = () => { if (dirtyRef.current) flush(); };

    const updateName = (v) => { setName(v); queue(false); };
    const updateDescription = (v) => { setDescription(v); queue(false); };
    const updateInstructions = (v) => { setInstructions(v); queue(false); };
    const updateWorkflow = (v) => { setWorkflow(v); queue(false); };
    const updateRules = (v) => { setRules(v); queue(false); };
    const updateExamples = (v) => { setExamples(v); queue(false); };
    const updateIcon = (v) => { setIcon(v); queue(true); };
    const toggleShared = () => { setIsShared(v => !v); queue(true); };
    const toggleDynamic = () => { setDynamicActivation(v => !v); queue(true); };
    const toggleGroup = (gid) => {
        setSharedGroups(prev => {
            const next = prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid];
            return next;
        });
        queue(true);
    };

    return (
        <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="flex items-center justify-end mb-4">
                <span className="text-xs text-[var(--text-tertiary)]">
                    {savingState === 'saving' && t('agent_wizard.builder.save_saving')}
                    {savingState === 'saved' && t('agent_wizard.builder.save_saved')}
                    {savingState === 'error' && t('agent_wizard.builder.save_error')}
                </span>
            </div>

            <div className="flex items-start gap-4 mb-6 relative">
                <button
                    onClick={() => setShowIconPicker(v => !v)}
                    className="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-2xl flex items-center justify-center hover:bg-[var(--bg-tertiary)]"
                >
                    {icon}
                </button>
                {showIconPicker && (
                    <div className="absolute top-16 left-0 z-10 p-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl grid grid-cols-5 gap-1 w-[200px]">
                        {ICONS.map(ic => (
                            <button
                                key={ic}
                                onClick={() => { updateIcon(ic); setShowIconPicker(false); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[18px] transition ${icon === ic ? 'bg-[var(--accent)]/15' : 'hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                {ic}
                            </button>
                        ))}
                    </div>
                )}
                <input
                    value={name}
                    onChange={(e) => updateName(e.target.value)}
                    onBlur={flushNow}
                    placeholder={t('skills_studio.field.name_placeholder')}
                    className="flex-1 text-2xl font-semibold bg-transparent outline-none text-[var(--text-primary)] border-b border-transparent focus:border-[var(--border-default)] py-1"
                />
            </div>

            <div className="space-y-5">
                <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.description')}</div>
                    <input
                        value={description}
                        onChange={(e) => updateDescription(e.target.value)}
                        onBlur={flushNow}
                        placeholder={t('skills_studio.field.description_placeholder')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                </div>

                <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.instructions')}</div>
                    <textarea
                        value={instructions}
                        onChange={(e) => updateInstructions(e.target.value)}
                        onBlur={flushNow}
                        rows={6}
                        placeholder={t('skills_studio.field.instructions_placeholder')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                </div>

                <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.workflow')}</div>
                    <textarea
                        value={workflow}
                        onChange={(e) => updateWorkflow(e.target.value)}
                        onBlur={flushNow}
                        rows={4}
                        placeholder={t('skills_studio.field.workflow_placeholder')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                </div>

                <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.rules')}</div>
                    <textarea
                        value={rules}
                        onChange={(e) => updateRules(e.target.value)}
                        onBlur={flushNow}
                        rows={3}
                        placeholder={t('skills_studio.field.rules_placeholder')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                </div>

                <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.examples')}</div>
                    <textarea
                        value={examples}
                        onChange={(e) => updateExamples(e.target.value)}
                        onBlur={flushNow}
                        rows={3}
                        placeholder={t('skills_studio.field.examples_placeholder')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                </div>

                <div className="space-y-3 pt-3 border-t border-[var(--border-default)]">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={isShared} onChange={toggleShared} className="mt-1" />
                        <div>
                            <div className="text-sm text-[var(--text-primary)]">{t('skills_studio.field.shared_label')}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('skills_studio.field.shared_help')}</div>
                        </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={dynamicActivation} onChange={toggleDynamic} className="mt-1" />
                        <div>
                            <div className="text-sm text-[var(--text-primary)]">{t('skills_studio.field.dynamic_label')}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('skills_studio.field.dynamic_help')}</div>
                        </div>
                    </label>
                </div>

                {isShared && orgGroups.length > 0 && (
                    <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{t('skills_studio.field.shared_groups')}</div>
                        <div className="space-y-1">
                            {orgGroups.map(g => (
                                <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={sharedGroups.includes(g.id)}
                                        onChange={() => toggleGroup(g.id)}
                                    />
                                    <span className="text-[var(--text-primary)]">{g.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
