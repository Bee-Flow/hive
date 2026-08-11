/**
 * Website Analytics dashboard shell.
 *
 * Owns the cross-cutting state every section shares — selected site, date
 * range, drill-down filters — and routes between sections. Sections do their
 * own fetching through useAnalyticsQuery so a slow report never blocks the
 * rest of the page.
 *
 * Section + range + filters are mirrored into the query string so a view is
 * shareable. Query params (not path segments) because AdminDashboard routes on
 * the pathname and would not recognise /website-analytics/<section>.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3, Activity, FileText, Share2, Users, Zap, Gauge,
    Filter, X, RefreshCw, Settings, Loader2, Flame, GitBranch, Video,
} from 'lucide-react';
import { analyticsApi, analyticsFetch } from '../analyticsApi';
import { useUrlQueryParam } from '../../../../hooks/useUrlTab';
import { AnalyticsStyles, ACCENT, ErrorNote } from './ui';
import { decodeFilters, encodeFilters, filterLabel, withFilter, withoutFilter } from './filters';
import RangeControl, { defaultRange } from '../../../../pages/settings/usage/RangeControl';
import OverviewSection from './sections/OverviewSection';
import RealtimeSection from './sections/RealtimeSection';
import PerformanceSection from './sections/PerformanceSection';
import PagesSection from './sections/PagesSection';
import SourcesSection from './sections/SourcesSection';
import AudienceSection from './sections/AudienceSection';
import EventsSection from './sections/EventsSection';
import BehaviorSection from './sections/BehaviorSection';
import HeatmapSection from './sections/HeatmapSection';
import ReplaysSection from './sections/ReplaysSection';
import SettingsSection from './sections/SettingsSection';

const TZ = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

/**
 * Section registry.
 *
 * `rangeless` / `filterless` are capability flags rather than id checks in the
 * shell: Realtime's endpoint is declared `window: false` server-side and takes
 * no filters, so rendering a date picker above it would promise something the
 * data cannot honour. `wide` gives the heatmap room for a page at its real
 * capture width.
 */
const SECTIONS = [
    { id: 'overview',    label: 'Overview',    icon: BarChart3,  Component: OverviewSection },
    { id: 'realtime',    label: 'Realtime',    icon: Activity,   Component: RealtimeSection, rangeless: true, filterless: true },
    { id: 'pages',       label: 'Pages',       icon: FileText,   Component: PagesSection },
    { id: 'sources',     label: 'Sources',     icon: Share2,     Component: SourcesSection },
    { id: 'audience',    label: 'Audience',    icon: Users,      Component: AudienceSection },
    { id: 'events',      label: 'Events',      icon: Zap,        Component: EventsSection },
    { id: 'performance', label: 'Performance', icon: Gauge,      Component: PerformanceSection },
    { id: 'behavior',    label: 'Behavior',    icon: GitBranch,  Component: BehaviorSection },
    { id: 'heatmap',     label: 'Heatmap',     icon: Flame,      Component: HeatmapSection, wide: true },
    { id: 'replays',     label: 'Sessions',    icon: Video,      Component: ReplaysSection },
];
const SECTION_IDS = SECTIONS.map(s => s.id);

/** Wide sections get room for a full-width page render beside its ranking. */
const activeSectionWidth = (id) => (SECTIONS.find(s => s.id === id)?.wide ? 1600 : 1280);

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * RangeControl's shape → the API's. `today` and `all` have no server-side
 * token, so they become absolute windows; the rest pass through as presets.
 */
export function toScopeRange(range) {
    const now = Date.now();
    switch (range?.preset) {
        case 'today': {
            const midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            return { range: 'custom', start: midnight.getTime(), end: now };
        }
        case 'all':
            return { range: 'custom', start: now - 3650 * MS_DAY, end: now };
        case 'custom': {
            const start = Date.parse(range.customStart);
            const end = Date.parse(range.customEnd);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
                return { range: '30d' };   // invalid pickers — fall back rather than 400
            }
            return { range: 'custom', start, end };
        }
        default:
            return { range: range?.preset || '7d' };
    }
}

