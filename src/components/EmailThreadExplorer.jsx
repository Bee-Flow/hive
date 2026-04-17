import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/helpers';
import { ChevronDown, ChevronRight, Mail } from 'lucide-react';

/**
 * Email Thread Explorer — groups email KB documents by their threadId.
 * Clicking a thread expands to show all messages in it, ordered by date.
 *
 * Props:
 *   - kbId       : string (required)
 *   - authFetch  : fetch wrapper with auth cookies
 *   - onOpenDoc? : (doc) => void  (optional: let the parent jump to the doc)
 */
export default function EmailThreadExplorer({ kbId, authFetch, onOpenDoc }) {
    const [loading, setLoading] = useState(false);
    const [threads, setThreads] = useState([]);
    const [expandedThreadId, setExpandedThreadId] = useState(null);
    const [threadDocs, setThreadDocs] = useState({});

    const loadThreads = useCallback(async () => {
        if (!kbId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/threads?limit=100`);
            if (res.ok) {
                const body = await res.json();
                setThreads(body.threads || []);
            }
        } catch (e) { console.error('Failed to load threads:', e); }
        finally { setLoading(false); }
    }, [kbId, authFetch]);

    useEffect(() => { loadThreads(); }, [loadThreads]);

    const expandThread = async (threadId) => {
        if (expandedThreadId === threadId) {
            setExpandedThreadId(null);
            return;
        }
        setExpandedThreadId(threadId);
        if (!threadDocs[threadId]) {
            try {
                const res = await authFetch(`${API_BASE}/api/kb/${kbId}/threads/${encodeURIComponent(threadId)}/documents`);
                if (res.ok) {
                    const body = await res.json();
                    setThreadDocs(prev => ({ ...prev, [threadId]: body.documents || [] }));
                }
            } catch (e) { console.error('Failed to load thread docs:', e); }
        }
    };

    if (loading && threads.length === 0) {
        return <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>Loading threads…</div>;
    }
    if (threads.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <h5 className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Email threads ({threads.length})</h5>
            </div>
            <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {threads.map(t => {
                    const isOpen = expandedThreadId === t.thread_id;
                    const docs = threadDocs[t.thread_id] || [];
                    return (
                        <li key={t.thread_id}>
                            <button onClick={() => expandThread(t.thread_id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-primary)' }}>
                                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span className="flex-1 truncate font-mono text-[10px]">{t.thread_id}</span>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.message_count} msgs</span>
                                {t.latest && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(t.latest).toLocaleDateString()}</span>}
                            </button>
                            {isOpen && (
                                <div className="px-3 pb-3">
                                    {docs.length === 0 ? (
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>
                                    ) : (
                                        <ol className="space-y-1">
                                            {docs.map((d, idx) => (
                                                <li key={d.id} className="flex items-center gap-2 py-1 px-2 rounded text-[11px] hover:bg-[var(--bg-tertiary)]">
                                                    <span className="inline-block w-4 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="truncate" style={{ color: 'var(--text-primary)' }}>{d.title || 'Untitled'}</div>
                                                        <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                            {d.metadata?.from ? String(d.metadata.from).replace(/<[^>]+>/, '').trim() : ''}
                                                            {d.metadata?.date ? ` · ${new Date(d.metadata.date).toLocaleDateString()}` : ''}
                                                            {d.metadata?.hasAttachments ? ' · 📎' : ''}
                                                        </div>
                                                    </div>
                                                    {onOpenDoc && (
                                                        <button onClick={() => onOpenDoc(d)}
                                                            className="text-[10px] text-blue-500 hover:underline">Open</button>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
