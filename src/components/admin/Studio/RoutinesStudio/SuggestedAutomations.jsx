import { Search, Check, Loader2, ShieldCheck, Plug, Lightbulb, XCircle, Clock } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import ScanLog from './ScanLog';
import ScanResultsHeader from './ScanResultsHeader';
import SuggestionSkeleton from './SuggestionSkeleton';
import SuggestionsSection from './SuggestionsSection';
import useSuggestionScan from './useSuggestionScan';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import EmptyState from '../../../shared/EmptyState';
import Spinner from '../../../shared/Spinner';

/**
 * "Find repeating work" section on the Routines empty state.
 *
 * Thin orchestrator over useSuggestionScan: the hook owns the catalog load,
 * the READ-ONLY Privacy-Shield-guarded SSE scan, the live per-tool log, and
 * the persisted last-scan / dismiss / built state. This component just wires
 * the picker, the scan controls, and the presentational pieces together.
 *
 * Public contract (unchanged): onBuildSuggestion / onAskSuggestion are called
 * with the chosen suggestion. We additionally record best-effort feedback and
 * track "built" locally so the card greys out.
 */
export default function SuggestedAutomations({ onBuildSuggestion, onAskSuggestion }) {
    const api = useAutomationApi();
    const scan = useSuggestionScan();
    const {
        apps,
        catalogLoaded,
        selected,
        toggle,
        focus,
        setFocus,
        scanning,
        phase,
        scanSteps,
        suggestions,
        summary,
        scanned,
        reason,
        error,
        rateLimitedUntil,
        lastScannedAt,
        cached,
        scan: runScan,
        cancel,
        dismiss,
        dismissed,
        markBuilt,
        builtIds,
        labelFor,
    } = scan;

    const feedback = (action, suggestion, reasonText) => {
        try {
            api.recordSuggestionFeedback?.({ action, suggestion, reason: reasonText });
        } catch { /* best-effort */ }
    };

    const handleBuild = (s) => {
        markBuilt(s);
        feedback('built', s);
        onBuildSuggestion?.(s);
    };
    const handleAsk = (s) => {
        feedback('asked', s);
        onAskSuggestion?.(s);
    };
    const handleDismiss = (s) => {
        dismiss(s);
        feedback('dismissed', s);
    };

    // 1s ticker while a rate-limit cooldown is active so the countdown updates
    // and the controls re-enable the instant it elapses.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!rateLimitedUntil) return undefined;
        setNow(Date.now());
        const id = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (t >= rateLimitedUntil) clearInterval(id);
        }, 1000);
        return () => clearInterval(id);
    }, [rateLimitedUntil]);
    const cooldown = rateLimitedUntil ? Math.max(0, Math.ceil((rateLimitedUntil - now) / 1000)) : 0;

    const canScan = useMemo(() => selected.size > 0 && !scanning && cooldown === 0, [selected, scanning, cooldown]);
    const showSkeleton = scanning && suggestions.length === 0;
    const blockedSteps = useMemo(() => scanSteps.filter((s) => s.status === 'blocked'), [scanSteps]);

    // Until the catalog resolves we don't know if there's anything to show.
    if (!catalogLoaded) return null;

    return (
        <div className="mt-10">
            <div className="text-[11px] text-[var(--text-tertiary)] mb-3 text-center leading-relaxed">
                Pick the apps to look at and we'll scan their recent activity to spot tasks worth automating.
            </div>

            {apps.length === 0 ? (
                <EmptyState
                    icon={<Plug size={28} />}
                    title="No connected apps yet"
                    description="Connect an integration to get automation ideas based on your work."
                    className="!h-auto !py-8"
                />
            ) : (
                <>
                    {/* Integration picker */}
                    <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                        {apps.map((a) => {
                            const on = selected.has(a.id);
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => toggle(a.id)}
                                    aria-pressed={on}
                                    disabled={scanning}
                                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition disabled:opacity-50 ${
                                        on
                                            ? 'border-[var(--text-tertiary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    {on && <Check size={11} />}
                                    {a.label || a.id}
                                </button>
                            );
                        })}
                    </div>

                    {/* Optional focus + scan */}
                    <div className="flex items-center gap-2 max-w-xl mx-auto mb-4">
                        <input
                            type="text"
                            value={focus}
                            onChange={(e) => setFocus(e.target.value)}
                            disabled={scanning}
                            placeholder="Optional: focus area (e.g. invoices, support tickets)…"
                            className="flex-1 text-[12px] px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] disabled:opacity-50"
                        />
                        {scanning ? (
                            <button
                                type="button"
                                onClick={cancel}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition flex-shrink-0"
                            >
                                <Loader2 size={13} className="animate-spin" />
                                {phase === 'synthesising' ? 'Reviewing findings…' : 'Scanning your tools…'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => runScan(false)}
                                disabled={!canScan}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 flex-shrink-0"
                                style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                            >
                                <Search size={13} />
                                Scan for ideas
                            </button>
                        )}
                    </div>

                    {/* Last-scan header + Re-scan (only once we have a prior scan) */}
                    <ScanResultsHeader
                        lastScannedAt={lastScannedAt}
                        scanning={scanning}
                        cached={cached}
                        onRescan={runScan}
                        disabled={cooldown > 0}
                    />

                    {/* Rate-limit cooldown — a calm heads-up, not a failure. Any
                        prior results stay visible below. */}
                    {cooldown > 0 && (
                        <div className="max-w-xl mx-auto mb-4 flex items-center gap-2 justify-center text-[12px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                            <Clock size={14} className="flex-shrink-0" />
                            <span>You've scanned a lot in a short time — you can scan again in {cooldown}s.</span>
                        </div>
                    )}

                    {/* Live scan log (transparency: what was looked at) */}
                    <ScanLog steps={scanSteps} labelFor={labelFor} />

                    {/* Privacy-Shield-blocked sources, called out explicitly. */}
                    {blockedSteps.length > 0 && (
                        <div className="max-w-xl mx-auto mb-4 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 justify-center text-center">
                            <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" />
                            <span>
                                Privacy Shield skipped {blockedSteps.map((s) => labelFor(s.integration)).join(', ')} — those sources weren't read.
                            </span>
                        </div>
                    )}

                    {/* Post-scan privacy/transparency summary */}
                    {scanned && summary && (summary.integrations?.length > 0) && (
                        <div className="max-w-xl mx-auto mb-4 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] justify-center">
                            <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                            <span>
                                Looked at {summary.integrations.map(labelFor).join(', ')}
                                {typeof summary.toolCalls === 'number' ? ` · ${summary.toolCalls} read${summary.toolCalls === 1 ? '' : 's'}` : ''}
                                {' · '}
                                {summary.piiCategories?.length > 0
                                    ? `PII detected: ${summary.piiCategories.join(', ')}`
                                    : 'no PII detected'}
                            </span>
                        </div>
                    )}

                    {/* Results */}
                    {error && (
                        <div className="py-3">
                            <EmptyState
                                icon={<XCircle size={28} className="text-red-500" />}
                                title="Couldn't generate ideas"
                                description={error}
                                action={{ label: 'Try again', onClick: () => runScan(true), icon: <Search size={14} /> }}
                                className="!h-auto !py-6"
                            />
                        </div>
                    )}

                    {!error && showSkeleton && (
                        <div className="flex flex-col items-center gap-3">
                            <Spinner size="sm" label="Scanning your tools" />
                            <SuggestionSkeleton count={3} />
                        </div>
                    )}

                    {!error && !showSkeleton && cooldown === 0 && scanned && suggestions.length === 0 && (
                        <EmptyState
                            icon={<Lightbulb size={28} />}
                            title={reason === 'no_integrations' ? 'Nothing to scan yet' : 'No repeating work spotted'}
                            description={
                                reason === 'no_integrations'
                                    ? 'No connected apps to scan yet — connect an integration first.'
                                    : 'No new repeating-work patterns found. Try selecting more apps or naming a focus area.'
                            }
                            className="!h-auto !py-8"
                        />
                    )}

                    {!error && suggestions.length > 0 && (
                        <SuggestionsSection
                            suggestions={suggestions}
                            onBuildDirectly={handleBuild}
                            onAskForChanges={handleAsk}
                            onDismiss={handleDismiss}
                            dismissed={dismissed}
                            builtIds={builtIds}
                        />
                    )}
                </>
            )}
        </div>
    );
}
