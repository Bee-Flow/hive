import AppIcon from '../../../../../AppIcon';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { isFill } from '../styleResolver';
import { EmptyText, ErrorText, SkeletonLines, displayValue , useStickyBinding } from '../uiBits';

/**
 * App Studio runtime — 'timeline'. Spec: server/appStudio/componentSpecs.js.
 * A vertical timeline over an array of objects (one entry per row, in source
 * order). Rows are clickable when the node carries onRowClick (run mode) —
 * the clicked row is passed as the action's form values, same contract as
 * table/data_grid row clicks.
 */

function formatDate(value) {
    if (value == null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return displayValue(value);
    // Show the time only when the source value carried one.
    const hasTime = typeof value === 'string' ? value.includes(':') : true;
    return hasTime ? d.toLocaleString() : d.toLocaleDateString();
}

export default function AppTimeline({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        titleKey = 'title', dateKey = 'created_at', descriptionKey = null,
        icon = null, rowLimit = 25, emptyText = 'Nothing to show yet.',
    } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={3} />;

    const limit = Number.isInteger(rowLimit) && rowLimit > 0 ? rowLimit : 25;
    const rows = (Array.isArray(source) ? source : [])
        .filter((row) => row && typeof row === 'object')
        .slice(0, limit);
    if (rows.length === 0) return <EmptyText art="all-done" title="Nothing logged yet" text={emptyText} />;

    const isRun = mode === 'run';
    const clickable = isRun && node.onRowClick;
    const size = node.style?.size || 'md';

    // The height knob is offered on this type, so it has to be honoured: without
    // the scroller a `fill` timeline overflowed its pane and was clipped.
    const fill = isFill(node);

    return (
        <ol
            className={`flex flex-col${fill ? ' app-fill h-full min-h-0 overflow-y-auto' : ''}`}
            data-app-timeline="true"
        >
            {rows.map((row, i) => {
                const title = displayValue(walkPath(row, titleKey));
                const date = formatDate(walkPath(row, dateKey));
                const description = descriptionKey ? walkPath(row, descriptionKey) : null;
                const body = (
                    <>
                        <div className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium truncate`} style={{ color: 'var(--text-primary)' }}>
                            {title}
                        </div>
                        {date != null ? (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</div>
                        ) : null}
                        {description != null && description !== '' ? (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{displayValue(description)}</div>
                        ) : null}
                    </>
                );
                return (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0" data-app-timeline-row={i}>
                        {/* rail + dot */}
                        <div className="flex flex-col items-center shrink-0" aria-hidden="true">
                            <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                                style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                            >
                                {icon ? <AppIcon name={icon} className="w-3 h-3" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />}
                            </span>
                            {i < rows.length - 1 ? (
                                <span className="w-px flex-1 mt-1" style={{ background: 'var(--border-default)' }} />
                            ) : null}
                        </div>
                        {clickable ? (
                            <button
                                type="button"
                                className="min-w-0 flex-1 text-left cursor-pointer"
                                onClick={() => runAction(node.onRowClick, { formValues: row })}
                            >
                                {body}
                            </button>
                        ) : (
                            <div className="min-w-0 flex-1">{body}</div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
