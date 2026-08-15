/**
 * /app/cowork — everything you handed to Bee Flow, in one place.
 *
 * This page replaces two half-surfaces. The sidebar's "Work" page could create
 * items and pause them but never showed a run history or let you fix a
 * schedule the composer had inferred wrong; Studio → Cowork could do both but
 * sat three clicks away under a different word, and had no way to make
 * anything. Splitting "create" from "correct" across two screens is what made
 * the feature feel like several features.
 *
 * Left column: the composer, then the list. Right pane: the selected item with
 * its full history — or, when nothing is selected, the welcome that used to be
 * the whole page. Deep-linkable at /app/cowork/:id.
 */
import { CalendarClock, Plus, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useModelTierSelection from '../../hooks/useModelTierSelection';
import CoworkComposer from './CoworkComposer';
import CoworkDetail from './CoworkDetail';
import CoworkRow from './CoworkRow';
import { CoworkWelcomeHeader, COWORK_STARTERS } from './CoworkWelcome';
import {
    deleteCowork, listCowork, listCoworkAgents, runCoworkNow, toggleCowork, updateCowork,
} from './coworkApi';
import { isInFlight } from './coworkStatus';
import useCoworkComposer from './useCoworkComposer';

export default function CoworkPage({ user = null, isMobile = false, initialCoworkId = null, onNavigate }) {
    const [items, setItems] = useState([]);
    const [maxItems, setMaxItems] = useState(10);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [brief, setBrief] = useState('');
    const [busy, setBusy] = useState(false);
    const [selectedId, setSelectedId] = useState(initialCoworkId);
    const [editingId, setEditingId] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [flash, setFlash] = useState(null);
    // Bumped after any mutation so an open history refetches without a reload.
    const [reloadKey, setReloadKey] = useState(0);
    const [agents, setAgents] = useState([]);
    const textareaRef = useRef(null);

    const refresh = useCallback(async () => {
        try {
            const { items: list, maxItems: max } = await listCowork();
            setItems(list);
            setMaxItems(max);
            setLoadError(null);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Only the edit form's "Run as" picker needs these; an empty list simply
    // hides the field, which is the right outcome outside the agent beta.
    useEffect(() => {
        let cancelled = false;
        listCoworkAgents()
            .then(list => { if (!cancelled) setAgents(list); })
            .catch(() => { if (!cancelled) setAgents([]); });
        return () => { cancelled = true; };
    }, []);

    // A deep link wins on arrival; after that the user's clicks decide.
    useEffect(() => {
        if (initialCoworkId) setSelectedId(initialCoworkId);
    }, [initialCoworkId]);

    const cowork = useCoworkComposer({
        onCreated: (created, payload) => {
            setBrief('');
            setFlash(payload.startNow ? 'Off it goes — the result lands in your notifications.' : 'Scheduled.');
            // Select what was just created, so the history it is about to fill
            // is already on screen.
            if (created?.id) setSelectedId(created.id);
            refresh();
        },
    });

    useEffect(() => {
        if (!flash) return undefined;
        const t = setTimeout(() => setFlash(null), 4000);
        return () => clearTimeout(t);
    }, [flash]);

    // Cowork keeps its own remembered tier, separate from the chat's: a daily
    // digest and a conversation are different jobs and deserve different
    // budgets. Until this existed the page sent no tier at all, so everything
    // scheduled here silently ran on 'auto'.
    const { modelTiers, selectedTier, setSelectedTier } = useModelTierSelection({
        storageKey: 'coworkTier',
    });

    const atLimit = items.length >= maxItems;
    const send = () => {
        if (atLimit) return;
        cowork.submit(brief, { modelTier: selectedTier });
    };

    const { scheduled, finished } = useMemo(() => ({
        scheduled: items.filter(i => i.isActive || isInFlight(i)),
        finished: items.filter(i => !i.isActive && !isInFlight(i)),
    }), [items]);

    // Results arrive asynchronously (the runner reports into notifications),
    // so poll gently while something is mid-run rather than leaving the page
    // showing "Starting…" until the user reloads. Stops as soon as it settles.
    const anyInFlight = items.some(isInFlight);
    useEffect(() => {
        if (!anyInFlight) return undefined;
        const t = setInterval(refresh, 10_000);
        return () => clearInterval(t);
    }, [anyInFlight, refresh]);

    const selected = useMemo(
        () => items.find(i => i.id === selectedId) || null,
        [items, selectedId],
    );

    const select = useCallback((id) => {
        setSelectedId(id);
        // Switching rows abandons an open edit: carrying the form over to a
        // different item would save one item's text onto another.
        setEditingId(null);
        setActionError(null);
        if (onNavigate) onNavigate(`cowork/${id}`);
    }, [onNavigate]);

    const withBusy = useCallback(async (fn) => {
        setBusy(true);
        setActionError(null);
        try {
            await fn();
            await refresh();
            setReloadKey(k => k + 1);
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    }, [refresh]);

    const handleRunNow = useCallback((id) => withBusy(async () => {
        await runCoworkNow(id);
        setFlash('Running — the result lands in your notifications.');
    }), [withBusy]);

    const handleToggle = useCallback((id) => withBusy(() => toggleCowork(id)), [withBusy]);

    const handleDelete = useCallback(async () => {
        const item = pendingDelete;
        setPendingDelete(null);
        if (!item) return;
        await withBusy(async () => {
            await deleteCowork(item.id);
            setSelectedId(prev => (prev === item.id ? null : prev));
        });
    }, [pendingDelete, withBusy]);

    const handleSave = useCallback(async (patch) => {
        if (!selectedId) return;
        setBusy(true);
        setActionError(null);
        try {
            await updateCowork(selectedId, patch);
            // Leave edit mode only on success, so a rejected save keeps the
            // user's edits on screen instead of discarding them.
            setEditingId(null);
            await refresh();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    }, [selectedId, refresh]);

    // ── Composer ────────────────────────────────────────────
    // Lives in the wide right-hand pane, directly under the promise it answers
    // — not in the 320px list column, where the chips wrapped onto three rows
    // and the brief was two words per line.
    const composer = (
        <>
            <CoworkComposer
                value={brief}
                onChange={setBrief}
                onSubmit={send}
                cowork={cowork}
                modelTiers={modelTiers}
                selectedTier={selectedTier}
                onTierChange={setSelectedTier}
                simpleMode={!!user?.simpleMode || isMobile}
                isMobile={isMobile}
                // Under a full-height hero a single-line box reads as an
                // afterthought; in the chat the same component starts at one
                // row and grows. Two, not three — a brief is usually a
                // sentence, and an empty box the size of a paragraph reads as
                // a demand for one.
                minRows={2}
                textareaRef={textareaRef}
            />

            {/* Page-level status: the load error, the "off it goes" flash and
                the quota ceiling. The composer shows its own create errors.
                This is also the only place the quota is spelled out — a
                permanent "4/10 in use" under the box was noise nine times out
                of ten, and the tenth time it needs to be a warning anyway. */}
            {(flash || loadError || atLimit) && (
                <div
                    className="mt-3 rounded-xl px-3 py-2 text-[12px]"
                    role="status"
                    style={{
                        background: 'var(--bg-secondary)',
                        color: loadError ? 'var(--danger, #dc2626)' : 'var(--text-secondary)',
                    }}
                >
                    {loadError || flash
                        || `You've used all ${maxItems} cowork slots. Delete or finish one to add more.`}
                </div>
            )}
        </>
    );

    // ── List ────────────────────────────────────────────────
    const section = (label, list, dim = false) => list.length > 0 && (
        <section className="mt-3">
            <h2
                className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1"
                style={{ color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
            >
                {label}
            </h2>
            <div className={`flex flex-col gap-1 ${dim ? 'opacity-90' : ''}`}>
                {list.map(item => (
                    <CoworkRow
                        key={item.id}
                        item={item}
                        selected={item.id === selectedId}
                        onSelect={select}
                    />
                ))}
            </div>
        </section>
    );

    // Phones get one pane at a time: the composer and the list stacked in a
    // single scroll, or — once a row is tapped — the detail on its own. The
    // desktop split would put a 320px column next to a 40px one.
    const showList = !isMobile || !selected;
    const showPane = !isMobile || !!selected;

    return (
        <div className="flex-1 flex min-h-0 min-w-0" style={{ background: 'var(--bg-primary)' }}>
            {showList && (
            <aside
                className={`${isMobile ? 'flex-1' : 'w-80 flex-shrink-0 border-r'} flex flex-col min-h-0`}
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Cowork</span>
                    <div className="flex items-center gap-1">
                        {/* Clearing the selection is what brings the composer
                            back — it lives in the pane on the right. */}
                        <button
                            type="button"
                            onClick={() => { setSelectedId(null); setEditingId(null); textareaRef.current?.focus(); }}
                            disabled={busy}
                            aria-label="New cowork"
                            title="New cowork"
                            data-testid="cowork-new"
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={loading || busy}
                            aria-label="Refresh"
                            data-testid="cowork-refresh"
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3 pt-1">
                    {/* On a phone there is no second pane to put the composer
                        in, so it rides above the list instead. */}
                    {isMobile && (
                        <div className="px-1 pt-2 pb-1">
                            <CoworkWelcomeHeader className="text-center mb-4" />
                            {composer}
                        </div>
                    )}
                    {loading && items.length === 0 && (
                        <p className="px-2 pt-3 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
                    )}
                    {!loading && items.length === 0 && (
                        <p
                            className="px-2 pt-4 text-[12px] leading-relaxed"
                            style={{ color: 'var(--text-tertiary)' }}
                            data-testid="cowork-empty"
                        >
                            Nothing here yet. Describe something above — or switch a chat to
                            {' '}<strong>Cowork</strong> — and it shows up in this list.
                        </p>
                    )}
                    {section('Running & scheduled', scheduled)}
                    {section('Done & paused', finished, true)}
                </div>
            </aside>
            )}

            {showPane && (
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    {actionError && editingId === null && (
                        <p className="m-4 text-[12px] text-red-600 dark:text-red-400" role="alert">{actionError}</p>
                    )}
                    {selected ? (
                        <CoworkDetail
                            item={selected}
                            agents={agents}
                            onRunNow={handleRunNow}
                            onToggle={handleToggle}
                            onDelete={setPendingDelete}
                            onSave={handleSave}
                            editing={editingId === selected.id}
                            onEdit={() => { setActionError(null); setEditingId(selected.id); }}
                            onCancelEdit={() => { setActionError(null); setEditingId(null); }}
                            saveError={actionError}
                            busy={busy}
                            reloadKey={reloadKey}
                        />
                    ) : (
                        <div className="h-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-6 py-10">
                            <div className="w-full max-w-2xl">
                                <CoworkWelcomeHeader />
                                {composer}

                                {/* Starters only while there is nothing real to
                                    look at — otherwise they compete with the
                                    user's own work for attention. */}
                                {items.length === 0 ? (
                                    <div className="mt-5 flex flex-col gap-2">
                                        {COWORK_STARTERS.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setBrief(s); textareaRef.current?.focus(); }}
                                                data-testid="cowork-starter"
                                                className="text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] transition-colors hover:bg-[var(--bg-secondary)]"
                                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-6 text-[13px] flex items-center gap-2 justify-center" style={{ color: 'var(--text-tertiary)' }}>
                                        <CalendarClock className="w-4 h-4 flex-shrink-0" />
                                        Or pick something on the left to see when it runs and how every run went.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Delete confirm ──────────────────────────────────── */}
            {pendingDelete && (
                <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={() => setPendingDelete(null)}>
                    <div
                        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Delete this cowork?</div>
                        <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-secondary)' }}>
                            &ldquo;{pendingDelete.title}&rdquo; stops running and its history is removed. This can&rsquo;t be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setPendingDelete(null)}
                                className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                data-testid="cowork-confirm-delete"
                                className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-white bg-red-500 hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phones: a selected item takes the whole screen, so it needs a way back. */}
            {isMobile && selected && (
                <button
                    type="button"
                    onClick={() => { setSelectedId(null); setEditingId(null); }}
                    aria-label="Back to the list"
                    className="fixed top-3 right-3 z-[900] p-2 rounded-full border shadow-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
