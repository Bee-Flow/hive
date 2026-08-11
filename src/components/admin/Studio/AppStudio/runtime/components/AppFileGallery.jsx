import { File, FileImage, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { isFill } from '../styleResolver';
import { EmptyText, ErrorText, Skeleton } from '../uiBits';
import { firstDescriptor } from './AppFilePreview';

/**
 * App Studio runtime — 'file_gallery'. Spec: server/appStudio/componentSpecs.js.
 *
 * Attachments as cards instead of as a list of blue filenames. Every app with a
 * `file` column was building this by hand out of a `list`, which meant no type
 * icon, no size, and no way to tell a drawing from a signature image without
 * opening both.
 *
 * NO BYTES ARE FETCHED HERE. A mailbox attachment is a pending descriptor
 * pointing at the provider, and redeeming one costs a provider round-trip — a
 * grid of twelve cards would fire twelve of them on mount, for thumbnails
 * nobody asked for. So the card shows a type icon, and file_preview (wired via
 * onRowClick) redeems exactly the one file someone chose to look at.
 */

const ICON_BY_KIND = [
    [/^image\//i, FileImage],
    [/pdf/i, FileText],
    [/(sheet|excel|csv)/i, FileSpreadsheet],
    [/(presentation|powerpoint)/i, Presentation],
    [/(word|document|text|rtf)/i, FileText],
];

export function iconForMime(mime) {
    const s = String(mime || '');
    for (const [re, Icon] of ICON_BY_KIND) if (re.test(s)) return Icon;
    return File;
}

/** Human file size; a missing or nonsense value renders nothing at all. */
export function formatBytes(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const units = ['B', 'kB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export default function AppFileGallery({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        fileKey = 'file',
        titleKey = 'filename',
        subtitleKey = null,
        sizeKey = null,
        columns = 3,
        rowLimit = 24,
        emptyText = 'No files yet.',
    } = node.props || {};
    const { value, isLoading, error, errorCode } = resolveBinding(node.props?.source, { actionState, dataState, scope });

    // isFill takes the NODE — passing the height string meant this was always
    // false, so the height knob the inspector offers did nothing at all.
    const fill = isFill(node);
    // min-h-0 is what lets a flex child actually scroll rather than growing
    // past its pane; app-fill is the class the fill contract is checked on.
    const wrapper = `w-full min-w-0${fill ? ' app-fill h-full min-h-0 overflow-auto' : ''}`;

    if (error) return <ErrorText error={error} errorCode={errorCode} />;
    if (isLoading) {
        return (
            <div className={wrapper}>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: Math.min(columns * 2, 6) }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    const rows = (Array.isArray(value) ? value : []).slice(0, rowLimit);
    if (rows.length === 0) return <EmptyText art="no-files" title="No files here" text={emptyText} />;

    const clickable = mode === 'run' && !!node.onRowClick;

    return (
        <div className={wrapper} data-app-file-gallery="true">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {rows.map((row, i) => {
                    const descriptor = firstDescriptor(row?.[fileKey]);
                    const mime = (descriptor && typeof descriptor === 'object' ? descriptor.mimeType || descriptor.type : null)
                        || (subtitleKey ? row?.[subtitleKey] : null)
                        || row?.mime_type;
                    const Icon = iconForMime(mime);
                    const name = row?.[titleKey]
                        || (descriptor && typeof descriptor === 'object' ? descriptor.name : null)
                        || 'File';
                    const size = formatBytes(sizeKey ? row?.[sizeKey] : row?.size);
                    const meta = [subtitleKey ? row?.[subtitleKey] : mime, size].filter(Boolean).join(' · ');

                    const card = (
                        <>
                            <span className="app-file-card-icon shrink-0" aria-hidden="true">
                                <Icon className="w-5 h-5" />
                            </span>
                            <span className="min-w-0 text-left">
                                <span className="block text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {name}
                                </span>
                                {meta ? (
                                    <span className="block text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                                        {meta}
                                    </span>
                                ) : null}
                            </span>
                        </>
                    );

                    return clickable ? (
                        <button
                            key={row?.id || i}
                            type="button"
                            onClick={() => runAction(node.onRowClick, { formValues: row })}
                            className="app-file-card flex items-center gap-2.5 rounded-lg border p-2.5 text-left min-w-0"
                            title={name}
                        >
                            {card}
                        </button>
                    ) : (
                        <div
                            key={row?.id || i}
                            className="app-file-card flex items-center gap-2.5 rounded-lg border p-2.5 min-w-0"
                            title={name}
                        >
                            {card}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
