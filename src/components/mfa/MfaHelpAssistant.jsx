import React, { useRef, useState } from 'react';
import { Sparkles, Loader2, Send, X } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Collapsible AI helper for the 2FA enrollment screens (BFSF-274 follow-up).
 *
 * SECURITY BOUNDARY — the assistant must never see the on-screen MFA material
 * (QR code, setup key, entered codes, recovery codes). Enforced structurally:
 * this component takes NO props, so callers cannot hand it secrets, and it
 * only ever sends the user's typed question. As a second layer, outgoing text
 * is redacted client-side for anything secret-shaped (otpauth:// URIs, base32
 * setup keys) before it leaves the browser; the server redacts again.
 */
function redactMfaMaterial(text) {
    return String(text || '')
        .replace(/otpauth:\/\/\S+/gi, '[redacted]')
        // Setup keys as users actually paste them: bare uppercase runs,
        // app-style grouped uppercase ("JBSW Y3DP EHPK 3PXP"), and lowercase
        // runs that contain a base32 digit (2-7) — the digit requirement
        // keeps ordinary long words in real questions intact.
        .replace(/(?:[A-Z2-7]{4}[ -]){3,}[A-Z2-7]{2,}/g, '[redacted]')
        .replace(/[A-Z2-7]{16,}/g, '[redacted]')
        .replace(/(?=[a-z2-7]*[2-7])[a-z2-7]{16,}/g, '[redacted]')
        .slice(0, 1000);
}

export default function MfaHelpAssistant() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content }
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const scrollRef = useRef(null);

    const send = async (e) => {
        e?.preventDefault?.();
        const question = redactMfaMaterial(input).trim();
        if (!question || busy) return;
        setError('');
        setBusy(true);
        const nextMessages = [...messages, { role: 'user', content: question }];
        setMessages(nextMessages);
        setInput('');
        try {
            const res = await authFetch(`${API_BASE}/auth/mfa/assist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Only the typed conversation — never QR/secret/code props
                // (this component has none, by design).
                body: JSON.stringify({ question, history: messages.slice(-6) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.answer) throw new Error(data.error || 'unavailable');
            setMessages([...nextMessages, { role: 'assistant', content: String(data.answer) }]);
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            });
        } catch (_) {
            setError(t('mfa.help_error', 'The assistant is unavailable right now. Try again later.'));
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
            >
                <Sparkles className="w-3.5 h-3.5" />
                {t('mfa.help_open', 'Questions? Ask the AI assistant')}
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 space-y-2 text-left">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    {t('mfa.help_title', '2FA help')}
                </span>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={t('common.close', 'Close')}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
                {t('mfa.help_intro', 'Ask anything about setting up two-factor authentication. The assistant cannot see your QR code, setup key or codes.')}
            </p>

            {messages.length > 0 && (
                <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`text-xs leading-5 whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${m.role === 'user'
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}
                        >
                            {m.content}
                        </div>
                    ))}
                    {busy && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] px-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> {t('chat.activity.thinking', 'Thinking…')}
                        </div>
                    )}
                </div>
            )}

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <form onSubmit={send} className="flex items-center gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('mfa.help_placeholder', 'e.g. Which app do I need?')}
                    maxLength={500}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="p-1.5 rounded-lg text-white disabled:opacity-40"
                    style={{ background: 'var(--accent-primary)' }}
                    aria-label={t('mfa.help_send', 'Send')}
                >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
            </form>
        </div>
    );
}
