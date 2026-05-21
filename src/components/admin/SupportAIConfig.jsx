import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Sparkles, AlertTriangle, Send } from 'lucide-react';
import AgentEditorUI from './AgentEditorUI';
import MarkdownRenderer from '../MarkdownRenderer';
import { tierLabel } from '../tierMeta';
import { authFetch, API_BASE } from '../../utils/helpers';

/**
 * SupportAIConfig — Studio-style editor for the singleton Bee Flow Support
 * agent. Reuses AgentEditorUI (same component the Agent Studio uses) so the
 * look-and-feel is identical to the rest of the app, and reuses
 * MarkdownRenderer + tierMeta for the preview reply rendering.
 *
 * Mounts inside the admin "Support" tab as a sub-view. Loads the agent from
 * GET /api/support/agent, persists via PUT /api/support/agent, and previews
 * via POST /api/support/preview.
 */

function deriveAgentData(agent) {
    if (!agent) return null;
    let starterPrompts = agent.starter_prompts;
    if (typeof starterPrompts === 'string') {
        try { starterPrompts = JSON.parse(starterPrompts); } catch { starterPrompts = []; }
    }
    if (!Array.isArray(starterPrompts)) starterPrompts = [];
    return {
        id: agent.id,
        name: agent.name || 'Bee Flow Support',
        avatar: agent.avatar || '🛟',
        model: agent.model || 'tier:thinking',
        description: agent.description || '',
        systemPrompt: agent.system_prompt || '',
        starterPrompts,
        categoryId: agent.category_id || null,
        config: agent.config || {},
    };
}

