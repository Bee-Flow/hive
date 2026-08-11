import React from 'react';

/**
 * Presentational shell for an AIConfig provider card: the bordered card
 * container + header (gradient icon tile, title, subtitle, status pills). The
 * card body (inputs + footer) is passed as `children`. Data plumbing stays in
 * each card (useProviderConfig / SecretInput / DeleteConfirmButtons).
 *
 * Extracted from AzureCard / RerankerConfig / EmbeddingsConfig / … which each
 * re-declared the identical container + header markup.
 */

// Shared input styling for the plain text inputs across provider cards.
export const PROVIDER_INPUT_CLS =
    'w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm';
export const PROVIDER_INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
};

// Literal class strings (NOT interpolated) so Tailwind's scanner keeps them.
const TONE_CLS = {
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    orange: 'bg-orange-500/20 text-orange-400',
};

/** A small rounded status pill (Endpoint / Key / model badges). */
export const ProviderStatusPill = ({ tone = 'green', children }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${TONE_CLS[tone] || TONE_CLS.green}`}>{children}</span>
);

export default function ProviderCardShell({ icon, iconGradient, title, subtitle, badges, children }) {
    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: iconGradient }}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                </div>
                {badges && <div className="flex gap-1.5">{badges}</div>}
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}
