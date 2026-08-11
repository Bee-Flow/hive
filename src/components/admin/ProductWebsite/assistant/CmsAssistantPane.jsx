import React, { useMemo, useRef, useState } from 'react';
import AppIcon from '../../../AppIcon';
import ModelTierSelector from '../../../ModelTierSelector';
import useModelTierSelection from '../../../../hooks/useModelTierSelection';
import useCmsBuilderStream from '../../../../hooks/useCmsBuilderStream';
import { MessageBubble } from '../../AITasksDesigner/Builder/chat';
import { HEADER_VIRTUAL_ID, DESIGN_VIRTUAL_ID } from '../sentinels';

// Site-level tools whose success should surface a "What changed" chip even
// when no page was created or touched (the `done` event only carries page
// ids — the frozen SSE contract stays untouched). One entry per editor
// SURFACE: a single turn can retheme the site AND rewrite the menu, so this
// is a map (not a boolean) and each touched surface gets its own chip
// pointing at the entry that actually edits it.
const SITE_TOUCH_SURFACES = {
    cms_update_header_nav: { id: HEADER_VIRTUAL_ID, label: 'Header menu' },
    cms_update_design: { id: DESIGN_VIRTUAL_ID, label: 'Design' },
};

/**
 * CMS page-building assistant — the left dock of the website builder.
 * Trimmed sibling of App Studio's BuilderChatPane: SSE agentic loop, tool
 * chips, "What changed" + Undo turn; no plans/phases/checkpoints (pages are
 * small — one turn, one action).
 *
 * The panel bridge (see ProductWebsitePanel) owns document state:
 *   bridge = {
 *     beginTurn()            — drain saves, snapshot, engage stream lock
 *     applyExternalDraft(e)  — fold a server-persisted draft in (NO save)
 *     endTurn(info)          — release the lock, select what was built
 *     undoTurn()             — server-side revert of the last turn
 *     context()              — { activePageId, activeBlockId, activeLocale }
 *     selectPage(id)
 *   }
 *
 * The transcript is SITE-scoped and shared between the site's admins
 * (rehydrated from the builder session snapshot).
 */

const ERROR_COPY = {
    subscription_limit: 'The AI limit for your plan has been reached. The builder will work again once the limit resets.',
    rate_limited: 'Too many builder requests in a row — give it a few seconds and try again.',
    model_unavailable: 'No AI model is available right now. Check the AI configuration, then try again.',
    transient_upstream: 'The AI provider had a hiccup. Nothing was lost — try again.',
    budget_exhausted: 'The builder hit its per-turn limit. Everything it finished is already saved — send a follow-up message to continue.',
    internal: 'Something went wrong in the builder. Try again; if it keeps failing, check the server logs.',
};

const QUICK_ACTIONS = [
    'Add a pricing page with a hero and a 3-tier pricing section',
    'Rewrite the hero headline to be punchier',
    'Add a features section with 4 items',
    'Fill in SEO titles and descriptions for every page',
];

function ToolChip({ item }) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 my-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] w-fit max-w-full">
            <AppIcon
                name={item.ok ? 'Wrench' : 'AlertTriangle'}
                className={`w-3 h-3 shrink-0 ${item.ok ? 'text-[var(--accent-primary)]' : 'text-amber-500'}`}
            />
            <span className="font-medium shrink-0">{item.label}</span>
            {item.summary ? <span className="truncate text-[var(--text-muted)]">{item.summary}</span> : null}
        </div>
    );
}

function ErrorItem({ item, onRetry }) {
    const copy = ERROR_COPY[item.code] || item.message || ERROR_COPY.internal;
    return (
        <div className="my-2 px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-300">
            <p>{copy}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1.5 px-2 py-1 rounded border border-red-400/40 text-red-200 hover:bg-red-500/20 text-[11px]"
                >
                    Try again
                </button>
            )}
        </div>
    );
}

