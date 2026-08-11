import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AppWindow, AlertTriangle, CheckCircle2, HelpCircle, Loader2, Lock,
    Plug, Plus, RefreshCw, Trash2, Workflow, X,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import useAutomationApi from '../../hooks/useAutomationApi';

/**
 * WebpageAppsPanel — the "Apps & data" sidebar pane of the webpage IDE.
 *
 * Makes the bridge grants (server: integrations/webpageGrants.js, routes:
 * routes/webpagesGrants.js) visible and manageable WITHOUT going through the
 * AI chat — previously the only way to grant/revoke. Two jobs:
 *
 *   1. Show which integrations + routines this page may call (with a live
 *      status: connected / needs reconnect / unknown), and revoke them.
 *   2. Add new ones from the apps the author ALREADY has access to — the same
 *      strict catalog the automations builder uses (GET /api/automation/
 *      catalog). Apps the author hasn't connected are greyed out with a
 *      Connect deep link to Settings → Integrations (with a ?return= back
 *      here); the server also refuses such grants with 409
 *      connection_required, so a stale catalog can't produce a broken grant.
 *
 * Owner-only surface (the bridge runs acts-as-author): non-owners get a note,
 * matching the owner gate in WebpageIDE.
 */

const GRANTS_BASE = (id) => `${API_BASE}/api/webpages/${encodeURIComponent(id)}/grants`;

// How long a catalog/grants snapshot may be shown stale; a window-focus or a
// manual refresh re-fetches (the author may have just connected an app).
const FOCUS_REFETCH_MS = 5_000;

async function readJson(res) {
    try { return await res.json(); } catch { return null; }
}

function StatusPill({ available }) {
    if (available === true) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#10b981' }}>
                <CheckCircle2 size={11} /> Connected
            </span>
        );
    }
    if (available === false) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#d97706' }}>
                <AlertTriangle size={11} /> Needs reconnect
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--vsc-fg-muted)' }}>
            <HelpCircle size={11} /> Status unknown
        </span>
    );
}

/** Settings → Integrations deep link that lands the author back on this page. */
function connectHref(webpageId) {
    return `/app/settings/integrations?return=${encodeURIComponent(`/app/studio/webpages/${webpageId}`)}`;
}

function ConnectLink({ webpageId, children }) {
    return (
        <a
            href={connectHref(webpageId)}
            className="underline underline-offset-2"
            style={{ color: 'var(--vsc-accent)' }}
        >
            {children || 'Connect it first'}
        </a>
    );
}

// ─── Add-an-app form ────────────────────────────────────────────────

