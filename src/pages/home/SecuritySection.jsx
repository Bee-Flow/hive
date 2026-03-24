import React, { useState } from 'react';

const CARDS = [
  {
    icon: '🏛️',
    title: 'Data Sovereignty & AVG/GDPR Compliance',
    tags: ['Self-hosted', 'On-premise', 'EU Mode', 'No vendor lock-in'],
    summary: 'Your data never leaves your infrastructure. BeeFlow runs entirely on your own servers — no mandatory cloud calls, no data sent to third parties, full compliance with AVG/GDPR out of the box.',
    details: [
      'Fully self-hosted on your own server or private cloud — data never leaves your environment',
      'EU Mode: restrict all AI model usage to EU-hosted providers only, enforced at org level',
      'No phone-home telemetry — BeeFlow does not collect usage data or send analytics externally',
      'All files, documents and knowledge bases stored encrypted on your own storage (RustFS/S3-compatible)',
      'Web Search Guard: AI search queries validated against compliance criteria before execution; blocked queries logged',
      'Encrypted secret management: API keys stored with AES-256-GCM, key derived via HKDF — never in plaintext',
      'Audit trail: every AI action, integration call, and data access logged for compliance reporting',
      'Containerised deployment (Docker Compose) — isolated services, no shared infrastructure with other tenants',
    ],
  },
  {
    icon: '🔐',
    title: 'Zero-Knowledge Encryption',
    tags: ['Argon2id', 'AES-256-GCM', 'HKDF-SHA256'],
    summary: 'End-to-end encrypted conversations. Even BeeFlow\'s server operators can\'t read your data — your keys never leave your device.',
    details: [
      'DEK/KEK envelope architecture — Data Encryption Key wrapped by a Key Encryption Key derived from your password',
      'Argon2id KDF: 128 MB memory cost, 4 iterations, 4-way parallelism (OWASP 2026 recommended)',
      'Per-conversation key derivation via HKDF-SHA256 — one leaked key can\'t compromise other conversations',
      'AAD binding (user:conv ID) prevents cross-user and cross-conversation replay attacks',
      'AES-256-GCM with 12-byte random IV per encryption operation (NIST SP 800-38D)',
      'Recovery key: 32 bytes formatted as 8×8 hex groups, wraps DEK independently of password',
      'Secure memory clearing via libsodium sodium_memzero() — keys never linger in RAM after use',
      'Key rotation: recovery keys can be regenerated; password changes re-wrap the DEK without data loss',
    ],
  },
  {
    icon: '🛡️',
    title: 'Zero-Knowledge Password Auth (OPAQUE)',
    tags: ['RFC 9807', 'WebAssembly', 'PAKE'],
    summary: 'Your password never leaves your browser. OPAQUE is a cryptographic protocol where the server never sees your password — not even during login.',
    details: [
      'OPAQUE PAKE (RFC 9807) — Password Authenticated Key Exchange via WebAssembly',
      'Server stores only a cryptographic record — your password cannot be leaked, even via a database breach',
      'After OPAQUE authentication, password is used client-side to derive the KEK and unlock the DEK',
      'SSO users (Google/Microsoft/Nextcloud OAuth) use OPAQUE for their encryption PIN too',
      'Automatic migration path: bcrypt users migrate to OPAQUE silently at next login',
      'Brute-force protection: exponential backoff after 3 failed attempts, hard lockout at 20',
      'Recovery key rate limiting: max 10 attempts with backoff, hard lockout after exhaustion',
      'Admin reset preserves recovery-wrapped DEK — old data stays accessible via recovery key',
    ],
  },
  {
    icon: '🤖',
    title: 'AI Content Moderation & PII Detection',
    tags: ['Llama Guard 1B/8B', '28+ PII categories', 'Self-hosted'],
    summary: 'Every message passes through a self-hosted three-layer safety pipeline and 28+ category PII detection — no data sent to external moderation APIs.',
    details: [
      'Layer 1 — Regex Guardrails: user-defined patterns, collection-based management, applied per scope (input/output/tool)',
      'Layer 2 — Self-hosted Llama Guard: Stage 1 (1B model, fast), Stage 2 (8B model, escalation for uncertain results)',
      '14 MLCommons safety categories (S1–S14) evaluated on every message; MarianMT auto-translates non-English content',
      'Layer 3 — PII Detection: 28+ categories including IBAN, creditcard, BSN/SSN, passport numbers, API keys, passwords',
      'Configurable sensitivity per category: in/out per organisation, real-time before data is stored',
      'Organisation Privacy Shield: org-level rules cascade down to all agents — strictest action wins',
      'Redis caching: repeated moderation checks served from cache for speed',
      'GPU-accelerated: optional NVIDIA CUDA support for high-traffic deployments',
    ],
  },
  {
    icon: '🏢',
    title: 'RBAC & Organisation Controls',
    tags: ['5 roles', '20+ permissions', 'Multi-org', 'SSO'],
    summary: 'Organisation admins have full control: who sees what, which AI models are allowed, which integrations are enabled, and what automations can run.',
    details: [
      'Roles: Admin, Org Admin, Agent Admin, Agent Editor, User — each with precisely scoped permissions',
      '20+ fine-grained permissions: chat, manage agents, components, AI config, monitoring, security, etc.',
      'Group-based access: users assigned to groups, groups scoped to organisations',
      'SSO support: Google, Microsoft Azure AD, and Nextcloud — any team can log in with existing credentials',
      'Subscription management built-in: plans, per-org message/token/cost limits, overage control',
      'Usage tracking per agent, model, and action — full visibility over AI spend',
      'Decrypt anomaly detection: alert triggered at 50+ decryptions/minute (potential bulk data exfiltration)',
      'Per-org feature flags: tasks, monitoring, integrations enabled/disabled per plan',
    ],
  },
];

