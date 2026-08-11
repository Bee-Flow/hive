import { AlertCircle, ExternalLink, LayoutGrid } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { studioAppsApi } from '../../components/admin/Studio/AppStudio/studioAppsApi';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/shared/EmptyState';

/**
 * AppsHomePage — the consumer directory at /app/apps.
 *
 * A gallery of every PUBLISHED app the signed-in user can open: the apps shared
 * with them (studioAppsApi.listAccessible, which the server already filters to
 * published + audience-matched) plus their own published apps
 * (studioAppsApi.listMine, filtered to published here). Tiles link to the
 * standalone run view at /app/apps/:id (AppRunPage). This is the end-user
 * surface — no editor chrome, no create/rename/delete.
 *
 * The card visual mirrors AppList's shared-card style (soft accent tile + name
 * + description) so an app looks the same wherever it is listed.
 */

// Matches AppList / APP_COLOR_PRESETS[0] (teal).
const DEFAULT_ACCENT = '#0F766E';

// `${hex}1a` = ~10% alpha soft tint — same trick AppList uses.
function accentTile(accentColor) {
    const accent = /^#[0-9a-fA-F]{6}$/.test(accentColor || '') ? accentColor : DEFAULT_ACCENT;
    return { background: `${accent}1a`, color: accent };
}

const CARD_CLASSES = 'group relative rounded-xl border p-3.5 transition-all hover:shadow-md text-left block no-underline';
const CARD_STYLE = { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' };
const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

const isPublished = (a) => !!(a?.isPublished ?? a?.is_published);

function AppCard({ app }) {
    return (
        <a href={`/app/apps/${app.id}`} className={CARD_CLASSES} style={CARD_STYLE}>
            <div className="flex items-start gap-2.5">
                <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={accentTile(app.accentColor)}
                >
                    <AppIcon name={app.icon || 'LayoutGrid'} className="w-4.5 h-4.5" />
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {app.name || 'Untitled app'}
                    </div>
                    {app.description ? (
                        <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {app.description}
                        </div>
                    ) : null}
                </div>
            </div>
            <span
                className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
            >
                Open <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </span>
        </a>
    );
}

function SkeletonGrid() {
    return (
        <div className={GRID_CLASSES} role="status" aria-label="Loading apps">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${CARD_CLASSES} animate-pulse`} style={CARD_STYLE}>
                    <div className="flex items-start gap-2.5">
                        <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--bg-secondary)' }} />
                        <div className="flex-1 pt-0.5">
                            <div className="h-3.5 w-2/3 rounded mb-2" style={{ background: 'var(--bg-secondary)' }} />
                            <div className="h-2.5 w-full rounded" style={{ background: 'var(--bg-secondary)' }} />
                        </div>
                    </div>
                </div>
            ))}
            <span className="sr-only">Loading…</span>
        </div>
    );
}

export default function AppsHomePage() {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [accessible, mine] = await Promise.all([
                studioAppsApi.listAccessible(),
                studioAppsApi.listMine(),
            ]);
            // listAccessible is already published-only server-side; filter
            // defensively. listMine holds drafts too, so keep only published.
            const shared = (accessible?.apps || []).filter(isPublished);
            const ownedPublished = (mine?.apps || []).filter(isPublished);
            // Dedupe by id (an owned app can also appear in accessible).
            const byId = new Map();
            for (const a of [...shared, ...ownedPublished]) {
                if (a?.id && !byId.has(a.id)) byId.set(a.id, a);
            }
            const merged = [...byId.values()].sort(
                (a, b) => new Date(b.updatedAt || b.publishedAt || 0) - new Date(a.updatedAt || a.publishedAt || 0),
            );
            setApps(merged);
        } catch (err) {
            setError(err?.message || 'Could not load your apps.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const isEmpty = !loading && !error && apps.length === 0;

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
            {/* Toolbar */}
            <div
                className="shrink-0 px-4 py-3 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <LayoutGrid className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Apps</h1>
                </div>
            </div>

            {error && (
                <div
                    className="shrink-0 px-4 py-2 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#991b1b' }}
                    role="alert"
                >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                    <button type="button" onClick={load} className="ml-auto underline font-medium">Retry</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <SkeletonGrid />
                ) : isEmpty ? (
                    <EmptyState
                        icon={<LayoutGrid className="w-12 h-12" />}
                        title="No apps yet"
                        description="No apps have been shared with you yet. When someone in your organization publishes an internal tool to you, it will appear here."
                    />
                ) : (
                    <div className={GRID_CLASSES}>
                        {apps.map((app) => <AppCard key={app.id} app={app} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