export default function AnalyticsPanel() {
    const [settings, setSettings] = useState(null);
    const [sites, setSites] = useState([]);
    const [siteId, setSiteId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('dashboard');           // 'dashboard' | 'settings'
    const [reloadToken, setReloadToken] = useState(0);

    const [sectionParam, setSectionParam] = useUrlQueryParam('section');
    const [filterParam, setFilterParam] = useUrlQueryParam('f');
    const section = SECTION_IDS.includes(sectionParam) ? sectionParam : 'overview';

    const [range, setRange] = useState(() => defaultRange('7d'));
    const [filters, setFiltersState] = useState(() => decodeFilters(filterParam));

    // Functional updates, and the URL write moved into an effect: reading
    // `filters` from the closure meant two drills dispatched in one tick both
    // built on the same stale object, so the first one was silently lost.
    const drill = useCallback((key, value) => setFiltersState(f => withFilter(f, key, value)), []);
    const clearFilter = useCallback((key) => setFiltersState(f => withoutFilter(f, key)), []);

    useEffect(() => {
        setFilterParam(encodeFilters(filters) || null, { replace: true });
    }, [filters, setFilterParam]);

    const loadShell = useCallback(async () => {
        setLoading(true);
        try {
            const [s, sitesRes] = await Promise.all([
                analyticsFetch(analyticsApi.settings()),
                analyticsFetch(analyticsApi.sites()).catch(() => ({ sites: [] })),
            ]);
            setSettings(s);
            const list = sitesRes?.sites || [];
            setSites(list);
            setSiteId(prev => {
                if (prev && list.some(x => x.id === prev && x.tracked)) return prev;
                const live = list.find(x => x.live && x.tracked) || list.find(x => x.tracked);
                return live?.id || '';
            });
            if (!s?.enabled || !s?.configured) setView('settings');
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadShell(); }, [loadShell]);

    const scope = useMemo(() => ({
        siteId: siteId || undefined,
        timezone: TZ,
        filters,
        ...toScopeRange(range),
        // Bumping this remounts section queries on an explicit refresh.
        _token: reloadToken,
    }), [siteId, range, filters, reloadToken]);

    const trackedSites = sites.filter(s => s.tracked);
    const activeSite = sites.find(s => s.id === siteId) || null;
    const ready = !!settings?.enabled && !!settings?.configured;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    if (view === 'settings') {
        return (
            <SettingsSection
                settings={settings}
                sites={sites}
                // Stay put on save. Jumping to the dashboard the instant two
                // fields become non-empty ejects the operator mid-configuration,
                // before they have set the recorder or consent options.
                onSaved={setSettings}
                onSitesChanged={loadShell}
                onClose={ready ? () => setView('dashboard') : null}
            />
        );
    }

    const activeSection = SECTIONS.find(s => s.id === section) || SECTIONS[0];
    const Active = activeSection.Component;
    const provisioned = trackedSites.length > 0;
    const showControls = !activeSection.rangeless || !activeSection.filterless;

    return (
        <div className="absolute inset-0 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
            <AnalyticsStyles />
            <div style={{ maxWidth: activeSectionWidth(section), margin: '0 auto', padding: '24px 28px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${ACCENT}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 style={{ width: 18, height: 18, color: ACCENT }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>Website Analytics</h2>
                            <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: 0 }}>
                                Self-hosted, privacy-first usage tracking for your published site
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {trackedSites.length > 1 && (
                            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={selectStyle}>
                                {trackedSites.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}{s.live ? ' (live)' : ''}</option>
                                ))}
                            </select>
                        )}
                        <button onClick={() => setReloadToken(t => t + 1)} title="Refresh" style={iconBtnStyle}>
                            <RefreshCw style={{ width: 15, height: 15 }} />
                        </button>
                        <button onClick={() => setView('settings')} title="Analytics settings" style={iconBtnStyle}>
                            <Settings style={{ width: 15, height: 15 }} />
                        </button>
                    </div>
                </div>

                {error && <div style={{ marginBottom: 14 }}><ErrorNote message={error} onRetry={loadShell} /></div>}

                {!provisioned ? (
                    <div style={{ marginTop: 40, textAlign: 'center', color: 'var(--text-muted, #888)', fontSize: 13 }}>
                        No tracked site yet. Publish a CMS site (with analytics enabled) to start collecting visitor data.
                    </div>
                ) : (
                    <>
                        {/* Section nav */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingBottom: 8 }}>
                            {SECTIONS.map(s => {
                                const active = s.id === section;
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setSectionParam(s.id)}
                                        aria-current={active ? 'page' : undefined}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                                            border: '1px solid ' + (active ? `${ACCENT}66` : 'transparent'),
                                            background: active ? `${ACCENT}14` : 'transparent',
                                            color: active ? ACCENT : 'var(--text-muted, #888)',
                                            fontSize: 12, fontWeight: 700,
                                        }}
                                    >
                                        <Icon style={{ width: 13, height: 13 }} />
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Range + filters. Hidden entirely for a section that
                            honours neither — a control that changes nothing is
                            worse than no control. */}
                        {showControls && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                            {!activeSection.rangeless && <RangeControl range={range} onChange={setRange} />}
                            {!activeSection.filterless && Object.entries(filters).map(([k, v]) => (
                                <span key={k} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                                    borderRadius: 7, background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`,
                                    color: ACCENT, fontSize: 11, fontWeight: 700,
                                }}>
                                    <Filter style={{ width: 11, height: 11 }} />
                                    {filterLabel(k)}: {v}
                                    <button onClick={() => clearFilter(k)} aria-label={`Clear ${filterLabel(k)} filter`} style={{
                                        display: 'inline-flex', background: 'transparent', border: 'none',
                                        color: ACCENT, cursor: 'pointer', padding: 0,
                                    }}>
                                        <X style={{ width: 12, height: 12 }} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        )}

                        <Active
                            scope={scope}
                            site={activeSite}
                            settings={settings}
                            onDrill={drill}
                            onOpenSettings={() => setView('settings')}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

const selectStyle = {
    background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary, #fff)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))', borderRadius: 8,
    padding: '6px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
const iconBtnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
    borderRadius: 8, background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    color: 'var(--text-secondary, #aaa)', cursor: 'pointer',
};
