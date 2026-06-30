import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * Lead Studio enrichment providers — global API keys for the data sources the
 * Lead Studio campaign agent uses beyond the always-on web search. Each key is
 * stored as a global secret (per-org overrides live under org_<id>_* but the UI
 * for those is out of scope); the Lead Studio campaign modal greys a provider
 * until its key is present here.
 */

const PROVIDERS = [
    { key: 'kvkApiKey', has: 'hasKvkKey', label: 'KvK Open Data', field: 'kvk_api_key',
      desc: 'Official NL company registry — fills KvK number, legal name, address, SBI codes.',
      help: 'developers.kvk.nl', helpUrl: 'https://developers.kvk.nl/' },
    { key: 'hunterApiKey', has: 'hasHunterKey', label: 'Hunter.io', field: 'hunter_api_key',
      desc: 'Email (and sometimes phone) for a company domain. Primary email source.',
      help: 'hunter.io/api-keys', helpUrl: 'https://hunter.io/api-keys' },
    { key: 'apolloApiKey', has: 'hasApolloKey', label: 'Apollo.io', field: 'apollo_api_key',
      desc: 'B2B contact intelligence — finds the owner/decision-maker with title, email, phone and LinkedIn for a company. Use a master key with the People Search + People Enrichment scopes.',
      help: 'developer.apollo.io/keys', helpUrl: 'https://developer.apollo.io/keys' },
    { key: 'apifyToken', has: 'hasApifyToken', label: 'LinkedIn (Apify)', field: 'apify_token',
      desc: 'Owner/director profile via an Apify LinkedIn actor. Opt-in per campaign — costly + ToS-sensitive.',
      help: 'console.apify.com', helpUrl: 'https://console.apify.com/account/integrations' },
];

export default function LeadEnrichmentConfig({ onMessage }) {
    const { t } = useTranslation();
    const [status, setStatus] = useState({});
    const [values, setValues] = useState({});
    const [actor, setActor] = useState('');
    const [saving, setSaving] = useState({});

    const load = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const d = await res.json();
                setStatus(d);
                setActor(d.apifyLinkedinActor || '');
            }
        } catch (_) { /* ignore */ }
    };
    useEffect(() => { load(); }, []);

    const save = async (provider) => {
        const val = values[provider.key];
        if (val == null) return;
        setSaving(s => ({ ...s, [provider.key]: true }));
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [provider.key]: val }),
            });
            if (res.ok) {
                onMessage?.({ type: 'success', text: `${provider.label} ${t('admin.lead_enrich.saved', 'key saved')}` });
                setValues(v => ({ ...v, [provider.key]: undefined }));
                await load();
            } else {
                onMessage?.({ type: 'error', text: `${t('admin.lead_enrich.save_failed', 'Failed to save')} ${provider.label}` });
            }
        } catch (_) {
            onMessage?.({ type: 'error', text: `${t('admin.lead_enrich.save_failed', 'Failed to save')} ${provider.label}` });
        } finally {
            setSaving(s => ({ ...s, [provider.key]: false }));
        }
    };

    const saveActor = async () => {
        setSaving(s => ({ ...s, _actor: true }));
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apifyLinkedinActor: actor }),
            });
            if (res.ok) { onMessage?.({ type: 'success', text: t('admin.lead_enrich.actor_saved', 'Apify actor saved') }); await load(); }
        } catch (_) { /* ignore */ } finally { setSaving(s => ({ ...s, _actor: false })); }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border p-4 text-xs leading-relaxed" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {t('admin.lead_enrich.intro', 'Configure the data sources the Lead Studio agent uses to enrich leads. Web search is always on. These keys are optional — each provider is skipped gracefully when its key is missing, and providers appear in the Lead Studio campaign dialog once configured here.')}
            </div>

            {PROVIDERS.map(p => (
                <div key={p.key} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.label}</span>
                        {status[p.has] && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                {t('admin.lead_enrich.configured', 'Configured')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{p.desc}</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={values[p.key] ?? ''}
                            onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                            placeholder={status[p.has] ? '••••••••••••  (' + t('admin.lead_enrich.replace', 'enter a new key to replace') + ')' : t('admin.lead_enrich.enter_key', 'Enter API key')}
                            className="flex-1 px-3 py-2 text-sm rounded border"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <button
                            onClick={() => save(p)}
                            disabled={values[p.key] == null || values[p.key] === '' || saving[p.key]}
                            className="px-3 py-2 text-sm rounded font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {saving[p.key] ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                        </button>
                    </div>
                    <a href={p.helpUrl} target="_blank" rel="noreferrer" className="text-[11px] mt-1 inline-block" style={{ color: 'var(--text-muted)' }}>
                        {t('admin.lead_enrich.get_key', 'Get your key from')} {p.help}
                    </a>
                    {p.key === 'apifyToken' && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                                {t('admin.lead_enrich.apify_actor', 'Apify actor id (optional)')}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    value={actor}
                                    onChange={e => setActor(e.target.value)}
                                    placeholder="apify~linkedin-company-scraper"
                                    className="flex-1 px-3 py-2 text-sm rounded border"
                                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                />
                                <button onClick={saveActor} disabled={saving._actor}
                                    className="px-3 py-2 text-sm rounded font-medium disabled:opacity-50"
                                    style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                                    {saving._actor ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
