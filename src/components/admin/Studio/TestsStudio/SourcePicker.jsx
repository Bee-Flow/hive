import React, { useEffect, useState } from 'react';
import { X, MessageSquare, GitBranch, Bug, FileText, Plus, Trash2, Sparkles, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * SourcePicker — modal that lets the user assemble a list of sources for the
 * test generator. Tabs: Conversations / GitHub / YouTrack / Free text. On
 * confirm the picked sources are returned to the parent which POSTs them to
 * /api/tests/suites/:id/generate.
 *
 * Missing-integration detection happens server-side via testGenerator's
 * `missing_integration` error; this picker only surfaces UI for sources the
 * user picks and trusts the backend to validate.
 */
export default function SourcePicker({ onClose, onConfirm, onRunAgent }) {
    const [tab, setTab] = useState('conversation');
    const [picked, setPicked] = useState([]);
    // Each panel reports its current in-flight draft so the agent button can
    // pick it up even if the user forgot to click "Add issue". The picked
    // list is still authoritative for the Generate-code flow.
    const [draftSource, setDraftSource] = useState(null);
    const [agentUrl, setAgentUrl] = useState('');
    const [agentBusy, setAgentBusy] = useState(false);
    const [agentErr, setAgentErr] = useState(null);
    const [showCreds, setShowCreds] = useState(false);
    const [credUsername, setCredUsername] = useState('');
    const [credPassword, setCredPassword] = useState('');
    const [credTotp, setCredTotp] = useState('');

    const remove = (idx) => setPicked(p => p.filter((_, i) => i !== idx));
    const add = (src) => setPicked(p => [...p, src]);

    // Agent mode is single-source — prefer a picked agent-compatible source,
    // otherwise fall back to the in-flight draft of the currently-open tab.
    // Conversation / commit-range / file sources are generation-only.
    const agentSource = pickAgentSource(picked) || (isAgentCompatibleDraft(draftSource) ? draftSource : null);

    const runAgent = async () => {
        setAgentErr(null);
        if (!agentSource) {
            setAgentErr('Add a YouTrack issue, GitHub issue, or free-text source — those are the kinds the agent can drive.');
            return;
        }
        if (!agentUrl || !/^https?:\/\//.test(agentUrl)) {
            setAgentErr('Target URL must start with http:// or https://');
            return;
        }
        // Build credentials payload only if the user actually entered any —
        // an empty object would still tell Claude credentials are available.
        const credentials = {};
        if (credUsername.trim()) credentials.username = credUsername;
        if (credPassword) credentials.password = credPassword;
        if (credTotp.trim()) credentials.totp = credTotp.trim();
        const credPayload = Object.keys(credentials).length > 0 ? credentials : null;

        setAgentBusy(true);
        try {
            await onRunAgent({ targetUrl: agentUrl, source: agentSource, credentials: credPayload });
            // Wipe local state immediately on success so the credentials don't
            // hang around in the modal if it's reopened.
            setCredUsername('');
            setCredPassword('');
            setCredTotp('');
        } catch (e) {
            setAgentErr(e.message || 'Failed to start agent run');
        } finally {
            setAgentBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="relative w-[820px] max-h-[80vh] flex flex-col rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pick sources for generation</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X size={16} /></button>
                </header>

                <div className="flex border-b border-[var(--border-default)] px-3">
                    <TabBtn icon={<MessageSquare size={14} />} label="Conversations" active={tab === 'conversation'} onClick={() => { setTab('conversation'); setDraftSource(null); }} />
                    <TabBtn icon={<GitBranch size={14} />} label="GitHub" active={tab === 'github'} onClick={() => { setTab('github'); setDraftSource(null); }} />
                    <TabBtn icon={<Bug size={14} />} label="YouTrack" active={tab === 'youtrack'} onClick={() => { setTab('youtrack'); setDraftSource(null); }} />
                    <TabBtn icon={<FileText size={14} />} label="Free text" active={tab === 'text'} onClick={() => { setTab('text'); setDraftSource(null); }} />
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {tab === 'conversation' && <ConversationsPanel onAdd={add} />}
                    {tab === 'github' && <GithubPanel onAdd={add} onDraftChange={setDraftSource} />}
                    {tab === 'youtrack' && <YouTrackPanel onAdd={add} onDraftChange={setDraftSource} />}
                    {tab === 'text' && <TextPanel onAdd={add} onDraftChange={setDraftSource} />}
                </div>

                <div className="border-t border-[var(--border-default)] px-5 py-3">
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                        Picked sources ({picked.length})
                    </div>
                    {picked.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] italic">Pick at least one source.</div>
                    )}
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                        {picked.map((p, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-[var(--bg-secondary)]">
                                <span className="truncate">{describeSource(p)}</span>
                                <button onClick={() => remove(i)} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]"><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {onRunAgent && (
                    <div className="border-t border-[var(--border-default)] px-5 py-3 flex flex-col gap-2 bg-[var(--bg-secondary)]/40">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                            <Sparkles size={12} /> Or run live with the AI
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)]">
                            {agentSource
                                ? <>The AI will use: <span className="font-medium text-[var(--text-secondary)]">{describeSource(agentSource)}</span>. It drives a real browser against the target URL — watch live.</>
                                : <>Enter a YouTrack ID, GitHub issue, or free text above. The AI reads it and drives a real browser against the target URL.</>
                            }
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={agentUrl}
                                onChange={(e) => setAgentUrl(e.target.value)}
                                placeholder="Target URL (https://…)"
                                className="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)]"
                            />
                            <button
                                onClick={runAgent}
                                disabled={!agentSource || !agentUrl || agentBusy}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap rounded"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                <Sparkles size={12} /> {agentBusy ? 'Starting…' : 'Run with Agent'}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCreds(s => !s)}
                            className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] self-start"
                        >
                            {showCreds ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            <Lock size={11} /> Credentials (optional)
                        </button>
                        {showCreds && (
                            <div className="flex flex-col gap-2 p-2 rounded border border-[var(--border-default)] bg-[var(--bg-primary)]">
                                <div className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                                    Stored in memory for this run only. Never written to the database, never echoed back, never visible to Claude — the agent uses tokens like <code>{`{{USERNAME}}`}</code> and the worker substitutes the real value at type-time. Password fields are blurred in the live preview.
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        value={credUsername}
                                        onChange={(e) => setCredUsername(e.target.value)}
                                        placeholder="Username / email"
                                        autoComplete="off"
                                        className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                                    />
                                    <input
                                        type="password"
                                        value={credPassword}
                                        onChange={(e) => setCredPassword(e.target.value)}
                                        placeholder="Password"
                                        autoComplete="new-password"
                                        className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                                    />
                                </div>
                                <input
                                    value={credTotp}
                                    onChange={(e) => setCredTotp(e.target.value)}
                                    placeholder="TOTP code (optional, 6 digits)"
                                    autoComplete="off"
                                    className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                                />
                            </div>
                        )}

                        {agentErr && <div className="text-[11px] text-[var(--danger)]">{agentErr}</div>}
                    </div>
                )}

                <footer className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">Cancel</button>
                    <button
                        onClick={() => {
                            // Auto-add the in-flight draft so the user doesn't
                            // need to click "Add issue" first when they only
                            // picked one source.
                            const effective = picked.length > 0
                                ? picked
                                : (draftSource ? [draftSource] : []);
                            if (effective.length === 0) return;
                            onConfirm(effective);
                        }}
                        disabled={picked.length === 0 && !draftSource}
                        className="px-4 py-1.5 text-sm font-semibold rounded text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        Generate code
                    </button>
                </footer>
            </div>
        </div>
    );
}