export default function CmsAssistantPane({
    siteId,
    bridge,
    pages = [],            // site index [{id, slug, title}] — chip labels
    translationMode = false,
    defaultLocaleName = 'the default language',
    canUndoTurn = false,
    onClose,
}) {
    const [input, setInput] = useState('');
    const [lastTurn, setLastTurn] = useState(null);   // { createdPageIds, touchedPageIds, siteSurfaces }
    const lastTurnRef = useRef(null);                 // { text, options } for Retry
    const siteTouchedRef = useRef(new Set());         // tool names from SITE_TOUCH_SURFACES that succeeded this turn
    const scrollRef = useRef(null);
    const bridgeRef = useRef(bridge);
    bridgeRef.current = bridge;

    const { modelTiers, selectedTier, setSelectedTier } = useModelTierSelection({ storageKey: 'cmsBuilderTier' });

    const stream = useCmsBuilderStream({
        siteId,
        onDraft: (evt) => bridgeRef.current?.applyExternalDraft(evt),
        onToolCall: (t) => {
            if (t?.ok && SITE_TOUCH_SURFACES[t.name]) siteTouchedRef.current.add(t.name);
        },
        onDone: (info) => {
            bridgeRef.current?.endTurn(info);
            const pageCount = (info?.createdPageIds?.length || 0) + (info?.touchedPageIds?.length || 0);
            // Insertion order = the order the tools ran in this turn.
            const siteSurfaces = [...siteTouchedRef.current].map(name => SITE_TOUCH_SURFACES[name]).filter(Boolean);
            if (pageCount > 0 || siteSurfaces.length > 0) {
                setLastTurn({ ...info, siteSurfaces });
            }
        },
        onError: () => bridgeRef.current?.endTurn({ failed: true }),
    });

    const pageById = useMemo(() => new Map((pages || []).map(p => [p.id, p])), [pages]);

    const scrollDown = () => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    };

    const startTurn = async (text, extraContext = {}) => {
        const msg = (text || '').trim();
        if (!msg || stream.running || translationMode) return;
        setLastTurn(null);
        siteTouchedRef.current = new Set();
        setInput('');
        await bridgeRef.current?.beginTurn();
        const options = {
            modelTier: selectedTier || 'auto',
            context: { ...(bridgeRef.current?.context() || {}), ...extraContext },
        };
        lastTurnRef.current = { text: msg, options };
        scrollDown();
        await stream.send(msg, options);
        scrollDown();
    };

    const retryLast = () => {
        const last = lastTurnRef.current;
        if (last) startTurn(last.text, last.options.context);
    };

    const chips = lastTurn
        ? [
            ...(lastTurn.siteSurfaces || []).map(s => ({ id: s.id, kind: 'site', label: s.label })),
            ...(lastTurn.createdPageIds || []).map(id => ({ id, kind: 'created' })),
            ...(lastTurn.touchedPageIds || []).filter(id => !(lastTurn.createdPageIds || []).includes(id)).map(id => ({ id, kind: 'edited' })),
        ]
        : [];

    return (
        <div className="h-full flex flex-col min-h-0 bg-[var(--bg-secondary)]">
            {/* header */}
            <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--border-subtle)]">
                <AppIcon name="Sparkles" className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Assistant</span>
                <span className="text-[10px] text-[var(--text-muted)]" title="The conversation is stored per site and visible to every admin of this site.">
                    Shared with site admins
                </span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        title="Close assistant"
                    >
                        <AppIcon name="X" className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* transcript */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                {stream.messages.length === 0 ? (
                    <div className="pt-6 text-center">
                        <AppIcon name="Sparkles" className="w-7 h-7 mx-auto mb-2 text-[var(--text-muted)]" />
                        <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">
                            Build pages by describing them
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] mb-4 px-2">
                            The assistant creates and edits pages, blocks and SEO on this site.
                            Publishing always stays in your hands.
                        </p>
                        <div className="flex flex-col gap-1.5 px-1">
                            {QUICK_ACTIONS.map(q => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => setInput(q)}
                                    className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] text-[11px] text-left text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : stream.messages.map((m, i) => {
                    if (m.kind === 'tool') return <ToolChip key={i} item={m} />;
                    if (m.kind === 'error') {
                        return <ErrorItem key={i} item={m} onRetry={!stream.running ? retryLast : undefined} />;
                    }
                    return <MessageBubble key={i} msg={m} />;
                })}

                {/* What changed + Undo turn */}
                {lastTurn && !stream.running && chips.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">What changed</span>
                            {canUndoTurn && (
                                <button
                                    type="button"
                                    onClick={() => bridgeRef.current?.undoTurn()}
                                    className="text-[10px] text-[var(--text-muted)] hover:text-red-400"
                                    title="Revert everything this turn changed (deletes pages it created)"
                                >
                                    Undo turn
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {chips.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => bridgeRef.current?.selectPage(c.id)}
                                    className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60"
                                    title="Show in the editor"
                                >
                                    {c.kind === 'created' ? '+ ' : '✎ '}
                                    {c.label || pageById.get(c.id)?.title || pageById.get(c.id)?.slug || c.id}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* validation strip */}
                {stream.lastValidation?.errors?.length > 0 && !stream.running && (
                    <div className="mt-2 p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10">
                        <p className="text-[10px] uppercase tracking-wider text-amber-500 mb-1">Needs attention</p>
                        {stream.lastValidation.errors.slice(0, 5).map((issue, i) => (
                            <div key={i} className="flex items-center gap-2 py-0.5">
                                <span className="flex-1 text-[11px] text-[var(--text-secondary)]">{issue.message}</span>
                                <button
                                    type="button"
                                    onClick={() => startTurn(`Fix: ${issue.message}`)}
                                    className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-500 hover:bg-amber-500/15"
                                >
                                    Fix
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* composer */}
            <div className="shrink-0 border-t border-[var(--border-subtle)] p-2">
                {translationMode ? (
                    <p className="text-[11px] text-[var(--text-muted)] px-1 py-2">
                        The assistant edits the source language. Switch back to {defaultLocaleName} to
                        build — use AI translate for translations.
                    </p>
                ) : (
                    <>
                        <textarea
                            rows={3}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    startTurn(input);
                                }
                            }}
                            placeholder='Describe what to build… e.g. "Add an About page with a team section"'
                            disabled={stream.running}
                            className="w-full px-2.5 py-2 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none resize-none disabled:opacity-60"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                            <ModelTierSelector
                                tiers={modelTiers}
                                value={selectedTier || 'auto'}
                                onChange={setSelectedTier}
                                variant="input"
                                portal
                                dropDirection="up"
                            />
                            {stream.running ? (
                                <button
                                    type="button"
                                    onClick={stream.stop}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-red-400/50 text-red-400 hover:bg-red-500/10"
                                >
                                    <AppIcon name="Square" className="w-3 h-3" />
                                    Stop
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => startTurn(input)}
                                    disabled={!input.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-40"
                                >
                                    <AppIcon name="Send" className="w-3 h-3" />
                                    Send
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
