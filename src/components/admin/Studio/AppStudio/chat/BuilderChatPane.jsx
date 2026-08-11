import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronDown, ChevronRight, History, RotateCcw, Send, Sparkles, Square, Undo2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { diffDefinitions } from './draftDiff';
import PlanCard from './PlanCard';
import QuickActions from './QuickActions';
import useAppBuilderStream from '../../../../../hooks/useAppBuilderStream';
import useModelTierSelection from '../../../../../hooks/useModelTierSelection';
import ModelTierSelector from '../../../../ModelTierSelector';
import toast from '../../../../shared/Toast';
import MessageBubble from '../../../AITasksDesigner/Builder/chat/MessageBubble';
import { useEditorChrome } from '../editor/EditorChromeContext';
import { useAppEditor } from '../state/AppEditorContext';
import { findNode, findScreen } from '../state/definitionOps';

/**
 * The table a node is bound to, if any — from a record/records source binding
 * or a relation input's tableId. Used to ground an AI turn on the selection.
 */
function boundTableIdFor(definition, nodeId) {
    if (!definition || !nodeId) return null;
    const found = findNode(definition, nodeId);
    const props = found?.node?.props;
    if (!props) return null;
    const src = props.source;
    if (src && typeof src === 'object' && (src.kind === 'records' || src.kind === 'record') && src.tableId) {
        return src.tableId;
    }
    return typeof props.tableId === 'string' ? props.tableId : null;
}

/**
 * App Studio — the AI builder chat pane (the editor shell's left `chatSlot`).
 *
 * Owns the conversational side of an AI turn and wires it into the editor's
 * single-authority data flow:
 *   - send        → set_stream_lock(true); the canvas goes read-only and the
 *                   shell pauses autosave + hotkeys for the whole turn.
 *   - draft (SSE) → transient set_definition (NO history commit), pulse the
 *                   just-added nodes via set_recent_ids, and follow the AI to
 *                   another screen when additions landed only there.
 *   - done        → exactly ONE history commit for the whole turn
 *                   (chrome.commitTurn), then markSaved — the builder route
 *                   already persisted every draft, so autosave must not
 *                   re-save — then unlock.
 *   - error       → unlock but keep the last draft (it is persisted
 *                   server-side); toast + a chat error item.
 */

// Product-language labels for builder tool calls. The server also sends a
// `label` per tool_call; this map wins so the wording stays product-owned.
// Keys MUST match the real tool names in server/appStudio/builderTools/schemas.js.
const TOOL_LABELS = {
    app_add_components: 'Added components',
    app_update_component: 'Updated component',
    app_remove_node: 'Removed component',
    app_move_node: 'Rearranged the layout',
    app_add_screen: 'Added screen',
    app_update_screen: 'Updated screen',
    app_remove_screen: 'Removed screen',
    app_add_section: 'Added section',
    app_set_theme: 'Updated theme',
    app_set_meta: 'Updated app details',
    app_set_action: 'Configured action',
    app_remove_action: 'Removed action',
    app_bind_action: 'Wired action',
    app_list_automations: 'Looked up routines',
    app_inspect_automation: 'Inspected routine',
    app_upsert_table: 'Created table',
    app_remove_table: 'Removed table',
    app_set_roles: 'Set up roles',
    app_seed_records: 'Added sample data',
    app_upsert_dataset: 'Created dataset',
    app_get_data_model: 'Read the data model',
    app_query_data: 'Checked the data',
    app_finalize: 'Checked the app',
    app_get_draft: 'Reviewed the app',
};

// React-query cache families that render the app's DATA side. When the AI
// mutates tables/rows/roles/datasets mid-stream (`data_model` SSE event),
// every family is invalidated so the canvas, TablesManager, QueryBuilder and
// RolesManager reflect the AI's work live. Keys must match:
//   bi/useAppTables.js         → ['studio-app-tables', appId]
//   bi/useDatasets.js          → ['studio-app-datasets', appId]
//   rbac/useAppRoles.js        → ['studio-app-schema', appId] + ['studio-app-members', appId]
//   runtime/useAppDataSource.js / AppDataScope → ['studio-app-data', appId]
const DATA_QUERY_KEY_FAMILIES = (appId) => [
    ['studio-app-tables', appId],
    ['studio-app-datasets', appId],
    ['studio-app-schema', appId],
    ['studio-app-members', appId],
    ['studio-app-data', appId],
];