// Map a SourcePicker source to the single-source shape the agent route accepts.
// Returns null if no picked source is agent-compatible (conversations, github
// files, and commit ranges are generation-only).
function pickAgentSource(picked) {
    for (const s of picked) {
        const norm = normalizeAgentSource(s);
        if (norm) return norm;
    }
    return null;
}

function isAgentCompatibleDraft(s) {
    return !!normalizeAgentSource(s);
}

function normalizeAgentSource(s) {
    if (!s) return null;
    if (s.type === 'text' && (s.body || '').trim()) {
        return { type: 'text', label: s.label || 'Pasted spec', body: s.body };
    }
    if (s.type === 'youtrack' && s.issueId) {
        return { type: 'youtrack', issueId: s.issueId };
    }
    if (s.type === 'github_issue' && s.owner && s.repo && s.number) {
        return { type: 'github', owner: s.owner, repo: s.repo, number: s.number };
    }
    return null;
}

function describeSource(s) {
    switch (s.type) {
        case 'conversation': return `Conversation • ${s.title || s.conversationId}`;
        case 'github_file': return `GitHub file • ${s.owner}/${s.repo}:${s.path}${s.ref ? '@' + s.ref : ''}`;
        case 'github_commit': return `GitHub commits • ${s.owner}/${s.repo}${s.sha ? ' since ' + s.sha.slice(0, 7) : ''}`;
        case 'github_issue': return `GitHub issue • ${s.owner}/${s.repo}#${s.number}`;
        case 'youtrack': return `YouTrack issue • ${s.issueId}`;
        case 'youtrack_query': return `YouTrack query • ${s.query}`;
        case 'text': return `Free text • ${s.label || (s.body || '').slice(0, 40)}`;
        case 'url': return `URL • ${s.url}`;
        default: return JSON.stringify(s).slice(0, 80);
    }
}

