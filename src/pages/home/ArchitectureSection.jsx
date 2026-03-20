import React from 'react';

const LAYERS = [
  {
    label: 'Frontend',
    tags: ['React 18 + Vite', 'AgentHub UI', 'Chat Engine', 'Admin Dashboard', 'AI Designer'],
    detail: '29+ components · useChatEngine (25+ SSE events) · 87KB AI Component Designer',
  },
  {
    label: 'Backend Core',
    tags: ['Node.js / Express', 'Agent Runtime', 'Tool Dispatcher', 'Execution Engine', 'Guardrails Pipeline'],
    detail: '50+ server modules · chatStream.js (1434 lines) · Provider adapters for 7 AI platforms',
  },
  {
    label: 'AI Providers',
    tags: ['OpenAI / GPT-5', 'Claude Sonnet/Opus', 'Google Gemini', 'Vertex AI', 'Mistral', 'Azure OpenAI'],
    detail: 'Unified streaming interface · Auto provider detection · Reasoning token support',
  },
  {
    label: 'Python Services',
    tags: ['Guard Service (Llama Guard)', 'Search Service (pgvector + FTS)', 'Inference Server (OpenVINO/CUDA)', 'WhisperX Transcription'],
    detail: 'FastAPI microservices · Redis-cached results · Intel OpenVINO + CUDA GPU backends',
  },
  {
    label: 'Data Layer',
    tags: ['PostgreSQL + pgvector', 'Redis Cache', 'RustFS (S3)', 'Docker Containers'],
    detail: '3 PostgreSQL databases · Vector similarity search · AES-256-GCM encrypted secrets',
  },
];

const STATS = [
  { n: '43+', l: 'live integrations' },
  { n: '7', l: 'AI providers' },
  { n: '22', l: 'technical novelties' },
  { n: '25+', l: 'SSE event types' },
  { n: '12', l: 'agent capabilities' },
  { n: '2250h', l: 'R&D logged' },
  { n: '3', l: 'moderation layers' },
  { n: '5', l: 'containerised services' },
];

export default function ArchitectureSection() {
  return (
    <section className="hp-section" id="architecture">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Architecture</span>
          <h2 className="hp-h2">A fully integrated, self-hosted stack</h2>
          <p className="hp-body--sm">
            Every layer is designed to work together — and to run entirely on your own infrastructure. No mandatory cloud calls, no data leaving your environment.
          </p>
        </div>

        <div className="hp-arch">
          {LAYERS.map((layer, i) => (
            <React.Fragment key={layer.label}>
              <div className={`hp-arch-layer hp-reveal hp-d${i + 1}`}>
                <div className="hp-arch-lbl">{layer.label}</div>
                <div style={{ flex: 1 }}>
                  <div className="hp-arch-items">
                    {layer.tags.map(t => (
                      <span key={t} className="hp-arch-tag">{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 6 }}>{layer.detail}</div>
                </div>
              </div>
              {i < LAYERS.length - 1 && (
                <div className="hp-arch-arrow">↓</div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="hp-stats hp-reveal" style={{ marginTop: 52 }}>
          {STATS.map(s => (
            <div key={s.l} className="hp-stat">
              <span className="n">{s.n}</span>
              <span className="l">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
