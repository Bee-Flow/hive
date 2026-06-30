import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Empty-state welcome for the AI assistant: a friendly intro + tappable
 * suggestion chips that PREFILL the composer (never auto-send). At least one
 * chip is derived from the current trigger so the prompt feels contextual.
 */
export default function AssistantWelcome({ triggerKind, onPick }) {
    const chips = [];
    if (triggerKind === 'schedule') chips.push('Summarise the latest activity and email me a digest');
    else if (triggerKind === 'app_event') chips.push('Filter these items, then draft a reply for each');
    else if (triggerKind === 'webhook') chips.push('Validate the incoming payload, then post it to Slack');
    else chips.push('Search my inbox and summarise the results');
    chips.push('Loop over the results and label each one');
    chips.push('Add a notification at the end of the flow');
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
            <span className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
                <Sparkles size={18} />
            </span>
            <div>
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">Build with the assistant</div>
                <div className="text-xs text-[var(--text-tertiary)] max-w-xs">
                    Describe what you want and it wires the trigger and steps for you.
                </div>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-xs">
                {chips.map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => onPick?.(c)}
                        className="text-left text-xs px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition"
                    >
                        {c}
                    </button>
                ))}
            </div>
        </div>
    );
}