export default function SecuritySection({ preview }) {
  const cards = preview ? CARDS.slice(0, 3) : CARDS;
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);

  return (
    <section className={`hp-section${preview ? '' : ' hp-section--alt'}`} id="security">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Security, Privacy & Data Sovereignty</span>
          <h2 className="hp-h2">
            {preview ? 'Your data stays yours — always' : 'Privacy by design, not just compliance'}
          </h2>
          <p className="hp-body--sm">
            {preview
              ? 'BeeFlow runs entirely on your own infrastructure. Zero-knowledge encryption, self-hosted content moderation, and full AVG/GDPR compliance — without compromise. Click any card for technical specs.'
              : 'Every architectural decision starts from privacy. Self-hosted infrastructure, zero-knowledge encryption, OPAQUE authentication, and a three-layer self-hosted moderation pipeline — no data leaves your environment.'}
          </p>
        </div>

        {/* Sovereignty highlight bar */}
        {preview && (
          <div className="hp-reveal" style={{ marginBottom: 32 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
            }}>
              {[
                { icon: '🏛️', text: '100% self-hosted — data never leaves your server' },
                { icon: '🔐', text: 'Zero-knowledge — even admins can\'t read your data' },
                { icon: '🇪🇺', text: 'AVG/GDPR compliant out of the box' },
                { icon: '🔒', text: 'AES-256-GCM · Argon2id · OPAQUE RFC 9807' },
              ].map(item => (
                <div key={item.text} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: '.82rem',
                  color: '#334155',
                  fontWeight: 500,
                }}>
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="hp-security-grid">
          {cards.map((c, i) => (
            <div
              key={c.title}
              className={`hp-sec-card hp-reveal hp-d${(i % 2) + 1}${open === i ? ' open' : ''}`}
            >
              <div className="hp-sec-hdr" onClick={() => toggle(i)}>
                <div className="hp-sec-icon">{c.icon}</div>
                <div className="hp-sec-info">
                  <h3>{c.title}</h3>
                  <p>{c.summary}</p>
                  <div className="hp-sec-info-tags">
                    {c.tags.map(t => <span key={t} className="hp-tag--sec">{t}</span>)}
                  </div>
                </div>
                <span className="hp-sec-toggle">▾</span>
              </div>
              <div className="hp-sec-body">
                <div className="hp-sec-body-inner">
                  <ul>
                    {c.details.map(d => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
