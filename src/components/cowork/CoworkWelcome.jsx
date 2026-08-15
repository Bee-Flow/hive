/**
 * The empty-state header for Cowork, shared by the /app/work page and the
 * chat composer once the user flips the switch to Cowork.
 *
 * Flipping to Cowork changes what the box does — the next thing you type is
 * not answered here, it goes off and runs. Leaving "How can I help you?" above
 * it said the opposite of what the composer was about to do, so the heading
 * changes with the mode. Both surfaces read from this one file so the promise
 * is worded identically wherever it is made.
 */
import { Handshake } from 'lucide-react';
import React from 'react';

export const COWORK_HEADING = 'What can Bee Flow take off your plate?';
export const COWORK_SUBHEADING = 'Describe it once. It runs on its own — now, later, or every week.';

// Concrete enough to send as-is, generic enough to survive any workspace.
export const COWORK_STARTERS = [
    'Every Monday at 09:00, summarise the AI news from the past week with source links.',
    'Every weekday morning, give me a digest of what changed in my inbox overnight.',
    'On the 1st of each month, draft a short progress report from my meeting notes.',
    'Every Friday, list the open items from this week that nobody has answered yet.',
];

export function CoworkWelcomeHeader({ className = 'text-center mb-6' }) {
    return (
        <div className={className} data-testid="cowork-welcome">
            <div
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-4"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}
            >
                <Handshake className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h1
                className="font-semibold"
                style={{ fontSize: 'clamp(20px, 4.5vw, 30px)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
                {COWORK_HEADING}
            </h1>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                {COWORK_SUBHEADING}
            </p>
        </div>
    );
}

/**
 * The whole Cowork empty state as the chat surface needs it: heading, the
 * composer passed as children, then starters that fill the box rather than
 * sending anything — a schedule should never fire from a single click.
 */
export default function CoworkWelcome({ children, onStarterClick, isMobile = false }) {
    return (
        <div className={`w-full ${isMobile ? 'max-w-full px-1' : 'max-w-3xl'} mx-auto`}>
            <CoworkWelcomeHeader />
            {children}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {COWORK_STARTERS.map(text => (
                    <button
                        key={text}
                        type="button"
                        onClick={() => onStarterClick && onStarterClick(text)}
                        data-testid="cowork-starter"
                        className="px-3 py-2 rounded-xl border text-[12.5px] text-left transition-colors hover:border-[var(--border-default)]"
                        style={{
                            background: 'var(--bg-card)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            maxWidth: '100%',
                        }}
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
}
