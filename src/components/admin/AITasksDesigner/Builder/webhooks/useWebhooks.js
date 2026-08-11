import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { useBuilderConfirm } from '../BuilderConfirmContext';

/**
 * All the state and actions behind an automation's inbound webhooks, extracted
 * from WebhookPanel so it can drive two surfaces (BFSF-320):
 *
 *   - `WebhookPanel` — the full manager in the Settings tab
 *   - `TriggerWebhookPanel` — the compact per-trigger-node view in the NDV,
 *     which is where users actually expect to find the URL
 *
 * Notes carried over from the original panel:
 *   - Listing returns metadata only; the secret is never re-readable once
 *     issued. The secret box is therefore only populated straight after Create
 *     or Rotate and goes blank on refresh.
 *   - Requests must be HMAC-signed: the caller generates a unique
 *     `X-BeeFlow-Nonce`, then computes
 *     `sha256=hex(HMAC-SHA256(secret, nonce + "\n" + JSON-body))` and sends it
 *     as `X-BeeFlow-Signature`. The nonce MUST be part of the signed message —
 *     signing the body alone lets a captured request be replayed under a new
 *     nonce.
 *   - Rotate is destructive: any caller still on the old secret starts getting
 *     401s the moment the new secret hits the DB.
 *
 * @param {object|null} automation
 * @param {object}  [options]
 * @param {string|null} [options.triggerStepId]
 *        When set, `webhooks` is filtered to the ones scoped to that trigger
 *        node and newly created webhooks are scoped to it. When null (the
 *        Settings panel), every webhook on the automation is listed.
 */
const REVEAL_AUTO_MASK_MS = 30_000;

