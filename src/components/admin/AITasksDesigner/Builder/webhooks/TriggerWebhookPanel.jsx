import { Webhook, Plus } from 'lucide-react';
import React, { useEffect, useMemo, useRef } from 'react';
import useWebhooks from './useWebhooks';
import { WebhookRow } from '../WebhookPanel';

/**
 * The webhook endpoint, shown inside the webhook trigger node's detail view
 * (BFSF-320).
 *
 * Before this, the trigger node exposed only Label and Trigger Kind, and the
 * URL lived exclusively in the Settings tab — so the node that exists purely to
 * receive an inbound POST never told you where to POST. Users had no way to
 * discover the endpoint at all.
 *
 * Scoped to THIS trigger node via `triggerStepId`, so an automation with
 * several webhook triggers shows each node its own URL. One is auto-provisioned
 * on first open: there is no sensible reason to make the user press "create"
 * before a webhook trigger has an address.
 *
 * Everything else — HMAC contract, secret masking, rotate/delete — is shared
 * with the Settings-tab manager via `useWebhooks`.
 */
export default function TriggerWebhookPanel({ automation, stepId }) {
    const ctl = useWebhooks(automation, { triggerStepId: stepId });
    // Destructured so the effect below can depend on the individual values
    // rather than the whole controller object, which is a fresh literal on
    // every render and would re-fire the effect (and re-create webhooks) in a
    // loop.
    const { loading, creating, webhooks, create, setErrorMsg } = ctl;

    // Provision only when the PERSISTED row already carries this trigger node
    // with kind 'webhook' (B11). The server validates triggerStepId against
    // the SAVED definition, so provisioning while the node (or its freshly
    // picked webhook kind) was still inside the save debounce deterministically
    // 400'd — and the old one-shot guard then never retried. When the pending
    // PUT lands, `automation.definition` updates and this re-evaluates.
    const persistedTrigger = useMemo(() => {
        const def = automation?.definition;
        if (!def || !stepId) return null;
        if (def.trigger?.id === stepId) return def.trigger;
        return (def.triggers || []).find(t => t?.id === stepId) || null;
    }, [automation?.definition, stepId]);
    const provisionable = persistedTrigger?.kind === 'webhook';

    // Auto-provision exactly once per (automation, trigger node). The guard is
    // only burned AFTER a successful create (useWebhooks.create returns null
    // on failure) so a failed attempt retries on the next dependency change;
    // the synchronous inFlightRef stops a StrictMode double-mount from
    // creating two webhooks.
    const provisionedFor = useRef(null);
    const inFlightRef = useRef(false);
    const key = automation?.id && stepId ? `${automation.id}:${stepId}` : null;
    useEffect(() => {
        if (!key || !provisionable) return;
        if (loading || creating || inFlightRef.current) return;
        if (webhooks.length > 0) { provisionedFor.current = key; return; }
        if (provisionedFor.current === key) return;
        inFlightRef.current = true;
        create()
            .then((wh) => { if (wh) provisionedFor.current = key; })
            .finally(() => { inFlightRef.current = false; });
    }, [key, provisionable, loading, creating, webhooks.length, create]);

    // A stale error from the pre-provisionable window would linger after the
    // save lands — clear it the moment provisioning becomes possible.
    useEffect(() => {
        if (provisionable) setErrorMsg(null);
    }, [provisionable, setErrorMsg]);

    if (!automation?.id || !provisionable) {
        return (
            <div className="text-[11px] text-[var(--text-tertiary)]">
                Waiting for the routine to save…
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Webhook size={13} />
                    <span className="text-[12px] font-medium">Webhook URL</span>
                </div>
                {ctl.webhooks.length > 0 && (
                    <button
                        onClick={ctl.create}
                        disabled={ctl.creating}
                        title="Add a second URL for this trigger (e.g. to rotate callers independently)"
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                    >
                        <Plus size={11} /> Add
                    </button>
                )}
            </div>

            <p className="text-[11px] text-[var(--text-tertiary)]">
                POST to this URL to fire the routine. Requests must be HMAC-signed —
                “Copy as cURL” gives you a complete working command, but only while the
                secret is still on screen (right after Create or Rotate).
            </p>

            {ctl.errorMsg && <div className="text-[11px] text-red-600">{ctl.errorMsg}</div>}

            {ctl.webhooks.length === 0 ? (
                <div className="text-[11px] text-[var(--text-tertiary)]">
                    {ctl.loading || ctl.creating ? 'Generating URL…' : (
                        <button onClick={ctl.create} className="underline hover:text-[var(--text-primary)]">
                            Generate a webhook URL
                        </button>
                    )}
                </div>
            ) : (
                <ul className="space-y-2">
                    {ctl.webhooks.map((row) => <WebhookRow key={row.id} row={row} ctl={ctl} />)}
                </ul>
            )}
        </div>
    );
}
