/**
 * Editing a cowork schedule.
 *
 * Everything the composer decided from one sentence is changeable here, in the
 * same words the user would use: what it should do, when it starts, how often
 * it repeats, which days, and who runs it. That matters because the schedule
 * was *inferred* — "elke ochtend" became 08:00 daily, and the only honest way
 * to ship an inference is to make it easy to correct.
 *
 * Local draft state, saved on submit: a schedule that rewrote itself on every
 * keystroke would fire a PUT per character, and a half-typed time is not a
 * schedule.
 */
import { Bot, Calendar, Clock, LayoutGrid, Repeat, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import AppsPicker from '../apps/AppsPicker';
import { COWORK_REPEAT_OPTIONS, toDateInput, toTimeInput } from './coworkSchedule';
import useCoworkApps from './useCoworkApps';

const DAYS = [
    { token: 'mon', label: 'Mo' },
    { token: 'tue', label: 'Tu' },
    { token: 'wed', label: 'We' },
    { token: 'thu', label: 'Th' },
    { token: 'fri', label: 'Fr' },
    { token: 'sat', label: 'Sa' },
    { token: 'sun', label: 'Su' },
];

/**
 * `as="div"` for fields whose control is not a single form element — wrapping
 * the Apps picker in a <label> would make a click anywhere in the row toggle
 * the first checkbox inside its overlay.
 */
function Field({ label, icon: Icon, children, hint, as: Tag = 'label' }) {
    return (
        <Tag className="block">
            <span
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {Icon && <Icon className="w-3.5 h-3.5" />}{label}
            </span>
            {children}
            {hint && (
                <span className="block text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{hint}</span>
            )}
        </Tag>
    );
}

const inputClass = 'w-full px-3 py-2 rounded-lg border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]';
const inputStyle = { borderColor: 'var(--border-subtle)' };

export default function CoworkEditForm({ item, agents = [], onSave, onCancel, saving = false, error = null }) {
    const initialRun = item.nextRunAt ? new Date(item.nextRunAt) : new Date();
    const [draft, setDraft] = useState({
        title: item.title || '',
        prompt: item.prompt || '',
        repeatInterval: item.repeatInterval || '',
        daysOfWeek: Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [],
        date: toDateInput(initialRun),
        time: toTimeInput(initialRun),
        agentId: item.agentId || '',
        // null until this item has a list of its own — it then inherits the
        // workspace-wide one, which is what it has been running on.
        enabledApps: Array.isArray(item.enabledApps) ? item.enabledApps : null,
    });

    const set = (patch) => setDraft(d => ({ ...d, ...patch }));

    // Scoped to THIS item: what it may touch when it runs unattended, which is
    // a narrower question than what you have switched on for chat.
    const { availableApps, isAppEnabled, toggleApp, hasOwnList } = useCoworkApps({
        value: draft.enabledApps,
        onChange: (next) => set({ enabledApps: next }),
    });
    const enabledCount = availableApps.filter(a => a.isStep || isAppEnabled(a.id)).length;

    const toggleDay = (token) => set({
        daysOfWeek: draft.daysOfWeek.includes(token)
            ? draft.daysOfWeek.filter(d => d !== token)
            : [...draft.daysOfWeek, token],
    });

    const submit = (e) => {
        e.preventDefault();
        const [y, m, d] = draft.date.split('-').map(Number);
        const [hh, mm] = draft.time.split(':').map(Number);
        const nextRun = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
        onSave({
            title: draft.title.trim(),
            prompt: draft.prompt.trim(),
            repeatInterval: draft.repeatInterval || null,
            // An empty list means "no day restriction", which the server stores
            // as null — sending [] would read as "never runs".
            daysOfWeek: draft.daysOfWeek.length > 0 ? draft.daysOfWeek : null,
            nextRunAt: Number.isNaN(nextRun.getTime()) ? item.nextRunAt : nextRun.toISOString(),
            // The stored wall-clock time has to follow the moment the user just
            // picked. It only feeds the schedule description the runner puts in
            // the prompt, but leaving it behind meant a job moved to 07:00 kept
            // telling the model it runs at 09:00.
            timeOfDay: /^([01]\d|2[0-3]):([0-5]\d)$/.test(draft.time) ? draft.time : null,
            agentId: draft.agentId || null,
            // Only sent once this item has a list of its own; null keeps it on
            // the workspace-wide default rather than freezing today's copy of it.
            enabledApps: draft.enabledApps,
        });
    };

    const canSave = draft.title.trim().length > 0 && draft.prompt.trim().length > 0 && !saving;

    return (
        <form onSubmit={submit} data-testid="cowork-edit-form" className="flex flex-col gap-4">
            <Field label="Name">
                <input
                    type="text"
                    value={draft.title}
                    onChange={e => set({ title: e.target.value })}
                    aria-label="Name"
                    data-testid="cowork-edit-title"
                    className={inputClass}
                    style={inputStyle}
                />
            </Field>

            <Field label="What it does" hint="This is the instruction Bee Flow runs, unattended, at the scheduled moment.">
                <textarea
                    value={draft.prompt}
                    onChange={e => set({ prompt: e.target.value })}
                    rows={5}
                    aria-label="What it does"
                    data-testid="cowork-edit-prompt"
                    className={`${inputClass} resize-y leading-relaxed`}
                    style={inputStyle}
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Next run" icon={Calendar}>
                    <input
                        type="date"
                        value={draft.date}
                        onChange={e => set({ date: e.target.value })}
                        aria-label="Next run date"
                        data-testid="cowork-edit-date"
                        className={inputClass}
                        style={inputStyle}
                    />
                </Field>
                <Field label="At" icon={Clock}>
                    <input
                        type="time"
                        value={draft.time}
                        onChange={e => set({ time: e.target.value })}
                        aria-label="Next run time"
                        data-testid="cowork-edit-time"
                        className={inputClass}
                        style={inputStyle}
                    />
                </Field>
            </div>

            <Field label="Repeat" icon={Repeat}>
                <select
                    value={draft.repeatInterval}
                    onChange={e => set({ repeatInterval: e.target.value })}
                    aria-label="Repeat"
                    data-testid="cowork-edit-repeat"
                    className={inputClass}
                    style={inputStyle}
                >
                    {COWORK_REPEAT_OPTIONS.map(o => (
                        <option key={o.value || 'once'} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </Field>

            {draft.repeatInterval && (
                <Field label="Only on" hint="Leave all off to use the repeat as-is.">
                    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Only on">
                        {DAYS.map(({ token, label }) => {
                            const on = draft.daysOfWeek.includes(token);
                            return (
                                <button
                                    key={token}
                                    type="button"
                                    onClick={() => toggleDay(token)}
                                    aria-pressed={on}
                                    aria-label={token}
                                    data-testid={`cowork-edit-day-${token}`}
                                    className="w-9 h-9 rounded-lg border text-[12px] font-medium transition-colors"
                                    style={{
                                        borderColor: on ? 'color-mix(in srgb, var(--accent-primary) 45%, transparent)' : 'var(--border-subtle)',
                                        background: on ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </Field>
            )}

            {availableApps.length > 0 && (
                <Field
                    as="div"
                    label="Apps it may use"
                    icon={LayoutGrid}
                    hint={hasOwnList
                        ? 'Only these apps are available to this cowork when it runs, whatever you have switched on elsewhere.'
                        : 'Following your workspace-wide list. Switch anything here and this cowork keeps its own list from then on.'}
                >
                    <div
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg border"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                    >
                        <AppsPicker
                            apps={availableApps}
                            isAppEnabled={isAppEnabled}
                            toggleApp={toggleApp}
                        />
                        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {enabledCount} of {availableApps.length} enabled
                        </span>
                        {hasOwnList && (
                            <button
                                type="button"
                                onClick={() => set({ enabledApps: null })}
                                data-testid="cowork-apps-reset"
                                className="ml-auto text-[11.5px] hover:underline"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Follow my workspace list
                            </button>
                        )}
                    </div>
                </Field>
            )}

            {agents.length > 0 && (
                <Field label="Run as" icon={Bot} hint="An agent brings its own skills, knowledge and connected apps.">
                    <select
                        value={draft.agentId}
                        onChange={e => set({ agentId: e.target.value })}
                        aria-label="Run as"
                        data-testid="cowork-edit-agent"
                        className={inputClass}
                        style={inputStyle}
                    >
                        <option value="">No agent</option>
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name || 'Untitled agent'}</option>
                        ))}
                    </select>
                </Field>
            )}

            {error && (
                <p className="text-[12px] text-red-600 dark:text-red-400" role="alert">{error}</p>
            )}

            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={!canSave}
                    data-testid="cowork-edit-save"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)', color: 'var(--accent-on-primary, #fff)' }}
                >
                    <Save className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Save'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    data-testid="cowork-edit-cancel"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                    <X className="w-3.5 h-3.5" />Cancel
                </button>
            </div>
        </form>
    );
}
