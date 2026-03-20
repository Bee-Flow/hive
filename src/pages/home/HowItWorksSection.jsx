import React from 'react';

const STEPS = [
  {
    num: '1',
    icon: '💬',
    title: 'Describe in plain language',
    desc: 'Type what you need — in any language. Bee Flow classifies your request, selects the right AI model tier, and determines which tools and agents are needed.',
    ex: '"Summarise all emails from last week about the budget, create a to-do list, and schedule a follow-up meeting with finance."',
    tech: 'Prompt classifier · Two-layer scoring · Auto model tier selection',
  },
  {
    num: '2',
    icon: '⚙️',
    title: 'Agents work for you',
    desc: 'One or more AI agents execute your request — calling integrations, searching your knowledge base, browsing the web, running code, or conferring with each other in a multi-agent swarm.',
    ex: 'Simultaneously reads Gmail, queries your knowledge base, and checks your Google Calendar — then drafts a reply and creates a YouTrack task.',
    tech: 'Swarm orchestrator · Tool dispatcher · Browser/terminal agents',
  },
  {
    num: '3',
    icon: '✅',
    title: 'Review and act',
    desc: 'Results stream back in real-time. Review drafts, approve actions, download files, or ask follow-up questions. Everything is encrypted end-to-end and never stored in plaintext.',
    ex: 'AI generates the email draft and calendar invite — you approve with one click. The conversation key is derived fresh each session.',
    tech: 'SSE streaming · Zero-knowledge encryption · Abort/retry/edit',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="hp-section hp-section--alt" id="how-it-works">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">How It Works</span>
          <h2 className="hp-h2">From intent to outcome in seconds</h2>
          <p className="hp-body--sm">
            No workflow diagrams to draw, no code to write. Just describe what you want and Bee Flow handles the rest.
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

        {/* Extended capability callouts */}
        <div className="hp-reveal" style={{ marginTop: 64 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '🧠', title: 'Memory across sessions', desc: 'Bee Flow extracts and stores structured memories — people, preferences, projects — and retrieves them automatically.' },
              { icon: '🔄', title: 'Round-table debates', desc: 'Multiple specialised agents discuss, debate, and reach consensus on complex research or strategy questions.' },
              { icon: '📅', title: 'Scheduled automation', desc: 'Set workflows to run on a schedule — daily reports, weekly summaries, automated follow-ups — without manual triggers.' },
              { icon: '🔌', title: 'Bring your own tools', desc: 'Connect any tool via MCP protocol or n8n webhooks. If it has an API, Bee Flow can call it.' },
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
