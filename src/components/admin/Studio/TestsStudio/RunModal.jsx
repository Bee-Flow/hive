import React, { useState } from 'react';
import { X, FileText, Bug, Github } from 'lucide-react';

/**
 * RunModal — collects target URL + mode (suite / explore / agent) and submits a run.
 * Agent mode also collects a single source (text / YouTrack / GitHub) so the
 * worker has a concrete ticket body to drive Claude with.
 */
export default function RunModal({ suite, defaultMode = 'suite', onClose, onStart }) {
    const [targetUrl, setTargetUrl] = useState('');
    const [mode, setMode] = useState(suite ? defaultMode : 'explore');
    const [sourceType, setSourceType] = useState('text');
    const [sourceText, setSourceText] = useState('');
    const [ytIssueId, setYtIssueId] = useState('');
    const [ghOwner, setGhOwner] = useState('');
    const [ghRepo, setGhRepo] = useState('');
    const [ghNumber, setGhNumber] = useState('');
    const [maxSteps, setMaxSteps] = useState(25);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setErr(null);
        if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
            setErr('Target URL must start with http:// or https://');
            return;
        }
        let source = null;
        if (mode === 'agent') {
            if (sourceType === 'text') {
                if (!sourceText.trim()) { setErr('Paste a spec or ticket description for the agent.'); return; }
                source = { type: 'text', label: 'Pasted spec', body: sourceText.trim() };
            } else if (sourceType === 'youtrack') {
                if (!ytIssueId.trim()) { setErr('Enter a YouTrack issue ID.'); return; }
                source = { type: 'youtrack', issueId: ytIssueId.trim() };
            } else if (sourceType === 'github') {
                if (!ghOwner.trim() || !ghRepo.trim() || !ghNumber.trim()) {
                    setErr('Enter the GitHub owner, repo, and issue/PR number.'); return;
                }
                source = { type: 'github', owner: ghOwner.trim(), repo: ghRepo.trim(), number: Number(ghNumber) };
            }
        }
        let parsedMaxSteps = null;
        if (mode === 'agent') {
            parsedMaxSteps = parseInt(maxSteps, 10);
            if (!Number.isFinite(parsedMaxSteps) || parsedMaxSteps < 1 || parsedMaxSteps > 200) {
                setErr('Max steps must be between 1 and 200.');
                return;
            }
        }
        setBusy(true);
        try {
            await onStart({ targetUrl, mode, source, maxSteps: parsedMaxSteps });
        } catch (e) {
            setErr(e.message || 'Failed to start run');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-[560px] max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="text-sm font-semibold">
                        {suite ? `Run "${suite.name}"` : 'Ad-hoc run'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X size={16} /></button>
                </header>
                <div className="px-5 py-4 flex flex-col gap-3">
                    <label className="text-xs text-[var(--text-secondary)]">
                        Target URL
                        <input
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="mt-1 w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                        />
                    </label>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-[var(--text-secondary)]">Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                            {suite && (
                                <button
                                    onClick={() => setMode('suite')}
                                    className={`px-2 py-2 text-xs rounded border text-center ${mode === 'suite'
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                        : 'border-[var(--border-default)]'}`}
                                >
                                    Suite
                                </button>
                            )}
                            <button
                                onClick={() => setMode('explore')}
                                className={`px-2 py-2 text-xs rounded border text-center ${mode === 'explore'
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)]'}`}
                            >
                                Explore
                            </button>
                            <button
                                onClick={() => setMode('agent')}
                                className={`px-2 py-2 text-xs rounded border text-center ${mode === 'agent'
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)]'}`}
                            >
                                Agent (live)
                            </button>
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
                            {mode === 'suite' && 'Runs the suite\'s Playwright code via the test runner.'}
                            {mode === 'explore' && 'Deterministic baseline sweep — no LLM, no live view.'}
                            {mode === 'agent' && 'Claude drives the browser step-by-step against a real Chromium. Watch live below.'}
                        </div>
                    </div>

                    {mode === 'agent' && (
                        <label className="text-xs text-[var(--text-secondary)]">
                            Max steps
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={maxSteps}
                                onChange={(e) => setMaxSteps(e.target.value)}
                                className="mt-1 w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                            />
                            <span className="block mt-1 text-[10px] text-[var(--text-tertiary)]">
                                How many actions the agent may take before stopping. Default 25, max 200.
                            </span>
                        </label>
                    )}

                    {mode === 'agent' && (
                        <div className="flex flex-col gap-2 mt-2 p-3 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]">
                            <label className="text-xs text-[var(--text-secondary)]">Source</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setSourceType('text')}
                                    className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border ${sourceType === 'text'
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-primary)]'
                                        : 'border-[var(--border-default)]'}`}
                                >
                                    <FileText size={12} /> Text
                                </button>
                                <button
                                    onClick={() => setSourceType('youtrack')}
                                    className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border ${sourceType === 'youtrack'
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-primary)]'
                                        : 'border-[var(--border-default)]'}`}
                                >
                                    <Bug size={12} /> YouTrack
                                </button>
                                <button
                                    onClick={() => setSourceType('github')}
                                    className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border ${sourceType === 'github'
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-primary)]'
                                        : 'border-[var(--border-default)]'}`}
                                >
                                    <Github size={12} /> GitHub
                                </button>
                            </div>
                            {sourceType === 'text' && (
                                <textarea
                                    rows={5}
                                    value={sourceText}
                                    onChange={(e) => setSourceText(e.target.value)}
                                    placeholder="Describe the scenario the agent should verify or reproduce…"
                                    className="w-full px-3 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                                />
                            )}
                            {sourceType === 'youtrack' && (
                                <input
                                    value={ytIssueId}
                                    onChange={(e) => setYtIssueId(e.target.value)}
                                    placeholder="Issue ID (e.g. PROJ-123)"
                                    className="w-full px-3 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                                />
                            )}
                            {sourceType === 'github' && (
                                <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
                                    <input
                                        value={ghOwner}
                                        onChange={(e) => setGhOwner(e.target.value)}
                                        placeholder="owner"
                                        className="px-3 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                                    />
                                    <input
                                        value={ghRepo}
                                        onChange={(e) => setGhRepo(e.target.value)}
                                        placeholder="repo"
                                        className="px-3 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                                    />
                                    <input
                                        type="number"
                                        value={ghNumber}
                                        onChange={(e) => setGhNumber(e.target.value)}
                                        placeholder="#"
                                        className="px-3 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {err && <div className="text-xs text-[var(--danger)]">{err}</div>}
                </div>
                <footer className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm rounded text-white font-semibold disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                    >
                        {busy ? 'Starting…' : 'Start run'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
