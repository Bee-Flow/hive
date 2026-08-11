import React, { useEffect, useState, useCallback, useRef, useId } from 'react';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../../../utils/agentAvatar';
import useTranslation from '../../../hooks/useTranslation';
import AgentWizard from '../AgentWizard';
import BuilderSplit from '../AgentWizard/BuilderSplit';
import { AgentEditorBootstrapProvider } from '../AgentWizard/AgentEditorBootstrapContext';

// Unified agent editor: agent list (left) + wizard-style split (right).
// Replaces the legacy AgentDesigner as the primary entry point. The legacy
// form is still reachable via "Advanced settings" for fields that aren't yet
// surfaced by the studio (guardrails, embedding, bubble widget, sharing).
export default function AgentStudio({ user, initialAgentId = null, onClose, onNavigate, hasPermission = () => true, systemMode = false, onEditingChange }) {
    const { t } = useTranslation();

    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedAgent, setSelectedAgent] = useState(null);
    // mode: 'idle' = no agent selected; show wizard landing.
    //       'edit' = editing selectedAgent in BuilderSplit.
    const [mode, setMode] = useState('idle');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const unsavedTitleId = useId();
    const deleteTitleId = useId();

    // Track in-flight list fetches so an unmount or rapid refetch can abort the
    // older request before its setState fires. React strict-mode double-invokes
    // effects in dev (mount → cleanup → mount); the setup re-arms the flag so
    // the second "mount" doesn't see a permanently-false ref left over by the
    // first cleanup — without this, every state setter inside fetchAgents was
    // skipped on the live mount and the loading spinner stuck forever.
    const listAbortRef = useRef(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (listAbortRef.current) {
                try { listAbortRef.current.abort(); } catch (_) { /* noop */ }
            }
        };
    }, []);

    const fetchAgents = useCallback(async () => {
        if (listAbortRef.current) {
            try { listAbortRef.current.abort(); } catch (_) { /* noop */ }
        }
        const ctrl = new AbortController();
        listAbortRef.current = ctrl;
        setLoading(true);
        setLoadError(null);
        try {
            const endpoint = systemMode ? `${API_BASE}/agents/system` : `${API_BASE}/agents/all`;
            const res = await authFetch(endpoint, { signal: ctrl.signal });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!mountedRef.current || ctrl.signal.aborted) return;
            setAgents(Array.isArray(data) ? data : []);
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error('Failed to load agents', e);
            if (mountedRef.current) {
                setLoadError(e.message || 'Failed to load');
                setAgents([]);
            }
        } finally {
            if (mountedRef.current && listAbortRef.current === ctrl) {
                setLoading(false);
            }
        }
    }, [systemMode]);

    useEffect(() => { fetchAgents(); }, [fetchAgents]);

    const isEditing = mode === 'edit' && !!selectedAgent;
    useEffect(() => {
        onEditingChange?.(isEditing);
        return () => { onEditingChange?.(false); };
    }, [isEditing, onEditingChange]);

    // Track whether the initial deep-link id has been resolved (matched against
    // the loaded agents list, or confirmed absent). The reflective URL effect
    // below is gated on this so a hard-refresh of /app/studio/agents/<id>
    // doesn't get clobbered to /app/studio/agents before the agent list arrives
    // and the auto-select effect runs.
    //
    // The flag is keyed on the *current* initialAgentId — if the parent passes
    // a new id (e.g. in-app nav from /studio/agents/A to /B), we re-bootstrap
    // instead of being stuck on A.
    const [bootstrappedFor, setBootstrappedFor] = useState(initialAgentId ? null : 'none');

    // Auto-select agent passed in via URL once agents have loaded.
    useEffect(() => {
        if (bootstrappedFor === initialAgentId || bootstrappedFor === 'none') return;
        if (agents.length === 0 && !loadError) return; // wait for load
        const found = initialAgentId ? agents.find(a => a.id === initialAgentId) : null;
        if (found) { setSelectedAgent(found); setMode('edit'); }
        else if (initialAgentId) {
            // Deep-link target no longer exists — drop to list view.
            setSelectedAgent(null);
            setMode('idle');
        }
        setBootstrappedFor(initialAgentId || 'none');
    }, [bootstrappedFor, initialAgentId, agents, loadError]);

    // Reflect the open agent in the URL so it's bookmarkable / visible to the user.
    useEffect(() => {
        if (!onNavigate) return;
        if (bootstrappedFor === null) return; // not yet bootstrapped
        if (mode === 'edit' && selectedAgent?.id) {
            onNavigate(`studio/agents/${selectedAgent.id}`);
        } else if (mode === 'idle') {
            onNavigate('studio/agents');
        }
    }, [bootstrappedFor, mode, selectedAgent?.id, onNavigate]);

    // Local-only draft: the agent isn't persisted until the user hits Save in
    // the editor. Until then it has no id, doesn't appear in the sidebar list,
    // and edits stay in memory.
    const createDraft = useCallback(() => {
        setSelectedAgent({
            id: null,
            name: t('agent_studio.untitled'),
            description: '',
            system_prompt: '',
            embed_enabled: 0,
            is_published: 0,
            shared_groups: [],
            config: {
                avatar: DEFAULT_AGENT_EMOJI,
                enabledIntegrations: [],
                knowledge_base_ids: [],
                attachedSkillIds: [],
                memoryEnabled: false,
            },
        });
        setMode('edit');
    }, [t]);

    // Track unsaved state from BuilderSplit so we can guard leave actions.
    const [isDirty, setIsDirty] = useState(false);
    const [pendingLeave, setPendingLeave] = useState(null); // null | { run: () => void }
    const guardLeave = useCallback((run) => {
        if (mode === 'edit' && selectedAgent && !selectedAgent.id && isDirty) {
            setPendingLeave({ run });
        } else {
            run();
        }
    }, [mode, selectedAgent, isDirty]);

    const selectAgent = useCallback((a) => guardLeave(() => { setSelectedAgent(a); setMode('edit'); setIsDirty(false); }), [guardLeave]);

    // Wizard "switch to manual" — must respect the unsaved-changes guard so a
    // dirty draft isn't silently replaced when the user clicks "Build it from
    // scratch" in the wizard while a previous draft is still unsaved.
    const switchToManualGuarded = useCallback(() => guardLeave(createDraft), [guardLeave, createDraft]);

    // BuilderSplit publish handler — memoized to avoid re-running BuilderSplit
    // effects that depend on this callback identity.
    const handlePublished = useCallback(async (updated) => {
        await fetchAgents();
        if (updated) setSelectedAgent(updated);
        setIsDirty(false);
    }, [fetchAgents]);

    const handleWizardPublished = useCallback(async (newAgent) => {
        await fetchAgents();
        if (newAgent?.id) { setSelectedAgent(newAgent); setMode('edit'); }
        else setMode('idle');
    }, [fetchAgents]);

    const handleBack = useCallback(() => guardLeave(() => { setSelectedAgent(null); setMode('idle'); setIsDirty(false); }), [guardLeave]);

    // Open the in-app confirmation modal. The actual delete happens in confirmDelete().
    const requestDelete = (a) => {
        if (!a?.id) return;
        setDeleteError(null);
        setPendingDelete(a);
    };

    const confirmDelete = async () => {
        const a = pendingDelete;
        if (!a?.id || deleting) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await authFetch(`${API_BASE}/agents/${a.id}`, { method: 'DELETE' });
            if (!res.ok) {
                // Guard res.text() — an HTML error page or a body-less response
                // would otherwise reject inside the throw, swallowing the real
                // status code.
                let detail = '';
                try { detail = await res.text(); } catch (_) { /* ignore */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            if (selectedAgent?.id === a.id) { setSelectedAgent(null); setMode('idle'); }
            // Close the modal first so the user sees the action complete; the
            // refresh runs in the background and any failure surfaces via the
            // load-error banner rather than blocking the modal.
            setPendingDelete(null);
            fetchAgents();
        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    // Escape closes the delete-confirm modal (when not in-flight).
    useEffect(() => {
        if (!pendingDelete) return undefined;
        const onKey = (e) => {
            if (deleting) return;
            if (e.key === 'Escape') { setPendingDelete(null); return; }
            // Power-user accelerator: Cmd/Ctrl + Enter triggers the destructive
            // action, matching the pattern used by browser print dialogs and
            // most modal-confirm UIs.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                confirmDelete();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [pendingDelete, deleting]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape closes the unsaved-changes modal.
    useEffect(() => {
        if (!pendingLeave) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setPendingLeave(null); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [pendingLeave]);

    return (
        <AgentEditorBootstrapProvider>
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Agent list sidebar — hidden in fullscreen edit mode */}
            {!isEditing && (
            <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] flex flex-col bg-[var(--bg-secondary)]">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{systemMode ? t('agent_studio.title_system') : t('agent_studio.title')}</span>
                    {!systemMode && hasPermission('manage_agents') && (
                        <button
                            onClick={() => guardLeave(createDraft)}
                            title={t('agent_studio.create_empty')}
                            className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {loading && (
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] p-3" role="status" aria-busy="true" aria-live="polite">
                            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                            <span className="sr-only">{t('agent_studio.loading', 'Loading agents')}</span>
                        </div>
                    )}
                    {!loading && loadError && (
                        <div className="text-xs text-red-500 p-3 flex flex-col gap-2" role="alert">
                            <span>{t('agent_studio.load_error', 'Failed to load agents')}: {loadError}</span>
                            <button
                                type="button"
                                onClick={fetchAgents}
                                className="self-start px-2 py-1 rounded-md text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-default)]"
                            >
                                {t('agent_studio.retry', 'Retry')}
                            </button>
                        </div>
                    )}
                    {!loading && !loadError && agents.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">{t('agent_studio.empty')}</div>
                    )}
                    {agents.map((a) => {
                        const sel = selectedAgent?.id === a.id;
                        const av = pickAgentAvatar(a) || DEFAULT_AGENT_EMOJI;
                        return (
                            <div
                                key={a.id}
                                onClick={() => selectAgent(a)}
                                aria-label={a.name}
                                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${sel ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                {isImageAvatar(av)
                                    ? <img src={resolveAvatarSrc(av)} alt="" aria-hidden="true" className="w-5 h-5 rounded-sm object-cover flex-shrink-0" />
                                    : <span className="text-base flex-shrink-0" aria-hidden="true">{av}</span>}
                                <span className="truncate flex-1">{a.name}</span>
                                {/* BFSF-271: server-computed can_edit drives the UI — no
                                    delete icon and a "View only" badge on agents the user
                                    may inspect but not modify. */}
                                {a.can_edit === false && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-tertiary)] whitespace-nowrap">
                                        {t('agent_studio.view_only', 'View only')}
                                    </span>
                                )}
                                {!systemMode && hasPermission('manage_agents') && a.can_edit !== false && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); requestDelete(a); }}
                                        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500"
                                        title={t('agent_studio.delete')}
                                        aria-label={`${t('agent_studio.delete', 'Delete')}: ${a.name}`}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>
            )}

            {/* Content */}
            <section className="flex-1 min-w-0 flex flex-col">
                {(mode === 'idle' || mode === 'wizard') && (
                    <AgentWizard
                        user={user}
                        onClose={onClose}
                        onSwitchToManual={switchToManualGuarded}
                        onPublished={handleWizardPublished}
                    />
                )}
                {mode === 'edit' && selectedAgent && (
                    <BuilderSplit
                        key={selectedAgent.id || 'draft'}
                        agent={selectedAgent}
                        readOnly={selectedAgent.can_edit === false}
                        user={user}
                        plan={null}
                        history={[]}
                        onBack={handleBack}
                        onDirtyChange={setIsDirty}
                        onPublished={handlePublished}
                        onDeleted={() => {
                            // Server has confirmed the agent is gone; deselect and drop
                            // back to the list so the URL doesn't keep reflecting a
                            // dead id (and so a hard-refresh doesn't re-fetch it).
                            setSelectedAgent(null);
                            setMode('idle');
                            fetchAgents();
                        }}
                    />
                )}
            </section>

            {pendingLeave && (
                <div
                    className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setPendingLeave(null)}
                    role="alertdialog"
                    aria-labelledby={unsavedTitleId}
                    aria-modal="true"
                >
                    <div
                        className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div id={unsavedTitleId} className="px-5 py-4 border-b border-[var(--border-default)] text-sm font-semibold text-[var(--text-primary)]">
                            {t('agent_studio.unsaved_title', 'Unsaved changes')}
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {t('agent_studio.unsaved_body', 'Your draft agent has not been saved yet. Leaving will discard these changes.')}
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => setPendingLeave(null)}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                            >
                                {t('agent_studio.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={() => { const run = pendingLeave.run; setPendingLeave(null); setIsDirty(false); run(); }}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 transition"
                            >
                                {t('agent_studio.discard', 'Discard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => { if (!deleting) setPendingDelete(null); }}
                    role="alertdialog"
                    aria-labelledby={deleteTitleId}
                    aria-modal="true"
                >
                    <div
                        className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-default)]">
                            <div id={deleteTitleId} className="text-sm font-semibold text-[var(--text-primary)]">{t('agent_studio.delete_title', 'Delete agent')}</div>
                            <button
                                onClick={() => { if (!deleting) setPendingDelete(null); }}
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                disabled={deleting}
                                aria-label={t('agent_studio.close', 'Close')}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {t('agent_studio.delete_confirm', { name: pendingDelete?.name || '' })}
                        </div>
                        {deleteError && (
                            <div className="px-5 pb-2 text-xs text-red-500" role="alert">{deleteError}</div>
                        )}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => { setDeleteError(null); setPendingDelete(null); }}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                            >
                                {t('agent_studio.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                {deleting && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                                <span>{deleting ? (t('agent_studio.deleting', 'Deleting…')) : (t('agent_studio.delete', 'Delete'))}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </AgentEditorBootstrapProvider>
    );
}
