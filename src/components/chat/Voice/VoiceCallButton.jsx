/**
 * VoiceCallButton — Composer affordance that opens the Voice Chat modal.
 *
 * Visibility rules (the button renders nothing unless ALL are true):
 *   1. The current user has the `voice_chat` beta feature enabled
 *      (admins and demo users always do).
 *   2. A Mistral API key is configured on the server (`/ai/config`
 *      returns `voiceChatReady: true`).
 *
 * Keeping both checks in the component (instead of elsewhere) means we
 * can show a helpful tooltip when the user is eligible but the key is
 * missing — instead of just hiding silently.
 */

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Phone } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const VoiceCallModal = lazy(() => import('./VoiceCallModal'));

export default function VoiceCallButton({ user, agentName, className = '' }) {
    const [ready, setReady] = useState(null); // null = probing, false = hide, true = show
    const [open, setOpen] = useState(false);

    const hasBetaFlag = !!(
        user?.isAdmin ||
        user?.permissions?.includes('all') ||
        (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('voice_chat'))
    );

    useEffect(() => {
        let cancelled = false;
        if (!hasBetaFlag) { setReady(false); return; }
        (async () => {
            try {
                const resp = await authFetch(`${API_BASE}/ai/config`);
                if (!resp.ok) { if (!cancelled) setReady(false); return; }
                const cfg = await resp.json();
                if (!cancelled) setReady(!!cfg.voiceChatReady);
            } catch (_) {
                if (!cancelled) setReady(false);
            }
        })();
        return () => { cancelled = true; };
    }, [hasBetaFlag]);

    if (!hasBetaFlag || !ready) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`p-2 rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-emerald-400 hover:bg-emerald-500/10 relative ${className}`}
                title="Voice Chat (Beta) — talk with your assistant"
                aria-label="Start voice chat"
                data-testid="voice-chat-button"
            >
                <Phone className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold uppercase px-1 rounded-sm bg-amber-500/90 text-black leading-tight">
                    β
                </span>
            </button>
            {open && (
                <Suspense fallback={null}>
                    <VoiceCallModal open={open} onClose={() => setOpen(false)} agentName={agentName} />
                </Suspense>
            )}
        </>
    );
}
