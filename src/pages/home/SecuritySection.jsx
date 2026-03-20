import React, { useState } from 'react';

const CARDS = [
  {
    icon: '🔐',
    title: 'Zero-Knowledge Encryption',
    tags: ['Argon2id', 'AES-256-GCM', 'HKDF-SHA256'],
    summary: 'End-to-end encrypted conversations. Even Bee Flow\'s servers can\'t read your data — your keys never leave your device.',
    details: [
      'DEK/KEK envelope architecture — Data Encryption Key wrapped by a Key Encryption Key derived from your password',
      'Argon2id KDF: 128 MB memory cost, 4 iterations, 4-way parallelism (OWASP 2026 recommended)',
      'Per-conversation key derivation via HKDF-SHA256 — one leaked key can\'t compromise other conversations',
      'AAD binding (user:conv ID) prevents cross-user and cross-conversation replay attacks',
      'AES-256-GCM with 12-byte random IV per encryption operation (NIST SP 800-38D)',
      'Recovery key: 32 bytes formatted as 8×8 hex groups, wraps DEK independently of password',
      'Transparent Argon2id migration from legacy PBKDF2 — no data loss, hard deadline 2026-06-01',
      'Secure memory clearing via libsodium sodium_memzero() — keys never linger in RAM',
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
      'Brute-force protection: 2^failures second backoff after 3 attempts, hard lockout at 20',
      'Rate limiting: max 10 active login sessions per server, automatic cleanup of expired sessions',
      'Admin reset preserves recovery-wrapped DEK — old data stays accessible via recovery key',
    ],
  },
  {
    icon: '🤖',
    title: 'Three-Layer Content Moderation',
    tags: ['Llama Guard 1B/8B', 'Azure PII', 'MarianMT'],
    summary: 'Every message passes through three independent safety layers and PII detection before reaching the AI or your screen.',
    details: [
      'Layer 1 — Regex Guardrails: user-defined patterns, collection-based management, applied per scope (input/output/tool)',
      'Layer 2 — Self-hosted Llama Guard: Stage 1 (1B model, fast), Stage 2 (8B model, escalation for uncertain results)',
      '14 MLCommons safety categories (S1–S14) evaluated on every message',
      'Multi-language support: MarianMT auto-translates non-English content to English before Llama Guard evaluation',
      'Layer 3 — Azure PII Detection: 20+ PII categories (SSN, IBAN, credit cards, phone numbers, etc.)',
      'Configurable confidence thresholds and per-category enable/disable by org admins',
      'Organisation Privacy Shield: org-level rules override agent-level rules — strictest action wins (delete > redact)',
      'Fail-open design: if guard service is unavailable, content is not blocked (no outage-based censorship)',
    ],
  },
  {
    icon: '🏢',
    title: 'Organisation Privacy Controls',
    tags: ['EU Mode', 'Privacy Shield', 'Web Search Guard'],
    summary: 'Organisation admins have full control over privacy policies that cascade down to every agent and user in the org.',
    details: [
      'EU Mode: restrict AI model usage to EU-hosted providers only — enforced at org level',
      'Web Search Guard: AI search queries validated against compliance criteria before execution; blocked queries logged',
      'Disable Search on Upload: prevents automatic web search when users upload sensitive files',
      'Hierarchical policy merging: org rules merged with agent rules; strictest action always wins',
      'Scope-based control: guardrails configurable per scope (userInput, agentOutput, toolInput, toolOutput)',
      'Decrypt anomaly detection: alert triggered at 50+ decryptions/minute (potential bulk data exfiltration)',
      'Encrypted secret management: API keys stored with AES-256-GCM, key derived from MASTER_ENCRYPTION_KEY via HKDF',
      'Per-org feature flags: tasks, monitoring, integrations can be enabled/disabled per subscription plan',
    ],
  },
];

export default function SecuritySection({ preview }) {
  const cards = preview ? CARDS.slice(0, 2) : CARDS;
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);

  return (
    <section className={`hp-section${preview ? '' : ' hp-section--alt'}`} id="security">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Security &amp; Privacy</span>
          <h2 className="hp-h2">Built for trust, not just compliance</h2>
          <p className="hp-body--sm">
            {preview
              ? 'Zero-knowledge encryption, OPAQUE password authentication, and multi-layer moderation. Click any card for technical specs.'
              : 'Bee Flow is built with Privacy by Design at every layer. Click any card to see the full technical specifications.'}
          </p>
        </div>
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
