import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { EM_DASH, EmptyText, ErrorText, SkeletonLines, displayValue, useStickyBinding } from '../uiBits';

/** App Studio runtime — 'table'. Spec: server/appStudio/componentSpecs.js. */

function isHttpUrl(value) {
    const v = String(value || '').trim().toLowerCase();
    return v.startsWith('https://') || v.startsWith('http://');
}

function Cell({ value, format }) {
    if (value == null || value === '') return <>{EM_DASH}</>;
    switch (format) {
        case 'number': {
            const n = Number(value);
            return <>{Number.isFinite(n) ? n.toLocaleString() : displayValue(value)}</>;
        }
        case 'date': {
            const d = new Date(value);
            return <>{Number.isNaN(d.getTime()) ? displayValue(value) : d.toLocaleDateString()}</>;
        }
        case 'badge':
            return (
                <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    {displayValue(value)}
                </span>
            );
        case 'link':
            if (!isHttpUrl(value)) return <>{displayValue(value)}</>;
            return (
                <a
                    href={String(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--app-primary)' }}
                >
                    {displayValue(value)}
                </a>
            );
        default:
            return <>{displayValue(value)}</>;
    }
}

export default function AppTable({ node }) {
    const { actionState, dataState, scope } = useRuntime();
    const { columns = [], emptyText = 'Nothing to show yet.', rowLimit = 25 } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={4} />;

    const allRows = (Array.isArray(source) ? source : [])
        .filter((row) => row && typeof row === 'object');
    const rows = allRows.slice(0, Math.max(1, rowLimit));
    // Everything past rowLimit was dropped in silence — with no count, no
    // paging and no scroll, a table of 500 rows looked like a table of 25.
    const hidden = allRows.length - rows.length;
    // No configured columns → derive from the first row (max 12, like the spec).
    const cols = columns.length
        ? columns
        : Object.keys(rows[0] || {}).slice(0, 12).map((key) => ({ key, label: key, format: 'text' }));

    if (rows.length === 0 || cols.length === 0) return <EmptyText text={emptyText} />;

    const size = node.style?.size || 'md';
    const cellPad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
    return (
        <div className="w-full overflow-x-auto">
            <table className={`w-full ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                <thead>
                    <tr>
                        {cols.map((col) => (
                            <th
                                key={col.key}
                                scope="col"
                                className={`text-left font-medium ${cellPad} border-b`}
                                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                            >
                                {col.label || col.key}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {cols.map((col) => (
                                <td
                                    key={col.key}
                                    className={`${cellPad} border-b align-top`}
                                    style={{ borderColor: 'var(--border-default)' }}
                                >
                                    {/* walkPath, like every sibling: a dotted key
                                        (customer.name) rendered an em-dash under
                                        plain bracket access. */}
                                    <Cell value={walkPath(row, col.key)} format={col.format || 'text'} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {hidden > 0 ? (
                <p
                    className="px-1 pt-1.5 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                    data-app-table-truncated={hidden}
                >
                    Showing {rows.length} of {allRows.length.toLocaleString()}.
                </p>
            ) : null}
        </div>
    );
}
