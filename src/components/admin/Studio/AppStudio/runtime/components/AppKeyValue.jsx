import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { EmptyText, ErrorText, SkeletonLines, displayValue, useStickyBinding } from '../uiBits';

/** App Studio runtime — 'keyValue'. Spec: server/appStudio/componentSpecs.js. */

export default function AppKeyValue({ node }) {
    const { actionState, dataState, scope } = useRuntime();
    const { fields = [], emptyText = 'No data yet.' } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={3} />;

    // An array is what a `records` binding hands back, and record_detail
    // already tolerates it by taking the first row. Rejecting it here meant
    // the same binding worked in one component and showed an empty state in
    // the other.
    const first = Array.isArray(source) ? source.find((r) => r && typeof r === 'object') : null;
    const record = Array.isArray(source)
        ? (first || null)
        : (source && typeof source === 'object' ? source : null);
    // No configured fields → show the record's own keys (bounded like the spec).
    const rows = fields.length
        ? fields
        : Object.keys(record || {}).slice(0, 20).map((key) => ({ key, label: key }));

    if (!record || rows.length === 0) return <EmptyText text={emptyText} />;

    const size = node.style?.size || 'md';
    return (
        <dl className={`flex flex-col ${size === 'sm' ? 'text-xs gap-1' : 'text-sm gap-1.5'}`}>
            {rows.map((field) => (
                <div key={field.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {field.label || field.key}
                    </dt>
                    <dd className="text-right break-words min-w-0">{displayValue(walkPath(record, field.key))}</dd>
                </div>
            ))}
        </dl>
    );
}
