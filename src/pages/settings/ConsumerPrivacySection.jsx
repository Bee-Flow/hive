import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Globe, Search, Save, Check, ScanEye, Eye } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import PiiCategoryGrid from '../../components/privacy/PiiCategoryGrid';
import PiiActionPicker from '../../components/privacy/PiiActionPicker';
import PiiSensitivityPicker from '../../components/privacy/PiiSensitivityPicker';
import { piiCategoriesLocalized } from '../../config/piiCategories';

/**
 * Consumer Privacy Shield section.
 * User-level privacy controls for consumer accounts (no org). Mirrors the
 * organisation Privacyschild panel but scoped to a single user:
 *   - EU Data Residency
 *   - Disable Search on File Upload
 *   - PII Detection (categories, confidence threshold, action)
 *   - Show raw payload & token mapping (transparency)
 */
const ConsumerPrivacySection = () => {
    const { t } = useTranslation();
    // Full canonical category list, localised. We surface every category
    // here regardless of detector coverage: the on-server PII Guard
    // (GLiNER + regex tier) is the single backend and covers most of them.
    // Unchecked categories are filtered server-side, so listing all of
    // them is safe — at worst a checked-but-unsupported category yields
    // zero hits.
    const PII_CATEGORIES = useMemo(() => piiCategoriesLocalized(t), [t]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    // Whether the values shown are the secure defaults in force rather than a
    // saved choice (BFSF-289) — the panel labels them so "on" isn't mistaken
    // for something the user configured.
    const [implicitDefault, setImplicitDefault] = useState(false);
    // null = still probing. Tells the user whether PII detection can actually
    // run; without it "shield on, guard not installed" looked identical to
    // "shield on and working" while detection silently failed open.
    const [guardStatus, setGuardStatus] = useState(null);
    const [config, setConfig] = useState({
        // Secure by default — mirrors server/core/userShieldDefaults.js.
        enabled: true,
        euModeEnabled: false,
        disableSearchOnUpload: false,
        piiDetectionEnabled: true,
        piiDetectionCategories: [],
        piiDetectionConfidenceThreshold: 0.7,
        piiDetectionAction: 'tokenize',
        // Fail closed by default: if detection is unavailable, don't send
        // unmasked text to the AI (BFSF-269).
        piiFailureMode: 'fail_closed',
        showRawPayload: false,
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/org-privacy-shield/user/me`);
                if (res.ok) {
                    const { implicitDefault: isImplicit, ...data } = await res.json();
                    setConfig(prev => ({ ...prev, ...data }));
                    setImplicitDefault(!!isImplicit);
                }
            } catch (e) {
                console.error('[ConsumerPrivacy] fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        const fetchGuardStatus = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/org-privacy-shield/user/guard-status`);
                if (res.ok) setGuardStatus(await res.json());
            } catch (e) {
                console.error('[ConsumerPrivacy] guard-status error:', e);
            }
        };
        fetchConfig();
        fetchGuardStatus();
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
                setImplicitDefault(false); // now an explicit, stored choice
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (e) {
            console.error('[ConsumerPrivacy] save error:', e);
        } finally {
            setSaving(false);
        }
    };

    const update = (key, value) => {
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
                        {t('settings.privacy_shield', 'Privacy Shield')}
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

            {/* Guard availability — an enabled shield with no guard service
                detects nothing, and used to say so nowhere at all. */}
            {config.enabled && guardStatus && !(guardStatus.configured && guardStatus.reachable) && (
                <div className="flex items-start gap-3 p-4 rounded-2xl border" style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.08)' }}>
                    <ScanEye className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'rgb(180,83,9)' }} />
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'rgb(146,64,14)' }}>
                            {t('privacy.guard_status_unavailable', 'Personal-data check unavailable')}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(146,64,14)' }}>
                            {t('privacy.guard_status_unavailable_desc', 'The service that scans for personal data is not set up on this server. Your settings are saved, but nothing is being checked. Ask your administrator to switch it on.')}
                        </p>
                    </div>
                </div>
            )}

            {/* Master toggle + reveal */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">Enable Privacy Shield</p>
                                {implicitDefault && config.enabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(4,120,87)' }}>
                                        {t('privacy.implicit_default_badge', 'On by default')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                                {implicitDefault && config.enabled
                                    ? t('privacy.implicit_default_note', 'These settings are already in force with the secure defaults. Save to make them your own.')
                                    : 'Activate privacy controls for your account'}
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={e => update('enabled', e.target.checked)}
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
                                    onChange={e => update('euModeEnabled', e.target.checked)}
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
                                    onChange={e => update('disableSearchOnUpload', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        {/* PII Detection toggle */}
                        <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)]">
                                    <ScanEye className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-[var(--text-primary)]">Look for personal data</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Check your messages for personal details — names, email addresses, phone numbers, passwords — and hide them from the AI, or stop the message altogether
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.piiDetectionEnabled}
                                    onChange={e => update('piiDetectionEnabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* PII configuration — only when both Shield + PII are on */}
            {config.enabled && config.piiDetectionEnabled && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                    {/* Detection sensitivity — three named levels; the raw
                        threshold slider lives behind the picker's advanced fold. */}
                    <div>
                        <PiiSensitivityPicker
                            value={config.piiDetectionConfidenceThreshold || 0.7}
                            onChange={v => update('piiDetectionConfidenceThreshold', v)}
                        />
                        {config.piiDetectionConfidenceThreshold >= 0.85 && (
                            <div className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(234, 179, 8, 0.10)', color: '#92400e', border: '1px solid rgba(234, 179, 8, 0.30)' }}>
                                <span>⚠️</span>
                                <span className="leading-relaxed">
                                    At this level some personal data can slip through. Email addresses, phone numbers and bank account numbers are still recognised by their exact shape, but names and addresses depend on the detector.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Action picker */}
                    <PiiActionPicker
                        value={config.piiDetectionAction}
                        onChange={v => update('piiDetectionAction', v)}
                    />

                    {/* Failure policy is not exposed in the UI — it stays at its
                        safe server-side default (fail_closed) via config.piiFailureMode. */}

                    {/* Transparency toggle (only when tokenizing) */}
                    {config.piiDetectionAction === 'tokenize' && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!config.showRawPayload}
                                    onChange={e => update('showRawPayload', e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                />
                                <span className="flex-1">
                                    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                        <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                        Show me what was sent to the AI
                                    </span>
                                    <span className="text-[10px] block mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                        Adds a section to the &ldquo;How I got this answer&rdquo; panel showing your original message, the version that went to the AI, and which placeholder stood for which value. Only you can see it, in your own conversation.
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Categories */}
                    <PiiCategoryGrid
                        value={config.piiDetectionCategories}
                        onChange={v => update('piiDetectionCategories', v)}
                        categories={PII_CATEGORIES}
                    />
                </div>
            )}

            {/* Info Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex gap-3">
                    <span className="text-lg">💡</span>
                    <div>
                        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">About Privacy Shield</p>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Privacy Shield gives you control over what happens to your data. With EU data residency on,
                            every request to an AI model goes through European data centres only. The personal-data
                            check reads your messages on this server and swaps sensitive details for placeholders
                            — or stops the message — before it reaches the AI.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsumerPrivacySection;