function AddAppForm({ webpageId, catalog, onGranted, onError }) {
    const [appId, setAppId] = useState('');
    const [tool, setTool] = useState('');
    const [label, setLabel] = useState('');
    const [fixedArgsText, setFixedArgsText] = useState('');
    const [fixedArgsError, setFixedArgsError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [needConnect, setNeedConnect] = useState(null); // provider id after a 409

    // Apps with at least one action; connectable ones first, then A–Z.
    const apps = useMemo(() => {
        const list = (catalog?.apps || []).filter(a => (a.actions || []).length > 0);
        return [...list].sort((a, b) => Number(b.available === true) - Number(a.available === true)
            || String(a.label || a.id).localeCompare(String(b.label || b.id)));
    }, [catalog]);

    const app = apps.find(a => a.id === appId) || null;
    const actions = app?.actions || [];

    const submit = async () => {
        setFixedArgsError(null);
        setNeedConnect(null);
        let fixedArgs;
        const raw = fixedArgsText.trim();
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    setFixedArgsError('Must be a JSON object, e.g. { "channel": "#general" }');
                    return;
                }
                fixedArgs = parsed;
            } catch {
                setFixedArgsError('Invalid JSON');
                return;
            }
        }
        setSubmitting(true);
        try {
            const res = await authFetch(GRANTS_BASE(webpageId) + '/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool, ...(fixedArgs ? { fixedArgs } : {}), ...(label.trim() ? { label: label.trim() } : {}) }),
            });
            const body = await readJson(res);
            if (!res.ok) {
                if (body?.code === 'connection_required') setNeedConnect(body.provider || app?.id || null);
                onError(body?.error || `Could not add the app (${res.status})`);
                return;
            }
            setAppId(''); setTool(''); setLabel(''); setFixedArgsText('');
            onGranted();
        } catch (e) {
            onError(e.message || 'Could not reach the server.');
        } finally {
            setSubmitting(false);
        }
    };

    const selectCls = 'w-full px-2 py-1.5 rounded text-[12px] border outline-none';
    const selectStyle = { background: 'var(--vsc-editor-bg)', borderColor: 'var(--vsc-border)', color: 'var(--vsc-fg)' };

    return (
        <div className="flex flex-col gap-2 p-2 rounded border" style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)' }}>
            <label className="flex flex-col gap-1">
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>App</span>
                <select
                    className={selectCls}
                    style={selectStyle}
                    value={appId}
                    aria-label="App"
                    onChange={(e) => { setAppId(e.target.value); setTool(''); setNeedConnect(null); }}
                >
                    <option value="">Choose an app…</option>
                    {apps.map(a => (
                        <option key={a.id} value={a.id} disabled={a.available !== true}>
                            {a.label || a.id}{a.available === true ? '' : ' — not connected'}
                        </option>
                    ))}
                </select>
            </label>
            {app && app.available !== true ? (
                <p className="text-[11px] flex items-start gap-1.5" style={{ color: '#d97706' }}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                        {app.label || app.id} isn&apos;t connected to your account.{' '}
                        <ConnectLink webpageId={webpageId}>Connect it in Settings → Integrations</ConnectLink>{' '}
                        and come back — this list updates when you return.
                    </span>
                </p>
            ) : null}
            <label className="flex flex-col gap-1">
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>What it may do</span>
                <select
                    className={selectCls}
                    style={selectStyle}
                    value={tool}
                    aria-label="Action"
                    disabled={!app || app.available !== true}
                    onChange={(e) => setTool(e.target.value)}
                >
                    <option value="">{app ? 'Choose an action…' : 'Pick an app first'}</option>
                    {actions.map(x => (
                        <option key={x.name} value={x.name}>{x.label || x.name}</option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>Label (optional)</span>
                <input
                    className={selectCls}
                    style={selectStyle}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Notify the team channel"
                    spellCheck={false}
                />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--vsc-fg-muted)' }}>
                    <Lock size={11} /> Pinned arguments (optional JSON)
                </span>
                <textarea
                    className={`${selectCls} font-mono min-h-[3.5rem]`}
                    style={selectStyle}
                    value={fixedArgsText}
                    onChange={(e) => setFixedArgsText(e.target.value)}
                    placeholder='{ "channel": "#general" }'
                    spellCheck={false}
                />
                <span className="text-[10px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                    Pinned values always win over what the page sends — pin anything a visitor must not choose (recipient, channel, sheet id).
                </span>
                {fixedArgsError ? <span className="text-[10px]" style={{ color: '#ef4444' }}>{fixedArgsError}</span> : null}
            </label>
            {needConnect ? (
                <p className="text-[11px]" style={{ color: '#d97706' }}>
                    That app isn&apos;t connected (anymore). <ConnectLink webpageId={webpageId}>Reconnect it</ConnectLink> and try again.
                </p>
            ) : null}
            <button
                type="button"
                onClick={submit}
                disabled={!tool || submitting}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--vsc-accent)' }}
            >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add to page
            </button>
        </div>
    );
}

// ─── Add-a-routine form ─────────────────────────────────────────────

