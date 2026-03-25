import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

// ── Email Writing Style ─────────────────────────────────────────────────────
const EmailWritingStyle = () => {
    const [analyzing, setAnalyzing] = useState(false);
    const [profile, setProfile] = useState(null);
    const [editedProfile, setEditedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const hasChanges = editedProfile !== null && editedProfile !== profile;

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists) {
                    setProfile(data.profile);
                    setEditedProfile(data.profile);
                }
            }
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    };

    const analyze = async () => {
        setAnalyzing(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/analyze-tone`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setProfile(data.profile);
                setEditedProfile(data.profile);
            } else {
                setError(data.error || 'Analysis failed');
            }
        } catch (e) {
            setError(e.message);
        } finally { setAnalyzing(false); }
    };

    const save = async () => {
        if (!hasChanges) return;
        setSaving(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: editedProfile }),
            });
            const data = await res.json();
            if (res.ok) {
                setProfile(data.profile);
                setEditedProfile(data.profile);
            } else {
                setError(data.error || 'Save failed');
            }
        } catch (e) {
            setError(e.message);
        } finally { setSaving(false); }
    };

    const clear = async () => {
        try {
            await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`, { method: 'DELETE' });
            setProfile(null);
            setEditedProfile(null);
        } catch (e) { /* ignore */ }
    };

    if (loading) return null;

    return (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.10)' }}>
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: '18px', height: '18px' }}>
                        <rect x="2" y="4" width="20" height="16" rx="3" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                        <path d="M2 7l10 6 10-6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Email Writing Style</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {profile ? 'AI matches your tone when composing emails' : 'Learn your writing style from sent emails'}
                    </p>
                </div>
                {profile && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(34,197,94,0.10)', color: '#4ade80' }}>
                        Active
                    </span>
                )}
            </div>

            {!profile ? (
                <div className="space-y-2">
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Reads your last 30 sent emails to learn your tone, greetings, sign-offs, and writing patterns.
                    </p>
                    <button
                        onClick={analyze}
                        disabled={analyzing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {analyzing ? (
                            <>
                                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" style={{ opacity: 0.3 }} />
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="24" strokeLinecap="round" />
                                </svg>
                                Analyzing emails…
                            </>
                        ) : 'Learn my writing style'}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <textarea
                        value={editedProfile || ''}
                        onChange={e => setEditedProfile(e.target.value)}
                        rows={10}
                        className="w-full rounded-lg p-3 text-xs resize-y"
                        style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-secondary)',
                            border: `1px solid ${hasChanges ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                            fontFamily: 'inherit',
                            lineHeight: 1.6,
                            minHeight: '120px',
                            outline: 'none',
                            transition: 'border-color .15s',
                        }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                        {hasChanges && (
                            <button
                                onClick={save}
                                disabled={saving}
                                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                {saving ? 'Saving…' : 'Save changes'}
                            </button>
                        )}
                        {hasChanges && (
                            <button
                                onClick={() => setEditedProfile(profile)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
                                style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                            >
                                Discard
                            </button>
                        )}
                        <button
                            onClick={analyze}
                            disabled={analyzing}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-opacity"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                        >
                            {analyzing ? 'Analyzing…' : 'Re-analyze emails'}
                        </button>
                        <button
                            onClick={clear}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
                            style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
            {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
        </div>
    );
};

const MemorySection = ({ memoryStats, onOpenMemory, user }) => {
    const count = memoryStats?.total || 0;
    const showWritingStyle = user?.provider === 'google';

    return (
        <section className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Memory
            </p>

            {/* Description card */}
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    Memories help the AI remember facts, preferences, and context from your conversations. They persist across sessions for a more personalised experience.
                </p>
            </div>

            {/* Stats card */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.10)' }}>
                        <svg style={{ color: '#c084fc', width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {count === 1 ? 'memory stored' : 'memories stored'}
                        </p>
                    </div>
                </div>

                {count === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        No memories yet. As you chat, memories are automatically extracted — people, projects, preferences, and more.
                    </p>
                ) : memoryStats?.typeDistribution?.labels?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {memoryStats.typeDistribution.labels.map((label, i) => (
                            <span key={label} className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                {label}: {memoryStats.typeDistribution.data[i]}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Action */}
            <button
                onClick={onOpenMemory}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage memories
            </button>

            {/* Email Writing Style — only for Google SSO users */}
            {showWritingStyle && <EmailWritingStyle />}
        </section>
    );
};

export default MemorySection;
