import React from 'react';
import { CHANNEL_OPTIONS } from './notificationDefaults';

/**
 * "Send to" — the delivery channels for a notification, as pressable pills.
 *
 * One component for two callers: the per-automation notification policy
 * (SettingsTab) and the Notification STEP's own editor (SettingsForm). The step
 * editor never had one, so a step could only say what to send, never where —
 * users had no way to tell whether it went anywhere at all (BFSF-350). Email
 * delivery worked the whole time; it was simply unreachable outside the JSON tab.
 *
 * The bell is always on and non-removable (the runner rejects a notification
 * with no known channel), and Slack/Push render disabled — there is no backend
 * for them, and a pill that silently does nothing is worse than one that says
 * "soon".
 */
export default function ChannelPills({ channels = [], onToggle, caption = 'Send to', disabled = false, className = '' }) {
    return (
        <div className={`flex items-center flex-wrap gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}>
            {caption && (
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mr-0.5">{caption}</span>
            )}
            {CHANNEL_OPTIONS.map((opt) => {
                const active = opt.always || channels.includes(opt.key);
                const locked = opt.always || opt.comingSoon;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        disabled={locked}
                        aria-pressed={active}
                        onClick={() => { if (!locked) onToggle?.(opt.key); }}
                        title={opt.comingSoon ? 'Coming soon' : opt.always ? 'Always on' : ''}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                            active
                                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        } ${opt.comingSoon ? 'opacity-50 cursor-not-allowed' : opt.always ? 'cursor-default' : ''}`}
                    >
                        {opt.label}{opt.comingSoon ? ' · soon' : ''}
                    </button>
                );
            })}
        </div>
    );
}
