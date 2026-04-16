/**
 * useDlpDecision — client-side glue for the pre-flight DLP preview modal.
 *
 * The server emits `dlp_preview` when a prompt needs user review (sensitive
 * content detected, provider is external, org mode is 'ask'). This hook
 * listens for those events via a custom window event bus (dispatched from
 * the chat SSE reducer) and drives the `<DlpPreviewModal>` component.
 *
 * Flow:
 *   1. SSE handler dispatches window event 'beeflow:dlp_preview' with detail.
 *   2. Hook stores it in `pending`, which renders the modal.
 *   3. User picks Redact / Block / Allow → we POST `/api/chat/dlp-decision`.
 *   4. Hook clears `pending`.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

export default function useDlpDecision() {
    const [pending, setPending] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const onPreview = (e) => {
            setPending(e.detail || null);
            setError(null);
        };
        const onResolved = () => {
            // The modal closes itself when the decision is sent, but if another
            // client path resolves first (e.g. a second tab), clear here too.
            setPending(null);
        };
        const onBlocked = () => setPending(null);

        window.addEventListener('beeflow:dlp_preview', onPreview);
        window.addEventListener('beeflow:dlp_resolved', onResolved);
        window.addEventListener('beeflow:dlp_blocked', onBlocked);
        return () => {
            window.removeEventListener('beeflow:dlp_preview', onPreview);
            window.removeEventListener('beeflow:dlp_resolved', onResolved);
            window.removeEventListener('beeflow:dlp_blocked', onBlocked);
        };
    }, []);

    const submit = useCallback(async (choice, { rememberForConversation = false } = {}) => {
        if (!pending?.decisionId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/chat/dlp-decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decisionId: pending.decisionId,
                    choice,
                    rememberForConversation,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Request failed (${res.status})`);
            }
            setPending(null);
        } catch (err) {
            setError(err.message || 'Failed to send decision.');
        } finally {
            setSubmitting(false);
        }
    }, [pending]);

    const cancel = useCallback(() => {
        // Default cancel = block, matching the server's fail-closed timeout behaviour.
        submit('block');
    }, [submit]);

    return { pending, submit, cancel, submitting, error };
}
