import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Copy, Check, Link2, RefreshCw, Loader2 } from 'lucide-react';
import { denseInputClass } from './formPrimitives';
import FormBuilderFields, { defaultFormDeclaration } from './FormBuilderFields';
import useAutomationApi from '../../../../../../hooks/useAutomationApi';
import { useBuilderConfirm } from '../../BuilderConfirmContext';

/**
 * The authoring surface for a hosted form trigger (`kind: 'form'`) — page one
 * of the routine's public form, plus the URL it lives at.
 *
 * The page editor itself is FormBuilderFields, shared with the `form_page`
 * steps that come after this one: all three declare the same `form` object, so
 * an author who has laid out page one already knows how to lay out page two.
 * What is trigger-only is the public URL below.
 */

// Re-exported so existing importers (DiagramPane, tests) keep one entry point.
export { defaultFormDeclaration, slugifyFieldName, THEME_PRESETS } from './FormBuilderFields';

export default function FormTriggerFields({ draft, set, automation = null, stepId = null }) {
    const form = draft.form || null;

    // A trigger that has just been switched to `form` has no declaration yet.
    // Seeding it from a click (rather than an effect) keeps the autosave
    // honest: nothing is written until the author asks for it.
    if (!form) {
        return (
            <div className="space-y-2">
                <p className="text-[11px] text-[var(--text-tertiary)]">
                    A form trigger publishes a page anyone can fill in. Every submission runs this routine once.
                </p>
                <button
                    type="button"
                    onClick={() => set('form', defaultFormDeclaration())}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90"
                >
                    <Plus size={13} /> Create the form
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <FormTriggerUrlPanel automation={automation} stepId={stepId} />
            <FormBuilderFields form={form} onChange={(next) => set('form', next)} bindingBase="trigger.output" />
        </div>
    );
}

/**
 * The public URL, provisioned on first open.
 *
 * Same B11 rule as TriggerWebhookPanel: only provision once the PERSISTED
 * definition carries this node with kind 'form'. The server validates
 * triggerStepId against the SAVED definition, so asking while the node is still
 * inside the autosave debounce deterministically 400s.
 */
export function FormTriggerUrlPanel({ automation, stepId }) {
    const api = useAutomationApi();
    const confirmAction = useBuilderConfirm();
    const [page, setPage] = useState(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(null);

    const persistedTrigger = useMemo(() => {
        const def = automation?.definition;
        if (!def || !stepId) return null;
        if (def.trigger?.id === stepId) return def.trigger;
        return (def.triggers || []).find(t => t?.id === stepId) || null;
    }, [automation?.definition, stepId]);
    const provisionable = persistedTrigger?.kind === 'form';

    const load = useCallback(async () => {
        if (!automation?.id || !provisionable) return;
        setBusy(true);
        setError(null);
        try {
            const listed = await api.listFormPages(automation.id);
            const mine = (listed.forms || []).find(f => (f.triggerStepId || null) === (persistedTrigger?.id === automation?.definition?.trigger?.id ? null : stepId))
                || (listed.forms || [])[0];
            if (mine) { setPage(mine); return; }
            const created = await api.createFormPage(automation.id);
            setPage(created.form || null);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }, [api, automation?.id, automation?.definition?.trigger?.id, provisionable, persistedTrigger?.id, stepId]);

    React.useEffect(() => { load(); }, [load]);

    const copy = async () => {
        if (!page?.url) return;
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(page.url);
            else {
                const ta = document.createElement('textarea');
                ta.value = page.url;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (!ok) throw new Error('copy failed');
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            setError(`Copy failed: ${e.message}. Select the text to copy it manually.`);
        }
    };

    const rotate = async () => {
        if (!page) return;
        // The URL IS the credential, so rotating is not "change the secret" —
        // it is "publish a different address". Say so before doing it.
        const ok = await confirmAction({
            title: 'Create a new link?',
            description: 'The current link stops working immediately — anyone who already has it will see “not available”.',
            confirmLabel: 'Create a new link',
            destructive: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            const r = await api.rotateFormPage(automation.id, page.id);
            setPage(r.form || null);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    if (!automation?.id || !provisionable) {
        return <div className="text-[11px] text-[var(--text-tertiary)]">Waiting for the routine to save…</div>;
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Link2 size={13} />
                <span className="text-[12px] font-medium">Public link</span>
            </div>
            {error && <div className="text-[11px] text-red-600">{error}</div>}
            {!page ? (
                <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                    {busy ? <><Loader2 size={11} className="animate-spin" /> Generating link…</> : (
                        <button onClick={load} className="underline hover:text-[var(--text-primary)]">Generate the link</button>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-1">
                        <input readOnly value={page.url || ''} aria-label="Public form URL" className={denseInputClass('flex-1 min-w-0 font-mono')} onFocus={(e) => e.target.select()} />
                        <button type="button" onClick={copy} title="Copy the link" aria-label="Copy the link"
                            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <button type="button" onClick={rotate} disabled={busy} title="Create a new link (the current one stops working)" aria-label="Create a new link"
                            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40">
                            <RefreshCw size={13} />
                        </button>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                        Anyone with this link can submit the form — it only works while the routine is active.
                        {typeof page.submissions === 'number' && page.submissions > 0 ? ` ${page.submissions} submission${page.submissions === 1 ? '' : 's'} so far.` : ''}
                    </p>
                </>
            )}
        </div>
    );
}