export default function useWebhooks(automation, { triggerStepId = null } = {}) {
    const api = useAutomationApi();
    const confirmAction = useBuilderConfirm();
    const [allWebhooks, setAllWebhooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [revealedSecrets, setRevealedSecrets] = useState({}); // id → secret (in-memory only)
    const [visibleSecretIds, setVisibleSecretIds] = useState({}); // id → currently shown vs masked
    const [copied, setCopied] = useState(null); // key of the control just copied
    const [errorMsg, setErrorMsg] = useState(null);

    // Auto-mask timers — one per webhook id whose secret is currently shown. We
    // keep secrets in memory but re-mask them after a window so the panel
    // doesn't shoulder-surf a value into a screenshare.
    const maskTimersRef = useRef({});
    const scheduleAutoMask = useCallback((id) => {
        const existing = maskTimersRef.current[id];
        if (existing) clearTimeout(existing);
        maskTimersRef.current[id] = setTimeout(() => {
            setVisibleSecretIds((prev) => ({ ...prev, [id]: false }));
            delete maskTimersRef.current[id];
        }, REVEAL_AUTO_MASK_MS);
    }, []);
    const cancelAutoMask = useCallback((id) => {
        if (maskTimersRef.current[id]) {
            clearTimeout(maskTimersRef.current[id]);
            delete maskTimersRef.current[id];
        }
    }, []);
    useEffect(() => () => {
        for (const id of Object.keys(maskTimersRef.current)) clearTimeout(maskTimersRef.current[id]);
        maskTimersRef.current = {};
    }, []);

    const reload = useCallback(async () => {
        if (!automation?.id) return [];
        setLoading(true);
        try {
            const r = await api.listWebhooks(automation.id);
            const list = r.webhooks || [];
            setAllWebhooks(list);
            // Prune revealed secrets for webhooks that no longer exist server-side
            // (e.g. deleted in another tab). Secrets for ids still in the list are
            // kept so a user who just created/rotated doesn't lose them on refresh.
            setRevealedSecrets((prev) => {
                const aliveIds = new Set(list.map((w) => w.id));
                const next = {};
                for (const [id, secret] of Object.entries(prev)) {
                    if (aliveIds.has(id)) next[id] = secret;
                }
                return next;
            });
            return list;
        } catch (e) {
            setErrorMsg(e.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [api, automation?.id]);

    useEffect(() => { reload(); }, [reload]);

    // Clear revealed secrets when the user navigates between automations.
    useEffect(() => { setRevealedSecrets({}); }, [automation?.id]);

    // Scoped view: a trigger node only ever shows ITS own webhooks. Rows created
    // before per-node scoping existed carry triggerStepId === null; they belong
    // to the primary trigger, so surface them there rather than orphaning them.
    const webhooks = useMemo(() => {
        if (!triggerStepId) return allWebhooks;
        const isPrimary = automation?.definition?.trigger?.id === triggerStepId;
        return allWebhooks.filter(w => w.triggerStepId === triggerStepId || (isPrimary && !w.triggerStepId));
    }, [allWebhooks, triggerStepId, automation?.definition?.trigger?.id]);

    const rememberSecret = useCallback((id, secret) => {
        if (!secret) return;
        setRevealedSecrets((prev) => ({ ...prev, [id]: secret }));
        setVisibleSecretIds((prev) => ({ ...prev, [id]: true }));
        scheduleAutoMask(id);
    }, [scheduleAutoMask]);

    const create = useCallback(async () => {
        if (!automation?.id) return null;
        setCreating(true);
        setErrorMsg(null);
        try {
            const r = await api.createWebhook(automation.id, triggerStepId);
            const wh = r?.webhook;
            if (wh) rememberSecret(wh.id, wh.secret);
            await reload();
            return wh || null;
        } catch (e) {
            setErrorMsg(e.message);
            return null;
        } finally {
            setCreating(false);
        }
    }, [api, automation?.id, triggerStepId, rememberSecret, reload]);

    const rotate = useCallback(async (wh) => {
        const ok = await confirmAction({
            title: 'Rotate the secret?',
            description: 'Any caller still using the old secret immediately starts getting 401 errors.',
            confirmLabel: 'Rotate',
            destructive: true,
        });
        if (!ok) return;
        setErrorMsg(null);
        try {
            const r = await api.rotateWebhook(automation.id, wh.id);
            rememberSecret(wh.id, r?.webhook?.secret);
            await reload();
        } catch (e) {
            setErrorMsg(e.message);
        }
    }, [api, automation?.id, rememberSecret, reload, confirmAction]);

    const remove = useCallback(async (wh) => {
        const ok = await confirmAction({
            title: 'Delete this webhook?',
            description: 'Any caller using it starts getting 404s immediately.',
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!ok) return;
        setErrorMsg(null);
        try {
            await api.deleteWebhook(automation.id, wh.id);
            await reload();
        } catch (e) {
            setErrorMsg(e.message);
        }
    }, [api, automation?.id, reload, confirmAction]);

    const toggleReveal = useCallback((id) => {
        setVisibleSecretIds((prev) => {
            const next = !prev[id];
            if (next) scheduleAutoMask(id); else cancelAutoMask(id);
            return { ...prev, [id]: next };
        });
    }, [scheduleAutoMask, cancelAutoMask]);

    const copyToClipboard = useCallback(async (text, copyKey) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-HTTPS / older browsers
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (!ok) throw new Error('execCommand copy returned false');
            }
            setCopied(copyKey);
            setTimeout(() => setCopied((c) => (c === copyKey ? null : c)), 1500);
            setErrorMsg(null);
        } catch (e) {
            setErrorMsg(`Copy failed: ${e.message || 'clipboard access denied'}. Select the text manually to copy.`);
        }
    }, []);

    const copyUrl = useCallback((wh) => copyToClipboard(webhookUrl(wh), wh.id), [copyToClipboard]);
    const copySecret = useCallback((id, secret) => copyToClipboard(secret, `secret-${id}`), [copyToClipboard]);
    const copyCurl = useCallback((wh) => {
        const secret = revealedSecrets[wh.id];
        if (!secret) {
            setErrorMsg('Secret is only available right after Create or Rotate. Rotate the webhook first to reveal a fresh secret.');
            return;
        }
        copyToClipboard(buildCurlSnippet(webhookUrl(wh), secret), `curl-${wh.id}`);
    }, [revealedSecrets, copyToClipboard]);

    return {
        webhooks,
        loading,
        creating,
        errorMsg,
        setErrorMsg,
        revealedSecrets,
        visibleSecretIds,
        copied,
        reload,
        create,
        rotate,
        remove,
        toggleReveal,
        copyUrl,
        copySecret,
        copyCurl,
    };
}

/**
 * The absolute endpoint for a webhook row.
 *
 * The server now sends `url` on every row (routes/automation/webhooksAndRunOps),
 * built from PUBLIC_BASE_URL or the request origin. The local fallback keeps
 * older cached responses working.
 */
export function webhookUrl(wh) {
    if (wh?.url) return wh.url;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/automation/webhook/${wh?.id}`;
}

/**
 * A complete, runnable signed-request template.
 *
 * The signature covers `nonce + "\n" + body`, NOT the body alone — that is what
 * `routes/automation/events.js` verifies. Signing only the body (as this used
 * to) produced a snippet that ALWAYS 401'd with "Bad signature", so nobody
 * could get a webhook working from the UI at all (BFSF-320).
 *
 * `printf '%s\n%s'` is deliberate: `echo` would append a trailing newline that
 * is not part of the signed message.
 */
export function buildCurlSnippet(url, secret) {
    return [
        `BODY='{}'`,
        `NONCE=$(openssl rand -hex 16)`,
        `SIG="sha256=$(printf '%s\\n%s' "$NONCE" "$BODY" | openssl dgst -sha256 -hmac '${secret}' -hex | awk '{print $2}')"`,
        `curl -X POST '${url}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -H "X-BeeFlow-Signature: $SIG" \\`,
        `  -H "X-BeeFlow-Nonce: $NONCE" \\`,
        `  --data "$BODY"`,
    ].join('\n');
}

/**
 * A placeholder the same width as the real secret so masking doesn't reflow the
 * row. The last 4 characters stay visible so users can sanity-check they are
 * looking at the right secret without revealing it.
 */
export function maskSecret(secret) {
    const s = String(secret || '');
    if (s.length <= 8) return '••••••••';
    return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}
