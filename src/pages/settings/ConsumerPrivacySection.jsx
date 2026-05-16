import React, { useState, useEffect } from 'react';
import { Shield, Globe, Search, Save, Check, ScanEye } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import PiiCategoryGrid from '../../components/privacy/PiiCategoryGrid';
import PiiActionPicker from '../../components/privacy/PiiActionPicker';

// The 8 categories the in-process Privacy Filter actually labels. Consumer
// accounts don't get Azure AI Language (which would unlock the full 18),
// so showing the extra categories would just let users toggle knobs that
// never fire. See server/core/localPiiDetection.js LABEL_TO_CATEGORY.
const CONSUMER_PII_CATEGORIES = [
    { id: 'Person',                  label: 'Person Names',     group: 'Personal',  icon: '👤' },
    { id: 'DateOfBirth',             label: 'Date of Birth',    group: 'Personal',  icon: '📅' },
    { id: 'PhoneNumber',             label: 'Phone Numbers',    group: 'Contact',   icon: '📱' },
    { id: 'Email',                   label: 'Email Addresses',  group: 'Contact',   icon: '📧' },
    { id: 'Address',                 label: 'Physical Addresses', group: 'Contact', icon: '🏠' },
    { id: 'BankAccountNumber',       label: 'Bank Accounts',    group: 'Financial', icon: '🏦' },
    { id: 'URL',                     label: 'URLs',             group: 'Digital',   icon: '🔗' },
    { id: 'AzureStorageAccountKey',  label: 'API Keys / Secrets', group: 'Digital', icon: '🔑' },
];

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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [config, setConfig] = useState({
        enabled: false,
        euModeEnabled: false,
        disableSearchOnUpload: false,
        piiDetectionEnabled: false,
        piiDetectionCategories: [],
        piiDetectionConfidenceThreshold: 0.7,
        piiDetectionAction: 'tokenize',
        showRawPayload: false,
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/org-privacy-shield/user/me`);
                if (res.ok) {
                    const data = await res.json();
                    setConfig(prev => ({ ...prev, ...data }));
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

            {/* Master toggle + reveal */}
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
                                    <p className="text-sm font-medium text-[var(--text-primary)]">PII Detection</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Scan messages for personal data — names, emails, phone numbers and secrets — and tokenise or block them before they reach the AI
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
                    {/* Confidence threshold */}
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted">Confidence Threshold</label>
                            <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                                {Math.round((config.piiDetectionConfidenceThreshold || 0.7) * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.1" max="1" step="0.05"
                            value={config.piiDetectionConfidenceThreshold || 0.7}
                            onChange={e => update('piiDetectionConfidenceThreshold', parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-muted mt-1">
                            <span>Detect more (10%)</span>
                            <span>Detect less (100%)</span>
                        </div>
                        {config.piiDetectionConfidenceThreshold >= 0.85 && (
                            <div className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(234, 179, 8, 0.10)', color: '#92400e', border: '1px solid rgba(234, 179, 8, 0.30)' }}>
                                <span>⚠️</span>
                                <span className="leading-relaxed">
                                    At this threshold most detections will be filtered out. Emails, phone numbers and IBANs may silently slip through. Recommended: 70%.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Action picker */}
                    <PiiActionPicker
                        value={config.piiDetectionAction}
                        onChange={v => update('piiDetectionAction', v)}
                    />

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
                                    <span className="text-xs font-medium block" style={{ color: 'var(--text-primary)' }}>
                                        🔍 Show raw payload &amp; token mapping
                                    </span>
                                    <span className="text-[10px] block mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                        Adds a transparency section to the &ldquo;How I got this answer&rdquo; panel showing your original message, the tokenised text sent to the AI, and the placeholder → value mapping. Visible only to you in your own conversation.
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Categories */}
                    <PiiCategoryGrid
                        value={config.piiDetectionCategories}
                        onChange={v => update('piiDetectionCategories', v)}
                        categories={CONSUMER_PII_CATEGORIES}
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
                            Privacy Shield gives you control over how your data is processed. When EU Data Residency
                            is enabled, all AI model requests are routed exclusively through European data centers.
                            PII Detection scans your messages locally and replaces sensitive values with placeholders
                            (or blocks the message) before it reaches the model.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsumerPrivacySection;
