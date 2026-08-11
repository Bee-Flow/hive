import { Ban, Repeat } from 'lucide-react';
import React from 'react';

/**
 * Two-card picker for the action taken when PII is detected. "Tokenize &
 * round-trip" replaces sensitive values with placeholders before the AI
 * sees them; "Block the message" rejects the turn outright. The emerald
 * border on the active option matches the rest of the privacy UI.
 *
 * Shared between the admin GuardrailsPanel and the personal
 * ConsumerPrivacySection so both stay visually aligned.
 */
export function PiiActionPicker({ value, onChange, tokenizeLabel, tokenizeHelp, blockLabel, blockHelp, footnote }) {
    const options = [
        {
            id: 'tokenize',
            label: tokenizeLabel || 'Tokenize & round-trip',
            desc: tokenizeHelp || 'Replace sensitive values with placeholders like [email_1] before the AI sees them. The real values are never sent to the model; BeeFlow swaps them back in the response. The user sees a small lock badge under their message.',
            Icon: Repeat,
        },
        {
            id: 'block',
            label: blockLabel || 'Block the message',
            desc: blockHelp || 'Reject the message before it leaves the organisation. The user is asked to rephrase without sensitive data.',
            Icon: Ban,
        },
    ];

    return (
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
            <label className="text-xs font-medium text-muted block mb-2">Action on detection</label>
            <div className="flex gap-2 flex-wrap">
                {options.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        className="flex-1 min-w-[180px] px-3 py-2.5 rounded-lg text-left transition-all"
                        style={{
                            background: value === opt.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)',
                            border: `1.5px solid ${value === opt.id ? '#10B981' : 'var(--border-subtle)'}`,
                        }}
                    >
                        <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: value === opt.id ? '#10B981' : 'var(--text-primary)' }}>
                            <opt.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{opt.label}</span>
                        </p>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </button>
                ))}
            </div>
            {footnote && (
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{footnote}</p>
            )}
        </div>
    );
}

export default PiiActionPicker;
