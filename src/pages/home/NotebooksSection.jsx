import React from 'react';
import NotebooksDemo from './NotebooksDemo';

const SOURCE_TYPES = [
  { icon: '📄', name: 'PDF', color: '#ef4444' },
  { icon: '📝', name: 'Word', color: '#3b82f6' },
  { icon: '📊', name: 'Excel / CSV', color: '#22c55e' },
  { icon: '📋', name: 'Plain Text', color: '#8b5cf6' },
  { icon: '🌐', name: 'URL', color: '#f59e0b' },
  { icon: '🔵', name: 'Google Drive', color: '#4285f4' },
  { icon: '☁️', name: 'OneDrive', color: '#0078d4' },
  { icon: '🎙️', name: 'Meeting Notes', color: '#ec4899' },
];

const EDITOR_FEATURES = [
  { icon: '✏️', name: 'Rich Text', desc: 'Bold, italic, underline, highlight, code, headings, lists, blockquotes' },
  { icon: '🔄', name: 'AI Rewrite', desc: 'Select text and let AI rewrite, shorten, or expand it' },
  { icon: '✨', name: 'Ask AI', desc: 'Highlight text and ask AI a question about it using your sources' },
  { icon: '🪄', name: 'AI Fill', desc: 'Write {{placeholders}} and AI fills them using your uploaded sources' },
  { icon: '📊', name: 'Tables', desc: 'Insert resizable tables with full row/column management' },
  { icon: '🔀', name: 'Mermaid Diagrams', desc: 'Render flowcharts, sequence diagrams, and mind maps inline' },
];

const STUDIO_TYPES = [
  { group: 'Reports', color: '#3b82f6', items: ['Executive Summary', 'Briefing Doc', 'Blog Post', 'FAQ'] },
  { group: 'Study Aids', color: '#22c55e', items: ['Study Guide', 'Flashcards', 'Knowledge Quiz'] },
  { group: 'Media & Visuals', color: '#8b5cf6', items: ['Audio Podcast', 'Mind Map', 'Data Table'] },
];

export default function NotebooksSection() {
  return (
    <>
      <NotebooksDemo />
      {/* ── 3-Panel Overview ────────────────────────────────── */}
      <section className="hp-section" id="notebooks-overview">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Three Integrated Panels</span>
            <h2 className="hp-h2">Sources, Editor, and Studio — unified</h2>
            <p className="hp-body--sm">
              Upload knowledge, write with AI assistance, and generate content — all in one workspace powered by your own sources.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
            {/* Sources Panel */}
            <div className="hp-card hp-reveal hp-d1" style={{ padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
              <h3 className="hp-h3" style={{ marginBottom: 8 }}>Sources Panel</h3>
              <p style={{ marginBottom: 16 }}>Upload documents, paste URLs, import meeting transcripts — build a knowledge base for AI to reference.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SOURCE_TYPES.map(s => (
                  <span key={s.name} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600,
                    background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20`,
                  }}>
                    {s.icon} {s.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Editor Panel */}
            <div className="hp-card hp-reveal hp-d2" style={{ padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
              <h3 className="hp-h3" style={{ marginBottom: 8 }}>Rich Text Editor</h3>
              <p style={{ marginBottom: 16 }}>TipTap-powered editor with AI inline actions. Select text to rewrite, shorten, expand, or ask AI questions.</p>
              <div style={{ display: 'grid', gap: 6 }}>
                {EDITOR_FEATURES.slice(0, 4).map(f => (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8, background: '#f8fafc', fontSize: '.78rem',
                  }}>
                    <span style={{ fontSize: 14 }}>{f.icon}</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Studio Panel */}
            <div className="hp-card hp-reveal hp-d3" style={{ padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎨</div>
              <h3 className="hp-h3" style={{ marginBottom: 8 }}>Studio & AI Chat</h3>
              <p style={{ marginBottom: 16 }}>Generate 10 content types from your sources — from executive summaries to AI-generated podcasts.</p>
              {STUDIO_TYPES.map(g => (
                <div key={g.group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                    {g.group}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.items.map(item => (
                      <span key={item} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: '.72rem', fontWeight: 500,
                        background: `${g.color}08`, color: '#475569', border: `1px solid ${g.color}15`,
                      }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Editor Features Detail ──────────────────────────── */}
      <section className="hp-section hp-section--alt" id="editor-features">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">AI-Powered Editor</span>
            <h2 className="hp-h2">Write smarter, not harder</h2>
            <p className="hp-body--sm">
              A full-featured rich text editor with AI actions built into the writing flow — not bolted on as an afterthought.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {EDITOR_FEATURES.map((f, i) => (
              <div key={f.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '20px 20px', display: 'flex', alignItems: 'start', gap: 14 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#0f172a', marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: '.82rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hp-reveal hp-d2" style={{ textAlign: 'center', marginTop: 32 }}>
            <span className="hp-tag--tech">⚙ TipTap editor · Markdown support · Auto-save · Word count · PDF/DOCX export</span>
          </div>
        </div>
      </section>
    </>
  );
}
