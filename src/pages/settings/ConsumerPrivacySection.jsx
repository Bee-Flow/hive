import React, { useState, useEffect } from 'react';
import { Shield, Globe, Search, Save, Check } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Consumer Privacy Shield section.
 * Simplified user-level privacy controls for consumer accounts (no org).
 * Controls EU-only model routing and search-on-upload behaviour.
 */
const ConsumerPrivacySection = ({ user }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [config, setConfig] = useState({
        enabled: false,
        euModeEnabled: false,
        disableSearchOnUpload: false,
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/org-privacy-shield/user/me`);
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);
                }
            } catch (e) {
                console.error('[ConsumerPrivacy] fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await authFetch(`${API_BASE}/api/org-privacy-shield/user/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (e) {
            console.error('[ConsumerPrivacy] save error:', e);
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return (
        <div className="space-y-6 animate-pulse">
            <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
            <div className="h-40 bg-[var(--bg-tertiary)] rounded-2xl" />
        </div>
    );

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                        {t('settings.privacy_shield') || 'Privacy Shield'}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        Control data privacy and model routing for your account
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
                    style={{ background: saved ? '#10b981' : 'var(--accent-primary)' }}
                >
                    {saving ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : saved ? (
                        <Check className="w-4 h-4" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
                </button>
            </div>

            {/* Privacy Shield Toggle */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Enable Privacy Shield</p>
                            <p className="text-xs text-[var(--text-muted)]">
                                Activate privacy controls for your account
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={e => updateConfig('enabled', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {config.enabled && (
                    <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                        {/* EU Mode */}
                        <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)]">
                                    <Globe className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-[var(--text-primary)]">EU Data Residency</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Route all AI requests through EU-based model endpoints only
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.euModeEnabled}
                                    onChange={e => updateConfig('euModeEnabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                        </div>

                        {/* Disable Search on Upload */}
                        <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)]">
                                    <Search className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-[var(--text-primary)]">Disable Search on File Upload</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Prevent web searches when files are attached to conversations
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.disableSearchOnUpload}
                                    onChange={e => updateConfig('disableSearchOnUpload', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex gap-3">
                    <span className="text-lg">💡</span>
                    <div>
                        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">About Privacy Shield</p>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Privacy Shield gives you control over how your data is processed. When EU Data Residency
                            is enabled, all AI model requests are routed exclusively through European data centers.
                            Disabling search on file uploads prevents document content from being included in web search queries.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsumerPrivacySection;
