import { X, Bot, Globe, Gauge, Clock } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ModelTierSelector from '../../../ModelTierSelector';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * New-scan wizard — every scan is AI-agent driven, so this is one guided panel:
 * target URL, the model tier that drives the agent, the aggression level
 * (clamped to the server ceiling), an autonomy/step budget, and the mandatory
 * authorization attestation. Submit stays disabled until the operator confirms
 * they are allowed to scan the target — we forward `authorized: true` so the
 * backend has an explicit, logged consent flag.
 */

const AGGRESSION_META = {
    recon: { label: 'Recon', desc: 'Discovery + passive recon only. No scanning traffic.' },
    passive: { label: 'Passive', desc: 'Recon + non-intrusive scans (ZAP passive, safe Nuclei, TLS).' },
    active: { label: 'Active', desc: 'Active scan, fuzzing, SYN/port scans. Sends attack traffic.' },
    offensive: { label: 'Offensive', desc: 'Full offensive: sqlmap attacks + exploit confirmation.' },
};
const DEFAULT_LEVELS = ['recon', 'passive', 'active', 'offensive'];

export default function ScanModal({ onClose, onStart, modelTiers = {}, policy = null }) {
    const [targetUrl, setTargetUrl] = useState('');
    const [aggression, setAggression] = useState(policy?.aggression?.default || 'passive');
    const [stepBudget, setStepBudget] = useState(40);
    const [authorized, setAuthorized] = useState(false);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    // The agent loop is provider-agnostic — offer every configured tier that
    // resolves to a concrete model (drop 'auto', a routing meta-tier with no
    // modelId). The model the picked tier resolves to is the model that drives
    // the scan (Claude, Mistral/Devstral, OpenAI, … — whatever serves it).
    const selectableTiers = useMemo(() => {
        const out = {};
        for (const [k, v] of Object.entries(modelTiers || {})) {
            if (k === 'auto') continue;
            if (v && typeof v.modelId === 'string' && v.modelId.trim()) out[k] = v;
        }
        return out;
    }, [modelTiers]);
    const defaultTier = useMemo(
        () => (selectableTiers.thinking ? 'thinking' : Object.keys(selectableTiers)[0] || 'thinking'),
        [selectableTiers],
    );
    const [modelTier, setModelTier] = useState(defaultTier);
    useEffect(() => { setModelTier(defaultTier); }, [defaultTier]);

    // Pre-warm a toolbox + ZAP the moment the dialog opens so the scan starts
    // (near-)instantly. Released on close if the user doesn't submit.
    const prewarmIdRef = useRef(null);
    const submittedRef = useRef(false);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/security/scans/prewarm`, { method: 'POST' });
                if (res.ok && alive) prewarmIdRef.current = (await res.json())?.prewarmId || null;
            } catch (_) { /* best-effort; the scan just cold-starts */ }
        })();
        return () => {
            alive = false;
            if (!submittedRef.current && prewarmIdRef.current) {
                authFetch(`${API_BASE}/api/security/scans/prewarm/${encodeURIComponent(prewarmIdRef.current)}/release`, { method: 'POST' }).catch(() => {});
            }
        };
    }, []);

    const levels = policy?.aggression?.levels || DEFAULT_LEVELS;
    const ceiling = policy?.aggression?.ceiling || 'offensive';
    const ceilingRank = levels.indexOf(ceiling);

    const scopeHint = useMemo(() => {
        const raw = targetUrl.trim();
        if (!raw) return null;
        try { return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).origin; }
        catch { return null; }
    }, [targetUrl]);

    const normalizeUrl = () => {
        const raw = targetUrl.trim();
        if (raw && !/^https?:\/\//.test(raw)) setTargetUrl(`https://${raw}`);
        else setTargetUrl(raw);
    };

    const submit = async () => {
        setErr(null);
        const url = targetUrl.trim();
        if (!url || !/^https?:\/\//.test(url)) {
            setErr('Target URL must start with http:// or https://');
            return;
        }
        if (!authorized) {
            setErr('You must confirm you are authorized to scan this target.');
            return;
        }
        setBusy(true);
        try {
            await onStart({
                targetUrl: url,
                engines: [{ engine: 'zap' }],
                authorized: true,
                modelTier: Object.keys(selectableTiers).length ? (modelTier || defaultTier) : undefined,
                aggression,
                stepBudget,
                prewarmId: prewarmIdRef.current || undefined,
            });
            submittedRef.current = true; // adopted by the scan — don't release on unmount
        } catch (e) {
            setErr(e.message || 'Failed to start scan');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-[600px] max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Bot size={15} style={{ color: 'var(--accent-primary)' }} />
                        New security scan
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X size={16} /></button>
                </header>

                <div className="px-5 py-4 flex flex-col gap-4">
                    {/* Pitch — the agent is the whole experience now. */}
                    <div className="text-xs text-[var(--text-secondary)] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 leading-relaxed">
                        The agent drives the scan live in one isolated container with a full pentest toolbox —
                        it crawls the site, reads each alert, runs tools, and explains what it finds as it goes.
                    </div>

                    {/* Target URL */}
                    <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1.5"><Globe size={12} /> Target URL</span>
                        <input
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            onBlur={normalizeUrl}
                            placeholder="https://example.com"
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                        />
                        {scopeHint
                            ? <span className="text-[10px] text-[var(--text-tertiary)]">Stays within {scopeHint}</span>
                            : <span className="text-[10px] text-[var(--text-tertiary)]">The agent stays on this origin.</span>}
                    </label>

                    {/* Model tier */}
                    <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Bot size={12} /> Model</span>
                        {Object.keys(selectableTiers).length > 0 ? (
                            <div className="flex items-center gap-2">
                                <ModelTierSelector
                                    tiers={selectableTiers}
                                    value={modelTier || defaultTier}
                                    onChange={setModelTier}
                                    dropDirection="down"
                                    variant="input"
                                />
                                <span className="text-[10px] text-[var(--text-tertiary)]">Pick the model tier that drives the agent.</span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-[var(--text-tertiary)] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1.5">
                                No model tier configured; the scan uses the default model.
                            </span>
                        )}
                    </div>

                    {/* Aggression */}
                    <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Gauge size={12} /> Aggression</span>
                        <div className="grid grid-cols-4 gap-2">
                            {levels.map((lvl, i) => {
                                const meta = AGGRESSION_META[lvl] || { label: lvl };
                                const locked = ceilingRank >= 0 && i > ceilingRank;
                                const selected = aggression === lvl;
                                return (
                                    <button
                                        key={lvl}
                                        type="button"
                                        disabled={locked}
                                        onClick={() => setAggression(lvl)}
                                        title={locked ? 'Enabled by your administrator' : meta.desc}
                                        className={`px-2 py-1.5 text-xs rounded border text-center capitalize ${selected
                                            ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                            : 'border-[var(--border-default)]'} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        {meta.label}
                                    </button>
                                );
                            })}
                        </div>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                            {(AGGRESSION_META[aggression] || {}).desc}
                        </span>
                    </div>

                    {/* Autonomy / step budget */}
                    <div className="flex flex-col gap-1.5">
                        <span className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1.5"><Clock size={12} /> How long the agent may work</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">~{stepBudget} steps</span>
                        </span>
                        <input
                            type="range"
                            min={10}
                            max={200}
                            step={10}
                            value={stepBudget}
                            onChange={(e) => setStepBudget(parseInt(e.target.value, 10))}
                            className="w-full accent-[var(--accent-primary)]"
                        />
                    </div>

                    {/* Authorization attestation */}
                    <label className="flex items-start gap-2 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={authorized}
                            onChange={(e) => setAuthorized(e.target.checked)}
                            className="mt-0.5"
                        />
                        <span className="text-[var(--text-primary)] leading-relaxed">
                            I am authorized to scan this target. Active security scanning of systems you
                            do not own or have explicit permission to test may be illegal.
                        </span>
                    </label>

                    {err && <div className="text-xs text-[var(--danger)]">{err}</div>}
                </div>

                <footer className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={busy || !authorized}
                        className="px-3 py-1.5 text-sm rounded text-white font-semibold disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {busy ? 'Starting…' : 'Start scan'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
