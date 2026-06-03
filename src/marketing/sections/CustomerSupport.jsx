import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Bot, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../utils/helpers';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

/**
 * Customer Support — a public, CMS-placeable support form. Submits to the
 * same backend that powers the in-app support inbox (`POST /api/support/threads`,
 * `source: 'marketing'`), so a message from a logged-out visitor lands in the
 * admin "Customer Support" inbox exactly like an in-app question does. The AI
 * replies first (polled inline below) and a human takes over on escalation.
 *
 * Two call shapes:
 *   • CMS block      — ProductWebsite renders <CustomerSupport data={...} />
 *                      where `data` is the block content (editable copy +
 *                      backgroundVariant). Title/intro are inline-editable in
 *                      ?preview=1; the rest is panel-editable.
 *   • Legacy wrapper — sections/ContactSection.jsx renders this with the
 *                      default content + a custom sectionId, so HomePage and
 *                      PricingPage keep their #contact anchor and copy.
 *
 * Styling is self-contained (inline) but reads the marketing design tokens
 * (--brand-*, --border-subtle, --radius-base) with hard fallbacks, mirroring
 * CookieBanner — so it follows brand-colour overrides and dark mode and never
 * hardcodes an off-palette colour.
 *
 * Inline-editable paths: customer-support.title, customer-support.lead
 */

// Default copy. Shared with the legacy ContactSection wrapper and kept in
// sync with BLOCK_DEFAULTS (editors.jsx) + cmsDefaults.js (server) so a block
// created either side renders identically.
export const SUPPORT_DEFAULT_CONTENT = {
    title: 'Talk to us',
    lead: 'Question about pricing, custom deployments, or anything else? Send us a note — our AI assistant replies within seconds, and a human picks it up if needed.',
    nameLabel: 'Your name',
    namePlaceholder: 'Jane Doe',
    emailLabel: 'Email',
    emailPlaceholder: 'you@company.com',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'How can we help?',
    messageLabel: 'Message',
    messagePlaceholder: "Tell us about your team, what you're trying to do, and any constraints.",
    submitLabel: 'Send to Bee Flow',
    successTitle: "Thanks — we've got your message",
    successBody: "Our AI assistant is looking through our knowledge base right now and you'll receive an email reply within a few minutes. If it can't fully resolve your question, a Bee Flow teammate will take over.",
    backgroundVariant: 'surface', // 'default' | 'surface' | 'primary' | 'dark'
};

const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// Design tokens with fallbacks — see component doc. Resolved once at module
// scope as plain CSS-var strings; the browser does the actual resolution.
const T = {
    cardBg: 'var(--brand-bg, #ffffff)',
    text:   'var(--brand-text, #1F2937)',
    muted:  'var(--brand-text-secondary, #6B7280)',
    border: 'var(--border-subtle, #E5E7EB)',
    primary:'var(--brand-primary, #F5A623)',
    radius: 'var(--radius-base, 12px)',
};

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 };
const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box',
    background: T.cardBg,
    color: T.text,
};
const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' };
const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: T.primary,
    color: T.text,
    border: 'none',
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
};
const cardStyle = {
    background: T.cardBg,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: 24,
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};
const errorStyle = { color: '#dc2626', fontSize: 13, marginTop: 8 };