export default function SupportAIConfig() {
    const [agent, setAgent] = useState(null);
    const [data, setData] = useState(null);
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [previewInput, setPreviewInput] = useState('How do I cancel my subscription?');
    const [previewing, setPreviewing] = useState(false);
    const [previewReply, setPreviewReply] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [tiers, setTiers] = useState({});
    const mountedRef = useRef(true);

    // Set `true` on every (re-)mount and only `false` during cleanup. React 18
    // StrictMode runs effects twice in dev: mount → unmount (cleanup runs, ref
    // flips to false) → mount again — and without resetting here, the second
    // mount would keep mountedRef as `false`, silently swallowing every
    // setLoading/setSaving call after the first fetch.
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support/agent`);
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                setSaveError(e.error || 'Failed to load support agent');
                return;
            }
            const { agent: fetched } = await res.json();
            setAgent(fetched);
            setData(deriveAgentData(fetched));
            setKnowledgeBaseIds(fetched?.config?.knowledge_base_ids || []);
            setDirty(false);
        } catch (e) {
            setSaveError(e.message);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Same tier source the rest of the app uses (InputArea, BuilderSplit, …).
    // We mirror it locally so we can surface a "this tier has no modelId in
    // your AI Config" warning without the admin having to test-reply first.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled) setTiers(json || {});
            } catch {}
        })();
        return () => { cancelled = true; };
    }, []);

    // AgentEditorUI gives us field-level changes; we merge into our local
    // `data` and mark dirty so the Save button activates.
    const handleChange = useCallback((field, value) => {
        setData(prev => prev ? { ...prev, [field]: value } : prev);
        setDirty(true);
    }, []);

    // KnowledgePanel inside AgentEditorUI sends knowledgeBaseIds via the
    // PATCH /agents/:id/knowledge endpoint by itself (it calls the server
    // directly). For our singleton we want PUT /api/support/agent to also
    // carry the ids so the backend mirrors them into configStore. We track
    // the current list separately and pass it as the controlled value down
    // the editor via the `agentId` it already gets — the panel does its own
    // GET /api/kb call, no extra wiring needed.
    //
    // To keep the support route the single source of truth, we read the
    // freshly-saved agent back after save and re-seed our local state.

    const handleSave = useCallback(async () => {
        if (!data || saving) return;
        setSaving(true);
        setSaveError(null);
        try {
            const body = {
                name: data.name,
                description: data.description,
                systemPrompt: data.systemPrompt,
                model: data.model,
                starterPrompts: data.starterPrompts || [],
                // knowledgeBaseIds is intentionally NOT sent here — the
                // KnowledgePanel inside AgentEditorUI persists it via the
                // generic /agents/:id/knowledge endpoint. We refetch after
                // save and reflect the result.
            };
            const res = await authFetch(`${API_BASE}/api/support/agent`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || `Save failed (${res.status})`);
            }
            await load();
            setDirty(false);
        } catch (e) {
            setSaveError(e.message);
        } finally {
            if (mountedRef.current) setSaving(false);
        }
    }, [data, saving, load]);

    const runPreview = useCallback(async () => {
        const message = previewInput.trim();
        if (!message || previewing) return;
        setPreviewing(true);
        setPreviewError(null);
        setPreviewReply(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Preview failed (${res.status})`);
            setPreviewReply(json);
        } catch (e) {
            setPreviewError(e.message);
        } finally {
            if (mountedRef.current) setPreviewing(false);
        }
    }, [previewInput, previewing]);

    if (loading) {
        return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>Loading Bee Flow Support agent…</div>;
    }
    if (!data) {
        return (
            <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                {saveError || 'Bee Flow Support agent is not seeded yet. Restart the server.'}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Sticky save bar */}
            <div className="px-4 py-2 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                    <span>Singleton agent · same editor as Agent Studio</span>
                </div>
                <div className="flex items-center gap-2">
                    {saveError && (
                        <span className="text-xs flex items-center gap-1" style={{ color: '#dc2626' }}>
                            <AlertTriangle className="w-3 h-3" /> {saveError}
                        </span>
                    )}
                    {dirty && !saveError && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unsaved changes</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                    >
                        <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {/* Inline sanity check: if the chosen tier has no modelId in
                    this environment, every customer thread will escalate with
                    a "model not found" error. We surface that immediately
                    instead of letting the admin discover it via a failed reply. */}
                {(() => {
                    if (!data?.model || !data.model.startsWith('tier:')) return null;
                    const tierKey = data.model.slice(5);
                    if (tierKey === 'auto') return null;
                    const tier = tiers[tierKey];
                    if (tier && tier.modelId) {
                        return (
                            <div className="max-w-2xl mx-auto px-4 pt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                Current tier <strong>{tierKey}</strong> resolves to model <code>{tier.modelId}</code>.
                            </div>
                        );
                    }
                    return (
                        <div className="max-w-2xl mx-auto px-4 pt-3">
                            <div className="rounded-lg border p-3 text-xs flex items-start gap-2"
                                style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#991b1b' }}>
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-medium">Tier <code>{tierKey}</code> has no model configured.</div>
                                    <div className="opacity-80">Every customer thread will escalate to staff until you either pick a different tier above or set <code>{tierKey}</code> in Admin → AI Config → Model tiers.</div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Reuse the same editor the Studio uses */}
                <AgentEditorUI
                    data={data}
                    onChange={handleChange}
                    isSystem={true}
                    hasKnowledge={true}
                    hasSkills={false}
                    agentId={agent?.id}
                    API_BASE={API_BASE}
                    categories={[]}
                    modelTiers={tiers}
                />

                {/* Preview pane — mirrors how MessageItem assistant replies
                    look in the real chat, using MarkdownRenderer (same
                    component MessageItem uses internally). */}
                <div className="max-w-2xl mx-auto p-4 pt-2 mb-6">
                    <div className="rounded-xl border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        <div className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-wide"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                            Preview
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Test the support AI without creating a real thread. No emails, no notifications, no DB writes.
                            </p>
                            <textarea
                                value={previewInput}
                                onChange={e => setPreviewInput(e.target.value)}
                                rows={3}
                                placeholder="Type a question as if you were a customer…"
                                className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={runPreview}
                                    disabled={previewing || !previewInput.trim()}
                                    className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                                >
                                    <Send className="w-3.5 h-3.5" /> {previewing ? 'Asking…' : 'Test reply'}
                                </button>
                            </div>

                            {previewError && (
                                <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                                    {previewError}
                                </div>
                            )}

                            {previewReply && (
                                <div className="rounded-lg p-3 text-sm border"
                                    style={{
                                        background: 'rgba(14,165,233,0.06)',
                                        borderColor: 'var(--border-default)',
                                        color: 'var(--text-primary)',
                                    }}>
                                    <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                        <span className="font-medium">Bee Flow Support (AI)</span>
                                        {previewReply.modelTier && (
                                            <span className="px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                {tierLabel(previewReply.modelTier.replace(/^tier:/, '')) || previewReply.modelTier}
                                            </span>
                                        )}
                                        {previewReply.escalated && (
                                            <span className="px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(245,158,11,0.18)', color: '#b45309' }}>
                                                would escalate{previewReply.escalateReason ? `: ${previewReply.escalateReason}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    {/* Reuse the same Markdown renderer the chat surface uses */}
                                    <MarkdownRenderer content={previewReply.content || ''} />
                                    {Array.isArray(previewReply.citations) && previewReply.citations.length > 0 && (
                                        <div className="mt-2 pt-2 border-t text-xs"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                                            Cited: {previewReply.citations.map(c => c.title).filter(Boolean).join(' · ')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
