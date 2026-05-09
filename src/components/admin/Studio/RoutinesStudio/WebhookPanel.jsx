import React, { useEffect, useState, useCallback } from 'react';
import { Webhook, Copy, RefreshCw, Trash2, Plus, Check } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Manage signed inbound webhook URLs for one automation. Lists every
 * webhook attached to it, lets the user create new ones, copy the URL,
 * rotate the secret, or delete.
 *
 * Notes:
 *   - Listing comes back with metadata only (the secret is never re-read
 *     once it's been issued). That means the secret box is only filled
 *     immediately after Create or Rotate; it goes blank after refresh.
 *   - Copy puts the FULL signed URL on the clipboard so the user can paste
 *     it directly into the upstream system.
 *   - Rotate is destructive: any caller still using the old secret starts
 *     getting 401s the moment the new secret hits the DB.
 */
export default function WebhookPanel({ automation }) {
    const api = useAutomationApi();
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [revealedSecrets, setRevealedSecrets] = useState({}); // id → secret (in-memory only)
    const [copied, setCopied] = useState(null); // id of the row that was just copied
    const [errorMsg, setErrorMsg] = useState(null);

    const reload = useCallback(async () => {
        if (!automation?.id) return;
        setLoading(true);
        try {
            const r = await api.listWebhooks(automation.id);
            setWebhooks(r.webhooks || []);
        } catch (e) {
            setErrorMsg(e.message);
        } finally {
            setLoading(false);
        }
    }, [api, automation?.id]);

    useEffect(() => { reload(); }, [reload]);

    const onCreate = async () => {
        setCreating(true);
        setErrorMsg(null);
        try {
            const r = await api.createWebhook(automation.id);
            const wh = r?.webhook;
            if (wh) {
                setRevealedSecrets((prev) => ({ ...prev, [wh.id]: wh.secret }));
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
            }
        } catch (e) {
            setErrorMsg(e.message);
        }
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

    const onCopyUrl = async (wh) => {
        const url = `${API_BASE}/api/automation/webhook/${wh.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(wh.id);
            setTimeout(() => setCopied(null), 1500);
        } catch (_) { /* silent */ }
    };

    const onCopySecret = async (id, secret) => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(`secret-${id}`);
            setTimeout(() => setCopied(null), 1500);
        } catch (_) { /* silent */ }
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
                                        <div className="text-[var(--text-tertiary)] mb-1">
                                            Secret (shown once — copy now):
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 truncate text-[11px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono">
                                                {secret}
                                            </code>
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
