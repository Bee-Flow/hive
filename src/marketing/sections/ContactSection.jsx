import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Bot, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../utils/helpers';

const BRAND = {
    primary: '#F5A623',
    primaryDark: '#E0941A',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    soft: '#FAFAFA',
};

const sectionStyle = {
    padding: '80px 24px',
    background: BRAND.soft,
};
const innerStyle = {
    maxWidth: 720,
    margin: '0 auto',
    textAlign: 'center',
};
const titleStyle = {
    fontSize: 32,
    fontWeight: 700,
    color: BRAND.text,
    margin: '0 0 12px',
};
const leadStyle = {
    fontSize: 16,
    color: BRAND.muted,
    margin: '0 0 32px',
    lineHeight: 1.6,
};
const formStyle = {
    background: '#fff',
    border: `1px solid ${BRAND.border}`,
    borderRadius: 16,
    padding: 24,
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
};
const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: BRAND.text, marginBottom: 4 };
const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${BRAND.border}`,
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
    color: BRAND.text,
};
const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' };
const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: BRAND.primary,
    color: BRAND.text,
    border: 'none',
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
};
const errorStyle = { color: '#dc2626', fontSize: 13, marginTop: 8 };
const okBoxStyle = {
    background: '#fff',
    border: `1px solid ${BRAND.border}`,
    borderRadius: 16,
    padding: 32,
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
};

export default function ContactSection({ id = 'contact' }) {
    const renderedAt = useRef(Date.now());
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [honeypot, setHoneypot] = useState(''); // bot trap
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);
    const [result, setResult] = useState(null); // { threadId, threadUrl, accessToken }
    // AI-reply polling state — populated by useEffect below.
    const [aiReply, setAiReply] = useState(null); // { content, escalated } | null
    const [aiPollExhausted, setAiPollExhausted] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        setErr(null);
        if (!email.trim() || !subject.trim() || !message.trim()) {
            setErr('Please fill in your email, a subject, and a message.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/support/threads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'marketing',
                    name: name.trim() || null,
                    email: email.trim(),
                    subject: subject.trim(),
                    message: message.trim(),
                    website_url: honeypot, // bots fill this
                    rendered_at_ms: renderedAt.current,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErr(data?.error || 'Could not submit. Please try again.');
                return;
            }
            if (data.spam) {
                // Silent success surface for the human path.
                setResult({ threadId: null, threadUrl: null });
                return;
            }
            setResult({
                threadId: data.threadId,
                threadUrl: data.threadUrl,
                accessToken: data.accessToken || null,
            });
        } catch (e) {
            setErr(e.message || 'Network error');
        } finally {
            setSubmitting(false);
        }
    };

    // Poll the new thread every 3s for up to ~45s after submit so the user
    // sees the AI's reply inline instead of having to refresh email.
    useEffect(() => {
        if (!result?.threadId || !result?.accessToken) return;
        if (aiReply) return;
        let cancelled = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 15; // 15 * 3s = ~45s
        const tick = async () => {
            if (cancelled) return;
            attempts += 1;
            try {
                const url = `${API_BASE}/api/support/threads/${result.threadId}?token=${encodeURIComponent(result.accessToken)}`;
                const r = await fetch(url, { credentials: 'omit' });
                if (r.ok) {
                    const data = await r.json();
                    const messages = Array.isArray(data?.messages) ? data.messages : [];
                    const lastAi = [...messages].reverse().find(m => m.author_kind === 'ai');
                    const lastSystem = [...messages].reverse().find(m => m.author_kind === 'system');
                    if (lastAi) {
                        if (!cancelled) setAiReply({
                            content: lastAi.body,
                            escalated: data?.thread?.status === 'awaiting_agent',
                        });
                        return; // stop polling
                    }
                    if (lastSystem && data?.thread?.status === 'awaiting_agent') {
                        if (!cancelled) setAiReply({
                            content: 'A Bee Flow teammate is taking a look. You\'ll get a reply by email soon.',
                            escalated: true,
                        });
                        return;
                    }
                }
            } catch { /* keep polling */ }
            if (attempts >= MAX_ATTEMPTS) {
                if (!cancelled) setAiPollExhausted(true);
                return;
            }
            setTimeout(tick, 3000);
        };
        const id = setTimeout(tick, 2000); // first check after 2s
        return () => { cancelled = true; clearTimeout(id); };
    }, [result?.threadId, result?.accessToken, aiReply]);

    if (result) {
        const waiting = !aiReply && !aiPollExhausted;
        return (
            <section id={id} style={sectionStyle}>
                <div style={innerStyle}>
                    <div style={okBoxStyle}>
                        <CheckCircle2 size={40} color={BRAND.primary} style={{ marginBottom: 12 }} aria-hidden="true" />
                        <h2 style={{ ...titleStyle, fontSize: 24 }}>Thanks — we've got your message</h2>

                        {waiting && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: BRAND.muted, fontSize: 14, margin: '12px 0 16px' }}>
                                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                <span>Our AI is looking through our knowledge base…</span>
                            </div>
                        )}

                        {aiReply && (
                            <div style={{
                                textAlign: 'left',
                                background: aiReply.escalated ? '#FFF7E6' : '#F0F9FF',
                                border: `1px solid ${aiReply.escalated ? '#F5A623' : '#BAE6FD'}`,
                                borderRadius: 12,
                                padding: 16,
                                margin: '16px 0',
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: BRAND.text,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600, fontSize: 12, color: BRAND.muted }}>
                                    {aiReply.escalated
                                        ? <><AlertTriangle size={14} /> A human is taking over</>
                                        : <><Bot size={14} /> Bee Flow AI replied</>
                                    }
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{aiReply.content}</div>
                            </div>
                        )}

                        {aiPollExhausted && !aiReply && (
                            <p style={{ ...leadStyle, margin: '0 0 16px' }}>
                                Our AI is still thinking. We'll email you the moment a reply is ready — no need to wait here.
                            </p>
                        )}

                        {!waiting && !aiReply && !aiPollExhausted && (
                            <p style={{ ...leadStyle, margin: '0 0 16px' }}>
                                Our AI assistant is looking through our knowledge base right now and you'll receive an email reply within a few minutes. If it can't fully resolve your question, a Bee Flow teammate will take over.
                            </p>
                        )}

                        {result.threadUrl && (
                            <a href={result.threadUrl} style={buttonStyle}>
                                View the conversation
                                <ArrowRight size={16} aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id={id} style={sectionStyle}>
            <div style={innerStyle}>
                <h2 style={titleStyle}>Talk to us</h2>
                <p style={leadStyle}>
                    Question about pricing, custom deployments, or anything else? Send us a note — our AI assistant replies within seconds, and a human picks it up if needed.
                </p>
                <form style={formStyle} onSubmit={submit} noValidate>
                    {/* Honeypot — visually hidden but reachable by naive bots. */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
                        <label>Website (leave blank)
                            <input
                                type="text"
                                tabIndex={-1}
                                autoComplete="off"
                                value={honeypot}
                                onChange={e => setHoneypot(e.target.value)}
                            />
                        </label>
                    </div>

                    <div style={rowStyle}>
                        <div>
                            <label style={labelStyle}>Your name</label>
                            <input
                                style={inputStyle}
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Jane Doe"
                                maxLength={120}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input
                                style={inputStyle}
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                maxLength={200}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Subject</label>
                        <input
                            style={inputStyle}
                            type="text"
                            required
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="How can we help?"
                            maxLength={200}
                        />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Message</label>
                        <textarea
                            style={textareaStyle}
                            required
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Tell us about your team, what you're trying to do, and any constraints."
                            maxLength={5000}
                        />
                    </div>
                    {err && <div style={errorStyle}>{err}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <button type="submit" style={{ ...buttonStyle, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
                            {submitting ? 'Sending…' : 'Send to Bee Flow'}
                            <ArrowRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
