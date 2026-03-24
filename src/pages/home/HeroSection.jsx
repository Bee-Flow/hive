import React from 'react';

const STATS = [
  { n: '13', l: 'core modules' },
  { n: '40+', l: 'integrations' },
  { n: '7+', l: 'AI providers' },
  { n: '100%', l: 'self-hosted' },
];

export default function HeroSection({ onLoginClick, onNavigate }) {
  const go = (path) => onNavigate && onNavigate(path);

  return (
    <section className="hp-hero" id="hero">
      <div className="hp-orb hp-orb--1" />
      <div className="hp-orb hp-orb--2" />

      <div className="hp-container">
        <div className="hp-hero-content">
          <div className="hp-hero-badge">
            <span>🐝</span>
            <span>Self-Hosted · Private · Enterprise-Grade AI Workplace</span>
          </div>

          <h1 className="hp-h1">
            The AI workplace that makes<br />
            organisations <span className="hp-grad-text">truly work smarter</span>
          </h1>

          <p className="hp-body" style={{ maxWidth: 580, margin: '0 auto' }}>
            Build custom AI assistants, create searchable knowledge bases from all your documents,
            and work smarter across every tool your team already uses —
            <strong> fully on your own infrastructure. Private by design. AVG/GDPR-ready.</strong>
          </p>

          <div className="hp-hero-ctas">
            <button className="hp-btn hp-btn--primary" onClick={onLoginClick}>
              Get Started Free →
            </button>
            <button className="hp-btn hp-btn--outline" onClick={() => go('/features')}>
              Explore features
            </button>
          </div>

          {/* Key value props */}
          <div className="hp-hero-pills">
            {['AVG/GDPR compliant', 'Zero-knowledge encryption', 'No-code agent builder', 'Military-grade AES-256'].map(p => (
              <span key={p} className="hp-hero-pill">✓ {p}</span>
            ))}
          </div>
        </div>

        {/* Problem vs Solution */}
        <div className="hp-reveal" style={{ marginTop: 64 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            maxWidth: 860,
            margin: '0 auto',
          }}>
            <div style={{
              background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 14,
              padding: '24px 22px',
            }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
                ❌ Today's challenges
              </div>
              {[
                'Business data sent to external AI servers',
                'Employees switch between 10+ disconnected apps',
                'Meetings not captured — decisions get lost',
                'Knowledge scattered across folders & systems',
                'IT has no visibility or control over AI usage',
              ].map(p => (
                <div key={p} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '.85rem', color: '#475569', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ef4444', flexShrink: 0 }}>✗</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 14,
              padding: '24px 22px',
            }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#d97706', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
                ✅ With BeeFlow
              </div>
              {[
                'Data stays 100% on your own server',
                'One AI hub for all your apps & workflows',
                'Auto-transcription with action items extracted',
                'Searchable AI knowledge base from all your docs',
                'Full audit trail, RBAC & content moderation',
              ].map(p => (
                <div key={p} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '.85rem', color: '#475569', alignItems: 'flex-start' }}>
                  <span style={{ color: '#d97706', flexShrink: 0 }}>✓</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="hp-reveal" style={{ marginTop: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
            {STATS.map(s => (
              <div key={s.l} className="hp-stat">
                <span className="n">{s.n}</span>
                <span className="l">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
