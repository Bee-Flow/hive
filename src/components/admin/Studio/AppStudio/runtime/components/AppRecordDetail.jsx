import renderInlineMarkdown from '../markdownInline';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { EM_DASH, EmptyText, ErrorText, SkeletonLines, displayValue , useStickyBinding } from '../uiBits';

/**
 * App Studio runtime — 'record_detail'. Spec: server/appStudio/componentSpecs.js.
 * Labeled fields of ONE record (typically a {kind:'record'} binding whose
 * filter reads screen.params — the read half of master→detail). An empty
 * `fields` list derives label/value rows from the record's own keys.
 */

const SYSTEM_KEYS = new Set(['id', 'created_at', 'updated_at', 'created_by']);

function isHttpUrl(value) {
    const v = String(value || '').trim().toLowerCase();
    return v.startsWith('https://') || v.startsWith('http://');
}

/** Format one field value — mirrors the data_grid cell formats + datetime/markdown. */
export function FieldValue({ value, format }) {
    if (value == null || value === '') return <span style={{ color: 'var(--text-muted)' }}>{EM_DASH}</span>;
    switch (format) {
        case 'number': {
            const n = Number(value);
            return <>{Number.isFinite(n) ? n.toLocaleString() : displayValue(value)}</>;
        }
        case 'date': {
            const d = new Date(value);
            return <>{Number.isNaN(d.getTime()) ? displayValue(value) : d.toLocaleDateString()}</>;
        }
        case 'datetime': {
            const d = new Date(value);
            return <>{Number.isNaN(d.getTime()) ? displayValue(value) : d.toLocaleString()}</>;
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
                    href={String(value)} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2" style={{ color: 'var(--app-primary)' }}
                >
                    {displayValue(value)}
                </a>
            );
        case 'markdown':
            return <>{renderInlineMarkdown(String(value))}</>;
        default:
            return <>{displayValue(value)}</>;
    }
}

export default function AppRecordDetail({ node }) {
    const { actionState, dataState, scope } = useRuntime();
    const { fields = [], columns = 2, emptyText = 'No record selected.' } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={4} />;

    // A record binding resolves to one row; tolerate a rows array by taking the first.
    const record = Array.isArray(source) ? source[0] : source;
    if (!record || typeof record !== 'object') return <EmptyText text={emptyText} />;

    const effFields = (Array.isArray(fields) && fields.length)
        ? fields.filter((f) => f && typeof f.key === 'string' && f.key)
        : Object.keys(record)
            .filter((k) => !SYSTEM_KEYS.has(k))
            .slice(0, 30)
            .map((key) => ({ key, label: key, format: 'text' }));

    if (effFields.length === 0) return <EmptyText text={emptyText} />;

    const cols = Number.isInteger(columns) ? Math.max(1, Math.min(3, columns)) : 2;

    return (
        <dl
            className="grid gap-x-6 gap-y-3"
            data-app-recorddetail="true"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {effFields.map((field, i) => (
                <div key={`${field.key}-${i}`} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {field.label || field.key}
                    </dt>
                    <dd className="text-sm mt-0.5 break-words" style={{ color: 'var(--text-primary)' }}>
                        <FieldValue value={walkPath(record, field.key)} format={field.format || 'text'} />
                    </dd>
                </div>
            ))}
        </dl>
    );
}
