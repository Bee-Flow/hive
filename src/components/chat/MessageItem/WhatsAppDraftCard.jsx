import React from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { MessageCircle, Send, X, Edit3, Check, Loader2 } from 'lucide-react';

export default function WhatsAppDraftCard({ msg, whatsappDraftStatuses, setWhatsappDraftStatuses }) {
    if (!msg.whatsappDrafts || msg.whatsappDrafts.length === 0) return null;

    const handleSend = async (draft, index) => {
        const key = `${msg.id}-wa-${index}`;
        setWhatsappDraftStatuses(prev => ({ ...prev, [key]: 'sending' }));

        try {
            const API = (typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api/integrations/whatsapp/send';
            const response = await authFetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: draft.to, message: draft.message }),
            });
            if (response.ok) {
                setWhatsappDraftStatuses(prev => ({ ...prev, [key]: 'sent' }));
            } else {
                const err = await response.json().catch(() => ({}));
                setWhatsappDraftStatuses(prev => ({ ...prev, [key]: `failed: ${err.error || 'Unknown error'}` }));
            }
        } catch (e) {
            setWhatsappDraftStatuses(prev => ({ ...prev, [key]: `failed: ${e.message}` }));
        }
    };

    const handleDiscard = (index) => {
        const key = `${msg.id}-wa-${index}`;
        setWhatsappDraftStatuses(prev => ({ ...prev, [key]: 'discarded' }));
    };

    return msg.whatsappDrafts.map((draft, i) => {
        const key = `${msg.id}-wa-${i}`;
        const status = whatsappDraftStatuses[key] || draft.status || 'pending';
        const isSent = status === 'sent';
        const isSending = status === 'sending';
        const isDiscarded = status === 'discarded';
        const isFailed = status.startsWith?.('failed');

        return (
            <div
                key={key}
                className="my-3 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                style={{
                    background: 'linear-gradient(135deg, #075e54 0%, #128c7e 50%, #25d366 100%)',
                    border: '1px solid rgba(37, 211, 102, 0.3)',
                    opacity: isDiscarded ? 0.5 : 1,
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                        }}
                    >
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                            WhatsApp Message
                        </div>
                        <div className="text-[11px] text-white/70 truncate">
                            To: {draft.toName || draft.toNumber || draft.to}
                        </div>
                    </div>
                    {isSent && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-white/20">
                            <Check className="w-3 h-3" /> Sent
                        </div>
                    )}
                    {isSending && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-white/20">
                            <Loader2 className="w-3 h-3 animate-spin" /> Sending
                        </div>
                    )}
                    {isDiscarded && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/60 bg-white/10">
                            Discarded
                        </div>
                    )}
                    {isFailed && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-red-200 bg-red-500/30">
                            Failed
                        </div>
                    )}
                </div>

                {/* Message Body */}
                <div className="px-4 pb-2">
                    <div
                        className="p-3 rounded-xl text-sm text-white/95 leading-relaxed whitespace-pre-wrap"
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                        }}
                    >
                        {draft.message}
                    </div>
                </div>

                {/* Action Buttons */}
                {status === 'pending' && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                        <button
                            onClick={() => handleSend(draft, i)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-200 text-white"
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.3)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                        >
                            <Send className="w-3.5 h-3.5" /> Send
                        </button>
                        <button
                            onClick={() => handleDiscard(i)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 text-white/70 hover:text-white"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        >
                            <X className="w-3.5 h-3.5" /> Discard
                        </button>
                    </div>
                )}

                {/* Error detail */}
                {isFailed && (
                    <div className="px-4 pb-3">
                        <div className="text-[11px] text-red-200 bg-red-500/20 rounded-lg px-3 py-1.5">
                            {status.replace('failed: ', '')}
                        </div>
                    </div>
                )}
            </div>
        );
    });
}
