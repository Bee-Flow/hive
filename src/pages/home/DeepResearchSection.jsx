import React from 'react';

const PIPELINE_PHASES = [
  {
    num: '01',
    icon: '🎯',
    title: 'Smart Clarification',
    desc: 'Before spending tokens on research, an AI Clarifier Agent analyses your query. If ambiguous, it asks 1–3 targeted questions to refine scope, perspective, and timeframe.',
    detail: 'Detects ambiguity · Refines scope · Identifies perspective (technical / business / academic)',
    color: '#f59e0b',
  },
  {
    num: '02',
    icon: '🗺️',
    title: 'DAG-Based Query Planning',
    desc: 'Your question is decomposed into a Directed Acyclic Graph of sub-questions with dependencies, priorities, and search strategies — enabling maximum parallelism.',
    detail: 'Topological sort · Parallel execution groups · Priority ranking · Complexity estimation',
    color: '#3b82f6',
  },
  {
    num: '03',
    icon: '⚡',
    title: 'Parallel Multi-Source Research',
    desc: 'Independent sub-questions execute in parallel across web search, knowledge base, and document analysis workers. A Reflection Agent evaluates coverage and triggers follow-up queries.',
    detail: '3 worker types · Iterative refinement · Coverage scoring (80%+ = sufficient) · Gap detection',
    color: '#22c55e',
  },
  {
    num: '04',
    icon: '📝',
    title: 'Cited Synthesis & Review',
    desc: 'Findings are synthesised into a publication-quality report with inline [N] citations, automatically generated reference list, and a quality review scoring factual accuracy and logical flow.',
    detail: 'Streamed SSE output · Inline citations · 1–10 quality score · Outline → Draft → Review',
    color: '#8b5cf6',
  },
];

const DEPTH_PRESETS = [
  {
    icon: '⚡',
    name: 'Fast',
    questions: '3',
    reflection: '0',
    passes: 'Single-pass draft',
    tokens: '20k',
    time: '~1 min',
    desc: 'Quick overview for simple questions',
  },
  {
    icon: '📋',
    name: 'Normal',
    questions: '5',
    reflection: '1 round',
    passes: 'Draft + Review',
    tokens: '50k',
    time: '~3 min',
    desc: 'Balanced research with quality review',
  },
  {
    icon: '🔬',
    name: 'Detailed',
    questions: '10',
    reflection: '2 rounds',
    passes: 'Outline + Draft + Review',
    tokens: '100k',
    time: '~5 min',
    desc: 'Thorough deep-dive with full synthesis',
  },
];

const AGENTS = [
  { icon: '🎯', name: 'Clarifier Agent', role: 'Analyses query ambiguity' },
  { icon: '🗺️', name: 'Query Planner', role: 'Builds research DAG' },
  { icon: '🌐', name: 'Web Search Worker', role: 'Iterative web research' },
  { icon: '📚', name: 'KB Search Worker', role: 'Knowledge base lookup' },
  { icon: '📊', name: 'Document Analyser', role: 'Cross-references sources' },
  { icon: '🪞', name: 'Reflection Agent', role: 'Evaluates coverage & gaps' },
  { icon: '✍️', name: 'Report Writer', role: 'Streamed synthesis' },
  { icon: '🔍', name: 'Report Reviewer', role: 'Quality scoring (1–10)' },
];

export default function DeepResearchSection() {
  return (
    <>
      {/* ── Pipeline Phases ─────────────────────────────────── */}
      <section className="hp-section" id="deep-research-pipeline">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">How It Works</span>
            <h2 className="hp-h2">A 4-phase research pipeline</h2>
            <p className="hp-body--sm">
              Every query passes through clarification, planning, parallel research, and cited synthesis — orchestrated by 8 specialised AI agents.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 24, maxWidth: 800, margin: '0 auto' }}>
            {PIPELINE_PHASES.map((phase, i) => (
              <div key={phase.num} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `${phase.color}15`,
                  border: `1.5px solid ${phase.color}30`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, lineHeight: 1,
                }}>
                  {phase.icon}
                  <span style={{ fontSize: 9, fontWeight: 800, color: phase.color, marginTop: 2 }}>{phase.num}</span>
                </div>
                <div>
                  <h3 className="hp-h3" style={{ marginBottom: 6 }}>{phase.title}</h3>
                  <p style={{ marginBottom: 8 }}>{phase.desc}</p>
                  <span className="hp-tag--tech">⚙ {phase.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depth Presets ───────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="depth-presets">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Depth Controls</span>
            <h2 className="hp-h2">Choose your research depth</h2>
            <p className="hp-body--sm">
              From quick overviews to exhaustive deep-dives — configure how thorough the pipeline should be.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
            {DEPTH_PRESETS.map((preset, i) => (
              <div key={preset.name} className={`hp-card hp-reveal hp-d${i + 1}`} style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{preset.icon}</div>
                <h3 className="hp-h3" style={{ marginBottom: 4, fontSize: '1.15rem' }}>{preset.name}</h3>
                <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: 16 }}>{preset.desc}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '.78rem' }}>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ color: '#94a3b8' }}>Questions</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{preset.questions}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ color: '#94a3b8' }}>Reflection</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{preset.reflection}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ color: '#94a3b8' }}>Report</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{preset.passes}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ color: '#94a3b8' }}>Token budget</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{preset.tokens}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent Architecture ──────────────────────────────── */}
      <section className="hp-section" id="research-agents">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Under the Hood</span>
            <h2 className="hp-h2">8 specialised AI agents</h2>
            <p className="hp-body--sm">
              Each agent has a single responsibility — from query analysis to quality review — enabling modular, fail-safe orchestration.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 960, margin: '0 auto' }}>
            {AGENTS.map((agent, i) => (
              <div key={agent.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{agent.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#0f172a' }}>{agent.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#64748b' }}>{agent.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
