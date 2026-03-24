import React from 'react';

const STEPS = [
  {
    num: '1',
    icon: '🤖',
    title: 'Build your own AI expert — no code needed',
    desc: 'Create custom AI assistants tailored to your organisation with a visual no-code designer. Choose from 7+ AI providers including local models, attach knowledge bases, and configure the assistant for your exact use case.',
    ex: '"Create an HR assistant that answers questions about our employment contracts, vacation policies, and onboarding procedures — based on our own documents."',
    tech: 'No-code agent designer · 7+ AI providers (incl. local) · Knowledge base linking · No programming required',
  },
  {
    num: '2',
    icon: '🧠',
    title: 'Connect your knowledge & tools',
    desc: 'Upload documents, connect Google Workspace, Microsoft 365, WhatsApp, GitHub and more. BeeFlow builds a searchable AI memory from all your existing knowledge — with source references on every answer.',
    ex: 'BeeFlow ingests your PDFs, crawls your website, and indexes your Drive — then answers questions with exact document and section citations.',
    tech: 'Hybrid vector + full-text search · OCR for scanned docs · 40+ integrations · Website crawler',
  },
  {
    num: '3',
    icon: '🔒',
    title: 'Stay in control — private, secure, compliant',
    desc: 'Everything runs on your own server. Zero-knowledge encryption means even your admins can\'t read your data. Full RBAC, audit trails, content moderation, and PII detection — AVG/GDPR compliant out of the box.',
    ex: '"Our legal team needed full data sovereignty. BeeFlow runs on our own infrastructure — we own every byte."',
    tech: 'AES-256-GCM · Argon2id · Llama Guard · RBAC · OPAQUE auth · Self-hosted',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="hp-section hp-section--alt" id="how-it-works">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">How It Works</span>
          <h2 className="hp-h2">Your AI workplace, set up in minutes</h2>
          <p className="hp-body--sm">
            No technical knowledge required. Build your own AI assistants, connect your knowledge, and keep full control of your data — all from one platform that runs on your own servers.
          </p>
        </div>
        <div className="hp-steps">
          {STEPS.map((s, i) => (
            <div key={s.num} className={`hp-step hp-reveal hp-d${i + 1}`}>
              <div className="hp-step-num">{s.icon}</div>
              <h3 className="hp-h3" style={{ marginBottom: 8 }}>{s.title}</h3>
              <p>{s.desc}</p>
              <div className="hp-step-ex">"{s.ex}"</div>
              <span className="hp-tag--tech" style={{ marginTop: 12, display: 'inline-flex' }}>⚙ {s.tech}</span>
            </div>
          ))}
        </div>

        {/* Platform highlights */}
        <div className="hp-reveal" style={{ marginTop: 64 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '🎙️', title: 'Meeting Notes', desc: 'Upload a recording or send a bot to your Google Meet. BeeFlow transcribes, identifies speakers, and extracts structured action items — in 14+ languages.' },
              { icon: '📚', title: 'AI Knowledge Bases', desc: 'Build searchable knowledge bases from PDFs, Word, Excel, URLs and sitemaps. Every answer comes with exact source and section references.' },
              { icon: '📓', title: 'AI Notebooks', desc: 'A research workspace where you add sources and generate summaries, FAQ, flashcards, quizzes, and audio podcasts — automatically.' },
              { icon: '📄', title: 'Document Templates', desc: 'Upload a Word template — BeeFlow auto-detects fill-in fields and completes the entire document in one click based on your data.' },
              { icon: '📂', title: 'Projects & Sharing', desc: 'Group conversations, knowledge bases, and AI instructions into projects. Share with your team with view/edit permissions and per-project AI memories.' },
              { icon: '📊', title: 'Monitoring Dashboards', desc: 'Build visual dashboards over your apps with a no-code query builder. Import from Gmail, Calendar, Sheets, YouTrack and more.' },
            ].map(c => (
              <div key={c.title} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: '20px 18px' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#0f172a', marginBottom: 5 }}>{c.title}</div>
                <div style={{ fontSize: '.82rem', color: '#334155', lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
