import React from 'react';
import { Mail, Send, Loader, FileText, X, ExternalLink } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function EmailDraftCard({ msg, emailDraftStatuses, setEmailDraftStatuses }) {
    if (!msg.emailDrafts || msg.emailDrafts.length === 0) return null;

    const handleSendEmail = async (draft, index) => {
        setEmailDraftStatuses(prev => ({ ...prev, [index]: 'sending' }));
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                setEmailDraftStatuses(prev => ({ ...prev, [index]: 'sent' }));
            } else {
                const err = await res.json();
                setEmailDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setEmailDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    };

    const handleSaveAsDraft = async (draft, index) => {
        setEmailDraftStatuses(prev => ({ ...prev, [index]: 'saving_draft' }));
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/gmail/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                const data = await res.json();
                setEmailDraftStatuses(prev => ({ ...prev, [index]: `draft_saved:${data.gmailLink || ''}` }));
            } else {
                const err = await res.json();
                setEmailDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setEmailDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    };

    const handleDiscard = (index) => {
        setEmailDraftStatuses(prev => ({ ...prev, [index]: 'discarded' }));
    };

    return msg.emailDrafts.map((draft, i) => {
        const status = emailDraftStatuses[i] || draft.status || 'pending';
        const isDraftSaved = status.startsWith('draft_saved');
        const isResolved = status === 'sent' || status === 'discarded' || isDraftSaved || status.startsWith('failed');
        const gmailLink = isDraftSaved ? status.split('draft_saved:')[1] : '';

        return (
            <div key={i} className={`my-3 rounded-xl border overflow-hidden transition-all duration-300 ${status === 'sent' ? 'border-green-500/40 bg-green-500/5'
                : isDraftSaved ? 'border-blue-500/40 bg-blue-500/5'
                    : status === 'discarded' ? 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] opacity-50'
                        : status.startsWith('failed') ? 'border-red-500/40 bg-red-500/5'
                            : 'border-blue-500/30 bg-blue-500/5'
                }`}>
                {/* Header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${status === 'sent' ? 'text-green-500'
                    : isDraftSaved ? 'text-blue-500'
                        : status === 'discarded' ? 'text-[var(--text-tertiary)]'
                            : status.startsWith('failed') ? 'text-red-500'
                                : 'text-blue-500'
                    }`}>
                    <Mail className="w-3.5 h-3.5" />
                    <span>{
                        status === 'sent' ? 'Email Sent ✓'
                            : isDraftSaved ? 'Saved to Drafts ✓'
                                : status === 'discarded' ? 'Email Discarded'
                                    : status === 'sending' ? 'Sending...'
                                        : status === 'saving_draft' ? 'Saving Draft...'
                                            : status.startsWith('failed') ? 'Send Failed'
                                                : draft.replyToMessageId ? 'Reply Draft — Awaiting Approval' : 'Email Draft — Awaiting Approval'
                    }</span>
                </div>

                {/* Email Content */}
                <div className="px-4 pb-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-[var(--text-tertiary)] font-medium w-14">To:</span>
                        <span className="text-[var(--text-primary)]">{draft.to}</span>
                    </div>
                    {draft.cc && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--text-tertiary)] font-medium w-14">Cc:</span>
                            <span className="text-[var(--text-primary)]">{draft.cc}</span>
                        </div>
                    )}
                    {draft.bcc && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--text-tertiary)] font-medium w-14">Bcc:</span>
                            <span className="text-[var(--text-primary)]">{draft.bcc}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-[var(--text-tertiary)] font-medium w-14">Subject:</span>
                        <span className="text-[var(--text-primary)] font-medium">{draft.subject}</span>
                    </div>
                    <div className="mt-2 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar">
                        {draft.body}
                    </div>
                </div>

                {/* Action Buttons */}
                {!isResolved && (
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <button
                            onClick={() => handleSendEmail(draft, i)}
                            disabled={status === 'sending' || status === 'saving_draft'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
                        >
                            {status === 'sending' ? (
                                <><Loader className="w-3 h-3 animate-spin" /> Sending...</>
                            ) : (
                                <><Send className="w-3 h-3" /> Send Email</>
                            )}
                        </button>
                        <button
                            onClick={() => handleSaveAsDraft(draft, i)}
                            disabled={status === 'sending' || status === 'saving_draft'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                        >
                            {status === 'saving_draft' ? (
                                <><Loader className="w-3 h-3 animate-spin" /> Saving...</>
                            ) : (
                                <><FileText className="w-3 h-3" /> Save as Draft</>
                            )}
                        </button>
                        <button
                            onClick={() => handleDiscard(i)}
                            disabled={status === 'sending' || status === 'saving_draft'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                            <X className="w-3 h-3" /> Discard
                        </button>
                    </div>
                )}

                {/* Draft saved — open in Gmail link */}
                {isDraftSaved && gmailLink && (
                    <div className="px-4 py-2 text-xs text-blue-400 border-t border-blue-500/20 flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3" />
                        <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Open draft in Gmail →
                        </a>
                    </div>
                )}

                {/* Status messages */}
                {status.startsWith('failed') && (
                    <div className="px-4 py-2 text-xs text-red-400 border-t border-red-500/20">
                        {status.replace('failed: ', 'Error: ')}
                    </div>
                )}
            </div>
        );
    });
}
