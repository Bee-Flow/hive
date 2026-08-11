import AppIcon from '../../../../../AppIcon';

/**
 * Brand — the app's identity lockup, shared by both shell layouts (tabs top
 * bar, sidebar head, mobile bar). Icon tile + name by default; when the
 * design layer carries a logoUrl the image replaces the icon tile (the name
 * stays, truncated, so an icon-only logo still reads).
 */
export default function Brand({ definition }) {
    const meta = definition?.meta || {};
    const logoUrl = definition?.design?.logoUrl || null;
    return (
        <div className="flex items-center gap-2 py-2.5 min-w-0" data-app-brand="true">
            {logoUrl ? (
                <img src={logoUrl} alt={meta.name || 'App'} className="h-6 max-w-[120px] object-contain" />
            ) : (
                <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                    style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                >
                    <AppIcon name={meta.icon || 'LayoutGrid'} className="w-4 h-4" />
                </span>
            )}
            <span className="font-semibold text-sm truncate">{meta.name || 'App'}</span>
        </div>
    );
}