function AddRoutineForm({ webpageId, automations, onGranted, onError }) {
    const [automationId, setAutomationId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        try {
            const res = await authFetch(GRANTS_BASE(webpageId) + '/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ automationId }),
            });
            const body = await readJson(res);
            if (!res.ok) { onError(body?.error || `Could not add the routine (${res.status})`); return; }
            setAutomationId('');
            onGranted();
        } catch (e) {
            onError(e.message || 'Could not reach the server.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 flex-1">
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>Routine</span>
                <select
                    className="w-full px-2 py-1.5 rounded text-[12px] border outline-none"
                    style={{ background: 'var(--vsc-editor-bg)', borderColor: 'var(--vsc-border)', color: 'var(--vsc-fg)' }}
                    value={automationId}
                    aria-label="Routine"
                    onChange={(e) => setAutomationId(e.target.value)}
                >
                    <option value="">Choose a routine…</option>
                    {automations.map(a => (
                        <option key={a.automationId || a.id} value={a.automationId || a.id}>
                            {a.title || a.automationId || a.id}
                        </option>
                    ))}
                </select>
            </label>
            <button
                type="button"
                onClick={submit}
                disabled={!automationId || submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--vsc-accent)' }}
            >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add
            </button>
        </div>
    );
}

// ─── The panel ──────────────────────────────────────────────────────

export default function WebpageAppsPanel({ webpageId, readOnly = false }) {
    // Keep the api in a ref: useAutomationApi is memoised in production, but
    // depending on it directly would re-fire load() whenever a consumer's mock
    // (or any future change) returns a fresh object per render — the exact
    // loop the hook's own useMemo warns about.
    const apiRef = React.useRef(null);
    apiRef.current = useAutomationApi();
    const [grants, setGrants] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [automations, setAutomations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adding, setAdding] = useState(null); // null | 'app' | 'routine'
    const lastFetchRef = React.useRef(0);

    const load = useCallback(async () => {
        if (!webpageId || readOnly) return;
        lastFetchRef.current = Date.now();
        setError(null);
        try {
            const res = await authFetch(GRANTS_BASE(webpageId));
            const body = await readJson(res);
            if (!res.ok) throw new Error(body?.error || `Could not load apps (${res.status})`);
            setGrants(body);
        } catch (e) {
            setError(e.message);
        }
        // Catalog + routines are best-effort: grants stay manageable without them.
        try {
            const c = await apiRef.current.getCatalog();
            setCatalog(c);
            setCatalogFailed(false);
        } catch {
            setCatalog(null);
            setCatalogFailed(true);
        }
        try {
            const r = await apiRef.current.listAutomations();
            setAutomations(r.automations || []);
        } catch {
            setAutomations([]);
        }
        setLoading(false);
    }, [webpageId, readOnly]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    // Refetch when the window regains focus (e.g. back from Settings →
    // Integrations), but not more often than FOCUS_REFETCH_MS.
    useEffect(() => {
        const onFocus = () => {
            if (Date.now() - lastFetchRef.current > FOCUS_REFETCH_MS) load();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [load]);

    const revoke = async (kind, key) => {
        setError(null);
        try {
            const res = await authFetch(`${GRANTS_BASE(webpageId)}/${kind}/${encodeURIComponent(key)}`, { method: 'DELETE' });
            const body = await readJson(res);
            if (!res.ok) throw new Error(body?.error || `Could not remove (${res.status})`);
            await load();
        } catch (e) {
            setError(e.message);
        }
    };

    if (readOnly) {
        return (
            <div className="p-3 text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                Only the page owner can manage the apps and routines this page may use.
            </div>
        );
    }

    const grantedIntegrations = grants?.integrations || [];
    const grantedAutomations = grants?.automations || [];

    return (
        <div className="flex flex-col h-full overflow-y-auto p-2 gap-3 text-[12px]" style={{ color: 'var(--vsc-fg)' }}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)' }}>
                    Apps &amp; data
                </span>
                <button
                    type="button"
                    onClick={load}
                    title="Refresh"
                    aria-label="Refresh apps and grants"
                    className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]"
                    style={{ color: 'var(--vsc-fg-muted)' }}
                >
                    <RefreshCw size={13} />
                </button>
            </div>

            <p className="text-[11px] -mt-1" style={{ color: 'var(--vsc-fg-muted)' }}>
                What this page may call, running as you. Visitors never need their own accounts.
            </p>

            {error ? (
                <p role="alert" className="flex items-start gap-1.5 text-[11px]" style={{ color: '#ef4444' }}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </p>
            ) : null}

            {grants?.discoveryFailed ? (
                <p className="flex items-start gap-1.5 text-[11px]" style={{ color: '#d97706' }}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>Couldn&apos;t verify your connected apps — statuses below may be stale.</span>
                </p>
            ) : null}

            {loading ? (
                <p className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                    <Loader2 size={12} className="animate-spin" /> Loading…
                </p>
            ) : (
                <>
                    {/* Granted integrations */}
                    <section className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--vsc-fg-muted)' }}>Apps</span>
                        {grantedIntegrations.length === 0 ? (
                            <p className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                No apps yet. Add one so the page can read or act in tools you already use.
                            </p>
                        ) : grantedIntegrations.map(g => (
                            <div
                                key={g.tool}
                                className="group flex items-center gap-2 px-2 py-1.5 rounded border"
                                style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)' }}
                            >
                                <Plug size={13} className="shrink-0" style={{ color: 'var(--vsc-fg-muted)' }} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate" title={g.tool}>
                                        {g.label || (g.tool || '').replace(/_/g, ' ')}
                                        {g.integrationLabel ? (
                                            <span style={{ color: 'var(--vsc-fg-muted)' }}> · {g.integrationLabel}</span>
                                        ) : null}
                                        {g.hasFixedArgs ? (
                                            <Lock size={10} className="inline ml-1 -mt-0.5" aria-label="Has pinned arguments" />
                                        ) : null}
                                    </div>
                                    <StatusPill available={g.available} />
                                </div>
                                {g.available === false ? (
                                    <ConnectLink webpageId={webpageId}>Reconnect</ConnectLink>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => revoke('integrations', g.tool)}
                                    aria-label={`Remove ${g.tool}`}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--vsc-hover-bg)]"
                                    style={{ color: '#ef4444' }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {adding === 'app' ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setAdding(null)}
                                    aria-label="Close"
                                    className="absolute right-1 top-1 p-1 rounded hover:bg-[var(--vsc-hover-bg)]"
                                    style={{ color: 'var(--vsc-fg-muted)' }}
                                >
                                    <X size={12} />
                                </button>
                                <AddAppForm
                                    webpageId={webpageId}
                                    catalog={catalog}
                                    onGranted={() => { setAdding(null); load(); }}
                                    onError={setError}
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAdding('app')}
                                disabled={catalogFailed && !catalog}
                                title={catalogFailed ? 'The app catalog could not be loaded' : undefined}
                                className="self-start inline-flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed text-[11px] disabled:opacity-50"
                                style={{ borderColor: 'var(--vsc-border)', color: 'var(--vsc-fg-muted)' }}
                            >
                                <AppWindow size={12} /> Add an app
                            </button>
                        )}
                        {catalogFailed ? (
                            <p className="text-[10px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                Your app catalog couldn&apos;t be loaded (automations may be off for your plan). Refresh to try again.
                            </p>
                        ) : null}
                    </section>

                    {/* Granted routines */}
                    <section className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--vsc-fg-muted)' }}>Routines</span>
                        {grantedAutomations.length === 0 ? (
                            <p className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                No routines yet. Let the page trigger one of your routines and use its result.
                            </p>
                        ) : grantedAutomations.map(g => (
                            <div
                                key={g.automationId}
                                className="group flex items-center gap-2 px-2 py-1.5 rounded border"
                                style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)' }}
                            >
                                <Workflow size={13} className="shrink-0" style={{ color: 'var(--vsc-fg-muted)' }} />
                                <span className="min-w-0 flex-1 truncate" title={g.automationId}>
                                    {g.label || g.automationId}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => revoke('automations', g.automationId)}
                                    aria-label={`Remove ${g.label || g.automationId}`}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--vsc-hover-bg)]"
                                    style={{ color: '#ef4444' }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {adding === 'routine' ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setAdding(null)}
                                    aria-label="Close"
                                    className="absolute right-1 -top-1 p-1 rounded hover:bg-[var(--vsc-hover-bg)] z-10"
                                    style={{ color: 'var(--vsc-fg-muted)' }}
                                >
                                    <X size={12} />
                                </button>
                                <AddRoutineForm
                                    webpageId={webpageId}
                                    automations={automations}
                                    onGranted={() => { setAdding(null); load(); }}
                                    onError={setError}
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAdding('routine')}
                                className="self-start inline-flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed text-[11px]"
                                style={{ borderColor: 'var(--vsc-border)', color: 'var(--vsc-fg-muted)' }}
                            >
                                <Workflow size={12} /> Add a routine
                            </button>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