function toolLabel(item) {
    if (TOOL_LABELS[item.name]) return TOOL_LABELS[item.name];
    if (item.label) return item.label;
    const raw = String(item.name || 'Tool').replace(/^app_/, '').replace(/_/g, ' ');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Wave 6c: map the builder route's SSE error-taxonomy `code` to product copy
// and a retry affordance. `canRetry` gates a "Try again" button on the error
// item (only for the codes where re-sending the same turn can plausibly work).
// Unknown/absent codes fall back to the raw server/drop message (existing
// behaviour) so nothing regresses.
const ERROR_COPY = {
    subscription_limit: { message: "You've reached your plan's AI limit. Upgrade your plan to keep building with AI.", canRetry: false },
    rate_limited: { message: "You're sending build requests too quickly. Wait a moment, then try again.", canRetry: true },
    model_unavailable: { message: 'The AI model is unavailable right now. Try again shortly, or pick a different model tier.', canRetry: true },
    transient_upstream: { message: 'The AI provider had a brief hiccup. Your progress is saved — try again in a moment.', canRetry: true },
    budget_exhausted: { message: "I ran out of build turns for this request, but your progress is saved. Send another message and I'll keep going.", canRetry: true },
    validation_failed: { message: "The app had validation errors the AI couldn't clear. Review the issues below and try again.", canRetry: false },
    save_conflict: { message: 'The app changed in another tab while the AI was building. Reopen it and try again.', canRetry: false },
    internal: { message: 'The AI builder ran into an unexpected problem. Your progress is saved.', canRetry: false },
};

/** Friendly copy + retry flag for a builder error `code`; falls back to `raw`. */
function friendlyBuilderError(code, raw) {
    const c = code && ERROR_COPY[code];
    if (c) return c;
    return { message: raw || 'The AI builder ran into a problem.', canRetry: false };
}

export default function BuilderChatPane({ appId, initialPrompt = '' }) {
    const { definition, screenId, selectedNodeId, selectedNodeIds, streamLock, dispatch } = useAppEditor();
    const chrome = useEditorChrome();
    const queryClient = useQueryClient();

    // Same tier machinery as the automations builder (shared hook + selector);
    // the choice persists per user and rides every turn incl. plan approvals.
    // taskType must NOT be 'direct_chat' — that list carries the chat-only
    // tiers (Flow, Swarm), which this builder can't run. 'automation' is the
    // builder task type: same non-chat filter, and it keeps the org's custom
    // tiers (they can only opt into the chat task types, so any other value
    // would strip them from the picker entirely).
    const { modelTiers, selectedTier, setSelectedTier } = useModelTierSelection({ storageKey: 'appBuilderTier', taskType: 'automation' });

    // Refs for the stream callbacks — SSE events fire between renders.
    const definitionRef = useRef(definition);
    const screenIdRef = useRef(screenId);
    const chromeRef = useRef(chrome);
    useEffect(() => {
        definitionRef.current = definition;
        screenIdRef.current = screenId;
        chromeRef.current = chrome;
    });

    const preTurnDefRef = useRef(null);  // baseline every draft diffs against
    const lastDraftRef = useRef(null);   // { definition, version } of the newest draft
    const lastTurnRef = useRef(null);    // { text, extraContext, sendOptions } for retry-after-error

    // The "What changed" summary for the just-finished turn: the diff between
    // the pre-turn baseline and the final draft, plus that final draft so a
    // clicked node can be resolved to its screen. Cleared when a new turn starts.
    const [lastChange, setLastChange] = useState(null);
    const [changeOpen, setChangeOpen] = useState(false);

    const handleDraft = useCallback((def, version) => {
        if (!def) return;
        lastDraftRef.current = { definition: def, version };
        const baseline = preTurnDefRef.current || definitionRef.current;

        // Transient apply — history records the whole turn once, on done.
        dispatch({ type: 'set_definition', definition: def });

        const diff = diffDefinitions(baseline, def);
        if (diff.addedIds.size) {
            dispatch({ type: 'set_recent_ids', ids: diff.addedIds });
        }
        // Follow the AI when its additions landed only on a screen the user
        // isn't looking at (a brand-new screen, or edits elsewhere).
        const active = screenIdRef.current;
        if (diff.addedOnScreens.size && active && !diff.addedOnScreens.has(active)) {
            const target = diff.addedOnScreens.values().next().value;
            const name = (def.screens || []).find((s) => s.id === target)?.name;
            dispatch({ type: 'set_screen', screenId: target });
            // The ref effect only refreshes after the next render; keep
            // back-to-back drafts in the same chunk from re-jumping.
            screenIdRef.current = target;
            toast.info(`AI edited the ${name || 'other'} screen`);
        }
    }, [dispatch]);

    const handleDone = useCallback((info = {}) => {
        const last = lastDraftRef.current;
        const baseline = preTurnDefRef.current;
        lastDraftRef.current = null;
        preTurnDefRef.current = null;
        // A plan proposal: the PlanCard takes over, so no history entry (there
        // is nothing to undo yet). A research pass may still have persisted a
        // draft though — adopt its version, or the next autosave sends a stale
        // baseVersion and the user hits a save conflict.
        if (info.awaitingPlan) {
            if (last) {
                chromeRef.current?.markSaved?.(last.definition, last.version);
                if (last.version != null) dispatch({ type: 'set_version', version: last.version });
            }
            dispatch({ type: 'set_stream_lock', streamLock: false });
            return;
        }
        if (last) {
            // ONE history entry for the whole AI turn (Cmd+Z undoes it all)…
            chromeRef.current?.commitTurn?.(last.definition);
            // …and the server already persisted every draft: adopt, don't re-save.
            chromeRef.current?.markSaved?.(last.definition, last.version);
            if (last.version != null) dispatch({ type: 'set_version', version: last.version });
            // Post-turn "What changed" summary — diff the pre-turn baseline
            // against the final draft (the same diff the per-draft pulse uses).
            const diff = diffDefinitions(baseline, last.definition);
            if (diff.addedIds.size || diff.changedIds.size) {
                setLastChange({ diff, finalDef: last.definition });
                setChangeOpen(false);
            }
        }
        dispatch({ type: 'set_stream_lock', streamLock: false });
    }, [dispatch]);

    const handleError = useCallback((message, code) => {
        const last = lastDraftRef.current;
        lastDraftRef.current = null;
        preTurnDefRef.current = null;
        if (last) {
            // A failed turn still applied a draft to the canvas — record it as
            // ONE history entry (exactly like a successful turn) so the first
            // Cmd+Z lands on the pre-turn state instead of jumping past it.
            // commitTurn also clears the shell's pre-turn snapshot.
            chromeRef.current?.commitTurn?.(last.definition);
            // Keep the last draft on the canvas — it is persisted server-side,
            // so make sure autosave doesn't write it again.
            chromeRef.current?.markSaved?.(last.definition, last.version);
            if (last.version != null) dispatch({ type: 'set_version', version: last.version });
        }
        dispatch({ type: 'set_stream_lock', streamLock: false });
        // The transcript's ErrorItem shows the friendly copy + retry; the toast
        // is the transient fallback — prefer the code's copy, else the raw text.
        toast.error(friendlyBuilderError(code, message).message);
    }, [dispatch]);

    // The AI created/changed tables, rows, roles or datasets — refresh every
    // cache family that renders them so the editor reflects it immediately.
    const handleDataModel = useCallback(() => {
        for (const queryKey of DATA_QUERY_KEY_FAMILIES(appId)) {
            queryClient.invalidateQueries({ queryKey });
        }
    }, [queryClient, appId]);

    const {
        messages, running, send, stop, lastValidation, pendingPlan, phases, checkpoints, continuation,
    } = useAppBuilderStream({
        appId,
        onDraft: handleDraft,
        onDone: handleDone,
        onError: handleError,
        onDataModel: handleDataModel,
    });

    // ---- composer ------------------------------------------------------------
    // initialPrompt (e.g. a "Remix with AI" prefill) seeds the composer once so
    // the user can tweak and send, rather than firing a turn unprompted.
    const [input, setInput] = useState(initialPrompt || '');
    // A turn is being prepared (the pre-turn flush is still saving). The canvas
    // isn't locked yet, so this is what keeps the UI closed until it is.
    const [starting, setStarting] = useState(false);
    const busy = running || streamLock || starting;

    // Refs so startTurn reads the LIVE selection without re-binding every chip.
    const selectionRef = useRef({ selectedNodeId, selectedNodeIds });
    useEffect(() => { selectionRef.current = { selectedNodeId, selectedNodeIds }; });

    // The editor's current focus (selection / screen / bound table), merged
    // with any `extraContext` override (e.g. a per-issue Fix targeting a node).
    const buildContext = useCallback((extraContext) => {
        const def = definitionRef.current;
        const { selectedNodeId: anchor, selectedNodeIds: ids } = selectionRef.current;
        const idList = ids instanceof Set ? [...ids] : [];
        return {
            screenId: screenIdRef.current,
            selectedNodeIds: idList,
            boundTableId: boundTableIdFor(def, anchor || idList[idList.length - 1] || null),
            ...(extraContext && typeof extraContext === 'object' ? extraContext : {}),
        };
    }, []);

    // Persist any pending local edit BEFORE the AI reads the app, then lock and
    // fire `run`. The builder reads the definition from the DB, and locking
    // pauses autosave, so an unsaved edit would be invisible to the AI and then
    // overwritten by the turn's markSaved. The lock therefore lands only AFTER
    // flush() resolves — locking first would strand the in-flight edit; until
    // then `starting` stands in for it so no second turn can begin.
    const lockAndRun = useCallback((run) => {
        preTurnDefRef.current = definitionRef.current;
        setLastChange(null);
        setStarting(true);
        const go = () => {
            dispatch({ type: 'set_stream_lock', streamLock: true });
            setStarting(false);
            run();
        };
        Promise.resolve(chromeRef.current?.flush?.()).then(go, go);
    }, [dispatch]);

    /**
     * Start one AI turn with `text`, threading editor focus as context.
     * `sendOptions` passes stream options through (e.g. quick actions force
     * `planMode:'never'`). Goes through the SAME streamLock/flush/commitTurn
     * flow as a typed message.
     */
    const startTurn = useCallback((text, extraContext, sendOptions) => {
        const message = typeof text === 'string' ? text.trim() : '';
        if (!message || busy) return;
        // Remember the turn so a retryable error (Wave 6c) can re-run it verbatim.
        lastTurnRef.current = { text: message, extraContext, sendOptions };
        const context = buildContext(extraContext);
        lockAndRun(() => send(message, { modelTier: selectedTier || 'auto', context, ...(sendOptions || {}) }));
    }, [busy, send, buildContext, lockAndRun, selectedTier]);

    // "Try again" on a retryable error item: re-run the last turn verbatim.
    const retryLastTurn = useCallback(() => {
        const lt = lastTurnRef.current;
        if (!lt || busy) return;
        startTurn(lt.text, lt.extraContext, lt.sendOptions);
    }, [busy, startTurn]);

    /**
     * Approve the (possibly edited) plan from the PlanCard — the AI builds the
     * artifact the user confirmed. Same lock/flush/commit flow as a turn.
     */
    const approvePlan = useCallback((editedPlan) => {
        if (busy || !pendingPlan) return;
        const context = buildContext();
        lockAndRun(() => send({
            plan: { planId: pendingPlan.planId, action: 'approve', plan: editedPlan },
            modelTier: selectedTier || 'auto',
            context,
        }));
    }, [busy, pendingPlan, send, buildContext, lockAndRun, selectedTier]);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || busy) return;
        setInput('');
        startTurn(text);
    }, [input, busy, startTurn]);

    // "Discuss" on the plan card just moves the user to the composer to talk it
    // over before building — the card stays put.
    const composerRef = useRef(null);
    const focusComposer = useCallback(() => {
        composerRef.current?.focus?.();
    }, []);

    // "What changed" click-to-select: jump to a node the turn touched. Resolve
    // its screen from the final draft so the canvas follows.
    const selectChangedNode = useCallback((nodeId) => {
        const def = lastChange?.finalDef;
        if (!def || !nodeId) return;
        const found = findNode(def, nodeId);
        if (found) {
            if (found.screen?.id) dispatch({ type: 'set_screen', screenId: found.screen.id });
            dispatch({ type: 'select_node', nodeId });
        } else if (findScreen(def, nodeId)) {
            // The id is a screen itself (a brand-new screen) — just go there.
            dispatch({ type: 'set_screen', screenId: nodeId });
        }
    }, [lastChange, dispatch]);

    // "Undo turn" is good for exactly one click: the turn's single history
    // entry. Once it is undone the summary describes state that no longer
    // exists, and a second undo would swallow the user's OWN previous edit —
    // so the summary (and with it the button) goes away.
    const undoTurn = useCallback(() => {
        chromeRef.current?.undoTurn?.();
        setLastChange(null);
    }, []);

    // "Revert to checkpoint": the version-history modal lives in EditorHeader
    // and isn't reachable from the chat pane, so point the user at it. (Noted
    // as a leftover — a chrome.openVersions handle would let us open it here.)
    const revertToCheckpoint = useCallback(() => {
        toast.info('Open “Version history” in the editor header to restore a checkpoint.');
    }, []);

    const onComposerKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // Keep the newest message in view.
    const listRef = useRef(null);
    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, running]);

    const showEmptyState = messages.length === 0 && !running && !pendingPlan;
    const last = messages[messages.length - 1];
    const showThinkingPlaceholder = running && !continuation && !(last && last.role === 'assistant'
        && ((last.content && last.content.length) || (last.thinkingParts && last.thinkingParts.length)));
    const currentPhase = phases.length ? phases[phases.length - 1] : null;

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div
                className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
                style={{ borderColor: 'var(--border-default)' }}
            >
                <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{
                        background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                        color: 'var(--accent-primary)',
                    }}
                >
                    <Sparkles size={14} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    AI builder
                </span>
            </div>

            {/* Messages */}
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
                {showEmptyState ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <span
                            className="flex h-10 w-10 items-center justify-center rounded-full"
                            style={{
                                background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                                color: 'var(--accent-primary)',
                            }}
                        >
                            <Sparkles size={18} aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            Build with AI
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                            {"Describe the app you want — I'll build it on the canvas"}
                        </p>
                    </div>
                ) : (
                    <div className="flex w-full flex-col gap-3">
                        {messages.map((item, i) => {
                            if (item?.kind === 'tool') return <ToolChip key={i} item={item} />;
                            if (item?.kind === 'error') {
                                // Only the newest error item gets the retry button —
                                // retrying re-runs the LAST turn, so an old item
                                // offering it would be misleading.
                                const isLatest = i === messages.length - 1;
                                return (
                                    <ErrorItem
                                        key={i}
                                        message={item.message}
                                        code={item.code}
                                        onRetry={isLatest ? retryLastTurn : null}
                                        disabled={busy}
                                    />
                                );
                            }
                            return <MessageBubble key={i} msg={item} />;
                        })}

                        {/* The AI proposed an editable plan — approve or discuss it. */}
                        {pendingPlan ? (
                            <PlanCard
                                pendingPlan={pendingPlan}
                                onBuild={approvePlan}
                                onDiscuss={focusComposer}
                                disabled={busy}
                            />
                        ) : null}

                        {/* Phased-build progress. */}
                        {running && currentPhase ? (
                            <div className="self-start px-1 text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                                {`Building — phase ${currentPhase.index}${currentPhase.total ? `/${currentPhase.total}` : ''}${currentPhase.label ? `: ${currentPhase.label}` : ''}`}
                            </div>
                        ) : null}

                        {/* Auto-continuation after a mid-plan budget exhaustion. */}
                        {continuation ? (
                            <div className="self-start px-1 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                                {`Continuing${continuation.phase ? ` (phase ${continuation.phase}${continuation.total ? `/${continuation.total}` : ''})` : ''}…`}
                            </div>
                        ) : null}

                        {/* Post-turn "What changed" summary. */}
                        {lastChange && !running ? (
                            <WhatChanged
                                change={lastChange}
                                open={changeOpen}
                                onToggle={() => setChangeOpen((o) => !o)}
                                onSelect={selectChangedNode}
                                onUndo={chrome?.undoTurn ? undoTurn : null}
                                onRevert={checkpoints.length ? revertToCheckpoint : null}
                            />
                        ) : null}

                        {showThinkingPlaceholder && (
                            <div className="self-start px-1 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                                Thinking…
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ValidationNotice
                validation={lastValidation}
                running={running}
                onFix={(message, nodeId) => startTurn(`Fix: ${message}`, nodeId ? { nodeId } : undefined)}
                disabled={busy}
            />

            <QuickActions
                onAction={(prompt, opts) => startTurn(prompt, undefined, opts)}
                disabled={busy}
                hasErrors={Array.isArray(lastValidation?.errors) && lastValidation.errors.length > 0}
            />

            {/* Composer */}
            <form
                className="shrink-0 border-t p-2"
                style={{ borderColor: 'var(--border-default)' }}
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
                <div
                    className="flex items-end gap-1.5 rounded-lg border px-2 py-1.5"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}
                >
                    <textarea
                        ref={composerRef}
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        disabled={busy}
                        data-app-ai-composer=""
                        placeholder={busy ? 'The AI is building…' : 'Describe a change…'}
                        aria-label="Message the AI builder"
                        className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-60"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    {/* While a build runs every other control is disabled, so
                        Stop takes the Send slot — otherwise there is no way
                        out of a turn that is going the wrong way. */}
                    {busy ? (
                        <button
                            type="button"
                            onClick={stop}
                            aria-label="Stop"
                            title="Stop building"
                            className="rounded-md p-1.5 transition-opacity"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            <Square size={14} fill="currentColor" aria-hidden="true" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            aria-label="Send"
                            title="Send (Enter)"
                            className="rounded-md p-1.5 transition-opacity disabled:opacity-40"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            <Send size={16} aria-hidden="true" />
                        </button>
                    )}
                </div>
                {Object.keys(modelTiers || {}).length > 0 && (
                    <div className="mt-1.5 flex items-center">
                        {/* portal: the composer sits at the pane's left edge, so an
                            absolute right-aligned panel would run off-screen. */}
                        <ModelTierSelector
                            tiers={modelTiers}
                            value={selectedTier}
                            onChange={setSelectedTier}
                            variant="input"
                            portal
                        />
                    </div>
                )}
            </form>
        </div>
    );
}

