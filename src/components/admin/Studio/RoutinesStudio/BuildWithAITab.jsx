import React from 'react';
import { Mail, Clock, MessageSquare } from 'lucide-react';

/**
 * "Build with AI" tab of the refactored Routines start screen. Holds the
 * hero + primary "Build with AI" CTA and three example quick-start cards.
 *
 * Layout-agnostic: the parent tab shell owns the scroll container and
 * width (`max-w-3xl mx-auto px-6 py-8`), so this returns just the section
 * content. Selecting an example prefills the chat input via
 * `onUseExample(text)`; the CTA opens a fresh builder draft via
 * `onCreateAutomation()`.
 */
export default function BuildWithAITab({ onCreateAutomation, onUseExample }) {
    return (
        <div>
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
                                    catch (err) { console.error('[BuildWithAITab] onUseExample threw:', err); }
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
