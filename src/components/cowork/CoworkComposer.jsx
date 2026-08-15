/**
 * The Cowork input box — the one there is.
 *
 * Both places you can hand Bee Flow a brief render this: the chat composer
 * with the Chat ⇄ Cowork switch flipped, and the /app/cowork page. They used
 * to be two hand-rolled boxes, which is exactly how the page ended up without
 * an Apps picker and without a model-tier picker, and silently scheduling
 * everything on `auto`.
 *
 * One slot keeps the surfaces honest instead of forking the component:
 * `chatTools` — the chat's own buttons (attach, skills, KB, …). They are
 * rendered hidden rather than unmounted so their popovers keep state across a
 * switch back to Chat. The page passes nothing.
 *
 * Everything else — placeholder, aria labels, the chips row, the Apps picker,
 * the tier pickers, the Run/Schedule button — is fixed here so it cannot drift
 * apart again.
 *
 * Deliberately not shown: a footer restating the schedule ("Now · results land
 * in your notifications") and the page's quota counter. The chips above already
 * say when it runs, the button already says Run vs Schedule, and the quota only
 * matters once it is reached — where the page raises it as a real warning.
 */
import { ArrowUp } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import EffortSelector from '../EffortSelector';
import ModelTierSelector from '../ModelTierSelector';
import AppsPicker from '../apps/AppsPicker';
import { seedTextForApp } from '../apps/appCatalog';
import CoworkOptionsBar from './CoworkOptionsBar';
import useCoworkApps from './useCoworkApps';

export const COWORK_PLACEHOLDER = 'Describe the work — Bee Flow runs it and reports back';

// Mirrors the `supportsReasoning` regexes used by the backend provider
// adapters, so server and client agree on when the effort picker applies.
const SUPPORTS_REASONING = /claude-opus-4|claude-sonnet-4|^o\d|gpt-5|gemini-2\.5|gemini-3|magistral/i;

export default function CoworkComposer({
    value,
    onChange,
    onSubmit,
    cowork,
    // Model tier. Omit `modelTiers` and the pickers simply don't render —
    // which is what a surface without a tier concern wants.
    modelTiers = null,
    selectedTier = 'auto',
    onTierChange,
    // Apps picker gating. `simpleMode` and `disableExternalTools` are the two
    // reasons to hide it; `agentIntegrations` narrows it inside agent chat.
    simpleMode = false,
    disableExternalTools = false,
    agentIntegrations = null,
    isMobile = false,
    minRows = 1,
    error = null,
    chatTools = null,
    textareaRef: externalRef = null,
}) {
    const innerRef = useRef(null);
    const textareaRef = externalRef || innerRef;
    const { availableApps, isAppEnabled, toggleApp } = useCoworkApps({
        agentIntegrations,
        value: cowork.enabledApps,
        onChange: cowork.setEnabledApps,
    });

    // Auto-resize. We toggle overflow-y inline so the scrollbar (or its native
    // +/- arrows on some GTK themes) only appears once the content actually
    // exceeds the 180px cap — otherwise it stays hidden.
    //
    // `minRows` has to be re-applied as a floor here, not left to the `rows`
    // attribute: this effect runs on mount and writes an explicit height, which
    // overrules `rows` immediately. That is why the page asked for three rows
    // and got the same single line as the chat.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const cs = window.getComputedStyle(el);
        const lineHeight = parseFloat(cs.lineHeight) || 24;
        const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        const floor = minRows * lineHeight + padding;
        const needsScroll = el.scrollHeight > 180;
        el.style.height = Math.max(floor, Math.min(el.scrollHeight, 180)) + 'px';
        el.style.overflowY = needsScroll ? 'auto' : 'hidden';
    }, [value, minRows, textareaRef]);

    const canSend = !!String(value || '').trim() && !cowork.submitting && cowork.scheduleReady;

    const submit = () => { if (canSend && onSubmit) onSubmit(); };

    // Enter sends, Shift+Enter breaks the line, Cmd/Ctrl+Enter also sends.
    // The page used to be Cmd+Enter-only while the chat sent on Enter — the
    // same box behaving differently depending on where you opened it.
    const onKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey) return;
        e.preventDefault();
        submit();
    };

    const showTiers = !simpleMode && !!modelTiers;
    const reasoningModelId = modelTiers?.[selectedTier]?.model || '';

    return (
        <div
            role="form"
            aria-label="Cowork brief input"
            data-testid="cowork-composer"
            data-cowork-mode="cowork"
            className="chat-composer relative flex flex-col rounded-2xl border transition-all focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/35 ring-1 ring-[var(--accent-primary)]/40"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
            <div className={`${isMobile ? 'px-2' : 'px-4'} pt-3 pb-1`}>
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={minRows}
                    placeholder={COWORK_PLACEHOLDER}
                    aria-label="Cowork brief"
                    data-testid="cowork-brief-input"
                    className="w-full max-h-[180px] bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none py-2 text-[15px] leading-relaxed outline-none"
                />
            </div>

            {/* Toolbar row. It is justify-between, so a third child would be
                pushed to the middle — which is exactly where the apps picker
                used to float. Everything on the left lives in one group; only
                the send cluster sits opposite. */}
            <div className="flex items-center justify-between px-3 pb-3 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <CoworkOptionsBar
                        when={cowork.when}
                        onWhenChange={cowork.setWhen}
                        repeatInterval={cowork.repeatInterval}
                        onRepeatChange={cowork.setRepeatInterval}
                        agentId={cowork.agentId}
                        onAgentChange={cowork.setAgentId}
                        agents={cowork.agents}
                        isMobile={isMobile}
                    />
                    {chatTools}
                    {!simpleMode && !disableExternalTools && (
                        <AppsPicker
                            apps={availableApps}
                            isAppEnabled={isAppEnabled}
                            toggleApp={toggleApp}
                            onPick={(app) => {
                                const seed = seedTextForApp(app);
                                if (seed) onChange(seed);
                                textareaRef.current?.focus();
                            }}
                        />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {showTiers && (
                        <div className="mr-1">
                            <ModelTierSelector
                                tiers={modelTiers}
                                value={selectedTier}
                                onChange={onTierChange}
                                variant="input"
                            />
                        </div>
                    )}
                    {showTiers && SUPPORTS_REASONING.test(reasoningModelId) && (
                        <div className="mr-1">
                            <EffortSelector modelId={reasoningModelId} />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSend}
                        data-testid="cowork-send"
                        title={cowork.summary}
                        className="inline-flex items-center gap-1.5 pl-3.5 pr-3 py-2 rounded-full text-[12.5px] font-semibold text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {cowork.submitting ? 'Starting…' : (cowork.when.presetId === 'now' ? 'Run' : 'Schedule')}
                        <ArrowUp className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {(error || cowork.error) && (
                <div className="px-4 pb-3 -mt-1 text-[12px] text-red-600 dark:text-red-400" role="alert">
                    {error || cowork.error}
                </div>
            )}
        </div>
    );
}
