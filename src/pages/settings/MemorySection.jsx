import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

// ── Email Writing Style ──────────────────────────────────────────────────────
const EmailWritingStyle = () => {
    const [analyzing, setAnalyzing] = useState(false);
    const [profile, setProfile] = useState(null);
    const [editedProfile, setEditedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const hasChanges = editedProfile !== null && editedProfile !== profile;

    useEffect(() => { loadProfile(); }, []);

    const loadProfile = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists) { setProfile(data.profile); setEditedProfile(data.profile); }
            }
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    };

    const analyze = async () => {
        setAnalyzing(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/analyze-tone`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) { setProfile(data.profile); setEditedProfile(data.profile); }
            else setError(data.error || 'Analysis failed');
        } catch (e) { setError(e.message); }
        finally { setAnalyzing(false); }
    };

    const save = async () => {
        if (!hasChanges) return;
        setSaving(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: editedProfile }),
            });
            const data = await res.json();
            if (res.ok) { setProfile(data.profile); setEditedProfile(data.profile); }
            else setError(data.error || 'Save failed');
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    const clear = async () => {
        try {
            await authFetch(`${API_BASE}/api/integrations/gmail/tone-profile`, { method: 'DELETE' });
            setProfile(null); setEditedProfile(null);
        } catch (e) { /* ignore */ }
    };

    if (loading) return null;

    return (
        <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Email Writing Style</p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: profile ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                        <svg viewBox="0 0 24 24" fill="none" style={{ width: '16px', height: '16px' }}>
                            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#d97706" strokeWidth="1.5" fill="none" />
                            <path d="M2 7l10 6 10-6" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-[13px] font-medium text-black">Email writing style</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {profile ? 'AI matches your tone when writing emails' : 'Learn your writing style from sent emails'}
                        </p>
                    </div>
                    {profile && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>Active</span>}
                </div>
                {!profile ? (
                    <div className="px-5 py-4" style={{ background: 'var(--bg-secondary)' }}>
                        <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                            Reads your last 30 sent emails to learn your tone, greetings, sign-offs, and writing patterns.
                        </p>
                        <button onClick={analyze} disabled={analyzing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 transition-opacity"
                            style={{ background: 'var(--accent-primary)' }}>
                            {analyzing ? 'Analyzing emails…' : 'Learn my writing style'}
                        </button>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-3" style={{ background: 'var(--bg-secondary)' }}>
                        <textarea value={editedProfile || ''} onChange={e => setEditedProfile(e.target.value)} rows={8}
                            className="w-full rounded-lg p-3 text-xs resize-y"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: `1px solid ${hasChanges ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', transition: 'border-color .15s' }} />
                        <div className="flex items-center gap-2 flex-wrap">
                            {hasChanges && <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}>{saving ? 'Saving…' : 'Save changes'}</button>}
                            {hasChanges && <button onClick={() => setEditedProfile(profile)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>Discard</button>}
                            <button onClick={analyze} disabled={analyzing} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>{analyzing ? 'Analyzing…' : 'Re-analyze'}</button>
                            <button onClick={clear} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>Clear</button>
                        </div>
                    </div>
                )}
                {error && <p className="text-xs px-5 pb-3" style={{ color: '#ef4444' }}>{error}</p>}
            </div>
        </div>
    );
};

// ── Memory Section ───────────────────────────────────────────────────────────
const MemorySection = ({ memoryStats, onOpenMemory, user }) => {
    const count = memoryStats?.total || 0;
    const showWritingStyle = user?.provider === 'google';

    return (
        <div className="space-y-6">
            {/* Memory card */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Memory</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    {/* Stat row */}
                    <div className="flex items-center gap-4 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)' }}>
                            <svg style={{ color: '#a855f7', width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-medium text-black">Stored memories</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                Persisted facts about you, your projects, and preferences
                            </p>
                        </div>
                        <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{count}</span>
                    </div>

                    {/* Type distribution */}
                    {count > 0 && memoryStats?.typeDistribution?.labels?.length > 0 && (
                        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {memoryStats.typeDistribution.labels.map((label, i) => (
                                <span key={label} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                    {label}: {memoryStats.typeDistribution.data[i]}
                                </span>
                            ))}
                        </div>
                    )}

                    {count === 0 && (
                        <div className="px-5 py-3" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                No memories yet. As you chat, facts and preferences are automatically saved.
                            </p>
                        </div>
                    )}

                    {/* Manage row */}
                    <button
                        onClick={onOpenMemory}
                        className="w-full flex items-center px-5 py-3.5 text-left transition-colors gap-3"
                        style={{ background: 'var(--bg-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    >
                        <span className="text-[13px] flex-1 text-black">Manage memories</span>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* About card */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>About</p>
                <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Memories help the AI remember facts, preferences, and context from your conversations. They persist across sessions for a more personalised experience.
                    </p>
                </div>
            </div>

            {showWritingStyle && <EmailWritingStyle />}
        </div>
    );
};

export default MemorySection;
