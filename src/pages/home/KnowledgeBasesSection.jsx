import React from 'react';

const SOURCE_FORMATS = [
  { icon: '📄', name: 'PDF (text + scanned)', color: '#ef4444', desc: 'pdfjs-dist for text, Mistral OCR or Azure Document Intelligence for scanned documents' },
  { icon: '📝', name: 'Word (.docx)', color: '#3b82f6', desc: 'Extracts text, headings, and table structures from Word documents' },
  { icon: '📊', name: 'Excel / CSV', color: '#22c55e', desc: 'Parses spreadsheets and CSV files into structured, searchable chunks' },
  { icon: '📋', name: 'Plain Text / Markdown', color: '#8b5cf6', desc: 'Direct text ingestion with markdown-aware heading structure' },
  { icon: '🌐', name: 'URL Import', color: '#f59e0b', desc: 'Fetches and converts web pages to markdown; auto-falls back to headless browser (Playwright) for SPAs' },
  { icon: '🗺️', name: 'Website Crawler', color: '#0891b2', desc: 'Provide a sitemap URL and BeeFlow crawls up to 50 pages automatically' },
  { icon: '🔵', name: 'Google Drive', color: '#4285f4', desc: 'Import documents directly from your Google Drive account' },
  { icon: '☁️', name: 'OneDrive', color: '#0078d4', desc: 'Import documents from Microsoft OneDrive / SharePoint' },
];

const PIPELINE_STEPS = [
  { num: '01', icon: '📥', title: 'Ingest', desc: 'Upload files, paste URLs, or connect cloud storage. BeeFlow auto-detects format and extracts content.', color: '#3b82f6' },
  { num: '02', icon: '🔍', title: 'Extract', desc: 'Text PDFs via pdfjs-dist, scanned documents via Mistral OCR, JavaScript-rendered pages via Playwright headless browser.', color: '#22c55e' },
  { num: '03', icon: '✂️', title: 'Chunk', desc: 'Markdown-aware chunking splits on heading structure, paragraph boundaries, and tables — with sentence overlap for context.', color: '#f59e0b' },
  { num: '04', icon: '🧮', title: 'Embed', desc: 'Self-hosted BAAI/bge-m3 embeddings (or Azure OpenAI text-embedding-3-small). Stored in PostgreSQL via pgvector.', color: '#8b5cf6' },
  { num: '05', icon: '🔎', title: 'Search', desc: 'Hybrid search combines vector similarity + full-text search, deduplicates results, and re-ranks with a cross-encoder model.', color: '#ef4444' },
];

const SEARCH_FEATURES = [
  { icon: '🔗', name: 'Hybrid Search', desc: 'Vector search (pgvector) + full-text search combined, with score boosting on overlap' },
  { icon: '🏆', name: 'AI Reranking', desc: 'BAAI/bge-reranker-v2-m3 cross-encoder model re-scores and re-orders results by relevance' },
  { icon: '📌', name: 'Source Citations', desc: 'AI answers include exact document name and section references — full traceability' },
  { icon: '🔄', name: 'Re-indexing', desc: 'Switch embedding models and re-index all documents with one click — zero data loss' },
  { icon: '🚫', name: 'Deduplication', desc: 'Automatic content-hash check prevents duplicate documents from cluttering your knowledge base' },
  { icon: '⚡', name: 'GPU Accelerated', desc: 'Self-hosted inference with NVIDIA CUDA, Intel OpenVINO, or CPU fallback — your data stays local' },
];

export default function KnowledgeBasesSection() {
  return (
    <>
      {/* ── Supported Sources ───────────────────────────────── */}
      <section className="hp-section" id="kb-sources">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Data Sources</span>
            <h2 className="hp-h2">Ingest knowledge from anywhere</h2>
            <p className="hp-body--sm">
              Upload files, paste URLs, crawl websites, or connect cloud storage. BeeFlow extracts, chunks, and indexes everything automatically.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, maxWidth: 960, margin: '0 auto' }}>
            {SOURCE_FORMATS.map((s, i) => (
              <div key={s.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '18px 18px', display: 'flex', alignItems: 'start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${s.color}10`, border: `1px solid ${s.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#0f172a', marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ingestion Pipeline ──────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="kb-pipeline">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Processing Pipeline</span>
            <h2 className="hp-h2">From raw document to searchable knowledge</h2>
            <p className="hp-body--sm">
              A 5-step pipeline: ingest, extract, chunk, embed, and search — with OCR, headless browser fallback, and AI deduplication built in.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {PIPELINE_STEPS.map((step, i) => (
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

      {/* ── Hybrid Search ───────────────────────────────────── */}
      <section className="hp-section" id="kb-search">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Search & Retrieval</span>
            <h2 className="hp-h2">Hybrid search with AI reranking</h2>
            <p className="hp-body--sm">
              Parallel vector and full-text search, combined with cross-encoder reranking on self-hosted hardware — no cloud dependency.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {SEARCH_FEATURES.map((f, i) => (
              <div key={f.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '22px 20px', display: 'flex', alignItems: 'start', gap: 14 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#0f172a', marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: '.82rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hp-reveal hp-d2" style={{ textAlign: 'center', marginTop: 28 }}>
            <span className="hp-tag--tech">⚙ pgvector · BAAI/bge-m3 · bge-reranker-v2-m3 · NVIDIA CUDA / Intel OpenVINO / CPU</span>
          </div>
        </div>
      </section>
    </>
  );
}
