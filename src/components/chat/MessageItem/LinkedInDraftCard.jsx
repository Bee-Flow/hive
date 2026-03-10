import React from 'react';
import { Send, Loader, X } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function LinkedInDraftCard({ msg, linkedInDraftStatuses, setLinkedInDraftStatuses }) {
    if (!msg.linkedInDrafts || msg.linkedInDrafts.length === 0) return null;

    const handlePost = async (draft, index) => {
        setLinkedInDraftStatuses(prev => ({ ...prev, [index]: 'posting' }));
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/linkedin/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: draft.text }),
            });
            if (res.ok) {
                setLinkedInDraftStatuses(prev => ({ ...prev, [index]: 'posted' }));
            } else {
                const err = await res.json();
                setLinkedInDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setLinkedInDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    };

    const handleDiscard = (index) => {
        setLinkedInDraftStatuses(prev => ({ ...prev, [index]: 'discarded' }));
    };

    return msg.linkedInDrafts.map((draft, i) => {
        const status = linkedInDraftStatuses[i] || draft.status || 'pending';
        const isResolved = status === 'posted' || status === 'discarded' || status.startsWith('failed');

        return (
            <div key={i} className={`my-3 rounded-xl border overflow-hidden transition-all duration-300 ${status === 'posted' ? 'border-green-500/40 bg-green-500/5'
                : status === 'discarded' ? 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] opacity-50'
                    : status.startsWith('failed') ? 'border-red-500/40 bg-red-500/5'
                        : 'border-[#0A66C2]/30 bg-[#0A66C2]/5'
                }`}>
                {/* Header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${status === 'posted' ? 'text-green-500'
                    : status === 'discarded' ? 'text-[var(--text-tertiary)]'
                        : status.startsWith('failed') ? 'text-red-500'
                            : 'text-[#0A66C2]'
                    }`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    <span>{
                        status === 'posted' ? 'Posted to LinkedIn ✓'
                            : status === 'discarded' ? 'Post Discarded'
                                : status === 'posting' ? 'Posting...'
                                    : status.startsWith('failed') ? 'Post Failed'
                                        : 'LinkedIn Draft — Awaiting Approval'
                    }</span>
                </div>

                {/* Post Content */}
                <div className="px-4 pb-3">
                    <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar">
                        {draft.text}
                    </div>
                    <div className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">
                        {draft.text.length} / 3,000 characters
                    </div>
                </div>

                {/* Action Buttons */}
                {!isResolved && (
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <button
                            onClick={() => handlePost(draft, i)}
                            disabled={status === 'posting'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                            style={{ background: '#0A66C2' }}
                        >
                            {status === 'posting' ? (
                                <><Loader className="w-3 h-3 animate-spin" /> Posting...</>
                            ) : (
                                <><Send className="w-3 h-3" /> Post to LinkedIn</>
                            )}
                        </button>
                        <button
                            onClick={() => handleDiscard(i)}
                            disabled={status === 'posting'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                            <X className="w-3 h-3" /> Discard
                        </button>
                    </div>
                )}

                {/* Error messages */}
                {status.startsWith('failed') && (
                    <div className="px-4 py-2 text-xs text-red-400 border-t border-red-500/20">
                        {status.replace('failed: ', 'Error: ')}
                    </div>
                )}
            </div>
        );
    });
}
