import React from 'react';

const EXAMPLE_AGENTS = [
  {
    icon: '📞',
    name: 'CRM Assistant',
    desc: 'Answers customer questions based on your own documentation and knowledge bases',
    color: '#3b82f6',
  },
  {
    icon: '👥',
    name: 'HR Bot',
    desc: 'Handles employee questions about policies, vacation rules, onboarding procedures, and CAO details',
    color: '#22c55e',
  },
  {
    icon: '📊',
    name: 'Sales Analyst',
    desc: 'Analyses sales data from your Sheets and CRM, generates reports and trend insights',
    color: '#f59e0b',
  },
  {
    icon: '📝',
    name: 'Content Writer',
    desc: 'Creates blog posts, social media content, and marketing copy using your brand voice and guidelines',
    color: '#8b5cf6',
  },
  {
    icon: '💻',
    name: 'Code Assistant',
    desc: 'Reviews code, generates scripts, manages GitHub issues, and helps debug — with Docker-sandboxed execution',
    color: '#ef4444',
  },
  {
    icon: '📋',
    name: 'Project Manager',
    desc: 'Tracks tasks in YouTrack, summarises standups, creates retrospective reports from meeting notes',
    color: '#0891b2',
  },
];

const AI_PROVIDERS = [
  { name: 'OpenAI GPT-5', icon: '🟢', desc: 'GPT-4o, GPT-5, o3/o4-mini reasoning' },
  { name: 'Google Gemini', icon: '🔵', desc: 'Gemini 2.5 Pro/Flash, Vertex AI' },
  { name: 'Anthropic Claude', icon: '🟠', desc: 'Claude Sonnet 4, Opus 4' },
  { name: 'Mistral AI', icon: '🟣', desc: 'Mistral Large, Medium, Small' },
  { name: 'Azure OpenAI', icon: '☁️', desc: 'Enterprise-grade, EU-hosted option' },
  { name: 'MiniMax', icon: '🔴', desc: 'MiniMax-M1 reasoning model' },
  { name: 'ElevenLabs', icon: '🔊', desc: 'Text-to-speech for AI Notebooks' },
];

const BUILDER_FEATURES = [
  { icon: '🎨', name: 'Visual Agent Designer', desc: 'Drag-and-drop interface with live preview — no code required' },
  { icon: '📚', name: 'Knowledge Base Linking', desc: 'Attach one or more knowledge bases so the agent answers from your data' },
  { icon: '🔧', name: 'Tool Assignment', desc: 'Enable integrations (Gmail, Drive, GitHub…) per agent — the AI calls them automatically' },
  { icon: '📝', name: 'System Prompt Editor', desc: 'Define personality, tone, expertise, and response style with a rich text editor' },
  { icon: '🌐', name: 'Multi-Language', desc: 'System prompts auto-translate per user language via AI-powered i18n' },
  { icon: '👥', name: 'Team Sharing', desc: 'Share agents with individuals, groups, or the entire organisation with view/edit permissions' },
];

const SWARM_STEPS = [
  { num: '01', icon: '🧠', title: 'Phase Planning', desc: 'The orchestrator breaks a complex task into sequential phases, each with specialised sub-agents.', color: '#3b82f6' },
  { num: '02', icon: '⚡', title: 'Parallel Execution', desc: 'Independent agents within a phase run simultaneously — browser, terminal, and LLM workers in parallel.', color: '#22c55e' },
  { num: '03', icon: '🔗', title: 'Hive Mind Context', desc: 'All agents share findings through a centralised Hive Mind, building collective knowledge across phases.', color: '#f59e0b' },
  { num: '04', icon: '📋', title: 'Synthesis & Report', desc: 'Results from all agents are combined into a unified output — a report, solution, or automated action.', color: '#8b5cf6' },
];

export default function AgentDesignerSection() {
  return (
    <>
      {/* ── Visual Builder ──────────────────────────────────── */}
      <section className="hp-section" id="agent-builder">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">No-Code Builder</span>
            <h2 className="hp-h2">Design agents visually, deploy instantly</h2>
            <p className="hp-body--sm">
              A drag-and-drop agent designer with live preview. Attach knowledge bases, assign tools, define personality — no programming required.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {BUILDER_FEATURES.map((f, i) => (
              <div key={f.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '22px 20px', display: 'flex', alignItems: 'start', gap: 14 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#0f172a', marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: '.82rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Example Agents ──────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="example-agents">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Ready-Made Examples</span>
            <h2 className="hp-h2">Build any expert your team needs</h2>
            <p className="hp-body--sm">
              From customer support to code review — create specialised AI assistants tailored to your workflows.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 960, margin: '0 auto' }}>
            {EXAMPLE_AGENTS.map((agent, i) => (
              <div key={agent.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '24px 22px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${agent.color}10`, border: `1.5px solid ${agent.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 12,
                }}>{agent.icon}</div>
                <h3 className="hp-h3" style={{ marginBottom: 6, fontSize: '.95rem' }}>{agent.name}</h3>
                <p style={{ fontSize: '.83rem', lineHeight: 1.5 }}>{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Providers ────────────────────────────────────── */}
      <section className="hp-section" id="ai-providers">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Model Freedom</span>
            <h2 className="hp-h2">7+ AI providers, you choose</h2>
            <p className="hp-body--sm">
              No vendor lock-in. Pick the right model for each agent — from OpenAI and Google to self-hosted options.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxWidth: 860, margin: '0 auto' }}>
            {AI_PROVIDERS.map((p, i) => (
              <div key={p.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#0f172a' }}>{p.name}</div>
                  <div style={{ fontSize: '.76rem', color: '#64748b' }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Multi-Agent Swarms ──────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="swarm-orchestration">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Advanced</span>
            <h2 className="hp-h2">Multi-agent swarm orchestration</h2>
            <p className="hp-body--sm">
              Deploy specialised AI agents that work in phases, share context through a Hive Mind, and combine browser, terminal, and LLM workers.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {SWARM_STEPS.map((step, i) => (
              <div key={step.num} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 18, alignItems: 'start' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${step.color}12`, border: `1.5px solid ${step.color}28`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {step.icon}
                  <span style={{ fontSize: 9, fontWeight: 800, color: step.color, marginTop: 1 }}>{step.num}</span>
                </div>
                <div>
                  <h3 className="hp-h3" style={{ marginBottom: 4 }}>{step.title}</h3>
                  <p style={{ fontSize: '.85rem', lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