/** One builder tool call, in product language ("Added components · 2 buttons"). */
function ToolChip({ item }) {
    const ok = item.ok !== false;
    return (
        <div
            className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
            style={{
                borderColor: ok ? 'var(--border-default)' : 'rgba(245, 158, 11, 0.45)',
                background: 'var(--bg-secondary)',
            }}
        >
            {ok
                ? <Check size={13} className="shrink-0" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                : <AlertTriangle size={13} className="shrink-0 text-amber-500" aria-hidden="true" />}
            <span className="shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>
                {toolLabel(item)}
            </span>
            {item.summary ? (
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-tertiary)' }} title={item.summary}>
                    {item.summary}
                </span>
            ) : null}
        </div>
    );
}

/**
 * A failed turn — the toast is transient, this stays in the transcript. Maps
 * the server's error-taxonomy `code` (Wave 6c) to friendly copy and, for the
 * retryable codes, a "Try again" button that re-runs the last turn.
 */
function ErrorItem({ message, code, onRetry, disabled = false }) {
    const { message: friendly, canRetry } = friendlyBuilderError(code, message);
    const showRetry = canRetry && typeof onRetry === 'function';
    return (
        <div
            className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed"
            role="alert"
            style={{
                borderColor: 'rgba(239, 68, 68, 0.35)',
                background: 'color-mix(in srgb, var(--error) 8%, transparent)',
                color: 'var(--text-secondary)',
            }}
        >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--error)' }} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span>{friendly}</span>
                {showRetry ? (
                    <button
                        type="button"
                        onClick={() => onRetry()}
                        disabled={disabled}
                        className="inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                        style={{ borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)', color: 'var(--text-secondary)' }}
                    >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        Try again
                    </button>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Collapsible post-turn summary of what the AI touched: added/changed node
 * ids (click to jump to them), an "Undo turn" affordance (the shell's single
 * history.undo, exposed as chrome.undoTurn), and "Revert to checkpoint".
 */
function WhatChanged({ change, open, onToggle, onSelect, onUndo, onRevert }) {
    const { diff, finalDef } = change;
    const added = [...(diff.addedIds || [])];
    const changed = [...(diff.changedIds || [])].filter((id) => !diff.addedIds?.has(id));
    const total = added.length + changed.length;
    if (!total) return null;

    const rows = [
        ...added.map((id) => ({ id, kind: 'added' })),
        ...changed.map((id) => ({ id, kind: 'changed' })),
    ].slice(0, 12);
    const Chevron = open ? ChevronDown : ChevronRight;

    return (
        <div
            className="flex w-full flex-col rounded-lg border text-xs"
            data-what-changed=""
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-left font-medium"
                style={{ color: 'var(--text-secondary)' }}
            >
                <Chevron size={13} className="shrink-0" aria-hidden="true" />
                What changed
                <span style={{ color: 'var(--text-tertiary)' }}>
                    {`· ${total} ${total === 1 ? 'update' : 'updates'}`}
                </span>
            </button>

            {open ? (
                <div className="flex flex-col gap-1.5 border-t px-2.5 py-2" style={{ borderColor: 'var(--border-default)' }}>
                    <ul className="flex flex-col gap-0.5">
                        {rows.map((row) => {
                            const type = findNode(finalDef, row.id)?.node?.type;
                            return (
                                <li key={`${row.kind}:${row.id}`}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(row.id)}
                                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <span
                                            className="shrink-0 rounded px-1 text-[10px] font-medium"
                                            style={{
                                                background: row.kind === 'added'
                                                    ? 'color-mix(in srgb, var(--accent-primary) 18%, transparent)'
                                                    : 'rgba(148, 163, 184, 0.18)',
                                                color: row.kind === 'added' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                            }}
                                        >
                                            {row.kind === 'added' ? 'new' : 'edit'}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{type || row.id}</span>
                                    </button>
                                </li>
                            );
                        })}
                        {total > rows.length ? (
                            <li className="px-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {`+${total - rows.length} more`}
                            </li>
                        ) : null}
                    </ul>
                    <div className="flex items-center gap-2 pt-0.5">
                        {onUndo ? (
                            <button
                                type="button"
                                onClick={() => onUndo()}
                                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                <Undo2 className="h-3 w-3" aria-hidden="true" />
                                Undo turn
                            </button>
                        ) : null}
                        {onRevert ? (
                            <button
                                type="button"
                                onClick={() => onRevert()}
                                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                <History className="h-3 w-3" aria-hidden="true" />
                                Revert to checkpoint
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/**
 * What a validation record says to a person, and what it says to a developer.
 * The record's `hint` is the plain-English line ("Pick one the app owner has.")
 * while `message` is validator wording ('A filter value must be a literal…') —
 * so `hint` leads and `message` becomes the technical detail behind a
 * disclosure. A bare `code` is never a headline; it means nothing to the reader.
 */
function issueLines(rec) {
    if (typeof rec === 'string') return { text: rec, detail: '' };
    const hint = typeof rec?.hint === 'string' ? rec.hint : '';
    const message = typeof rec?.message === 'string' ? rec.message : '';
    if (hint) return { text: hint, detail: message };
    if (message) return { text: message, detail: '' };
    return { text: 'Something here needs attention', detail: typeof rec?.code === 'string' ? rec.code : '' };
}
function issueNodeId(rec) {
    if (!rec || typeof rec !== 'string') {
        return (rec && typeof rec.nodeId === 'string') ? rec.nodeId : null;
    }
    return null;
}

/**
 * Compact amber list of the latest validation records. While the stream is
 * running the AI is actively repairing them, so lead with that; otherwise each
 * issue gets a per-issue "Fix" button that asks the AI to repair just that one
 * (scoped to its node when the record carries a nodeId).
 */
function ValidationNotice({ validation, running, onFix, disabled = false }) {
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];
    if (!errors.length && !warnings.length) return null;

    const shown = [...errors, ...warnings].slice(0, 4);
    const n = errors.length;
    const noun = n === 1 ? 'issue' : 'issues';

    return (
        <div className="shrink-0 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {n > 0 && (
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {running ? `The AI is fixing ${n} ${noun}…` : `${n} ${noun} to review`}
                </div>
            )}
            <ul className="mt-1 flex flex-col gap-0.5">
                {shown.map((rec, i) => {
                    const { text, detail } = issueLines(rec);
                    return (
                        <li key={i} className="flex flex-col gap-0.5 text-[11px] text-amber-700/90 dark:text-amber-400/90">
                            <div className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate" title={text}>{text}</span>
                                {!running && onFix ? (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onFix(detail || text, issueNodeId(rec))}
                                        className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/40 px-1.5 py-0.5 font-medium text-amber-700 hover:bg-amber-500/15 disabled:opacity-40 dark:text-amber-300"
                                    >
                                        <Wrench className="h-3 w-3" aria-hidden="true" />
                                        Fix
                                    </button>
                                ) : null}
                            </div>
                            {detail ? (
                                <details>
                                    <summary className="cursor-pointer text-[10px] opacity-70">Technical detail</summary>
                                    <span className="text-[10px] opacity-80">{detail}</span>
                                </details>
                            ) : null}
                        </li>
                    );
                })}
                {errors.length + warnings.length > shown.length && (
                    <li className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
                        +{errors.length + warnings.length - shown.length} more
                    </li>
                )}
            </ul>
        </div>
    );
}
