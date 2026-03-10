import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

const RenderingConfigPanel = () => {
    const [companyInfo, setCompanyInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch(`${API_BASE}/ai/rendering-config`)
            .then(res => res.ok ? res.json() : {})
            .then(data => setCompanyInfo(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
            <div className="max-w-3xl mx-auto py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Rendering Capabilities
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Document rendering uses your organization's information for branding.
                    </p>
                </div>

                {/* Quote Info Section */}
                <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-xl">📄</span>
                        Quote / Offerte
                    </h2>

                    <div className="rounded-lg p-4 mb-4 flex items-start gap-3" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                                Company details are managed in Organizations
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Quotes and proposals automatically use your organization's logo, name, address, contact details, and legal information.
                                To update this information, go to <strong>Security → Organizations</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Preview of current company info */}
                    {companyInfo && companyInfo.companyName && (
                        <div className="rounded-lg p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                Current Organization Details (Preview)
                            </p>
                            <div className="flex items-start gap-4">
                                {companyInfo.companyLogo && (
                                    <img
                                        src={companyInfo.companyLogo.startsWith('/') ? `${API_BASE}${companyInfo.companyLogo}` : companyInfo.companyLogo}
                                        alt="Logo"
                                        className="w-16 h-16 object-contain rounded-lg"
                                        style={{ border: '1px solid var(--border-subtle)' }}
                                    />
                                )}
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{companyInfo.companyName}</p>
                                    {companyInfo.companyDetails && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{companyInfo.companyDetails}</p>}
                                    {companyInfo.companyAddress && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{companyInfo.companyAddress}</p>}
                                    <div className="flex gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                                        {companyInfo.companyEmail && <span>{companyInfo.companyEmail}</span>}
                                        {companyInfo.companyPhone && <span>{companyInfo.companyPhone}</span>}
                                    </div>
                                    <div className="flex gap-4 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {companyInfo.companyChamber && <span>KvK: {companyInfo.companyChamber}</span>}
                                        {companyInfo.companyVat && <span>BTW: {companyInfo.companyVat}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RenderingConfigPanel;
