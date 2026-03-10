import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const OCRConfig = () => {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config`);
                if (res.ok) {
                    const data = await res.json();
                    setHasApiKey(!!data.apiKey);
                }
            } catch (e) { }
            setLoading(false);
        })();
    }, []);

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading settings...</div>;

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
                        📄
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Document OCR</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Mistral OCR for PDF and image text extraction
                        </p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${hasApiKey ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {hasApiKey ? '✓ Ready' : 'API Key Required'}
                </span>
            </div>

            <div className="space-y-4">
                <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        <strong>Mistral OCR</strong> extracts text from PDF documents and images using Mistral's advanced OCR model (mistral-ocr-latest).
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        When a user uploads a PDF, the content is extracted as markdown text before being sent to the AI.
                    </p>
                </div>

                <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {hasApiKey
                            ? '✅ Using your Mistral API key — OCR is ready to use.'
                            : '⚠️ Set your Mistral API key in the "Mistral API Key" tab to enable OCR.'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OCRConfig;
