import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { ShieldCheck, Scale, Bot, Settings as SettingsIcon } from 'lucide-react';
import OverviewPage from './OverviewPage';
import ChecksPage from './ChecksPage';
import SettingsPage from './SettingsPage';
import OnboardingWizard from './OnboardingWizard';

const API = (import.meta.env.VITE_API_URL || '') + '/api/compliance';
const OPTS = { credentials: 'include' };

const SECTIONS = [
    { id: 'overview', labelKey: 'compliance.nav_overview', icon: ShieldCheck, color: '#10b981' },
    { id: 'gdpr', labelKey: 'compliance.nav_gdpr', icon: Scale, color: '#3b82f6' },
    { id: 'aia', labelKey: 'compliance.nav_aia', icon: Bot, color: '#8b5cf6' },
    { id: 'settings', labelKey: 'compliance.nav_settings', icon: SettingsIcon, color: '#f59e0b' },
];

async function fetchJson(url, init) {
    const r = await fetch(url, { ...OPTS, ...(init || {}) });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

export default function ComplianceHub({ activeSection = 'overview', onNavigate }) {
    const { t } = useTranslation();
    const VALID = SECTIONS.map(s => s.id);
    const active = VALID.includes(activeSection) ? activeSection : 'overview';

    const [overview, setOverview] = useState(null);
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [rerunningId, setRerunningId] = useState(null);
    const [showWizard, setShowWizard] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const [o, c] = await Promise.all([
                fetchJson(`${API}/overview`),
                fetchJson(`${API}/checks`),
            ]);
            setOverview(o);
            setChecks(Array.isArray(c) ? c : []);
            if (!o?.onboarded) setShowWizard(true);
        } catch (e) {
            console.error('[ComplianceHub] refresh error:', e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const handleRunNow = async () => {
        setRunning(true);
        try {
            await fetchJson(`${API}/checks/run`, { method: 'POST' });
            await refresh();
        } catch (e) {
            console.error('[ComplianceHub] run error:', e.message);
        } finally { setRunning(false); }
    };

    const handleRerun = async (checkId) => {
        setRerunningId(checkId);
        try {
            await fetchJson(`${API}/checks/${encodeURIComponent(checkId)}/run`, { method: 'POST' });
            await refresh();
        } catch (e) {
            console.error('[ComplianceHub] rerun error:', e.message);
        } finally { setRerunningId(null); }
    };

    const handleSaveSettings = async (body) => {
        const saved = await fetchJson(`${API}/settings`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        await refresh();
        return saved;
    };

    const handleFinishWizard = async (body) => {
        await fetchJson(`${API}/settings/onboarded`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        setShowWizard(false);
        await refresh();
    };

    const handleSectionClick = (id) => {
        if (onNavigate) onNavigate(`admin/compliance/${id}`);
    };

    return (
        <div style={styles.container}>
            {/* Sidebar */}
            <div style={styles.sidebar}>
                {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button key={sec.id}
                            onClick={() => handleSectionClick(sec.id)}
                            title={t(sec.labelKey)}
                            style={{
                                ...styles.navBtn,
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}>
                            <Icon style={{
                                width: 20, height: 20,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                            }} />
                            <span style={{
                                fontSize: 9, fontWeight: isActive ? 700 : 500,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center', lineHeight: 1.1,
                            }}>{t(sec.labelKey)}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main */}
            <div style={styles.main}>
                <div style={styles.topBar}>
                    <div>
                        <h2 style={styles.pageTitle}>{t(SECTIONS.find(s => s.id === active)?.labelKey)}</h2>
                        <p style={styles.pageDesc}>{t(`compliance.nav_${active}_desc`)}</p>
                    </div>
                </div>
                <div style={styles.content}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #888)' }}>{t('compliance.loading')}</div>
                    ) : !overview?.onboarded && !showWizard && active !== 'settings' ? (
                        <div style={banner}>
                            <div>
                                <strong style={{ fontSize: 14, color: 'var(--text-primary, #fff)' }}>{t('compliance.banner_onboard_title')}</strong>
                                <div style={{ fontSize: 12, color: 'var(--text-muted, #aaa)', marginTop: 4 }}>{t('compliance.banner_onboard_desc')}</div>
                            </div>
                            <button onClick={() => setShowWizard(true)} style={{
                                background: '#10b981', color: '#fff', border: 'none',
                                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                            }}>{t('compliance.start_wizard')}</button>
                        </div>
                    ) : null}

                    {active === 'overview' && (
                        <OverviewPage overview={overview} checks={checks}
                            running={running}
                            onRunNow={handleRunNow} onNavigate={onNavigate} />
                    )}
                    {active === 'gdpr' && (
                        <ChecksPage checks={checks} regulation="GDPR"
                            onNavigate={onNavigate} onRerun={handleRerun} rerunningId={rerunningId} />
                    )}
                    {active === 'aia' && (
                        <ChecksPage checks={checks} regulation="AIA"
                            onNavigate={onNavigate} onRerun={handleRerun} rerunningId={rerunningId} />
                    )}
                    {active === 'settings' && overview && (
                        <SettingsPage settings={overview.settings} onSave={handleSaveSettings} />
                    )}
                </div>
            </div>

            {showWizard && (
                <OnboardingWizard
                    initialSettings={overview?.settings}
                    onFinish={handleFinishWizard}
                    onSkip={() => setShowWizard(false)}
                />
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

const styles = {
    container: { display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-family, Inter, sans-serif)' },
    sidebar: {
        width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2,
        padding: '8px 0',
        background: 'var(--bg-secondary, #111)',
        borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
    },
    navBtn: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '10px 4px', margin: '0 4px',
        borderRadius: 8, border: 'none',
        cursor: 'pointer', transition: 'all 0.15s',
    },
    main: {
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'var(--bg-primary, #0f0f1a)',
    },
    topBar: {
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.06))',
        flexShrink: 0,
    },
    pageTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #fff)', margin: 0 },
    pageDesc: { fontSize: 12, color: 'var(--text-muted, #888)', margin: '2px 0 0', fontWeight: 400 },
    content: { flex: 1, overflow: 'auto', padding: '20px 24px' },
};

const banner = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid #10b98133',
    borderLeft: '4px solid #10b981',
    borderRadius: 10, padding: 16, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
};
