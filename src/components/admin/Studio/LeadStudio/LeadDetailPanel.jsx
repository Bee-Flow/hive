import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Sparkles, Loader2, Mail, Phone, Linkedin, Plus, Check, Star, Trash2,
    PhoneCall, Users, FileText, ArrowRightLeft, Bot, CheckCircle2, ListTodo,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { formatRelativeTime } from '../../../../utils/dateFormatters';
import useTranslation from '../../../../hooks/useTranslation';

const STAGE_IDS = ['new', 'contacted', 'qualified', 'converted', 'disqualified'];
const ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email'];
const ACT_ICON = { note: FileText, call: PhoneCall, meeting: Users, email: Mail, stage_change: ArrowRightLeft, task: ListTodo, ai: Bot, system: Bot };

/**
 * Lead detail panel — the CRM record. Contacts, activity timeline, tasks, deal
 * fields, and AI helpers (next-step + log-from-notes). Self-contained: fetches
 * its sub-resources on open and mutates via the API; lead-level edits go through
 * the parent's onPatchLead so the board/list stay in sync.
 */
export default function LeadDetailPanel({ lead, teammates = [], onClose, onPatchLead, onDraftEmail = () => {}, onResearch = () => {}, busyResearchId = '', t: tProp, userId }) {
    const { t: tHook } = useTranslation();
    const t = tProp || tHook;
    const [activities, setActivities] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [noteType, setNoteType] = useState('note');
    const [noteBody, setNoteBody] = useState('');
    const [aiNotes, setAiNotes] = useState('');
    const [nextStep, setNextStep] = useState(null);
    const [busy, setBusy] = useState({});
    const [taskForm, setTaskForm] = useState({ title: '', dueAt: '', assignee: '' });
    const [contactForm, setContactForm] = useState(null); // null = closed
    const [logSuggestion, setLogSuggestion] = useState(null);

    const setBusyKey = (k, v) => setBusy(b => ({ ...b, [k]: v }));
    const lid = lead?.id;

    const reload = useCallback(async () => {
        if (!lid) return;
        try {
            const [a, c, tk] = await Promise.all([
                authFetch(`${API_BASE}/api/lead-studio/leads/${lid}/activities`).then(r => r.ok ? r.json() : { activities: [] }),
                authFetch(`${API_BASE}/api/lead-studio/leads/${lid}/contacts`).then(r => r.ok ? r.json() : { contacts: [] }),
                authFetch(`${API_BASE}/api/lead-studio/tasks?leadId=${lid}&status=open`).then(r => r.ok ? r.json() : { tasks: [] }),
            ]);
            setActivities(a.activities || []); setContacts(c.contacts || []); setTasks(tk.tasks || []);
        } catch (_) { /* ignore */ }
    }, [lid]);
    useEffect(() => { setNextStep(null); setLogSuggestion(null); reload(); }, [reload]);

    if (!lead) return null;

    const patch = (body) => onPatchLead?.(lead.id, body);

    const addActivity = async () => {
        if (!noteBody.trim()) return;
        setBusyKey('act', true);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/activities`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: noteType, body: noteBody.trim() }),
            });
            if (res.ok) { const d = await res.json(); setActivities(prev => [d.activity, ...prev]); setNoteBody(''); }
        } finally { setBusyKey('act', false); }
    };

    const logFromNotes = async () => {
        if (!aiNotes.trim()) return;
        setBusyKey('ainotes', true); setLogSuggestion(null);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/log-from-notes`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiNotes.trim() }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok) {
                if (d.activity) setActivities(prev => [d.activity, ...prev]);
                setAiNotes('');
                if (d.suggestedStatus || d.suggestedTask) setLogSuggestion(d);
            }
        } finally { setBusyKey('ainotes', false); }
    };

    const runNextStep = async () => {
        setBusyKey('next', true);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/next-step`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (res.ok) setNextStep(await res.json());
        } finally { setBusyKey('next', false); }
    };

    const addTask = async (title, dueAt, assignee) => {
        const body = { title: (title ?? taskForm.title).trim(), dueAt: dueAt ?? (taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null), assigneeUserId: assignee ?? (taskForm.assignee || null) };
        if (!body.title) return;
        setBusyKey('task', true);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) { const d = await res.json(); setTasks(prev => [...prev, d.task]); setTaskForm({ title: '', dueAt: '', assignee: '' }); reload(); }
        } finally { setBusyKey('task', false); }
    };

    const completeTask = async (task) => {
        setTasks(prev => prev.filter(x => x.id !== task.id));
        await authFetch(`${API_BASE}/api/lead-studio/tasks/${task.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => reload());
        reload();
    };

    const addContact = async () => {
        if (!contactForm?.name?.trim()) { setContactForm(null); return; }
        const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactForm) });
        if (res.ok) { const d = await res.json(); setContacts(prev => [...prev, d.contact]); }
        setContactForm(null);
    };
    const makePrimary = async (c) => { await authFetch(`${API_BASE}/api/lead-studio/contacts/${c.id}/primary`, { method: 'POST' }); reload(); };
    const delContact = async (c) => { setContacts(prev => prev.filter(x => x.id !== c.id)); await authFetch(`${API_BASE}/api/lead-studio/contacts/${c.id}`, { method: 'DELETE' }).catch(() => reload()); };

    const applyNextStep = () => {
        if (!nextStep) return;
        if (nextStep.action?.type === 'email') onDraftEmail?.(lead);
        else if (nextStep.action?.type === 'task') {
            const due = nextStep.taskDueInDays != null ? new Date(Date.now() + nextStep.taskDueInDays * 86400000).toISOString() : null;
            addTask(nextStep.taskTitle || nextStep.suggestion, due, userId || null);
        }
        setNextStep(null);
    };

    const assigneeName = (id) => (teammates.find(m => m.id === id)?.name) || (id === userId ? t('leads.row.you', 'jij') : id) || '';

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
            <div className="w-[480px] max-w-full h-full overflow-y-auto bg-[var(--bg-primary)] border-l border-[var(--border-default)] shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{lead.companyName}</h3>
                            {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">{lead.website.replace(/^https?:\/\//, '')}</a>}
                        </div>
                        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"><X size={16} /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[var(--text-tertiary)]">{t('leads.col.status', 'Fase')}</span>
                            <select value={lead.status} onChange={e => patch({ status: e.target.value })} className="px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                                {STAGE_IDS.map(s => <option key={s} value={s}>{t(`leads.status.${s}`, s)}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[var(--text-tertiary)]">{t('crm.assignee', 'Toegewezen')}</span>
                            <select value={lead.assigneeUserId || ''} onChange={e => patch({ assigneeUserId: e.target.value || null })} className="px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                                <option value="">{t('leads.row.unassigned', 'Niet toegewezen')}</option>
                                {userId && !teammates.some(m => m.id === userId) && <option value={userId}>{t('leads.row.assign_me', 'Aan mij')}</option>}
                                {teammates.map(m => <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[var(--text-tertiary)]">{t('crm.deal_value', 'Deal-waarde (€)')}</span>
                            <input type="number" min="0" defaultValue={lead.dealValue ?? ''} onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (lead.dealValue ?? null)) patch({ dealValue: v }); }}
                                className="px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </label>
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[var(--text-tertiary)]">{t('crm.expected_close', 'Verwachte sluiting')}</span>
                            <input type="date" defaultValue={lead.expectedCloseAt || ''} onChange={e => patch({ expectedCloseAt: e.target.value || null })}
                                className="px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </label>
                    </div>
                    {lead.hotnessScore != null && (
                        <div className="mt-2 text-[11px] text-amber-600 flex items-center gap-1" title={lead.hotnessReason || ''}>
                            <Sparkles size={11} /> {t('crm.hotness', 'Prioriteit')}: {lead.hotnessScore}/100 {lead.hotnessReason ? `· ${lead.hotnessReason}` : ''}
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 space-y-4">
                    {/* AI next step */}
                    <section className="rounded-lg border border-[var(--border-default)] p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1"><Sparkles size={12} className="text-amber-500" /> {t('crm.next_step', 'Volgende stap (AI)')}</span>
                            <button onClick={runNextStep} disabled={busy.next} className="text-[11px] px-2 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                                {busy.next ? <Loader2 size={11} className="animate-spin" /> : t('crm.suggest', 'Voorstellen')}
                            </button>
                        </div>
                        {nextStep && (
                            <div className="mt-2 text-xs text-[var(--text-secondary)]">
                                <p className="text-[var(--text-primary)] font-medium">{nextStep.suggestion}</p>
                                {nextStep.rationale && <p className="text-[var(--text-tertiary)] mt-0.5">{nextStep.rationale}</p>}
                                {['email', 'task'].includes(nextStep.action?.type) && (
                                    <button onClick={applyNextStep} className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-[11px]" style={{ background: 'var(--accent-primary)' }}>
                                        {nextStep.action.type === 'email' ? <Mail size={11} /> : <Plus size={11} />}
                                        {nextStep.action.type === 'email' ? t('crm.draft_email', 'Stel e-mail op') : t('crm.create_task', 'Maak taak')}
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="mt-2 flex gap-1.5">
                            <button onClick={() => onResearch?.(lead.id)} disabled={busyResearchId === lead.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-sky-500/40 text-sky-600 hover:bg-sky-500/10 disabled:opacity-50">
                                {busyResearchId === lead.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} {t('leads.actions.research', 'Meer info zoeken')}
                            </button>
                            <button onClick={() => onDraftEmail?.(lead)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
                                <Mail size={11} /> {t('leads.actions.draft_email', 'E-mail opstellen')}
                            </button>
                        </div>
                    </section>

                    {/* Contacts */}
                    <section>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{t('contacts.title', 'Contactpersonen')}</span>
                            <button onClick={() => setContactForm(contactForm ? null : { name: '', title: '', email: '', phone: '', linkedinUrl: '' })} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><Plus size={13} /></button>
                        </div>
                        {/* Primary (from lead columns) */}
                        {(lead.ownerName || lead.email || lead.phone) && (
                            <div className="text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1.5 mb-1">
                                <div className="flex items-center gap-1 text-[var(--text-primary)] font-medium"><Star size={10} className="text-amber-500" /> {lead.ownerName || '—'} {lead.contactTitle && <span className="text-[var(--text-tertiary)] font-normal">· {lead.contactTitle}</span>}</div>
                                <div className="text-[var(--text-tertiary)] flex flex-wrap gap-x-3">{lead.email && <span className="inline-flex items-center gap-0.5"><Mail size={9} /> {lead.email}</span>}{lead.phone && <span className="inline-flex items-center gap-0.5"><Phone size={9} /> {lead.phone}</span>}{lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[var(--accent-primary)]"><Linkedin size={9} /> LinkedIn</a>}</div>
                            </div>
                        )}
                        {contacts.map(c => (
                            <div key={c.id} className="text-xs rounded border border-[var(--border-subtle)] px-2 py-1.5 mb-1 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[var(--text-primary)] truncate">{c.name} {c.title && <span className="text-[var(--text-tertiary)]">· {c.title}</span>}</div>
                                    <div className="text-[var(--text-tertiary)] flex flex-wrap gap-x-3">{c.email && <span>{c.email}</span>}{c.phone && <span>{c.phone}</span>}</div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => makePrimary(c)} title={t('contacts.make_primary', 'Maak primair')} className="text-[var(--text-tertiary)] hover:text-amber-500"><Star size={12} /></button>
                                    <button onClick={() => delContact(c)} title={t('common.delete', 'Verwijderen')} className="text-[var(--text-tertiary)] hover:text-rose-500"><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                        {contactForm && (
                            <div className="text-xs rounded border border-[var(--border-default)] p-2 space-y-1">
                                {[['name', 'contacts.name', 'Naam'], ['title', 'contacts.title_field', 'Functie'], ['email', 'contacts.email', 'E-mail'], ['phone', 'contacts.phone', 'Telefoon']].map(([f, key, fb]) => (
                                    <input key={f} value={contactForm[f] || ''} onChange={e => setContactForm(cf => ({ ...cf, [f]: e.target.value }))}
                                        placeholder={t(key, fb)} className="w-full px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                                ))}
                                <div className="flex justify-end gap-1"><button onClick={() => setContactForm(null)} className="px-2 py-0.5 text-[var(--text-secondary)]">{t('common.cancel', 'Annuleren')}</button><button onClick={addContact} className="px-2 py-0.5 rounded text-white" style={{ background: 'var(--accent-primary)' }}>{t('common.save', 'Opslaan')}</button></div>
                            </div>
                        )}
                    </section>

                    {/* Tasks */}
                    <section>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{t('tasks.title', 'Taken')}</span>
                        <div className="mt-1 space-y-1">
                            {tasks.map(tk => (
                                <div key={tk.id} className="text-xs flex items-center gap-2">
                                    <button onClick={() => completeTask(tk)} className="text-[var(--text-tertiary)] hover:text-emerald-500"><CheckCircle2 size={14} /></button>
                                    <span className="flex-1 text-[var(--text-primary)] truncate">{tk.title}</span>
                                    {tk.dueAt && <span className="text-[10px] text-[var(--text-tertiary)]">{formatRelativeTime(tk.dueAt)}</span>}
                                </div>
                            ))}
                            {!tasks.length && <div className="text-[11px] text-[var(--text-tertiary)]">{t('tasks.none', 'Geen open taken.')}</div>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                            <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder={t('tasks.add_ph', 'Nieuwe taak…')}
                                className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                            <input type="datetime-local" value={taskForm.dueAt} onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))}
                                className="px-1 py-1 text-[11px] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]" />
                            <button onClick={() => addTask()} disabled={busy.task || !taskForm.title.trim()} aria-label={t('tasks.add', 'Taak toevoegen')} className="p-1 rounded text-white disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}><Plus size={13} /></button>
                        </div>
                    </section>

                    {/* Activity timeline */}
                    <section>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{t('activity.title', 'Tijdlijn')}</span>
                        {/* Composer */}
                        <div className="mt-1 rounded border border-[var(--border-default)] p-2 space-y-1.5">
                            <div className="flex items-center gap-1">
                                <select value={noteType} onChange={e => setNoteType(e.target.value)} className="text-[11px] px-1 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                                    {ACTIVITY_TYPES.map(ty => <option key={ty} value={ty}>{t(`activity.type.${ty}`, ty)}</option>)}
                                </select>
                                <input value={noteBody} onChange={e => setNoteBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addActivity(); }} placeholder={t('activity.add_ph', 'Wat is er gebeurd?')}
                                    className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                                <button onClick={addActivity} disabled={busy.act || !noteBody.trim()} className="p-1 rounded text-white disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}><Plus size={13} /></button>
                            </div>
                            <div className="flex items-start gap-1">
                                <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)} rows={2} placeholder={t('crm.log_notes_ph', 'Plak ruwe notitie → AI structureert')}
                                    className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                                <button onClick={logFromNotes} disabled={busy.ainotes || !aiNotes.trim()} title={t('crm.log_from_notes', 'Loggen uit notitie (AI)')} className="p-1 rounded border border-amber-500/40 text-amber-600 hover:bg-amber-500/10 disabled:opacity-50">
                                    {busy.ainotes ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                                </button>
                            </div>
                            {logSuggestion && (
                                <div className="text-[11px] flex flex-wrap gap-1.5">
                                    {logSuggestion.suggestedStatus && <button onClick={() => { patch({ status: logSuggestion.suggestedStatus }); setLogSuggestion(s => ({ ...s, suggestedStatus: null })); }} className="px-2 py-0.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]">{t('crm.move_to', 'Naar fase')}: {t(`leads.status.${logSuggestion.suggestedStatus}`, logSuggestion.suggestedStatus)}</button>}
                                    {logSuggestion.suggestedTask && <button onClick={() => { const d = logSuggestion.suggestedTask.dueInDays != null ? new Date(Date.now() + logSuggestion.suggestedTask.dueInDays * 86400000).toISOString() : null; addTask(logSuggestion.suggestedTask.title, d, userId || null); setLogSuggestion(s => ({ ...s, suggestedTask: null })); }} className="px-2 py-0.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]">{t('crm.create_task', 'Maak taak')}: {logSuggestion.suggestedTask.title}</button>}
                                </div>
                            )}
                        </div>
                        {/* Feed */}
                        <ul className="mt-2 space-y-2">
                            {activities.map(a => {
                                const Icon = ACT_ICON[a.type] || FileText;
                                return (
                                    <li key={a.id} className="flex items-start gap-2 text-xs">
                                        <Icon size={12} className="mt-0.5 text-[var(--text-tertiary)] flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-[var(--text-primary)] break-words">{a.body}</div>
                                            <div className="text-[10px] text-[var(--text-tertiary)]">{formatRelativeTime(a.createdAt)}{a.actorUserId ? ` · ${assigneeName(a.actorUserId)}` : ''}</div>
                                        </div>
                                    </li>
                                );
                            })}
                            {!activities.length && <li className="text-[11px] text-[var(--text-tertiary)]">{t('activity.none', 'Nog geen activiteit.')}</li>}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
