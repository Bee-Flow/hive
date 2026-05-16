import React, { useEffect, useMemo, useState } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import * as api from '../lib/transcriptionsApi';

export default function ShareDialog({ open, onClose, transcriptionId, currentUserId, sharedWith = [], onShareChange }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [busyIds, setBusyIds] = useState({});

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        api.listOrgUsers()
            .then((all) => setUsers(all.filter((u) => u.id !== currentUserId)))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, currentUserId]);

    const filtered = useMemo(() => {
        if (!query) return users;
        const q = query.toLowerCase();
        return users.filter((u) => (u.name || u.email || '').toLowerCase().includes(q));
    }, [users, query]);

    const toggle = async (userId) => {
        setBusyIds((b) => ({ ...b, [userId]: true }));
        try {
            const isShared = sharedWith.includes(userId);
            const data = isShared
                ? await api.unshareTranscription(transcriptionId, [userId])
                : await api.shareTranscription(transcriptionId, [userId]);
            onShareChange?.(data.sharedWith || []);
        } catch (_) { /* swallow */ } finally {
            setBusyIds((b) => { const c = { ...b }; delete c[userId]; return c; });
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Share meeting" description="Choose who else in your organization can see this transcription." size="md">
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people…"
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>
                <div className="max-h-80 overflow-auto rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    {loading && <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>}
                    {!loading && filtered.length === 0 && (
                        <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No people found.</div>
                    )}
                    {!loading && filtered.map((u) => {
                        const isShared = sharedWith.includes(u.id);
                        const busy = !!busyIds[u.id];
                        return (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => !busy && toggle(u.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                    {((u.name || u.email || '?')[0] || '?').toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{u.name || u.email}</div>
                                    {u.name && u.email && <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</div>}
                                </div>
                                <div
                                    className="w-5 h-5 rounded border flex items-center justify-center"
                                    style={{
                                        background: isShared ? 'var(--accent-primary)' : 'transparent',
                                        borderColor: isShared ? 'var(--accent-primary)' : 'var(--border-default)',
                                    }}
                                >
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : (isShared && <Check className="w-3 h-3 text-white" />)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
}
