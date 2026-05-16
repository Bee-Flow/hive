import React, { useEffect, useState } from 'react';
import { Plus, Mail, Clock, MessageSquare, CheckCircle2, AlertTriangle, Clock as ClockIcon, Play } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import TemplateGallery from './TemplateGallery';

/**
 * Right-pane empty state shown when no routine is selected. Mirrors
 * SkillsStudio EmptyState layout (centered, generous padding, single
 * CTA), with three example-prompt cards below to give first-time users
 * a one-click way into the chat builder.
 *
 * Selecting an example prefills the chat input via `onUseExample(text)`.
 * The parent then opens a fresh builder draft.
 */
export default function RoutinesEmptyState({ segment, onCreateAutomation, onCreateTask, onUseExample, onOpenAutomation, onPickTemplate }) {
    if (segment === 'prompt_task') {
        return (
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center bg-[var(--bg-secondary)]">
                    <Clock size={28} className="text-[var(--text-primary)] opacity-60" />
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Schedule a routine
                </div>
                <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center leading-relaxed">
                    Recurring AI workflows — weekly digests, daily reports, lead summaries.
                    Results land in your notifications when ready.
                </div>
                <button
                    onClick={onCreateTask}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                >
                    <Plus size={15} /> New routine
                </button>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-10">
                <div className="flex flex-col items-center text-center">
                    <div className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        Build an automation in plain English
                    </div>
                    <div className="text-sm text-[var(--text-tertiary)] mb-5 max-w-md leading-relaxed">
                        Describe a trigger and what should happen. The builder wires the steps,
                        runs a dry-run, and shows you the diagram before going live.
                    </div>
                    <button
                        onClick={onCreateAutomation}
                        className="px-5 py-2 rounded-full text-sm font-semibold text-white"
                        style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                    >
                        Build with AI
                    </button>
                </div>

                <div className="mt-8">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-3 text-center">
                        Or start from an example
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {EXAMPLES.map((ex, i) => {
                            const Icon = ex.icon;
                            return (
                                <button
                                    key={`example-${i}`}
                                    onClick={() => {
                                        try { onUseExample(ex.prompt); }
                                        catch (err) { console.error('[EmptyState] onUseExample threw:', err); }
                                    }}
                                    className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition p-4"
                                >
                                    <Icon size={16} className="text-[var(--text-secondary)] mb-2" />
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                        {ex.title}
                                    </div>
                                    <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed line-clamp-3">
                                        {ex.prompt}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {onPickTemplate && (
                    <div className="mt-10">
                        <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-3 text-center">
                            Or pick a ready-made template
                        </div>
                        <TemplateGallery onPick={onPickTemplate} />
                    </div>
                )}

                <RecentRunsFeed onOpenAutomation={onOpenAutomation} />
            </div>
        </div>
    );
}

/**
 * Cross-automation activity feed shown on the empty pane. Sources from
 * GET /api/automation/_runs/recent — same data as the per-automation Run
 * History tab, just unioned across the user's automations.
 *
 * Helps users spot a single failed run without clicking into each
 * automation. Clicking a row jumps into that automation's builder
 * (`onOpenAutomation(id)` callback wired by the parent).
 */
function RecentRunsFeed({ onOpenAutomation }) {
    const api = useAutomationApi();
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        api.listRecentRuns(25)
            .then(d => { if (alive) setRuns(d.runs || []); })
            .catch(e => { if (alive) setError(e.message); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
        // useAutomationApi is memoised so `api` is a stable reference —
        // including it in deps satisfies exhaustive-deps without causing
        // a re-fetch loop. If auth refreshes and `api` is rebuilt, we
        // want the recent-runs feed to refresh too.
    }, [api]);

    if (error) {
        return (
            <div className="mt-10 text-xs text-[var(--text-tertiary)] text-center">
                Could not load activity: {error}
            </div>
        );
    }

    return (
        <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                    Recent activity (all automations)
                </div>
                {!loading && runs.length > 0 && (
                    <div className="text-[11px] text-[var(--text-tertiary)]">{runs.length} run{runs.length === 1 ? '' : 's'}</div>
                )}
            </div>

            {loading && (
                <div className="text-xs text-[var(--text-tertiary)] py-4 text-center">Loading…</div>
            )}
            {!loading && runs.length === 0 && (
                <div className="text-xs text-[var(--text-tertiary)] py-6 text-center border border-dashed border-[var(--border-default)] rounded-lg">
                    No runs yet. Activate an automation or click Run on one to see activity here.
                </div>
            )}
            {!loading && runs.length > 0 && (
                <div className="rounded-xl border border-[var(--border-default)] overflow-hidden divide-y divide-[var(--border-default)]">
                    {runs.map(r => (
                        <button
                            key={r.id}
                            onClick={() => {
                                if (!r.automationId) return;
                                try { onOpenAutomation?.(r.automationId); }
                                catch (err) { console.error('[RecentRunsFeed] onOpenAutomation threw:', err); }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-left transition"
                        >
                            <RunStatusIcon status={r.status} mode={r.mode} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-[var(--text-primary)] truncate">
                                    {r.automationTitle || 'Untitled automation'}
                                </div>
                                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                                    {r.mode === 'dry_run' ? 'Dry-run' : (r.triggerKind || r.automationTriggerType || 'manual')}
                                    {r.summary ? ` — ${r.summary}` : ''}
                                </div>
                            </div>
                            <RunStatusBadge status={r.status} mode={r.mode} />
                            <span className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
                                {r.startedAt ? formatRelative(r.startedAt) : '—'}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function RunStatusIcon({ status }) {
    if (status === 'success') return <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />;
    if (status === 'error')   return <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />;
    if (status === 'running') return <ClockIcon size={14} className="text-amber-500 flex-shrink-0" />;
    if (status === 'awaiting_confirm') return <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />;
    return <Play size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />;
}

function RunStatusBadge({ status, mode }) {
    const cls = status === 'success' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : status === 'error' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
        : status === 'running' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : status === 'awaiting_confirm' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${cls}`}>
            {mode === 'dry_run' ? 'dry-run' : status}
        </span>
    );
}

function formatRelative(iso) {
    try {
        const t = new Date(iso).getTime();
        const diff = Date.now() - t;
        const m = Math.round(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.round(h / 24);
        if (d < 7) return `${d}d ago`;
        return new Date(iso).toLocaleDateString();
    } catch {
        return iso;
    }
}

const EXAMPLES = [
    {
        icon: Mail,
        title: 'Auto-reply emails',
        prompt: 'When a new email arrives from a specific sender, draft a friendly reply with AI and send it back automatically.',
    },
    {
        icon: Clock,
        title: 'Weekly digest',
        prompt: 'Every Monday at 9am, summarise unread Gmail labelled "invoices" into one report and send it to me.',
    },
    {
        icon: MessageSquare,
        title: 'Calendar prep',
        prompt: 'Every weekday at 8am, email me a digest of today\'s calendar events with relevant context.',
    },
];