function TabBtn({ icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition ${active
                ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
            {icon}
            {label}
        </button>
    );
}

function ConversationsPanel({ onAdd }) {
    const [convs, setConvs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');

    useEffect(() => {
        (async () => {
            try {
                // Endpoint /api/agent-conversations exists in the codebase; if it
                // 404s in older deployments we degrade to an empty list rather
                // than break the picker.
                const res = await authFetch(`${API_BASE}/api/agent-conversations`);
                if (res.ok) {
                    const data = await res.json();
                    setConvs(Array.isArray(data) ? data : (data?.conversations || []));
                }
            } catch (_) {}
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = convs.filter(c => !q || (c.title || '').toLowerCase().includes(q.toLowerCase()));

    return (
        <div className="flex flex-col gap-3">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search conversations…"
                className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
            />
            {loading && <div className="text-xs text-[var(--text-tertiary)]">Loading…</div>}
            {!loading && filtered.length === 0 && (
                <div className="text-xs text-[var(--text-tertiary)] italic">No conversations found.</div>
            )}
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                {filtered.map(c => (
                    <button
                        key={c.id}
                        onClick={() => onAdd({ type: 'conversation', conversationId: c.id, title: c.title || c.id })}
                        className="text-left text-xs px-3 py-2 rounded border border-[var(--border-default)] hover:border-[var(--accent-primary)]"
                    >
                        <div className="font-semibold truncate">{c.title || 'Untitled conversation'}</div>
                        <div className="text-[var(--text-tertiary)]">{c.id}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function GithubPanel({ onAdd, onDraftChange }) {
    const [owner, setOwner] = useState('');
    const [repo, setRepo] = useState('');
    const [filePath, setFilePath] = useState('');
    const [ref, setRef] = useState('');
    const [sha, setSha] = useState('');
    const [issueNumber, setIssueNumber] = useState('');

    useEffect(() => {
        const num = Number(issueNumber);
        onDraftChange?.(owner && repo && num > 0
            ? { type: 'github_issue', owner, repo, number: num }
            : null);
    }, [owner, repo, issueNumber, onDraftChange]);

    return (
        <div className="flex flex-col gap-4 text-sm">
            <div className="text-xs text-[var(--text-tertiary)]">
                Uses your stored GitHub personal access token. Connect it under
                Settings → Integrations if you haven't already.
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner (org or user)" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repository" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2 items-center">
                <input
                    value={issueNumber}
                    onChange={(e) => setIssueNumber(e.target.value)}
                    placeholder="Issue / PR number (e.g. 42)"
                    className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]"
                />
                <button
                    onClick={() => onAdd({ type: 'github_issue', owner, repo, number: Number(issueNumber) })}
                    disabled={!owner || !repo || !issueNumber}
                    className="px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={12} className="inline mr-1" /> Add issue
                </button>
            </div>

            <hr className="border-[var(--border-default)]" />

            <div className="grid grid-cols-2 gap-2">
                <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="File path (e.g. src/auth.ts)" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Branch / SHA (optional)" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
            </div>
            <button
                onClick={() => onAdd({ type: 'github_file', owner, repo, path: filePath, ref: ref || undefined })}
                disabled={!owner || !repo || !filePath}
                className="self-start px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
            >
                <Plus size={12} className="inline mr-1" /> Add file
            </button>

            <hr className="border-[var(--border-default)]" />

            <div className="grid grid-cols-1 gap-2">
                <input value={sha} onChange={(e) => setSha(e.target.value)} placeholder="Since SHA (optional — recent commits otherwise)" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                <button
                    onClick={() => onAdd({ type: 'github_commit', owner, repo, sha: sha || undefined })}
                    disabled={!owner || !repo}
                    className="self-start px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={12} className="inline mr-1" /> Add commit range
                </button>
            </div>
        </div>
    );
}

function YouTrackPanel({ onAdd, onDraftChange }) {
    const [issueId, setIssueId] = useState('');
    const [query, setQuery] = useState('');
    useEffect(() => {
        onDraftChange?.(issueId ? { type: 'youtrack', issueId } : null);
    }, [issueId, onDraftChange]);
    return (
        <div className="flex flex-col gap-4 text-sm">
            <div className="text-xs text-[var(--text-tertiary)]">
                Uses your stored YouTrack URL + token. Connect it under
                Settings → Integrations if you haven't already.
            </div>
            <div className="flex gap-2">
                <input value={issueId} onChange={(e) => setIssueId(e.target.value)} placeholder="Issue ID (e.g. PROJ-123)" className="flex-1 px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                <button
                    onClick={() => onAdd({ type: 'youtrack', issueId })}
                    disabled={!issueId}
                    className="px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                >
                    Add issue
                </button>
            </div>
            <div className="flex gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search query (e.g. "project: WEB state: Open")' className="flex-1 px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                <button
                    onClick={() => onAdd({ type: 'youtrack_query', query })}
                    disabled={!query}
                    className="px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
                >
                    Add query
                </button>
            </div>
        </div>
    );
}

function TextPanel({ onAdd, onDraftChange }) {
    const [label, setLabel] = useState('');
    const [body, setBody] = useState('');
    useEffect(() => {
        onDraftChange?.(body.trim() ? { type: 'text', label: label || 'Free text', body } : null);
    }, [label, body, onDraftChange]);
    return (
        <div className="flex flex-col gap-2 text-sm">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste a spec, an acceptance criterion, or a description of what to test…"
                rows={8}
                className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
            />
            <button
                onClick={() => onAdd({ type: 'text', label: label || 'Free text', body })}
                disabled={!body.trim()}
                className="self-start px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}
            >
                <Plus size={12} className="inline mr-1" /> Add text source
            </button>
        </div>
    );
}
