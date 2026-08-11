import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Play, Wand2, Search, Trash2, Compass, StopCircle, Eye, Loader2, LayoutDashboard } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import useTranslation from '../../../../hooks/useTranslation';
import StudioShell from '../../../shared/StudioShell';
import SourcePicker from './SourcePicker';
import RunModal from './RunModal';
import RunResults from './RunResults';
import InsightsDashboard, { StatusDot } from './InsightsDashboard';
import SuiteTrends from './SuiteTrends';

/**
 * TestsStudio — beta-quality Studio tab for Playwright test generation + runs.
 *
 * Backend contract: /api/tests/* (gated by playwright_tests license + beta).
 */
export default function TestsStudio({ user }) {
    const { t } = useTranslation();

    const [suites, setSuites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [runs, setRuns] = useState([]);
    const [q, setQ] = useState('');

    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showRunModal, setShowRunModal] = useState(false);
    const [adHocExplore, setAdHocExplore] = useState(false);
    const [activeRunId, setActiveRunId] = useState(null);
    const [showDashboard, setShowDashboard] = useState(false);

    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState(null);
    const [draftCode, setDraftCode] = useState('');
    const [editing, setEditing] = useState(false);
    const [activeRuns, setActiveRuns] = useState([]);

    const fetchActiveRuns = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/tests/runs/active`);
            if (res.ok) {
                const data = await res.json();
                setActiveRuns(data.runs || (data.run ? [data.run] : []));
            }
        } catch (_) { /* ignore */ }
    }, []);

    // Poll in-flight runs so several concurrent runs stay live in the sidebar.
    useEffect(() => {
        fetchActiveRuns();
        const id = setInterval(fetchActiveRuns, 5000);
        return () => clearInterval(id);
    }, [fetchActiveRuns]);

    const cancelRun = async (run) => {
        if (!run) return;
        if (!window.confirm('Cancel the running test? Any progress so far is kept.')) return;
        const res = await authFetch(`${API_BASE}/api/tests/runs/${encodeURIComponent(run.id)}/cancel`, { method: 'POST' });
        if (res.ok || res.status === 409) {
            if (activeRunId === run.id) setActiveRunId(null);
            fetchActiveRuns();
        } else {
            const data = await res.json().catch(() => ({}));
            window.alert(data?.message || data?.error || 'Failed to cancel');
        }
    };

    const fetchSuites = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/tests/suites`);
            if (res.ok) {
                const data = await res.json();
                setSuites(data.suites || []);
            }
        } catch (_) { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchSuites(); }, [fetchSuites]);

    useEffect(() => {
        if (!selected) { setSelectedDetail(null); setRuns([]); return; }
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/tests/suites/${selected.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setSelectedDetail(data.suite);
                    setDraftCode(data.suite?.playwrightCode || '');
                    setRuns(data.runs || []);
                }
            } catch (_) { /* ignore */ }
        })();
    }, [selected]);

    const createSuite = async () => {
        const res = await authFetch(`${API_BASE}/api/tests/suites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: t('tests_studio.untitled', 'Untitled Test Suite') }),
        });
        if (res.ok) {
            const data = await res.json();
            await fetchSuites();
            setShowDashboard(false);
            setSelected(data.suite);
        }
    };

    const deleteSuite = async (s) => {
        if (!window.confirm(`Delete "${s.name}"? Test runs are kept.`)) return;
        const res = await authFetch(`${API_BASE}/api/tests/suites/${s.id}`, { method: 'DELETE' });
        if (res.ok) {
            if (selected?.id === s.id) setSelected(null);
            await fetchSuites();
        }
    };

    const saveCode = async () => {
        if (!selected) return;
        const res = await authFetch(`${API_BASE}/api/tests/suites/${selected.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playwrightCode: draftCode }),
        });
        if (res.ok) {
            const data = await res.json();
            setSelectedDetail(data.suite);
            setEditing(false);
        }
    };

    const onPickedSources = async (sources) => {
        setShowSourcePicker(false);
        if (!selected || sources.length === 0) return;
        setGenerating(true);
        setGenError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/tests/suites/${selected.id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setGenError(data);
            } else {
                setSelectedDetail(data.suite);
                setDraftCode(data.suite?.playwrightCode || '');
            }
        } catch (e) {
            setGenError({ error: 'network', message: e.message });
        } finally {
            setGenerating(false);
        }
    };

    const startAgentRunFromPicker = async ({ targetUrl, source, credentials }) => {
        const body = { targetUrl, mode: 'agent', source, suiteId: selected?.id || null };
        if (credentials && Object.keys(credentials).length > 0) body.credentials = credentials;
        const res = await authFetch(`${API_BASE}/api/tests/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || 'failed_to_start');
        setShowSourcePicker(false);
        setActiveRunId(data.runId);
        fetchActiveRuns();
    };

    const startRun = async ({ targetUrl, mode, source, maxSteps, credentials }) => {
        let body;
        if (mode === 'agent') {
            body = { targetUrl, mode, source, suiteId: adHocExplore ? null : (selected?.id || null) };
            if (Number.isFinite(maxSteps) && maxSteps > 0) body.maxSteps = maxSteps;
        } else if (mode === 'explore' && adHocExplore) {
            body = { targetUrl, mode: 'explore' };
        } else {
            body = { suiteId: selected?.id, targetUrl, mode };
        }
        // Credentials (agent + suite) ride along in the request only; the worker
        // keeps them in memory for the run and never persists them.
        if (credentials && Object.keys(credentials).length > 0) body.credentials = credentials;
        const res = await authFetch(`${API_BASE}/api/tests/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || 'failed_to_start');
        setShowRunModal(false);
        setAdHocExplore(false);
        setActiveRunId(data.runId);
        fetchActiveRuns();
    };

    const openExplore = () => { setAdHocExplore(true); setShowRunModal(true); };

    const filtered = suites.filter(s => !q || (s.name || '').toLowerCase().includes(q.toLowerCase()));
    const running = activeRuns.filter(r => r.status === 'running');
    const queued = activeRuns.filter(r => r.status === 'queued');

    const selectSuite = (s) => { setShowDashboard(false); setActiveRunId(null); setSelected(s); };

    return (
        <>
            <StudioShell
                sidebarTitle={(
                    <span className="flex items-center gap-2">
                        {t('tests_studio.title', 'Tests')}
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">Beta</span>
                    </span>
                )}
                sidebarActions={(
                    <button
                        onClick={createSuite}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                        title="New test suite"
                    >
                        <Plus size={14} />
                    </button>
                )}
                sidebar={(
                    <div className="flex flex-col gap-2 p-3">
                        <button
                            onClick={() => { setShowDashboard(true); setSelected(null); setActiveRunId(null); }}
                            className={`flex items-center gap-2 text-xs px-3 py-2 rounded border ${showDashboard && !selected && !activeRunId
                                ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}
                        >
                            <LayoutDashboard size={12} /> Overview
                        </button>

                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-2 text-[var(--text-tertiary)]" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search suites…"
                                className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                            />
                        </div>

                        {(running.length > 0 || queued.length > 0) && (
                            <div className="text-[11px] rounded border border-amber-500/40 bg-amber-500/10 p-2 flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                    <Loader2 className="animate-spin" size={11} />
                                    {running.length} running{queued.length > 0 ? ` · ${queued.length} queued` : ''}
                                </div>
                                {activeRuns.slice(0, 6).map(run => (
                                    <div key={run.id} className="flex items-center gap-1.5">
                                        <StatusDot status={run.status} />
                                        <span className="font-mono text-[10px] truncate text-[var(--text-secondary)] flex-1">
                                            {run.id.slice(0, 8)} · {run.mode}
                                        </span>
                                        <button
                                            onClick={() => { setSelected(null); setShowDashboard(false); setActiveRunId(run.id); }}
                                            className="p-0.5 rounded hover:bg-amber-500/20"
                                            title="View run"
                                        >
                                            <Eye size={11} />
                                        </button>
                                        <button
                                            onClick={() => cancelRun(run)}
                                            className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                                            title="Cancel run"
                                        >
                                            <StopCircle size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={openExplore}
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-dashed border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)]"
                        >
                            <Compass size={12} /> Ad-hoc explore
                        </button>

                        {loading && <div className="text-xs text-[var(--text-tertiary)]">Loading…</div>}
                        {!loading && filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] italic px-1">
                                {t('tests_studio.no_suites', 'No test suites yet — create one with the + button.')}
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            {filtered.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => selectSuite(s)}
                                    className={`text-left text-xs px-3 py-2 rounded border ${selected?.id === s.id
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                        : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}
                                >
                                    <div className="font-semibold truncate">{s.name}</div>
                                    <div className="text-[var(--text-tertiary)] truncate">
                                        {(s.playwrightCode || '').length > 0 ? 'Generated' : 'No code yet'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            >
                {activeRunId ? (
                    <RunResults
                        runId={activeRunId}
                        onClose={() => { setActiveRunId(null); fetchActiveRuns(); }}
                        onCancelled={() => { fetchActiveRuns(); }}
                    />
                ) : selected ? (
                    <Detail
                        suite={selectedDetail || selected}
                        runs={runs}
                        draftCode={draftCode}
                        setDraftCode={setDraftCode}
                        editing={editing}
                        setEditing={setEditing}
                        onSaveCode={saveCode}
                        onGenerate={() => { setGenError(null); setShowSourcePicker(true); }}
                        onRun={() => setShowRunModal(true)}
                        onDelete={() => deleteSuite(selectedDetail || selected)}
                        onOpenRun={(id) => setActiveRunId(id)}
                        generating={generating}
                        genError={genError}
                    />
                ) : (
                    <InsightsDashboard
                        onCreate={createSuite}
                        onExplore={openExplore}
                        onOpenRun={(id) => setActiveRunId(id)}
                    />
                )}
            </StudioShell>

            {showSourcePicker && (
                <SourcePicker
                    onClose={() => setShowSourcePicker(false)}
                    onConfirm={onPickedSources}
                    onRunAgent={startAgentRunFromPicker}
                />
            )}
            {showRunModal && (
                <RunModal
                    suite={adHocExplore ? null : (selectedDetail || selected)}
                    onClose={() => { setShowRunModal(false); setAdHocExplore(false); }}
                    onStart={startRun}
                />
            )}
        </>
    );
}

function Detail({ suite, runs, draftCode, setDraftCode, editing, setEditing, onSaveCode, onGenerate, onRun, onDelete, onOpenRun, generating, genError }) {
    if (!suite) return null;
    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)] gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{suite.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                        Suite {suite.id}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                    >
                        <Wand2 size={12} /> {generating ? 'Generating…' : 'Generate'}
                    </button>
                    <button
                        onClick={onRun}
                        disabled={!(suite.playwrightCode || '').trim()}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                    >
                        <Play size={12} /> Run
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--bg-secondary)]"
                        title="Delete suite"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
                {genError && <GenerationError data={genError} />}

                <section className="rounded-lg border border-[var(--border-default)] p-4">
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Insights</h4>
                    <SuiteTrends suiteId={suite.id} refreshKey={runs.length} />
                </section>

                <section>
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Sources used</h4>
                    {(suite.sourceManifest || []).length === 0 ? (
                        <div className="text-xs text-[var(--text-tertiary)] italic">No sources yet — click <strong>Generate</strong> to pick some.</div>
                    ) : (
                        <ul className="text-xs flex flex-col gap-1">
                            {suite.sourceManifest.map((s, i) => (
                                <li key={i} className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                                    <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{s.kind}</span>{' '}
                                    {s.title}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Playwright code</h4>
                        {!editing ? (
                            <button
                                onClick={() => setEditing(true)}
                                disabled={!(suite.playwrightCode || '').trim()}
                                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                            >
                                Edit
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setEditing(false)} className="text-xs text-[var(--text-secondary)]">Cancel</button>
                                <button onClick={onSaveCode} className="text-xs text-[var(--accent-primary)]">Save</button>
                            </div>
                        )}
                    </div>
                    {editing ? (
                        <textarea
                            value={draftCode}
                            onChange={(e) => setDraftCode(e.target.value)}
                            rows={20}
                            className="w-full font-mono text-xs px-3 py-2 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                        />
                    ) : (
                        <pre className="font-mono text-xs px-3 py-2 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] whitespace-pre-wrap max-h-96 overflow-y-auto">
                            {suite.playwrightCode?.trim() || '// (no code yet — click Generate)'}
                        </pre>
                    )}
                </section>

                <section>
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Recent runs ({runs.length})</h4>
                    {runs.length === 0 ? (
                        <div className="text-xs text-[var(--text-tertiary)] italic">No runs yet.</div>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {runs.map(r => (
                                <li key={r.id}>
                                    <button
                                        onClick={() => onOpenRun(r.id)}
                                        className="w-full text-left text-xs px-3 py-2 rounded border border-[var(--border-default)] hover:border-[var(--accent-primary)]"
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-mono">{r.id.slice(0, 8)}</span>
                                            <span className={r.status === 'passed' ? 'text-emerald-500' : r.status === 'failed' ? 'text-red-500' : 'text-[var(--text-secondary)]'}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <div className="text-[var(--text-tertiary)] truncate">
                                            {r.targetUrl} • {r.mode} • {r.createdAt || ''}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}

function GenerationError({ data }) {
    if (data.error === 'missing_integration') {
        const label = data.integration === 'github' ? 'GitHub' : data.integration === 'youtrack' ? 'YouTrack' : data.integration;
        return (
            <div className="text-xs px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-[var(--text-primary)]">
                Connect {label} before generating tests from {label} sources.
                {' '}
                <a href="/app/settings/integrations" className="underline">Open settings →</a>
            </div>
        );
    }
    return (
        <div className="text-xs px-3 py-2 rounded border border-red-500/40 bg-red-500/10 text-[var(--text-primary)]">
            <div className="font-semibold mb-1">Generation failed: {data.error}</div>
            {data.message && <div>{data.message}</div>}
        </div>
    );
}
