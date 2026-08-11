import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Bot, User, AlertTriangle, Loader2, Send } from 'lucide-react';
import { API_BASE } from '../../utils/helpers';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

/**
 * Customer Support — a public, CMS-placeable support widget that mirrors the
 * in-app "Help & Support" experience for logged-out website visitors.
 *
 * Flow (same as the app's HelpSupportSection → ThreadDetail):
 *   1. First contact form (name/email/subject/message) → POST /api/support/threads
 *      with source 'marketing'. The backend's honeypot + rate limits apply.
 *   2. We get back { threadId, accessToken } and switch to an inline, live
 *      CONVERSATION: the Bee Flow AI agent replies first, and the visitor can
 *      keep replying. A human takes over on escalation (shown via status +
 *      system/staff messages). View/reply use the per-thread HMAC token, so no
 *      login is needed:
 *        GET  /api/support/threads/:id?token=…           (poll)
 *        POST /api/support/threads/:id/messages?token=…  (reply → re-triggers AI)
 *
 * Two call shapes:
 *   • CMS block      — ProductWebsite renders <CustomerSupport data={...} />.
 *                      Title/intro are inline-editable in ?preview=1; the rest
 *                      (labels, button, confirmation copy, background) is panel-
 *                      editable.
 *   • Legacy wrapper — sections/ContactSection.jsx renders this with the default
 *                      content + a custom sectionId (#contact anchor) so HomePage
 *                      and PricingPage keep working.
 *
 * Styling: the static form/card/button skeleton lives in marketing.css as
 * `.support-*` classes scoped under `.customer-support-block` (NOT under
 * .marketing-root — this widget also renders on the standalone HomePage /
 * PricingPage via ContactSection, so every token reference there carries a
 * hard fallback). Only DYNAMIC values (disabled opacity, scroll caps,
 * per-bubble tints) stay inline, still reading the design tokens through
 * the `T` map with hard fallbacks, mirroring CookieBanner.
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
    successBody: "Our AI assistant is looking through our knowledge base right now. We've also emailed you a link to this conversation so you can pick it back up any time.",
    backgroundVariant: 'surface', // 'default' | 'surface' | 'primary' | 'dark'
};

const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// Public-facing status copy. Mirrors STATUS_LABELS in SupportDrawer.jsx but
// worded for visitors (no internal jargon).
const STATUS_TEXT = {
    open:           'Bee Flow AI is replying…',
    ai_responding:  'Bee Flow AI is replying…',
    awaiting_user:  'Reply from Bee Flow',
    awaiting_agent: 'A Bee Flow teammate is taking over',
    resolved:       'Resolved',
    closed:         'Closed',
};

function formatRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return d.toLocaleDateString();
}

// Design tokens with fallbacks — see component doc. Resolved once at module
// scope as plain CSS-var strings; the browser does the actual resolution.
// Only the values still used INLINE (dynamic/bubble styling) live here;
// the form/card/button skeleton moved to the `.support-*` classes.
const T = {
    surface:'var(--brand-surface, #F3F4F6)',
    text:   'var(--brand-text, #1F2937)',
    muted:  'var(--brand-text-secondary, #6B7280)',
    border: 'var(--border-subtle, #E5E7EB)',
    primary:'var(--brand-primary, #F5A623)',
};

// Per-author-kind bubble appearance. AI = blue tint, staff = green tint —
// same hues the in-app ThreadDetail uses; requester/system = neutral surface.
function bubbleMeta(kind) {
    switch (kind) {
        case 'ai':    return { bg: 'rgba(14,165,233,0.08)',  Icon: Bot,           who: 'Bee Flow AI' };
        case 'staff': return { bg: 'rgba(16,185,129,0.08)',  Icon: User,          who: 'Bee Flow' };
        case 'system':return { bg: T.surface,                Icon: AlertTriangle, who: 'Bee Flow' };
        default:      return { bg: T.surface,                Icon: User,          who: 'You' };
    }
}

const errorStyle = { color: '#dc2626', fontSize: 13, marginTop: 8 };

export default function CustomerSupport({ data, sectionId }) {
    // All hooks run before any conditional return (Rules of Hooks). `preview`
    // is a plain function call, safe to compute up top.
    const preview = isPreviewMode();
    const renderedAt = useRef(Date.now());
    // Unique per-instance prefix for the form-field ids: the block can be
    // placed more than once on a page (CMS block + legacy #contact wrapper),
    // and duplicate ids silently break the label→field association that
    // makes the labels programmatic (WCAG 1.3.1/1.3.5).
    const uid = useId();

    // First-contact form fields.
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [honeypot, setHoneypot] = useState(''); // bot trap
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    // Conversation state — populated once a thread exists. `convo` carries the
    // ids/token needed for the token-gated public view + reply endpoints.
    const [convo, setConvo] = useState(null); // { threadId, accessToken, subject, threadUrl } | null
    const [thread, setThread] = useState(null); // { status, subject, ... } | null
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    // Silent-success surface for the honeypot/spam path (no real thread) or a
    // submission that returned no access token to converse with.
    const [sentDone, setSentDone] = useState(null); // { threadUrl } | null

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
                setSentDone({ threadUrl: null });
                return;
            }
            if (payload.threadId && payload.accessToken) {
                setConvo({
                    threadId: payload.threadId,
                    accessToken: payload.accessToken,
                    subject: subject.trim(),
                    threadUrl: payload.threadUrl || null,
                });
            } else {
                // No token to converse with (shouldn't happen for marketing) —
                // fall back to a static confirmation + link.
                setSentDone({ threadUrl: payload.threadUrl || null });
            }
        } catch (e) {
            setErr(e.message || 'Network error');
        } finally {
            setSubmitting(false);
        }
    };

    // Load the thread + messages via the per-thread access token (no login).
    const loadThread = useCallback(async () => {
        const threadId = convo?.threadId;
        const token = convo?.accessToken;
        if (!threadId || !token) return;
        try {
            const r = await fetch(
                `${API_BASE}/api/support/threads/${threadId}?token=${encodeURIComponent(token)}`,
                { credentials: 'omit' },
            );
            if (r.ok) {
                const payload = await r.json();
                setThread(payload?.thread || null);
                setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
            }
        } catch { /* keep polling */ }
    }, [convo?.threadId, convo?.accessToken]);

    // Poll the conversation every 8s (matching the app's ThreadDetail cadence,
    // a touch faster) until it resolves/closes.
    useEffect(() => {
        if (!convo?.threadId || !convo?.accessToken) return;
        loadThread();
        const done = thread?.status === 'resolved' || thread?.status === 'closed';
        if (done) return; // one final load above; stop polling
        const id = setInterval(loadThread, 8000);
        return () => clearInterval(id);
    }, [loadThread, convo?.threadId, convo?.accessToken, thread?.status]);

    const sendReply = async () => {
        const body = reply.trim();
        if (!body || !convo?.threadId || !convo?.accessToken) return;
        setSending(true);
        try {
            const r = await fetch(
                `${API_BASE}/api/support/threads/${convo.threadId}/messages?token=${encodeURIComponent(convo.accessToken)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body }),
                },
            );
            if (r.ok) {
                setReply('');
                await loadThread(); // surface the new requester message immediately
            }
        } catch { /* swallow — next poll recovers */ }
        finally { setSending(false); }
    };

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

    // Plain function (NOT a component) so the wrapper's element types stay
    // stable across renders. Rendering it as <Shell/> would give it a fresh
    // component identity each render and remount the whole subtree — the form
    // and reply inputs would lose focus on every keystroke and every poll.
    const wrap = (children) => (
        <SectionFrame id="customer-support" name="Customer Support" enabled={data.enabled}>
            <section id={id} className={sectionClass}>
                <div className="container">
                    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
                        {children}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );

    // ── Live conversation view ──────────────────────────────────────────
    if (convo) {
        const status = thread?.status;
        const statusText = STATUS_TEXT[status] || 'Sent';
        const replyable = thread && status !== 'resolved' && status !== 'closed';
        const hasReply = messages.some(m => m.author_kind && m.author_kind !== 'requester');
        const waitingFirst = !hasReply;

        return wrap(
                <div className="support-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <CheckCircle2 size={22} color={T.primary} aria-hidden="true" />
                        <div style={{ minWidth: 0 }}>
                            <h2 className="headline-md" style={{ color: T.text, margin: 0, fontSize: 18 }}>{c.successTitle}</h2>
                            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                                {thread?.subject || convo.subject} · {statusText}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                        {messages.map(m => {
                            const meta = bubbleMeta(m.author_kind);
                            const Icon = meta.Icon;
                            return (
                                <div key={m.id} style={{ background: meta.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', color: T.text }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted, marginBottom: 4 }}>
                                        <Icon size={12} aria-hidden="true" />
                                        <span>{m.author_display || meta.who}</span>
                                        <span style={{ marginLeft: 'auto' }}>{formatRelative(m.created_at)}</span>
                                    </div>
                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55 }}>{m.body}</div>
                                </div>
                            );
                        })}

                        {waitingFirst && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 13, padding: '6px 2px' }}>
                                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                <span>Bee Flow AI is looking through our knowledge base…</span>
                            </div>
                        )}
                    </div>

                    {replyable ? (
                        <div style={{ marginTop: 14 }}>
                            <textarea
                                rows={2}
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                placeholder="Reply…"
                                maxLength={5000}
                                className="support-input"
                                // Inline min-height wins over the class's
                                // 120px floor — the reply box starts compact.
                                style={{ minHeight: 56 }}
                            />
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 12, color: T.muted }}>Our AI replies first; a human takes over if needed.</span>
                                <button
                                    type="button"
                                    onClick={sendReply}
                                    disabled={sending || !reply.trim()}
                                    className="support-submit"
                                    style={{ padding: '8px 16px', fontSize: 14, opacity: (sending || !reply.trim()) ? 0.6 : 1 }}
                                >
                                    <Send size={14} aria-hidden="true" /> {sending ? 'Sending…' : 'Send'}
                                </button>
                            </div>
                        </div>
                    ) : status === 'resolved' || status === 'closed' ? (
                        <p style={{ fontSize: 13, color: T.muted, margin: '14px 0 0' }}>
                            This conversation is {STATUS_TEXT[status].toLowerCase()}. Reply to the email we sent you to reopen it.
                        </p>
                    ) : null}

                    {convo.threadUrl && (
                        <div style={{ marginTop: 14 }}>
                            <a href={convo.threadUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.primary, textDecoration: 'none', fontWeight: 600 }}>
                                Open this conversation in its own page
                                <ArrowRight size={14} aria-hidden="true" />
                            </a>
                        </div>
                    )}
                </div>
        );
    }

    // ── Static confirmation (spam path / no access token) ───────────────
    if (sentDone) {
        return wrap(
                <div className="support-card">
                    <CheckCircle2 size={40} color={T.primary} style={{ marginBottom: 12 }} aria-hidden="true" />
                    <h2 className="headline-md" style={{ color: T.text, margin: '0 0 12px' }}>{c.successTitle}</h2>
                    <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>{c.successBody}</p>
                    {sentDone.threadUrl && (
                        <a href={sentDone.threadUrl} className="support-submit">
                            View the conversation
                            <ArrowRight size={16} aria-hidden="true" />
                        </a>
                    )}
                </div>
        );
    }

    // ── First-contact form ──────────────────────────────────────────────
    return wrap(
        <>
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

            <form className="support-card" onSubmit={submit} noValidate>
                {/* Honeypot — visually hidden but reachable by naive bots.
                    Deliberately NO autocomplete value and no id/htmlFor pair:
                    it must never be offered to (or filled by) a browser's
                    autofill, only by bots that fill every field they find. */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
                    <label>Website (leave blank)
                        <input
                            type="text"
                            name="website_url"
                            tabIndex={-1}
                            autoComplete="off"
                            value={honeypot}
                            onChange={e => setHoneypot(e.target.value)}
                        />
                    </label>
                </div>

                {/* Real fields: explicit htmlFor/id association (the wrapping
                    div breaks implicit association) + name/autocomplete so
                    browsers and assistive tech can identify the purpose of
                    each field (WCAG 1.3.5). Subject/message have no matching
                    autocomplete token — none exists for them. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label className="support-label" htmlFor={`${uid}-name`}>{c.nameLabel}</label>
                        <input
                            id={`${uid}-name`}
                            className="support-input"
                            type="text"
                            name="name"
                            autoComplete="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={c.namePlaceholder}
                            maxLength={120}
                        />
                    </div>
                    <div>
                        <label className="support-label" htmlFor={`${uid}-email`}>{c.emailLabel}</label>
                        <input
                            id={`${uid}-email`}
                            className="support-input"
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder={c.emailPlaceholder}
                            maxLength={200}
                        />
                    </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label className="support-label" htmlFor={`${uid}-subject`}>{c.subjectLabel}</label>
                    <input
                        id={`${uid}-subject`}
                        className="support-input"
                        type="text"
                        name="subject"
                        required
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder={c.subjectPlaceholder}
                        maxLength={200}
                    />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label className="support-label" htmlFor={`${uid}-message`}>{c.messageLabel}</label>
                    <textarea
                        id={`${uid}-message`}
                        className="support-input"
                        name="message"
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
                        className="support-submit"
                        style={{ opacity: (submitting || preview) ? 0.6 : 1, cursor: preview ? 'not-allowed' : 'pointer' }}
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
        </>
        );
}
