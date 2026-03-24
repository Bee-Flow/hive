import React from 'react';
import WebSearchDemo from './WebSearchDemo';

const WEB_PIPELINE = [
  { num: '01', icon: '🔍', title: 'Query Expansion', desc: 'Automatically generates query variants for broader coverage — removes filter words, expands short queries.', color: '#3b82f6' },
  { num: '02', icon: '🌐', title: 'Multi-Provider Search', desc: 'Searches via Serper.dev (Google Search API), Bing Search API, or Tavily — configurable per deployment.', color: '#22c55e' },
  { num: '03', icon: '📄', title: 'Full-Page Fetch', desc: 'Fetches complete web pages, extracts content, and normalises to clean markdown. Knowledge Graph and Answer Box data included.', color: '#f59e0b' },
  { num: '04', icon: '🤖', title: 'AI Cleanup', desc: 'A local LLM (Qwen3.5-2B via vLLM) processes results into structured, readable summaries with source citations.', color: '#8b5cf6' },
  { num: '05', icon: '🏆', title: 'AI Reranking', desc: 'A cross-encoder model re-scores all results by relevance for the specific question. Redis caching for repeated queries.', color: '#ef4444' },
];

const KB_SEARCH = [
  { icon: '🔗', name: 'Vector Search', desc: 'pgvector (PostgreSQL) finds semantically similar documents using BAAI/bge-m3 embeddings' },
  { icon: '📝', name: 'Full-Text Search', desc: 'PostgreSQL FTS finds exact word matches — complementing vector similarity' },
  { icon: '🔀', name: 'Merge & Deduplicate', desc: 'Combines both result sets, boosts scores on overlap, removes duplicates' },
  { icon: '🏆', name: 'Cross-Encoder Reranking', desc: 'BAAI/bge-reranker-v2-m3 re-orders final results by relevance to the query' },
  { icon: '📊', name: 'Score Threshold', desc: 'Automatically filters out weak results below configurable confidence thresholds' },
  { icon: '☁️', name: 'Azure Fallback', desc: 'Can use Azure OpenAI (text-embedding-3-small) as an alternative to local embeddings' },
];

const GPU_MODELS = [
  { name: 'BAAI/bge-m3', purpose: 'Embeddings', desc: 'Converts documents and queries to vectors' },
  { name: 'BAAI/bge-reranker-v2-m3', purpose: 'Reranking', desc: 'Re-scores search results by relevance' },
  { name: 'Qwen3.5-2B (vLLM)', purpose: 'AI Cleanup', desc: 'Summarises and cleans web page content' },
];

const HARDWARE = [
  { icon: '🟢', name: 'NVIDIA CUDA', desc: 'FP16 on GPU — half VRAM usage, fastest inference' },
  { icon: '🔵', name: 'Intel OpenVINO', desc: 'AVX-512 / Intel GPU acceleration — no NVIDIA required' },
  { icon: '⚪', name: 'PyTorch CPU', desc: 'Fallback for any hardware — runs on standard servers' },
];

export default function SearchEngineSection() {
  return (
    <>
      <WebSearchDemo />
      {/* ── Web Search Pipeline ──────────────────────────────── */}
      <section className="hp-section" id="web-search">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Web Search</span>
            <h2 className="hp-h2">5-step web search pipeline</h2>
            <p className="hp-body--sm">
              AI agents search the web via Google, Bing, or Tavily — with automatic query expansion, full-page extraction, and AI-powered result cleanup.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {WEB_PIPELINE.map((step, i) => (
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

      {/* ── Hybrid KB Search ────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="kb-hybrid-search">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Knowledge Base Search</span>
            <h2 className="hp-h2">Hybrid search with 6 stages</h2>
            <p className="hp-body--sm">
              Vector similarity and full-text search run in parallel, results are merged, deduplicated, and re-ranked by a cross-encoder model.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, maxWidth: 900, margin: '0 auto' }}>
            {KB_SEARCH.map((f, i) => (
              <div key={f.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '20px 18px', display: 'flex', alignItems: 'start', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#0f172a', marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: '.8rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GPU Inference Server ─────────────────────────────── */}
      <section className="hp-section" id="gpu-inference">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Self-Hosted AI</span>
            <h2 className="hp-h2">Local GPU inference server</h2>
            <p className="hp-body--sm">
              Embeddings, reranking, and web cleanup run on your own hardware — no data leaves your network. Supports NVIDIA, Intel, and CPU fallback.
            </p>
          </div>

          {/* Models */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, maxWidth: 860, margin: '0 auto 28px' }}>
            {GPU_MODELS.map((m, i) => (
              <div key={m.name} className={`hp-card hp-reveal hp-d${i + 1}`} style={{ padding: '22px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{m.purpose}</div>
                <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#0f172a', marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: '.8rem', color: '#64748b' }}>{m.desc}</div>
              </div>
            ))}
          </div>

          {/* Hardware support */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
            {HARDWARE.map(h => (
              <div key={h.name} className="hp-card hp-reveal hp-d1" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{h.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#0f172a' }}>{h.name}</div>
                  <div style={{ fontSize: '.75rem', color: '#64748b' }}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hp-reveal hp-d2" style={{ textAlign: 'center', marginTop: 24 }}>
            <span className="hp-tag--tech">⚙ OpenAI-compatible API · /v1/embeddings · /v1/rerank · FP16 on GPU · Redis-cached results</span>
          </div>
        </div>
      </section>
    </>
  );
}
