import React, { useState, useEffect } from 'react';

const TOTAL_LOOP = 16000;

const SOURCES = [
  { icon: '📄', name: 'Product_Roadmap_2025.pdf', type: 'PDF', color: '#ef4444' },
  { icon: '🌐', name: 'docs.beeflow.ai/overview', type: 'URL', color: '#f59e0b' },
  { icon: '🎙️', name: 'Q3 Planning Meeting', type: 'Meeting Notes', color: '#ec4899' },
];

const REPORT_WORDS = `## Q3 Product Roadmap Summary

Based on your uploaded sources, here are the key themes:

**Growth Targets:** The roadmap targets 30% user growth by end of Q3, with EU compliance audit completion as a critical milestone.

**Engineering Priorities:** Search pipeline upgrade is on track. GPU hosting vendor decision required by Friday 26 March.

**Next Steps:** Schedule compliance review, finalise board presentation slides, and complete GPU comparison.`.split(' ');

const STUDIO_ITEMS = [
  { icon: '📝', label: 'Executive Summary', color: '#3b82f6' },
  { icon: '🎧', label: 'Audio Podcast', color: '#8b5cf6' },
  { icon: '🃏', label: 'Flashcards (12)', color: '#22c55e' },
  { icon: '❓', label: 'Knowledge Quiz', color: '#f59e0b' },
];

function usePhase(total) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) % total), 80);
    return () => clearInterval(id);
  }, [total]);
  return elapsed;
}

export default function NotebooksDemo() {
  const elapsed = usePhase(TOTAL_LOOP);

  // How many sources are visible
  const visibleSources = Math.min(SOURCES.length, Math.floor(elapsed / 2200) + 1);
  const sourceDone = elapsed > 6000;

  // Writing phase starts at 6s
  const writeStart = 6000;
  const wordsVisible = sourceDone
    ? Math.min(REPORT_WORDS.length, Math.floor(((elapsed - writeStart) / 5000) * REPORT_WORDS.length))
    : 0;
  const writingDone = wordsVisible >= REPORT_WORDS.length;

  // Studio phase starts at 12s
  const studioStart = 12000;
  const studioVisible = elapsed > studioStart
    ? Math.min(STUDIO_ITEMS.length, Math.floor(((elapsed - studioStart) / 3000) * STUDIO_ITEMS.length) + 1)
    : 0;

  const partialText = REPORT_WORDS.slice(0, wordsVisible).join(' ');

  return (
    <section className="hp-section" id="notebooks-demo">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Live Demo</span>
          <h2 className="hp-h2">See it in action</h2>
          <p className="hp-body--sm">
            Upload your sources, let AI write the report, then generate podcasts, flashcards and quizzes — all from the same notebook.
          </p>
        </div>

        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 10, fontSize: '.8rem', color: '#64748b', fontWeight: 500 }}>
              📓 BeeFlow — AI Notebooks · Q3 Strategy
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: '.68rem', fontWeight: 700,
              color: '#d97706', background: '#fef9c3',
              border: '1px solid #fde68a', borderRadius: 999, padding: '2px 10px',
            }}>● Live Demo</span>
          </div>

          {/* 3-panel layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 180px', minHeight: 320 }}>
            {/* Sources panel */}
            <div style={{
              borderRight: '1px solid rgba(0,0,0,0.07)',
              padding: '16px 12px',
              background: '#fafafa',
            }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {SOURCES.slice(0, visibleSources).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 8px', borderRadius: 8,
                    background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
                    animation: 'hp-bFade .3s ease',
                  }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: '.68rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{s.name}</div>
                      <div style={{ fontSize: '.6rem', color: s.color, fontWeight: 600 }}>{s.type}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: '#16a34a' }}>✓</span>
                  </div>
                ))}
                {visibleSources < SOURCES.length && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', borderRadius: 8,
                    background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.25)',
                    fontSize: '.68rem', color: '#d97706',
                  }}>
                    <span style={{ animation: 'hp-orbF 1s infinite' }}>⏳</span> Adding source...
                  </div>
                )}
              </div>
            </div>

            {/* Editor panel */}
            <div style={{ padding: '16px 18px', overflow: 'hidden' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Rich Text Editor
              </div>
              {sourceDone ? (
                <div style={{
                  fontSize: '.78rem', color: '#334155', lineHeight: 1.8,
                  fontFamily: '-apple-system, sans-serif',
                  whiteSpace: 'pre-line',
                }}>
                  {partialText}
                  {!writingDone && (
                    <span style={{
                      display: 'inline-block', width: 2, height: '1em',
                      background: '#f59e0b', marginLeft: 2,
                      animation: 'hp-cursor 1s steps(1) infinite',
                    }} />
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: '100%', gap: 8, color: '#94a3b8', fontSize: '.8rem', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 28 }}>✍️</span>
                  <span>Adding sources first...</span>
                </div>
              )}
            </div>

            {/* Studio panel */}
            <div style={{
              borderLeft: '1px solid rgba(0,0,0,0.07)',
              padding: '16px 12px',
              background: '#fafafa',
            }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Studio
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {STUDIO_ITEMS.map((item, i) => {
                  const isDone = i < studioVisible - 1;
                  const isGenerating = i === studioVisible - 1 && elapsed > studioStart;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 8px', borderRadius: 8,
                      background: isDone ? `${item.color}08` : '#fff',
                      border: `1px solid ${isDone ? item.color + '25' : 'rgba(0,0,0,0.07)'}`,
                      opacity: (elapsed > studioStart) ? 1 : 0.4,
                      animation: isGenerating ? 'none' : isDone ? 'hp-bFade .3s ease' : 'none',
                    }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <div style={{ fontSize: '.68rem', fontWeight: 600, color: '#334155', flex: 1 }}>
                        {item.label}
                      </div>
                      <span style={{
                        fontSize: '.6rem', fontWeight: 700,
                        color: isDone ? '#16a34a' : isGenerating ? '#d97706' : '#94a3b8',
                      }}>
                        {isDone ? '✓' : isGenerating ? '...' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hp-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
