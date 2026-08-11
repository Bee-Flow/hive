import React, { useState } from 'react';
import { Plug, PlugZap, RefreshCw, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';

/**
 * ISO evidence connectors — couple external systems (code hosting, cloud,
 * identity, monitoring) for automatic evidence collection. Credentials live in
 * the integration-connections vault; a connector only references one. Sweeps
 * run every 6 hours plus on demand; a changed snapshot re-runs the linked
 * checks immediately (CONTROL_DRIFT).
 */
export default function ConnectorsPage({ connectors, busyId, onSave, onSweep, onLoadConnections }) {
    const { t } = useTranslation();
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [connections, setConnections] = useState([]);
    const [settingsError, setSettingsError] = useState(false);

    if (connectors === null) return <CheckCardSkeleton count={3} />;

    const open = async (c) => {
        if (openId === c.id) { setOpenId(null); setDraft(null); return; }
        setOpenId(c.id);
        setSettingsError(false);
        setDraft({
            enabled: !!c.config?.enabled,
            connection_id: c.config?.connection_id || '',
            settingsText: JSON.stringify(c.config?.settings || {}, null, 2),
        });
        setConnections(c.credential ? await onLoadConnections(c.id) : []);
    };

    const save = (c) => {
        let settings;
        try { settings = JSON.parse(draft.settingsText || '{}'); }
        catch { setSettingsError(true); return; }
        setSettingsError(false);
        onSave(c.id, {
            enabled: draft.enabled,
            connection_id: draft.connection_id || null,
            settings,
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {connectors.map(c => {
                const cfg = c.config;
                const isOpen = openId === c.id;
                const ok = cfg?.last_status === 'ok';
                return (
                    <div key={c.id} style={box}>
                        <div onClick={() => open(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
                            {cfg?.enabled
                                ? <PlugZap size={16} style={{ color: ok ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
                                : <Plug size={16} style={{ color: 'var(--text-muted, #777)', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                    {t(c.titleKey)}
                                    {!c.credential && <span style={{ ...pill('#0ea5e9'), marginLeft: 8 }}>{t('compliance.conn_no_credential')}</span>}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #999)', marginTop: 2 }}>{t(c.descKey)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {(c.covered_controls || []).map(ref => <span key={ref} style={pill('#8b5cf6')}>{ref}</span>)}
                            </div>
                            {cfg?.enabled && (
                                <span style={{ fontSize: 11, color: ok ? '#10b981' : cfg?.last_status === 'error' ? '#ef4444' : 'var(--text-muted, #888)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {ok ? <CheckCircle2 size={12} /> : cfg?.last_status === 'error' ? <AlertTriangle size={12} /> : null}
                                    {cfg?.last_sweep_at
                                        ? (t('compliance.conn_last_sweep', { date: new Date(cfg.last_sweep_at).toLocaleString() }, null) || `Swept ${new Date(cfg.last_sweep_at).toLocaleString()}`)
                                        : t('compliance.conn_never_swept')}
                                </span>
                            )}
                        </div>

                        {isOpen && draft && (
                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
                                {cfg?.last_error && (
                                    <div style={{ fontSize: 11.5, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={12} /> {cfg.last_error}
                                    </div>
                                )}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary, #eee)' }}>
                                    <input type="checkbox" checked={draft.enabled}
                                        onChange={e => setDraft(d => ({ ...d, enabled: e.target.checked }))} />
                                    {t('compliance.conn_enabled')}
                                </label>
                                {c.credential && (
                                    <label style={fieldLabel}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <KeyRound size={11} /> {t('compliance.conn_connection')}
                                        </span>
                                        <select value={draft.connection_id}
                                            onChange={e => setDraft(d => ({ ...d, connection_id: e.target.value }))}
                                            style={input}>
                                            <option value="">{t('compliance.conn_connection_none')}</option>
                                            {connections.map(conn => (
                                                <option key={conn.id} value={conn.id}>{conn.label || conn.id} ({conn.kind})</option>
                                            ))}
                                        </select>
                                        <span style={{ fontSize: 10.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted, #888)' }}>
                                            {t('compliance.conn_connection_hint', { provider: c.credential.provider }, null)
                                                || `Create a "${c.credential.provider}" connection under Integrations first.`}
                                        </span>
                                    </label>
                                )}
                                <label style={fieldLabel}>
                                    {t('compliance.conn_settings')}
                                    <textarea value={draft.settingsText} rows={4} spellCheck={false}
                                        placeholder={c.settings_hint ? `{ ${c.settings_hint} }` : '{}'}
                                        onChange={e => setDraft(d => ({ ...d, settingsText: e.target.value }))}
                                        style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 11.5, borderColor: settingsError ? '#ef4444' : undefined }} />
                                    {settingsError && <span style={{ color: '#ef4444', fontSize: 10.5, textTransform: 'none', letterSpacing: 0 }}>{t('compliance.conn_settings_invalid')}</span>}
                                </label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button onClick={() => save(c)} disabled={busyId === c.id} style={primaryBtn}>
                                        <CheckCircle2 size={14} /> {t('compliance.conn_save')}
                                    </button>
                                    {cfg?.enabled && (
                                        <button onClick={() => onSweep(c.id)} disabled={busyId === c.id} style={secondaryBtn}>
                                            <RefreshCw size={14} /> {t('compliance.conn_sweep_now')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const box = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
};
const pill = (color) => ({
    fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
    background: `${color}22`, color, whiteSpace: 'nowrap',
});
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#10b981', color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const secondaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: 'var(--text-secondary, #bbb)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const fieldLabel = {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--text-muted, #888)',
};
const input = {
    background: 'var(--bg-card, #ffffff08)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #eee)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
