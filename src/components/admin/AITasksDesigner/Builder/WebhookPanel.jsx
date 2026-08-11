import { Webhook, Copy, RefreshCw, Trash2, Plus, Check, Terminal, Eye, EyeOff } from 'lucide-react';
import React from 'react';
import useWebhooks, { webhookUrl, maskSecret } from './webhooks/useWebhooks';

/**
 * Manage signed inbound webhook URLs for one automation — the full manager,
 * rendered in the builder's Settings tab. Lists every webhook attached to the
 * automation regardless of which trigger node it is scoped to.
 *
 * The compact per-trigger-node view lives in
 * `webhooks/TriggerWebhookPanel.jsx`; both share all their behaviour via
 * `webhooks/useWebhooks.js`, which also documents the HMAC signing contract.
 */
export default function WebhookPanel({ automation }) {
    const wh = useWebhooks(automation);

    if (!automation?.id) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Webhook size={14} />
                    <span className="text-[13px] font-medium">Webhooks</span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{wh.webhooks.length}</span>
                </div>
                <button
                    onClick={wh.create}
                    disabled={wh.creating}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-white disabled:opacity-60"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={12} /> {wh.creating ? 'Creating…' : 'New webhook'}
                </button>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] mb-2">
                Requests must be HMAC-signed. Use “Copy as cURL” immediately after Create/Rotate to grab a complete signed-request template.
            </div>
            {wh.errorMsg && (
                <div className="text-[12px] text-red-600 mb-2">{wh.errorMsg}</div>
            )}
            {wh.loading && wh.webhooks.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">Loading…</div>
            ) : wh.webhooks.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No webhooks yet.</div>
            ) : (
                <ul className="space-y-2">
                    {wh.webhooks.map((row) => (
                        <WebhookRow key={row.id} row={row} ctl={wh} />
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * One webhook: URL + copy/cURL/rotate/delete, with the secret revealed
 * underneath while it is still in memory (right after Create or Rotate).
 * Exported so the trigger-node panel renders identical rows.
 */
export function WebhookRow({ row, ctl }) {
    const url = webhookUrl(row);
    const secret = ctl.revealedSecrets[row.id];
    const hasSecret = !!secret;
    const revealed = ctl.visibleSecretIds[row.id];

    return (
        <li className="border border-[var(--border-default)] rounded-lg p-2">
            <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-[12px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded" title={url}>
                    {url}
                </code>
                <button
                    onClick={() => ctl.copyUrl(row)}
                    title="Copy URL"
                    aria-label="Copy webhook URL"
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                    {ctl.copied === row.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                    onClick={() => ctl.copyCurl(row)}
                    title={hasSecret ? 'Copy as signed cURL' : 'Rotate to reveal secret first'}
                    aria-label="Copy as cURL"
                    disabled={!hasSecret}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {ctl.copied === `curl-${row.id}` ? <Check size={14} /> : <Terminal size={14} />}
                </button>
                <button
                    onClick={() => ctl.rotate(row)}
                    title="Rotate secret"
                    aria-label="Rotate secret"
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                    <RefreshCw size={14} />
                </button>
                <button
                    onClick={() => ctl.remove(row)}
                    title="Delete"
                    aria-label="Delete webhook"
                    className="p-1 rounded hover:bg-red-50 text-red-500"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {secret && (
                <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                    <div className="text-[var(--text-tertiary)] mb-1 flex items-center justify-between gap-2">
                        <span>Secret — only visible here until you navigate away.</span>
                        {revealed && <span className="text-[10px] text-[var(--text-tertiary)]">Auto-masks in 30s</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 truncate text-[11px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono">
                            {revealed ? secret : maskSecret(secret)}
                        </code>
                        <button
                            onClick={() => ctl.toggleReveal(row.id)}
                            title={revealed ? 'Hide secret' : 'Reveal secret'}
                            aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                        >
                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                            onClick={() => ctl.copySecret(row.id, secret)}
                            title="Copy secret"
                            aria-label="Copy secret"
                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                        >
                            {ctl.copied === `secret-${row.id}` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>
            )}
            {row.lastSeenAt && (
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    Last seen: {new Date(row.lastSeenAt).toLocaleString()}
                </div>
            )}
        </li>
    );
}
