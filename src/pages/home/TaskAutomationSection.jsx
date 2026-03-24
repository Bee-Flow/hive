import React from 'react';

const CONNECTED_APPS = [
  { icon: '📧', name: 'Gmail', color: '#ea4335' },
  { icon: '📅', name: 'Calendar', color: '#4285f4' },
  { icon: '📁', name: 'Drive', color: '#34a853' },
  { icon: '📊', name: 'Sheets', color: '#0f9d58' },
  { icon: '📝', name: 'Docs', color: '#4285f4' },
  { icon: '📋', name: 'YouTrack', color: '#f59e0b' },
  { icon: '🎙️', name: 'Fireflies', color: '#8b5cf6' },
  { icon: '🔗', name: 'n8n', color: '#ef4444' },
];

const FEATURES = [
  {
    icon: '🔍',
    title: 'Cross-App Scanning',
    desc: 'AI analyses your email, calendar, Drive, Sheets, Docs, meeting transcripts, and project trackers simultaneously — discovering patterns and automation opportunities.',
    color: '#3b82f6',
  },
  {
    icon: '👤',
    title: 'Human-in-the-Loop',
    desc: 'Every automated task requires human approval before execution. AI never acts without your explicit permission — full control, zero risk.',
    color: '#22c55e',
  },
  {
    icon: '⏰',
    title: 'Triggers & Scheduling',
    desc: 'Set time-based schedules or event-driven triggers. Run tasks on a cron schedule or fire them when specific events occur in your connected apps.',
    color: '#f59e0b',
  },
  {
    icon: '📜',
    title: 'AI-Generated Scripts',
    desc: 'AI writes the automation scripts for you. Scripts are generated, reviewed, and executed in isolated environments with full monitoring.',
    color: '#8b5cf6',
  },
  {
    icon: '📊',
    title: 'Execution Monitoring',
    desc: 'Track every task run with detailed logs, success/failure status, and timing metrics. Full audit trail for compliance.',
    color: '#ef4444',
  },
  {
    icon: '🔒',
    title: 'Sandboxed Execution',
    desc: 'All scripts run in Docker-isolated containers with command sandboxing, file lifecycle tracking, and 20-minute idle timeout.',
    color: '#0891b2',
  },
];

const EXAMPLES = [
  { icon: '📧', title: 'Weekly Client Summary', desc: '"Every Friday, summarise all client emails from this week into a Google Sheet with sentiment analysis"' },
  { icon: '✅', title: 'Meeting Action Items', desc: '"After each meeting, extract action items and create YouTrack tickets with assignee and deadline"' },
  { icon: '📋', title: 'Daily Standup Report', desc: '"Every morning at 9:00, compile yesterday\'s completed tasks from YouTrack into a Slack summary"' },
  { icon: '📊', title: 'Sales Pipeline Update', desc: '"When a new email from a prospect arrives, update the deal status in our Sales Sheet and notify the team"' },
];

export default function TaskAutomationSection() {
  return (
    <>
      {/* ── Connected Apps ──────────────────────────────────── */}
      <section className="hp-section" id="task-apps">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Connected Intelligence</span>
            <h2 className="hp-h2">AI that sees across all your apps</h2>
            <p className="hp-body--sm">
              BeeFlow scans your email, calendar, documents, and project trackers simultaneously — discovering automation opportunities you'd never find manually.
            </p>
          </div>

          <div className="hp-reveal hp-d1" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 600, margin: '0 auto 32px' }}>
            {CONNECTED_APPS.map(app => (
              <span key={app.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 24, fontSize: '.85rem', fontWeight: 600,
                background: `${app.color}08`, color: app.color, border: `1.5px solid ${app.color}18`,
              }}>
                {app.icon} {app.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core Features ───────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="task-features">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">How It Works</span>
            <h2 className="hp-h2">Safe, transparent automation</h2>
            <p className="hp-body--sm">
              AI suggests automations, generates scripts, and executes them in sandboxed containers — but only after you approve.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '24px 22px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 12,
                  background: `${f.color}10`, border: `1.5px solid ${f.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>{f.icon}</div>
                <h3 className="hp-h3" style={{ marginBottom: 6, fontSize: '.95rem' }}>{f.title}</h3>
                <p style={{ fontSize: '.83rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Examples ────────────────────────────────────────── */}
      <section className="hp-section" id="task-examples">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Use Cases</span>
            <h2 className="hp-h2">Describe it in plain language</h2>
            <p className="hp-body--sm">
              Tell BeeFlow what you want automated — the AI figures out the connections, writes the script, and runs it on schedule.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {EXAMPLES.map((ex, i) => (
              <div key={ex.title} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '22px 20px' }}>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 10 }}>{ex.icon}</span>
                <h3 className="hp-h3" style={{ marginBottom: 8, fontSize: '.95rem' }}>{ex.title}</h3>
                <p style={{ fontSize: '.83rem', color: '#475569', lineHeight: 1.5, fontStyle: 'italic' }}>{ex.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
