import { GraduationCap, Search, RefreshCw, Award, ScrollText, Users as UsersIcon, Activity } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCan } from '../../components/Gate';
import Tabs from '../../components/shared/Tabs';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import AcademyContentEditor from './learning/admin/AcademyContentEditor';

/**
 * OrgAcademyPanel — org-admin Academy hub. The Overview tab is the team
 * learning progress view: who completed which courses, earned which badges,
 * and holds which certificates. Read-only (data comes from
 * GET /ai/learning/org-overview, a 60s-cached server aggregation);
 * certificates show level + issue date only, never serials.
 *
 * When the org has the Academy Custom Courses beta (`learning_custom_content`)
 * a second Content tab exposes the course authoring surface
 * (AcademyContentEditor).
 */

const TableSkeleton = () => (
    <div className="animate-pulse space-y-2 p-5">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg" style={{ background: 'var(--bg-tertiary)' }} />
        ))}
    </div>
);

function relativeTime(iso, t) {
    if (!iso) return t('org.academy.never', 'Not started');
    const diffMs = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diffMs / 86_400_000);
    if (days <= 0) return t('org.academy.today', 'Today');
    if (days === 1) return t('org.academy.yesterday', 'Yesterday');
    if (days < 30) return t('org.academy.days_ago', '{n} days ago').replace('{n}', String(days));
    const months = Math.floor(days / 30);
    if (months < 12) return t('org.academy.months_ago', '{n}mo ago').replace('{n}', String(months));
    return new Date(iso).toLocaleDateString();
}

const StatCard = ({ icon: Icon, label, value, accent }) => (
    <div className="rounded-xl border p-4 flex items-center gap-3"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
        </div>
        <div className="min-w-0">
            <div className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{value}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
        </div>
    </div>
);

const MemberAvatar = ({ m }) => {
    if (m.avatarType === 'emoji' && m.avatar) {
        return <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-lg shrink-0">{m.avatar}</div>;
    }
    if (m.avatar && (m.avatarType === 'image' || m.avatarType === 'url' || m.avatar.startsWith('http') || m.avatar.startsWith('/'))) {
        return <img src={m.avatar.startsWith('/') ? `${API_BASE}${m.avatar}` : m.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />;
    }
    return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(m.displayName || '?')[0].toUpperCase()}
        </div>
    );
};

