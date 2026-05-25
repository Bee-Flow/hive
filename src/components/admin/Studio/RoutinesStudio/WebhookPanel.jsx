import { Webhook, Copy, RefreshCw, Trash2, Plus, Check, Terminal, Eye, EyeOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import { API_BASE } from '../../../../utils/helpers';

const REVEAL_AUTO_MASK_MS = 30_000;

/**
 * Manage signed inbound webhook URLs for one automation. Lists every
 * webhook attached to it, lets the user create new ones, copy the URL,
 * rotate the secret, or delete.
 *
 * Notes:
 *   - Listing comes back with metadata only (the secret is never re-read
 *     once it's been issued). That means the secret box is only filled
 *     immediately after Create or Rotate; it goes blank after refresh.
 *   - Requests must be HMAC-signed: callers compute
 *     `sha256=hex(HMAC-SHA256(secret, JSON-body))` and send it as
 *     `X-BeeFlow-Signature`, plus a unique `X-BeeFlow-Nonce`. Copy URL
 *     puts the bare endpoint on the clipboard; Copy as cURL emits a
 *     complete signed-request template so the user can paste-and-run.
 *   - Rotate is destructive: any caller still using the old secret starts
 *     getting 401s the moment the new secret hits the DB.
 */
export default function WebhookPanel({ automation }) {
    const api = useAutomationApi();
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [revealedSecrets, setRevealedSecrets] = useState({}); // id → secret (in-memory only)
    const [visibleSecretIds, setVisibleSecretIds] = useState({}); // id → boolean (currently shown vs masked)
    const [copied, setCopied] = useState(null); // id of the row that was just copied
    const [errorMsg, setErrorMsg] = useState(null);
    // Auto-mask timers — one per webhook id whose secret is currently shown.
    // We persist secrets in memory but mask them after a window so the
    // panel doesn't shoulder-surf a value into a screenshare.
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
        // Sweep all pending mask timers on unmount.
        for (const id of Object.keys(maskTimersRef.current)) {
            clearTimeout(maskTimersRef.current[id]);
        }
        maskTimersRef.current = {};
    }, []);

    const reload = useCallback(async () => {
        if (!automation?.id) return;
        setLoading(true);
        try {
            const r = await api.listWebhooks(automation.id);
            const list = r.webhooks || [];
            setWebhooks(list);
            // Prune revealed secrets for webhooks that no longer exist server-side
            // (e.g. deleted in another tab). Secrets for IDs in the fresh list are
            // kept so a user who just created/rotated doesn't lose them on refresh.
            setRevealedSecrets((prev) => {
                const aliveIds = new Set(list.map((w) => w.id));
                const next = {};
                for (const [id, secret] of Object.entries(prev)) {
                    if (aliveIds.has(id)) next[id] = secret;
                }
                return next;
            });
        } catch (e) {
            setErrorMsg(e.message);
        } finally {
            setLoading(false);
        }
    }, [api, automation?.id]);

    useEffect(() => { reload(); }, [reload]);

    // Clear revealed secrets if the user navigates between automations.
    useEffect(() => { setRevealedSecrets({}); }, [automation?.id]);

    const onCreate = async () => {
        setCreating(true);
        setErrorMsg(null);
        try {
            const r = await api.createWebhook(automation.id);
            const wh = r?.webhook;
            if (wh) {
                setRevealedSecrets((prev) => ({ ...prev, [wh.id]: wh.secret }));
                setVisibleSecretIds((prev) => ({ ...prev, [wh.id]: true }));
                scheduleAutoMask(wh.id);
            }
            await reload();
        } catch (e) {
            setErrorMsg(e.message);
        } finally {
            setCreating(false);
        }
    };

    const onRotate = async (wh) => {
        if (!window.confirm('Rotate the secret? Any caller still using the old secret immediately starts getting 401 errors.')) return;
        setErrorMsg(null);
        try {
            const r = await api.rotateWebhook(automation.id, wh.id);
            if (r?.webhook?.secret) {
                setRevealedSecrets((prev) => ({ ...prev, [wh.id]: r.webhook.secret }));
                setVisibleSecretIds((prev) => ({ ...prev, [wh.id]: true }));
                scheduleAutoMask(wh.id);
            }
            await reload();
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const toggleReveal = (id) => {
        const next = !visibleSecretIds[id];
        setVisibleSecretIds((prev) => ({ ...prev, [id]: next }));
        if (next) scheduleAutoMask(id);
        else cancelAutoMask(id);
    };

    const onDelete = async (wh) => {
        if (!window.confirm('Delete this webhook? Any caller using it will start getting 404s immediately.')) return;
        setErrorMsg(null);
        try {
            await api.deleteWebhook(automation.id, wh.id);
            await reload();
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const copyToClipboard = async (text, copyKey) => {
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
    };

    const onCopyUrl = (wh) => copyToClipboard(`${API_BASE}/api/automation/webhook/${wh.id}`, wh.id);
    const onCopySecret = (id, secret) => copyToClipboard(secret, `secret-${id}`);
    const onCopyCurl = (wh) => {
        const secret = revealedSecrets[wh.id];
        if (!secret) {
            setErrorMsg('Secret is only available right after Create or Rotate. Rotate the webhook first to reveal a fresh secret.');
            return;
        }
        const url = `${API_BASE}/api/automation/webhook/${wh.id}`;
        // POSIX shell template: signs an empty JSON body. Users replace BODY
        // and re-run the signature line.
        const curl = [
            `BODY='{}'`,
            `NONCE=$(openssl rand -hex 16)`,
            `SIG="sha256=$(printf %s "$BODY" | openssl dgst -sha256 -hmac '${secret}' -hex | awk '{print $2}')"`,
            `curl -X POST '${url}' \\`,
            `  -H 'Content-Type: application/json' \\`,
            `  -H "X-BeeFlow-Signature: $SIG" \\`,
            `  -H "X-BeeFlow-Nonce: $NONCE" \\`,
            `  --data "$BODY"`,
        ].join('\n');
        copyToClipboard(curl, `curl-${wh.id}`);
    };

    if (!automation?.id) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Webhook size={14} />
                    <span className="text-[13px] font-medium">Webhooks</span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{webhooks.length}</span>
                </div>
                <button
                    onClick={onCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-white disabled:opacity-60"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={12} /> {creating ? 'Creating…' : 'New webhook'}
                </button>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] mb-2">
                Requests must be HMAC-signed. Use “Copy as cURL” immediately after Create/Rotate to grab a complete signed-request template.
            </div>
            {errorMsg && (
                <div className="text-[12px] text-red-600 mb-2">{errorMsg}</div>
            )}
            {loading && webhooks.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">Loading…</div>
            ) : webhooks.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No webhooks yet.</div>
            ) : (
                <ul className="space-y-2">
                    {webhooks.map((wh) => {
                        const url = `${API_BASE}/api/automation/webhook/${wh.id}`;
                        const secret = revealedSecrets[wh.id];
                        const hasSecret = !!secret;
                        return (
                            <li key={wh.id} className="border border-[var(--border-default)] rounded-lg p-2">
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 truncate text-[12px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded">
                                        {url}
                                    </code>
                                    <button
                                        onClick={() => onCopyUrl(wh)}
                                        title="Copy URL"
                                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                    >
                                        {copied === wh.id ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                    <button
                                        onClick={() => onCopyCurl(wh)}
                                        title={hasSecret ? 'Copy as signed cURL' : 'Rotate to reveal secret first'}
                                        disabled={!hasSecret}
                                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {copied === `curl-${wh.id}` ? <Check size={14} /> : <Terminal size={14} />}
                                    </button>
                                    <button
                                        onClick={() => onRotate(wh)}
                                        title="Rotate secret"
                                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(wh)}
                                        title="Delete"
                                        className="p-1 rounded hover:bg-red-50 text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {secret && (
                                    <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                                        <div className="text-[var(--text-tertiary)] mb-1 flex items-center justify-between gap-2">
                                            <span>
                                                Secret — only visible here until you navigate away.
                                            </span>
                                            {visibleSecretIds[wh.id] && (
                                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                                    Auto-masks in 30s
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 truncate text-[11px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono">
                                                {visibleSecretIds[wh.id] ? secret : maskSecret(secret)}
                                            </code>
                                            <button
                                                onClick={() => toggleReveal(wh.id)}
                                                title={visibleSecretIds[wh.id] ? 'Hide secret' : 'Reveal secret'}
                                                aria-label={visibleSecretIds[wh.id] ? 'Hide secret' : 'Reveal secret'}
                                                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                            >
                                                {visibleSecretIds[wh.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button
                                                onClick={() => onCopySecret(wh.id, secret)}
                                                title="Copy secret"
                                                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                            >
                                                {copied === `secret-${wh.id}` ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {wh.lastSeenAt && (
                                    <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                        Last seen: {new Date(wh.lastSeenAt).toLocaleString()}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Render a placeholder string the same width as the actual secret so
 * the masked state doesn't reflow the row. We expose just enough of the
 * tail (last 4 chars) to let users sanity-check they're looking at the
 * right secret without revealing it fully.
 */
function maskSecret(secret) {
    const s = String(secret || '');
    if (s.length <= 8) return '••••••••';
    return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}
