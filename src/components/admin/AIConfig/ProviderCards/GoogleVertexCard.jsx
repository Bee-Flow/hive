import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

const GoogleVertexConfigCard = ({ onMessage }) => {
    const [project, setProject] = useState('');
    const [location, setLocation] = useState('europe-west4');
    const [serviceAccountKey, setServiceAccountKey] = useState('');
    const [hasProject, setHasProject] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setHasProject(!!data.hasGoogleVertexProject);
                setHasKey(!!data.hasGoogleVertexServiceAccountKey);
                if (data.googleVertexLocation) setLocation(data.googleVertexLocation);
            }
        } catch (e) {
            console.error('Failed to fetch Vertex AI status:', e);
        }
    };

    const handleSave = async () => {
        if (!project.trim() && !serviceAccountKey.trim()) return;
        setSaving(true);
        try {
            const body = {};
            if (project.trim()) body.googleVertexProject = project;
            body.googleVertexLocation = location;
            if (serviceAccountKey.trim()) {
                // Validate JSON before sending
                try {
                    JSON.parse(serviceAccountKey);
                } catch {
                    onMessage?.({ type: 'error', text: 'Invalid JSON — please paste a valid service account key' });
                    setSaving(false);
                    return;
                }
                body.googleVertexServiceAccountKey = serviceAccountKey;
            }

            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                if (project.trim()) setHasProject(true);
                if (serviceAccountKey.trim()) setHasKey(true);
                setProject('');
                setServiceAccountKey('');
                setShowKeyInput(false);
                onMessage?.({ type: 'success', text: 'Google Vertex AI config saved!' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to save config' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to save config' });
        } finally {
            setSaving(false);
        }
    };

    const isConfigured = hasProject && hasKey;

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, rgba(66,133,244,0.2), rgba(52,168,83,0.2))' }}>
                    ☁️
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Google Vertex AI</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {isConfigured ? '✅ Fully configured' : 'EU-hosted Gemini via Vertex AI'}
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {hasProject && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Project</span>}
                    {hasKey && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Key</span>}
                </div>
            </div>
            <div className="space-y-3">
                {/* Project + Location row */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={project}
                        onChange={e => setProject(e.target.value)}
                        placeholder={hasProject ? '••••••••••••••••' : 'GCP Project ID'}
                        className="flex-1 px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                    <input
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="europe-west4"
                        className="w-40 px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        title="GCP Location (e.g. europe-west4, us-central1)"
                    />
                </div>

                {/* Service Account Key */}
                {!showKeyInput ? (
                    <button
                        onClick={() => setShowKeyInput(true)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/10"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                    >
                        {hasKey ? '🔑 Update Service Account Key' : '🔑 Add Service Account Key'}
                    </button>
                ) : (
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Service Account JSON Key
                        </label>
                        <textarea
                            value={serviceAccountKey}
                            onChange={e => setServiceAccountKey(e.target.value)}
                            placeholder='Paste your service account JSON key here...'
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-xs font-mono resize-y"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            GCP Console → IAM → Service Accounts → Keys → Add Key → JSON
                        </p>
                    </div>
                )}

                {/* Save button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || (!project.trim() && !serviceAccountKey.trim())}
                        className="px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? '...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};


export default GoogleVertexConfigCard;