export default function CustomerSupport({ data, sectionId }) {
    // All hooks run before any conditional return (Rules of Hooks). `preview`
    // is a plain function call, safe to compute up top.
    const preview = isPreviewMode();
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
        // Editing the block inside the admin iframe must never create a real
        // support thread. The button is also disabled in preview; this is the
        // belt-and-suspenders guard.
        if (preview) return;
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
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErr(payload?.error || 'Could not submit. Please try again.');
                return;
            }
            if (payload.spam) {
                // Silent success surface for the human path.
                setResult({ threadId: null, threadUrl: null });
                return;
            }
            setResult({
                threadId: payload.threadId,
                threadUrl: payload.threadUrl,
                accessToken: payload.accessToken || null,
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
                    const payload = await r.json();
                    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
                    const lastAi = [...messages].reverse().find(m => m.author_kind === 'ai');
                    const lastSystem = [...messages].reverse().find(m => m.author_kind === 'system');
                    if (lastAi) {
                        if (!cancelled) setAiReply({
                            content: lastAi.body,
                            escalated: payload?.thread?.status === 'awaiting_agent',
                        });
                        return; // stop polling
                    }
                    if (lastSystem && payload?.thread?.status === 'awaiting_agent') {
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
        const t = setTimeout(tick, 2000); // first check after 2s
        return () => { cancelled = true; clearTimeout(t); };
    }, [result?.threadId, result?.accessToken, aiReply]);

    // Hooks are all above — safe to bail now. CMS already filters disabled
    // blocks before mount, but the legacy wrapper and defensive callers rely
    // on this guard.
    if (!data?.enabled) return null;

    const c = { ...SUPPORT_DEFAULT_CONTENT, ...data };
    const id = sectionId || 'customer-support';
    const backgroundVariant = c.backgroundVariant || 'default';
    const sectionClass = [
        'customer-support-block',
        backgroundVariant !== 'default' ? `cms-bg--${backgroundVariant}` : '',
    ].filter(Boolean).join(' ');

    if (result) {
        const waiting = !aiReply && !aiPollExhausted;
        return (
            <SectionFrame id="customer-support" name="Customer Support" enabled={data.enabled}>
                <section id={id} className={sectionClass} style={{ paddingTop: 80, paddingBottom: 80 }}>
                    <div className="container">
                        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
                            <div style={cardStyle}>
                                <CheckCircle2 size={40} color={T.primary} style={{ marginBottom: 12 }} aria-hidden="true" />
                                <h2 className="headline-md" style={{ color: T.text, margin: '0 0 12px' }}>{c.successTitle}</h2>

                                {waiting && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.muted, fontSize: 14, margin: '12px 0 16px' }}>
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
                                        color: '#1F2937',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600, fontSize: 12, color: '#6B7280' }}>
                                            {aiReply.escalated
                                                ? <><AlertTriangle size={14} /> A human is taking over</>
                                                : <><Bot size={14} /> Bee Flow AI replied</>
                                            }
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{aiReply.content}</div>
                                    </div>
                                )}

                                {aiPollExhausted && !aiReply && (
                                    <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>
                                        Our AI is still thinking. We'll email you the moment a reply is ready — no need to wait here.
                                    </p>
                                )}

                                {!waiting && !aiReply && !aiPollExhausted && (
                                    <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>
                                        {c.successBody}
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
                    </div>
                </section>
            </SectionFrame>
        );
    }

    return (
        <SectionFrame id="customer-support" name="Customer Support" enabled={data.enabled}>
            <section id={id} className={sectionClass} style={{ paddingTop: 80, paddingBottom: 80 }}>
                <div className="container">
                    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
                        <EditableText
                            path="customer-support.title"
                            as="h2"
                            className="headline-lg"
                            placeholder="Title"
                            style={{ color: 'inherit', margin: '0 0 12px' }}
                        >
                            {c.title}
                        </EditableText>
                        <EditableText
                            path="customer-support.lead"
                            as="p"
                            multiline
                            placeholder="Intro text"
                            style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: 'inherit', opacity: 0.85, margin: '0 0 32px' }}
                        >
                            {c.lead}
                        </EditableText>

                        <form style={cardStyle} onSubmit={submit} noValidate>
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label style={labelStyle}>{c.nameLabel}</label>
                                    <input
                                        style={inputStyle}
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={c.namePlaceholder}
                                        maxLength={120}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{c.emailLabel}</label>
                                    <input
                                        style={inputStyle}
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder={c.emailPlaceholder}
                                        maxLength={200}
                                    />
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle}>{c.subjectLabel}</label>
                                <input
                                    style={inputStyle}
                                    type="text"
                                    required
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder={c.subjectPlaceholder}
                                    maxLength={200}
                                />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle}>{c.messageLabel}</label>
                                <textarea
                                    style={textareaStyle}
                                    required
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder={c.messagePlaceholder}
                                    maxLength={5000}
                                />
                            </div>
                            {err && <div style={errorStyle}>{err}</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginTop: 12 }}>
                                <button
                                    type="submit"
                                    style={{ ...buttonStyle, opacity: (submitting || preview) ? 0.6 : 1, cursor: preview ? 'not-allowed' : 'pointer' }}
                                    disabled={submitting || preview}
                                >
                                    {submitting ? 'Sending…' : c.submitLabel}
                                    <ArrowRight size={16} aria-hidden="true" />
                                </button>
                                {preview && (
                                    <span style={{ fontSize: 12, color: T.muted }}>
                                        Submitting is disabled in the editor preview.
                                    </span>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
