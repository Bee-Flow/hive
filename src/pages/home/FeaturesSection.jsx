import React from 'react';

const FEATURES = [
  {
    icon: '💬',
    title: 'Conversational Workflow Builder',
    desc: 'Describe what you need in plain language. Bee Flow classifies intent, routes to the right model tier, and translates your request into a multi-step automated workflow.',
    tech: 'SSE streaming · Prompt classifier · DAG execution engine',
  },
  {
    icon: '🤖',
    title: 'Multi-Agent Swarm Orchestration',
    desc: 'Deploy specialised AI agents that work in parallel phases, share context through a Hive Mind, and combine browser, terminal, and LLM workers to solve complex tasks.',
    tech: 'Phase-driven orchestrator · Hive Mind shared memory · Parallel execution',
  },
  {
    icon: '🔗',
    title: '43+ Live Integrations',
    desc: 'Gmail, Google Calendar, GitHub, YouTrack, Microsoft 365, WhatsApp, n8n webhooks and more — all available as AI-callable tools with automatic input/output mapping.',
    tech: 'Tool dispatcher · MCP protocol · n8n webhook bridge',
  },
  {
    icon: '🔒',
    title: 'Zero-Knowledge Encryption',
    desc: "End-to-end encrypted conversations with DEK/KEK envelope encryption. Your keys are derived from your password via Argon2id — the server sees only ciphertext.",
    tech: 'Argon2id · AES-256-GCM · HKDF per-conversation keys',
  },
  {
    icon: '🛡️',
    title: 'Three-Layer Content Moderation',
    desc: 'Regex guardrails, self-hosted Llama Guard (1B fast + 8B strong with MarianMT translation), and Azure PII detection — configurable per scope and per organisation.',
    tech: 'Llama Guard 1B/8B · Azure PII · Org Privacy Shield',
  },
  {
    icon: '🔍',
    title: 'Hybrid Knowledge Search',
    desc: 'Upload documents and datasets. Parallel vector + full-text search, score fusion, and cross-encoder reranking on self-hosted hardware — no cloud embedding dependency.',
    tech: 'pgvector · FTS · BAAI/bge-reranker · OpenVINO/CUDA',
  },
  {
    icon: '🌐',
    title: 'Autonomous Browser Agent',
    desc: 'AI navigates the web, fills forms, and extracts information using a three-agent loop (Planner, Executor, Coordinator) with multimodal screenshot grounding and loop detection.',
    tech: 'Playwright · Multimodal grounding · Domain restrictions',
  },
  {
    icon: '💻',
    title: 'Container-Isolated Code Execution',
    desc: 'Python, shell commands, and pip packages run in dedicated Docker containers with command sandboxing, file lifecycle tracking, and 20-minute idle timeout.',
    tech: 'Docker isolation · Command sandboxing · File lifecycle tracking',
  },
  {
    icon: '🎙️',
    title: 'Meeting Recording & AI Enrichment',
    desc: 'Bee Flow joins Google Meet, captures audio via PulseAudio virtual sink, transcribes with Voxtral or WhisperX, then uses Claude to identify speakers and generate action items.',
    tech: 'WhisperX · Voxtral · Claude speaker diarisation',
  },
  {
    icon: '📄',
    title: 'Word Template Auto-Parameterisation',
    desc: 'Upload a .docx template and AI automatically detects fill-in fields across split XML runs, creates a knowledge base, and generates a context-aware template chat interface.',
    tech: 'Cross-run XML reconstruction · Auto-KB creation · Template chat',
  },
  {
    icon: '🔑',
    title: 'OPAQUE Password Authentication',
    desc: 'Your password never leaves your browser. The server stores only a cryptographic record — a database breach cannot expose your password or your encryption keys.',
    tech: 'OPAQUE RFC 9807 · WebAssembly · PAKE',
  },
  {
    icon: '📊',
    title: 'Visual Dashboard & Data Import',
    desc: 'Build dashboards over tasks, AI usage, and custom data with a code-free query builder. Import from Gmail, Sheets, YouTrack and more via AI-generated import scripts.',
    tech: 'Visual query builder · Multi-DB SQL · AES at-query-time decrypt',
  },
];

export default function FeaturesSection({ preview }) {
  const items = preview ? FEATURES.slice(0, 6) : FEATURES;

  return (
    <section className={`hp-section${!preview ? ' hp-section--alt' : ''}`} id="features">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">{preview ? 'Features' : 'All Features'}</span>
          <h2 className="hp-h2">
            {preview ? 'Powerful, private, and built for real work' : 'Everything you need to automate smarter'}
          </h2>
          <p className="hp-body--sm">
            {preview
              ? 'Twelve integrated capabilities — from AI agents to zero-knowledge encryption to autonomous browser automation.'
              : 'From conversational workflow builders to OPAQUE authentication and autonomous agents — built for teams that need power, privacy, and simplicity.'}
          </p>
        </div>
        <div className="hp-features-grid">
          {items.map((f, i) => (
            <div key={f.title} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`}>
              <div className="hp-feature-icon">{f.icon}</div>
              <h3 className="hp-h3" style={{ marginBottom: 7 }}>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="hp-tag--tech">⚙ {f.tech}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
