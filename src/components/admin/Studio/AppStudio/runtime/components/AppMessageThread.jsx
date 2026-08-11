import { useEffect, useRef } from 'react';
import EmailHtmlBody from '../../../../EmailHtmlBody';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { ROLE_COLORS, roleFillContrast } from '../styleResolver';
import { EmptyText, ErrorText, SkeletonLines, displayValue, useStickyBinding } from '../uiBits';

/**
 * App Studio runtime — 'message_thread'. Spec: server/appStudio/componentSpecs.js.
 *
 * A conversation, not a list. The thing a repeater genuinely cannot do is give
 * each row a DIFFERENT appearance based on one of its fields: `computed`
 * overrides props, never style. `sideMap` is that missing piece — one list
 * mapping a row value ('requester', 'agent', 'system', …) to a side and a tone.
 *
 * HTML bodies render through the shared EmailHtmlBody, which is imported rather
 * than copied on purpose: the "sandbox without allow-scripts" invariant that
 * makes rendering a stranger's e-mail safe must have exactly one home.
 */

const SIDE_ALIGN = { left: 'items-start', right: 'items-end', center: 'items-center' };

function toneStyle(side, tone) {
    if (side === 'center') {
        return { background: 'transparent', color: 'var(--text-muted)', border: 'none' };
    }
    // 'neutral' is the incoming default: a plain surface bubble. Any other role
    // tints the bubble so the eye can separate the two parties at a glance.
    if (!tone || tone === 'neutral') {
        return { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' };
    }
    const color = ROLE_COLORS[tone] || ROLE_COLORS.primary;
    // OUR side gets a filled bubble, not a 14% wash of one. That wash is the
    // difference between "a chat with two clearly different voices" and "a list
    // of grey boxes, one very slightly warmer" — which is what every screenshot
    // of this component actually looked like.
    if (side === 'right') {
        // White was hardcoded on the raw role colour, so a warning/info/success
        // bubble printed its text at well under 4.5:1.
        return { background: color, color: roleFillContrast(tone) };
    }
    return { background: `color-mix(in srgb, ${color} 14%, transparent)`, color: 'var(--text-primary)' };
}

function formatStamp(value) {
    if (value == null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return displayValue(value);
    return d.toLocaleString();
}

/** The sideMap entry matching this row, or a left/neutral default. */
function resolveSide(row, sideField, sideMap) {
    if (!sideField) return { side: 'left', tone: 'neutral' };
    const raw = walkPath(row, sideField);
    const value = raw == null ? '' : String(raw);
    const hit = (Array.isArray(sideMap) ? sideMap : []).find((m) => m && String(m.value) === value);
    return {
        side: hit?.side === 'right' || hit?.side === 'center' ? hit.side : 'left',
        tone: hit?.tone || 'neutral',
    };
}

function Chips({ items, labelKey, testId }) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1.5" data-app-thread-chips={testId}>
            {items.map((item, i) => {
                const label = typeof item === 'string' ? item : displayValue(walkPath(item, labelKey));
                if (label == null || label === '') return null;
                return (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                        {label}
                    </span>
                );
            })}
        </div>
    );
}

export default function AppMessageThread({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        bodyField = 'body', htmlField = null, authorField = 'author',
        timestampField = 'created_at', sideField = null, sideMap = [],
        attachmentsField = null, attachmentLabelKey = 'filename',
        citationsField = null, citationLabelKey = 'title',
        rowLimit = 100, emptyText = 'No messages yet.',
    } = node.props || {};

    const binding = resolveBinding(node.props?.source, { actionState, dataState, scope });
    // Sticky: a polling tick must not blank the conversation for a moment. This
    // is what makes auto-refresh feel like an inbox rather than a page reload.
    const { value: source, isLoading, error, errorCode } = useStickyBinding(binding);

    const listRef = useRef(null);
    const limit = Number.isInteger(rowLimit) && rowLimit > 0 ? rowLimit : 100;
    const all = (Array.isArray(source) ? source : []).filter((r) => r && typeof r === 'object');
    // Keep the TAIL, unlike timeline's head slice: in a conversation the newest
    // messages are the ones you must not drop.
    const rows = all.length > limit ? all.slice(all.length - limit) : all;

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [rows.length]);

    // A failed conversation fetch reported "No messages yet." — the one empty
    // state a user is most likely to believe.
    if (error) return <ErrorText error={error} errorCode={errorCode} />;
    if (isLoading && rows.length === 0) return <SkeletonLines lines={4} />;
    if (rows.length === 0) return <EmptyText text={emptyText} />;

    const isRun = mode === 'run';
    const clickable = isRun && node.onRowClick;
    const size = node.style?.size || 'md';
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

    return (
        <div
            ref={listRef}
            className="flex flex-col gap-3 h-full overflow-y-auto min-h-0"
            data-app-message-thread="true"
        >
            {rows.map((row, i) => {
                const { side, tone } = resolveSide(row, sideField, sideMap);
                const author = authorField ? displayValue(walkPath(row, authorField)) : null;
                const stamp = timestampField ? formatStamp(walkPath(row, timestampField)) : null;
                const html = htmlField ? walkPath(row, htmlField) : null;
                const text = bodyField ? walkPath(row, bodyField) : null;
                const attachments = attachmentsField ? walkPath(row, attachmentsField) : null;
                const citations = citationsField ? walkPath(row, citationsField) : null;

                // The meta line lives ABOVE the bubble, not inside it. Inside, it
                // has to be tinted to survive a filled bubble, it competes with
                // the message for the eye, and it pushes every body down by a
                // line — three problems that all disappear by moving it out.
                const meta = side !== 'center' && (author || stamp) ? (
                    <div
                        className={`flex items-baseline gap-2 mb-1 px-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}
                        data-app-thread-meta={side}
                    >
                        {author ? (
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{author}</span>
                        ) : null}
                        {stamp ? (
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{stamp}</span>
                        ) : null}
                    </div>
                ) : null;

                const bubble = (
                    <div
                        className={`px-3 py-2 rounded-lg ${side === 'center' ? 'text-xs italic' : textSize}`}
                        style={{ ...toneStyle(side, tone), borderRadius: 'var(--app-radius)', maxWidth: side === 'center' ? '100%' : '85%' }}
                        data-app-thread-side={side}
                        data-app-thread-tone={tone}
                    >
                        {html ? (
                            <EmailHtmlBody html={String(html)} />
                        ) : (
                            <div className="whitespace-pre-wrap break-words">{displayValue(text)}</div>
                        )}

                        <Chips items={attachments} labelKey={attachmentLabelKey} testId="attachments" />
                        <Chips items={citations} labelKey={citationLabelKey} testId="citations" />
                    </div>
                );

                return (
                    <div
                        key={i}
                        className={`flex flex-col ${SIDE_ALIGN[side] || SIDE_ALIGN.left}`}
                        data-app-thread-row={i}
                    >
                        {meta}
                        {clickable ? (
                            <button
                                type="button"
                                className="text-left cursor-pointer max-w-full"
                                onClick={() => runAction(node.onRowClick, { formValues: row })}
                            >
                                {bubble}
                            </button>
                        ) : bubble}
                    </div>
                );
            })}
        </div>
    );
}
