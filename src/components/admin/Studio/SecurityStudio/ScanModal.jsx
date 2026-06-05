import { X, ShieldCheck, Radar, Lock } from 'lucide-react';
import React, { useState } from 'react';

/**
 * ScanModal — collects a target URL, the engines to run (ZAP / Nuclei /
 * testssl), the ZAP intensity, and a mandatory authorization acknowledgement,
 * then submits a scan.
 *
 * The authorization checkbox is REQUIRED: the submit button stays disabled
 * until the operator confirms they are allowed to scan the target. We forward
 * `authorized: true` so the backend has an explicit, logged consent flag for
 * what is an active security probe against a live host.
 */
export default function ScanModal({ onClose, onStart }) {
    const [mode, setMode] = useState('quick');
    const [targetUrl, setTargetUrl] = useState('');
    const [useZap, setUseZap] = useState(true);
    const [zapIntensity, setZapIntensity] = useState('baseline');
    const [useNuclei, setUseNuclei] = useState(false);
    const [useTestssl, setUseTestssl] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const anyEngine = useZap || useNuclei || useTestssl;

    const submit = async () => {
        setErr(null);
        if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
            setErr('Target URL must start with http:// or https://');
            return;
        }
        if (!anyEngine) {
            setErr('Select at least one scan engine.');
            return;
        }
        if (!authorized) {
            setErr('You must confirm you are authorized to scan this target.');
            return;
        }
        const engines = [];
        if (useZap) engines.push({ engine: 'zap', intensity: zapIntensity });
        if (useNuclei) engines.push({ engine: 'nuclei' });
        if (useTestssl) engines.push({ engine: 'testssl' });
        setBusy(true);
        try {
            await onStart({ targetUrl: targetUrl.trim(), engines, authorized: true, mode });
        } catch (e) {
            setErr(e.message || 'Failed to start scan');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-[560px] max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="text-sm font-semibold">New security scan</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X size={16} /></button>
                </header>
                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--text-secondary)]">Mode</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('quick')}
                                className={`px-2 py-1.5 text-xs rounded border text-center ${mode === 'quick'
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)]'}`}
                            >
                                Quick
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('agent')}
                                className={`px-2 py-1.5 text-xs rounded border text-center ${mode === 'agent'
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)]'}`}
                            >
                                AI agent
                            </button>
                        </div>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                            {mode === 'quick'
                                ? 'Deterministic pipeline — each selected engine runs once and produces a graded report.'
                                : 'Claude drives the scan live: it spiders, reads alerts, runs tools (incl. a sandboxed terminal), and you watch each step in real time.'}
                        </span>
                    </div>

                    <label className="text-xs text-[var(--text-secondary)]">
                        Target URL
                        <input
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="mt-1 w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                        />
                    </label>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-[var(--text-secondary)]">Engines</label>

                        {mode === 'agent' && (
                            <div className="text-[10px] text-[var(--text-tertiary)] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1.5">
                                ZAP runs as a daemon the agent drives; Nuclei / testssl become tools it may use.
                            </div>
                        )}

                        {/* ZAP — web app scanner, with a baseline / full intensity selector. */}
                        <div className={`flex flex-col gap-2 p-3 rounded border ${useZap
                            ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                            : 'border-[var(--border-default)]'}`}>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={useZap} onChange={(e) => setUseZap(e.target.checked)} />
                                <ShieldCheck size={13} className="text-[var(--text-secondary)]" />
                                <span className="font-medium">OWASP ZAP</span>
                                <span className="text-[10px] text-[var(--text-tertiary)]">— dynamic web app scan</span>
                            </label>
                            {useZap && (
                                <div className="pl-6 flex flex-col gap-1">
                                    <span className="text-[10px] text-[var(--text-tertiary)]">Intensity</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setZapIntensity('baseline')}
                                            className={`px-2 py-1.5 text-xs rounded border text-center ${zapIntensity === 'baseline'
                                                ? 'border-[var(--accent-primary)] bg-[var(--bg-primary)]'
                                                : 'border-[var(--border-default)]'}`}
                                        >
                                            Baseline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setZapIntensity('full')}
                                            className={`px-2 py-1.5 text-xs rounded border text-center ${zapIntensity === 'full'
                                                ? 'border-[var(--accent-primary)] bg-[var(--bg-primary)]'
                                                : 'border-[var(--border-default)]'}`}
                                        >
                                            Full
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-tertiary)]">
                                        {zapIntensity === 'baseline'
                                            ? 'Passive spider + a quick set of checks. Fast and non-intrusive.'
                                            : 'Active scan with attack payloads. Slower and more intrusive — only on hosts you own.'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Nuclei — template-based vulnerability scanner. */}
                        <label className={`flex items-center gap-2 p-3 text-xs rounded border cursor-pointer ${useNuclei
                            ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                            : 'border-[var(--border-default)]'}`}>
                            <input type="checkbox" checked={useNuclei} onChange={(e) => setUseNuclei(e.target.checked)} />
                            <Radar size={13} className="text-[var(--text-secondary)]" />
                            <span className="font-medium">Nuclei</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">— template-based CVE / misconfig checks</span>
                        </label>

                        {/* testssl.sh — TLS configuration audit. */}
                        <label className={`flex items-center gap-2 p-3 text-xs rounded border cursor-pointer ${useTestssl
                            ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                            : 'border-[var(--border-default)]'}`}>
                            <input type="checkbox" checked={useTestssl} onChange={(e) => setUseTestssl(e.target.checked)} />
                            <Lock size={13} className="text-[var(--text-secondary)]" />
                            <span className="font-medium">testssl.sh</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">— TLS / certificate configuration audit</span>
                        </label>
                    </div>

                    <label className="flex items-start gap-2 mt-1 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs cursor-pointer">
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
                        className="px-3 py-1.5 text-sm rounded text-white font-semibold disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                    >
                        {busy ? 'Starting…' : 'Start scan'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
