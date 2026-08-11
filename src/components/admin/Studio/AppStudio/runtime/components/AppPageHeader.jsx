import React from 'react';
import AppIcon from '../../../../../AppIcon';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'page_header' (container). Spec: server/appStudio/componentSpecs.js.
 * Title/subtitle/icon on the left; the node's CHILDREN render right-aligned as
 * the action area (typically buttons). The optional divider closes the header.
 *
 * `titleFrom`/`subtitleFrom` bind the header to what is on screen. Without them
 * the title was a literal authored at design time, so the subject of the open
 * e-mail could only appear as a labelled field inside a record_detail — which is
 * exactly why the conversation view read like a form rather than a conversation.
 */

/** A bound value that is worth showing: a non-empty scalar. */
function boundText(binding, deps) {
    if (!binding) return null;
    const { value } = resolveBinding(binding, deps);
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
}

export default function AppPageHeader({ node, children }) {
    const {
        title = 'Page title', subtitle = null, titleFrom = null, subtitleFrom = null,
        icon = null, showDivider = true,
    } = node.props || {};
    const { actionState, dataState, scope } = useRuntime();
    const deps = { actionState, dataState, scope };
    // The binding WINS when it resolves; the literal stays the fallback for the
    // editor canvas and for the moment before data arrives.
    const shownTitle = boundText(titleFrom, deps) ?? title;
    const shownSubtitle = boundText(subtitleFrom, deps) ?? subtitle;
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    const kids = React.Children.toArray(children);

    return (
        <header className="w-full min-w-0" data-app-pageheader="true">
            <div className="flex items-start" style={{ gap: spaceSteps(gap) }}>
                {icon ? (
                    <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0"
                        style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                        aria-hidden="true"
                    >
                        <AppIcon name={icon} className="w-4.5 h-4.5" />
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{shownTitle}</h1>
                    {shownSubtitle ? (
                        <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{shownSubtitle}</p>
                    ) : null}
                </div>
                {kids.length ? (
                    <div
                        className="flex items-center justify-end flex-wrap shrink-0"
                        style={{ gap: spaceSteps(2) }}
                        data-app-pageheader-actions="true"
                    >
                        {kids}
                    </div>
                ) : null}
            </div>
            {showDivider ? (
                <hr className="mt-3 border-0 h-px w-full" style={{ background: 'var(--border-default)' }} aria-hidden="true" />
            ) : null}
        </header>
    );
}
