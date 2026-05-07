import React from 'react';
import { Sparkles, Plus, Mail, Clock, MessageSquare } from 'lucide-react';

/**
 * Right-pane empty state shown when no routine is selected. Mirrors
 * SkillsStudio EmptyState layout (centered, generous padding, single
 * CTA), with three example-prompt cards below to give first-time users
 * a one-click way into the chat builder.
 *
 * Selecting an example prefills the chat input via `onUseExample(text)`.
 * The parent then opens a fresh builder draft.
 */
export default function RoutinesEmptyState({ segment, onCreateAutomation, onCreateTask, onUseExample }) {
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
        <div className="h-full flex flex-col items-center justify-center px-6 py-10">
            <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center bg-[var(--bg-secondary)]">
                <Sparkles size={28} className="opacity-60" style={{ color: 'var(--accent-primary, var(--text-primary))' }} />
            </div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Build an automation in plain English
            </div>
            <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center leading-relaxed">
                Describe a trigger and what should happen. The builder wires the steps,
                runs a dry-run, and shows you the diagram before going live.
            </div>
            <button
                onClick={onCreateAutomation}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white mb-8"
                style={{ background: 'var(--accent-primary, var(--text-primary))' }}
            >
                <Sparkles size={15} /> Build with AI
            </button>

            <div className="w-full max-w-2xl">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-3 text-center">
                    Or start from an example
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {EXAMPLES.map((ex) => {
                        const Icon = ex.icon;
                        return (
                            <button
                                key={ex.title}
                                onClick={() => onUseExample(ex.prompt)}
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
        </div>
    );
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
