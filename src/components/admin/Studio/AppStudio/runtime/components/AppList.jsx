import { tryEvaluate } from '@shared/expr/engine.mjs';
import AppIcon from '../../../../../AppIcon';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { isFill, ROLE_COLORS, roleTextColor } from '../styleResolver';
import { Inbox } from 'lucide-react';
import { EmptyText, ErrorText, SkeletonLines, displayValue, useStickyBinding } from '../uiBits';

/**
 * App Studio runtime — 'list'. Spec: server/appStudio/componentSpecs.js.
 *
 * Rich enough to be a real sidebar picker: a title, a subtitle, a meta line, a
 * right-aligned relative timestamp, a status pill (badgeToneMap, the same shape
 * message_thread uses for sideMap) and an unread marker. Rows are clickable
 * when the node carries onRowClick — same contract as table/data_grid/timeline:
 * the clicked row is handed to the action as its form values.
 */

/** "3 min", "2 u", "5 d" — short enough for a narrow sidebar. */
function relativeTime(value) {
    if (value == null || value === '') return null;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return displayValue(value);
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'nu';
    if (mins < 60) return `${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} u`;
    return `${Math.round(hours / 24)} d`;
}

function badgeStyle(tone) {
    if (!tone || tone === 'neutral') {
        return { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
    }
    const color = ROLE_COLORS[tone] || ROLE_COLORS.primary;
    // The wash keeps the role's hue; the TEXT has to be readable on it, which
    // the raw hex is not in the light themes.
    return { background: `color-mix(in srgb, ${color} 16%, transparent)`, color: roleTextColor(tone) };
}

export default function AppList({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        titleKey = 'title', subtitleKey = null, metaKey = null,
        timestampKey = null, badgeKey = null, badgeToneMap = [], unreadKey = null,
        selectedWhen = null,
        icon = null, emptyText = 'Nothing to show yet.',
    } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={3} />;

    const items = (Array.isArray(source) ? source : []).filter((row) => row && typeof row === 'object');
    if (items.length === 0) return <EmptyText art="empty-inbox" title="Nothing here yet" text={emptyText} />;

    const size = node.style?.size || 'md';
    const clickable = mode === 'run' && node.onRowClick;

    // A fill list IS the scroll region — it is the sidebar of an inbox, and a
    // hundred rows must not push the pane. Without this the list overflowed and
    // was silently clipped by the pane's overflow-hidden, which is how the
    // support desk shipped with an unscrollable ticket list.
    return (
        <ul
            className={`flex flex-col gap-2${isFill(node) ? ' app-fill h-full min-h-0 overflow-y-auto' : ''}`}
            data-app-list="true"
        >
            {items.map((item, i) => {
                const subtitle = subtitleKey ? walkPath(item, subtitleKey) : null;
                const meta = metaKey ? walkPath(item, metaKey) : null;
                const stamp = timestampKey ? relativeTime(walkPath(item, timestampKey)) : null;
                const badge = badgeKey ? walkPath(item, badgeKey) : null;
                const unread = unreadKey ? Boolean(walkPath(item, unreadKey)) : false;
                const toneHit = badge != null
                    ? (Array.isArray(badgeToneMap) ? badgeToneMap : []).find((m) => m && String(m.value) === String(badge))
                    : null;

                const body = (
                    <>
                        {icon ? (
                            <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                                style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                            >
                                <AppIcon name={icon} className="w-3.5 h-3.5" />
                            </span>
                        ) : null}
                        {unread ? (
                            <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ background: 'var(--app-primary)' }}
                                aria-label="Unread"
                                data-app-list-unread="true"
                            />
                        ) : null}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={`${size === 'sm' ? 'text-xs' : 'text-sm'} truncate ${unread ? 'font-semibold' : 'font-medium'}`}
                                >
                                    {displayValue(walkPath(item, titleKey))}
                                </span>
                                {stamp ? (
                                    <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {stamp}
                                    </span>
                                ) : null}
                            </div>
                            {subtitle != null && subtitle !== '' ? (
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {displayValue(subtitle)}
                                </div>
                            ) : null}
                            {(meta != null && meta !== '') || badge != null ? (
                                <div className="mt-1 flex items-center gap-1.5">
                                    {badge != null && badge !== '' ? (
                                        <span
                                            className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded"
                                            style={{ ...badgeStyle(toneHit?.tone), borderRadius: 'var(--app-radius)' }}
                                            data-app-list-badge={toneHit?.tone || 'neutral'}
                                        >
                                            {displayValue(toneHit?.label ?? badge)}
                                        </span>
                                    ) : null}
                                    {meta != null && meta !== '' ? (
                                        <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                            {displayValue(meta)}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </>
                );

                // Which row is OPEN. An inbox that cannot show you which
                // conversation you are reading is broken, and there was no way
                // to express it — a formula per row (`item` in scope) is the
                // only shape that works, because the answer lives in a variable
                // the row has to be compared against.
                const selected = selectedWhen
                    ? !!tryEvaluate(String(selectedWhen), { ...scope, item, index: i }).value
                    : false;

                const cls = `flex items-center gap-2.5 border w-full text-left ${size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2'}`;
                const style = {
                    background: selected ? 'var(--app-primary-soft)' : 'var(--bg-card)',
                    borderColor: selected ? 'var(--app-primary)' : 'var(--border-default)',
                    borderRadius: 'var(--app-radius)',
                };

                return (
                    <li key={i} data-app-list-row={i} data-app-list-selected={selected || undefined}>
                        {clickable ? (
                            <button
                                type="button"
                                // Hover was missing entirely, so a clickable row
                                // looked exactly like a static one.
                                className={`${cls} cursor-pointer transition-colors hover:brightness-[1.06]`}
                                style={style}
                                aria-current={selected ? 'true' : undefined}
                                onClick={() => runAction(node.onRowClick, { formValues: item })}
                            >
                                {body}
                            </button>
                        ) : (
                            <div className={cls} style={style}>{body}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
