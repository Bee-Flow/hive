import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, PenTool, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SendForSigningModal({ open, onClose, onSend, sending, notebookTitle }) {
    const [signers, setSigners] = useState([{ email: '', first_name: '', last_name: '' }]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [result, setResult] = useState(null);
    const overlayRef = useRef(null);

    // Reset state when opened
    useEffect(() => {
        if (open) {
            setSigners([{ email: '', first_name: '', last_name: '' }]);
            setSubject(notebookTitle ? `Signature requested: ${notebookTitle}` : '');
            setMessage('');
            setResult(null);
        }
    }, [open, notebookTitle]);

    if (!open) return null;

    const addSigner = () => {
        setSigners(prev => [...prev, { email: '', first_name: '', last_name: '' }]);
    };

    const removeSigner = (i) => {
        if (signers.length <= 1) return;
        setSigners(prev => prev.filter((_, idx) => idx !== i));
    };

    const updateSigner = (i, field, value) => {
        setSigners(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
    };

    const validSigners = signers.filter(s => s.email.trim());
    const canSend = validSigners.length > 0 && !sending && !result;

    const handleSend = async () => {
        const res = await onSend({
            signers: validSigners,
            subject: subject.trim(),
            message: message.trim(),
        });
        if (res) setResult(res);
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div
                className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    animation: 'slideDown 0.25s ease-out',
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="p-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
                        <PenTool className="w-5 h-5" style={{ color: '#22c55e' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Send for Signing
                        </h3>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                            via SignRequest · {notebookTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {result ? (
                        /* ── Success state ── */
                        <div className="flex flex-col items-center gap-3 py-6">
                            <CheckCircle className="w-12 h-12" style={{ color: '#22c55e' }} />
                            <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Document Sent for Signing!
                            </h4>
                            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                                {result.message || 'Your document has been sent to the signer(s).'}
                            </p>
                            {result.signers?.length > 0 && (
                                <div className="w-full mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                                    {result.signers.map((s, i) => (
                                        <div key={i} className="flex items-center gap-2 px-4 py-2 text-sm" style={{ borderBottom: i < result.signers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                            <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                                                {s.name ? `${s.name} (${s.email})` : s.email}
                                            </span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                                style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>
                                                {s.status || 'Pending'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Form state ── */
                        <>
                            {/* Signers */}
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    Signers
                                </label>
                                <div className="space-y-2 mt-2">
                                    {signers.map((signer, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <input
                                                    type="email"
                                                    placeholder="Email *"
                                                    value={signer.email}
                                                    onChange={e => updateSigner(i, 'email', e.target.value)}
                                                    className="col-span-3 sm:col-span-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="First name"
                                                    value={signer.first_name}
                                                    onChange={e => updateSigner(i, 'first_name', e.target.value)}
                                                    className="px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Last name"
                                                    value={signer.last_name}
                                                    onChange={e => updateSigner(i, 'last_name', e.target.value)}
                                                    className="px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                            {signers.length > 1 && (
                                                <button
                                                    onClick={() => removeSigner(i)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors mt-0.5"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addSigner}
                                    className="flex items-center gap-1.5 mt-2 text-[12px] font-medium px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
                                    style={{ color: 'var(--accent-primary)' }}
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add signer
                                </button>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    Email Subject
                                </label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="e.g. Contract for review and signature"
                                    className="w-full mt-1.5 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    Message (optional)
                                </label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Add a personal message to the signers..."
                                    rows={3}
                                    className="w-full mt-1.5 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors resize-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    {result ? (
                        <button
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl text-[13px] font-medium text-white"
                            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                        >
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!canSend}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <PenTool className="w-4 h-4" />
                                        Send for Signing
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
