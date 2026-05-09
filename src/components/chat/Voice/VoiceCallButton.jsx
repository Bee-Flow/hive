/**
 * VoiceCallButton — Composer toggle that switches the InputArea into
 * voice mode. No more modal overlay: voice UI lives embedded inside
 * the composer (see VoiceInlinePanel) and completed turns flow into
 * the real chat conversation as regular messages.
 *
 * Visibility rules (the button renders nothing unless ALL are true):
 *   1. The current user has the `voice_chat` beta feature enabled
 *      (admins always do).
 *   2. The server probe /ai/config reports `voiceChatReady: true`
 *      (a Mistral API key is configured).
 */

import React, { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function VoiceCallButton({
    user,
    voiceMode = false,
    onToggleVoiceMode,
    className = '',
}) {
    const [ready, setReady] = useState(null);

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

    const active = !!voiceMode;

    return (
        <button
            type="button"
            onClick={() => onToggleVoiceMode?.(!active)}
            className={[
                'p-2 rounded-lg transition-colors relative',
                active
                    ? 'text-emerald-400 bg-emerald-500/15'
                    : 'text-[var(--text-tertiary)] hover:text-emerald-400 hover:bg-emerald-500/10',
                className,
            ].join(' ')}
            title={active ? 'Exit voice mode' : 'Voice Chat (Beta) — talk with your assistant'}
            aria-label={active ? 'Exit voice mode' : 'Start voice chat'}
            aria-pressed={active}
            data-testid="voice-chat-button"
        >
            <Phone className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 text-[8px] font-bold uppercase px-1 rounded-sm bg-amber-500/90 text-black leading-tight">
                β
            </span>
        </button>
    );
}