function OrgAcademyOverview() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [courseFilter, setCourseFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/learning/org-overview`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (_) {
            setError(t('org.academy.load_failed', 'Could not load the learning overview.'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    const members = useMemo(() => {
        let rows = data?.members || [];
        const q = query.trim().toLowerCase();
        if (q) {
            rows = rows.filter((m) =>
                (m.displayName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
        }
        if (courseFilter) rows = rows.filter((m) => (m.coursesDone || []).includes(courseFilter));
        // Most recently active first; never-started members sink to the bottom.
        return [...rows].sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
    }, [data, query, courseFilter]);

    const courses = data?.courses || [];
    const totals = data?.totals || {};

    return (
        <div>
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('settings.academy', 'Academy')}
                        </h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t('org.academy.subtitle', 'Course progress, badges and certificates across your team.')}
                    </p>
                </div>
                <button onClick={load} disabled={loading}
                    className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}
                    title={t('org.academy.refresh', 'Refresh')}>
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {t('org.academy.refresh', 'Refresh')}
                </button>
            </div>

            {error && (
                <div className="rounded-xl border p-6 text-sm text-center mb-4"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    {error}
                </div>
            )}

            {!error && (
                <>
                    {/* Totals */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <StatCard icon={UsersIcon} accent="#3b82f6"
                            label={t('org.academy.members', 'Members')} value={totals.members ?? '—'} />
                        <StatCard icon={Award} accent="#059669"
                            label={t('org.academy.courses_completed', 'Courses completed')} value={totals.coursesCompleted ?? '—'} />
                        <StatCard icon={ScrollText} accent="#f59e0b"
                            label={t('org.academy.certificates', 'Certificates issued')} value={totals.certificatesIssued ?? '—'} />
                        <StatCard icon={Activity} accent="#0ea5e9"
                            label={t('org.academy.active_30d', 'Active last 30 days')} value={totals.activeLast30d ?? '—'} />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('org.academy.search', 'Search members…')}
                                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)]"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                        </div>
                        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
                            className="px-3 py-2 rounded-lg border text-sm outline-none"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            <option value="">{t('org.academy.all_courses', 'All courses')}</option>
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>{t('org.academy.completed_prefix', 'Completed:')} {c.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Member table */}
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        {loading && !data ? (
                            <TableSkeleton />
                        ) : members.length === 0 ? (
                            <div className="p-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                                {query || courseFilter
                                    ? t('org.academy.no_matches', 'No members match the current filters.')
                                    : t('org.academy.empty', 'No learning activity in your organisation yet.')}
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-subtle)]">
                                {/* Header row */}
                                <div className="px-5 py-2 hidden md:flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wide"
                                    style={{ color: 'var(--text-muted)' }}>
                                    <span className="w-9" />
                                    <span className="flex-1">{t('org.academy.col_member', 'Member')}</span>
                                    <span className="w-36">{t('org.academy.col_courses', 'Courses')}</span>
                                    <span className="w-16 text-center">{t('org.academy.col_badges', 'Badges')}</span>
                                    <span className="w-44">{t('org.academy.col_certs', 'Certificates')}</span>
                                    <span className="w-24 text-right">{t('org.academy.col_activity', 'Last activity')}</span>
                                </div>
                                {members.map((m) => (
                                    <div key={m.userId} className="px-5 py-3 flex items-center gap-4 flex-wrap md:flex-nowrap hover:bg-[var(--bg-secondary)] transition-colors">
                                        <MemberAvatar m={m} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.displayName}</div>
                                            {m.email && <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>}
                                        </div>
                                        {/* Course completion dots */}
                                        <div className="w-36 flex items-center gap-1.5 flex-shrink-0" aria-label={t('org.academy.col_courses', 'Courses')}>
                                            {courses.map((c) => {
                                                const done = (m.coursesDone || []).includes(c.id);
                                                return (
                                                    <span key={c.id} title={`${c.title}${done ? ' ✓' : ''}`}
                                                        className="w-2.5 h-2.5 rounded-full inline-block"
                                                        style={{
                                                            background: done ? '#059669' : 'transparent',
                                                            border: done ? 'none' : '1.5px solid var(--border-default)',
                                                        }} />
                                                );
                                            })}
                                            <span className="text-[11px] ml-1" style={{ color: 'var(--text-muted)' }}>
                                                {(m.coursesDone || []).length}/{courses.length}
                                            </span>
                                        </div>
                                        {/* Badges */}
                                        <div className="w-16 text-center text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                            {(m.badges || []).length > 0 ? `🏅 ${m.badges.length}` : '—'}
                                        </div>
                                        {/* Certificates */}
                                        <div className="w-44 flex items-center gap-1 flex-wrap flex-shrink-0">
                                            {(m.certificates || []).length === 0 ? (
                                                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                                            ) : m.certificates.map((cert) => (
                                                <span key={cert.certificateId}
                                                    title={cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : ''}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                    style={{ background: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#b45309' }}>
                                                    📜 {cert.level || cert.certificateId}
                                                </span>
                                            ))}
                                        </div>
                                        {/* Last activity */}
                                        <div className="w-24 text-right text-[12px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                            {relativeTime(m.lastActivity, t)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default function OrgAcademyPanel() {
    const { t } = useTranslation();
    const canAuthor = useCan('learning_custom_content');
    const [tab, setTab] = useState('overview');

    // No custom-content beta → exactly the original overview, no tab chrome.
    if (!canAuthor) return <OrgAcademyOverview />;

    return (
        <div>
            <Tabs
                value={tab}
                onChange={setTab}
                ariaLabel={t('settings.academy', 'Academy')}
                className="mb-4"
                items={[
                    { id: 'overview', label: t('org.academy.tab_overview', 'Overview') },
                    { id: 'content', label: t('org.academy.tab_content', 'Content') },
                ]}
            />
            {tab === 'overview' ? <OrgAcademyOverview /> : <AcademyContentEditor />}
        </div>
    );
}
