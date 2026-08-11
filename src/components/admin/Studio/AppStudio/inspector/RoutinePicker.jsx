import { Plus, Search, Workflow } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { INPUT_CLS } from './panels/kit';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import Modal from '../../../../shared/Modal';
import Spinner from '../../../../shared/Spinner';

/**
 * RoutinePicker — modal search over the user's routines (automations),
 * using the same listAutomations() the AITasksDesigner sidebar uses
 * (GET /api/automation → { automations }). `onPick` receives the FULL
 * automation object so the caller can read its trigger contract
 * (agent_call parametersSchema → input-mapping prefill).
 *
 * Routines with an `app_trigger` trigger sort first ("Built for apps" —
 * the purpose-built kind: typed inputs incl. files), then `agent_call`
 * ("Best for apps" — a typed contract, built to be invoked
 * programmatically), then everything else.
 */

const TRIGGER_LABELS = {
    app_trigger: 'Studio App',
    agent_call: 'Agent call',
    schedule: 'Schedule',
    webhook: 'Webhook',
    app_event: 'App event',
    manual: 'Manual',
};

/**
 * The badges beside a routine's name.
 *
 * They used to be hardcoded Tailwind hues — emerald-500 and sky-500 text on a
 * 10%-alpha tint of the same hue — which lands near 2.2:1 at 10px and ignores
 * the theme entirely. They carry no meaning a colour needs to encode ("Active",
 * "Built for apps"), so they read as ordinary chips in the token palette, at
 * the same 11px the trigger-kind chip beside them already uses.
 */
const PILL_CLS = 'shrink-0 text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium';

// Lower sorts first: contract-carrying kinds lead the list.
const KIND_RANK = { app_trigger: 0, agent_call: 1 };

function triggerKindOf(automation) {
    return automation?.definition?.trigger?.kind || automation?.triggerType || 'manual';
}

export default function RoutinePicker({ open, onClose, onPick, formFields = [] }) {
    return (
        <Modal open={open} onClose={onClose} title="Choose a routine" size="lg">
            {/* Body mounts fresh on every open, so search + results reset. */}
            {open ? <RoutinePickerBody onPick={onPick} formFields={formFields} /> : null}
        </Modal>
    );
}

function RoutinePickerBody({ onPick, formFields }) {
    const api = useAutomationApi();
    const [automations, setAutomations] = useState(null); // null = loading
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.listAutomations()
            .then((r) => { if (!cancelled) setAutomations(r.automations || []); })
            .catch((e) => { if (!cancelled) { setError(e.message); setAutomations([]); } });
        return () => { cancelled = true; };
    }, [api]);

    const filtered = useMemo(() => {
        const list = automations || [];
        const q = query.trim().toLowerCase();
        const matches = q
            ? list.filter((a) =>
                (a.title || '').toLowerCase().includes(q)
                || (a.description || '').toLowerCase().includes(q))
            : list;
        // Contract-carrying kinds first: app_trigger, then agent_call.
        return [...matches].sort((a, b) => {
            const aa = KIND_RANK[triggerKindOf(a)] ?? 2;
            const bb = KIND_RANK[triggerKindOf(b)] ?? 2;
            return aa - bb;
        });
    }, [automations, query]);

    return (
        <div className="flex flex-col gap-3">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                    type="text"
                    className={`${INPUT_CLS} pl-9`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search routines…"
                    aria-label="Search routines"
                    spellCheck={false}
                />
            </div>

            {automations === null && (
                <div className="flex items-center justify-center py-8"><Spinner size="sm" /></div>
            )}
            {error && (
                <p className="text-xs text-rose-500 py-2">Could not load routines: {error}</p>
            )}
            {automations !== null && !error && filtered.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
                    {query ? 'No routines match your search.' : 'No routines yet.'}
                </p>
            )}

            {/* There was no way out of here but to leave: the empty state said
                "build one in Routines first", so wiring a button to new work
                meant abandoning the app editor. This makes one, already shaped
                for this app — a Studio App trigger whose inputs are the fields
                of the form the action sits in. */}
            {automations !== null && !error ? (
                <CreateRoutineRow formFields={formFields} onCreated={onPick} />
            ) : null}

            <ul className="flex flex-col gap-1.5" aria-label="Routines">
                {filtered.map((a) => {
                    const kind = triggerKindOf(a);
                    return (
                        <li key={a.id}>
                            <button
                                type="button"
                                onClick={() => onPick(a)}
                                className="w-full text-left rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]/40 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Workflow className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
                                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                                        {a.title || 'Untitled routine'}
                                    </span>
                                    {a.isActive && (
                                        <span className={PILL_CLS}>
                                            Active
                                        </span>
                                    )}
                                    <span className="shrink-0 ml-auto text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                        {TRIGGER_LABELS[kind] || kind}
                                    </span>
                                    {kind === 'app_trigger' && (
                                        <span className={PILL_CLS}>
                                            Built for apps
                                        </span>
                                    )}
                                    {kind === 'agent_call' && (
                                        <span className={PILL_CLS}>
                                            Best for apps
                                        </span>
                                    )}
                                </div>
                                {a.description ? (
                                    <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">{a.description}</p>
                                ) : null}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/**
 * Make a routine from here, already shaped for this app.
 *
 * It gets an `app_trigger`, whose declared params become `trigger.output.<name>`
 * inside the routine — the purpose-built contract for being called by an app.
 * The params are seeded from the fields of the form the action sits in, so the
 * input mapping the picker fills in afterwards lines up with no typing.
 *
 * `automations` is a separately licensed feature, so a 403 gets a sentence
 * rather than a stack trace: the person can still pick an existing routine.
 */
function CreateRoutineRow({ formFields, onCreated }) {
    const api = useAutomationApi();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // app_trigger param names are /^[A-Za-z][A-Za-z0-9_]{0,59}$/ and a leading
    // underscore is reserved for the audit keys the payload carries.
    const params = (formFields || [])
        .filter((f) => /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(f.name || ''))
        .slice(0, 50)
        .map((f) => ({
            name: f.name,
            type: f.type === 'input_file' ? 'file' : f.type === 'input_number' ? 'number' : f.type === 'input_checkbox' ? 'boolean' : 'string',
            required: false,
            description: '',
        }));

    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const { automation } = await api.createAutomation({
                title: 'New routine for this app',
                description: 'Called by a Studio app action.',
                triggerType: 'manual',
                definition: {
                    trigger: { id: 'trg', type: 'trigger', kind: 'app_trigger', params },
                    steps: [],
                    edges: [],
                },
            });
            onCreated(automation);
        } catch (e) {
            const message = String(e?.message || e);
            setError(/403|forbidden|licen/i.test(message)
                ? 'Routines are not part of this plan, so a new one cannot be made here. An existing routine still works.'
                : message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
            <button
                type="button"
                onClick={create}
                disabled={busy}
                className="self-start inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Making it…' : 'Make a routine for this app'}
            </button>
            <span className="text-[11px] text-[var(--text-secondary)]">
                {params.length
                    ? `It starts with ${params.length} input${params.length === 1 ? '' : 's'} matching this form.`
                    : 'It starts with a Studio App trigger, ready for inputs.'}
            </span>
            {error ? <span className="text-[11px] text-[var(--error)]">{error}</span> : null}
        </div>
    );
}
