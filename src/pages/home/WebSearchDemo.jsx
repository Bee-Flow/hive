import React, { useState, useEffect } from 'react';

const TOTAL_LOOP = 18000;

const QUERY = 'What are the EU AI Act requirements for high-risk AI systems in 2025?';

const STEPS = [
  {
    num: '01', icon: '🔍', label: 'Query Expansion', color: '#3b82f6', delay: 1800,
    detail: [
      '"EU AI Act high-risk requirements 2025"',
      '"European AI regulation compliance checklist"',
      '"EU Artificial Intelligence Act Article 13 obligations"',
    ],
  },
  {
    num: '02', icon: '🌐', label: 'Searching via Bing', color: '#22c55e', delay: 4000,
    detail: ['8 results found', 'europa.eu · eur-lex.europa.eu · ai-act.eu'],
  },
  {
    num: '03', icon: '📄', label: 'Fetching full pages', color: '#f59e0b', delay: 6000,
    detail: ['europa.eu/news/artificial-intelligence-act', 'eur-lex.europa.eu/legal-content/EN/', 'ai-act.eu/summary'],
  },
  {
    num: '04', icon: '🤖', label: 'AI Cleanup (Qwen3.5-2B)', color: '#8b5cf6', delay: 9000,
    detail: ['Processing 3 pages · removing boilerplate', 'Structuring content · extracting key sections'],
  },
  {
    num: '05', icon: '🏆', label: 'Cross-encoder Reranking', color: '#ef4444', delay: 11500,
    scores: [
      { url: 'eur-lex.europa.eu', score: 0.97 },
      { url: 'ai-act.eu', score: 0.89 },
      { url: 'europa.eu', score: 0.81 },
    ],
  },
];

const ANSWER_WORDS = `Under the EU AI Act (effective August 2024), high-risk AI systems must comply with requirements including: **risk management systems**, **data governance practices**, **technical documentation**, **transparency obligations** for users, **human oversight** mechanisms, and **accuracy & robustness** standards. Organizations deploying high-risk AI must register systems in a public EU database before market placement.`.split(' ');

const SOURCES = [
  { url: 'eur-lex.europa.eu', title: 'EU AI Act — Official Text', tag: 'EUR-Lex' },
  { url: 'ai-act.eu', title: 'AI Act Compliance Summary', tag: 'ai-act.eu' },
  { url: 'europa.eu', title: 'European Commission — AI Regulation', tag: 'EU Commission' },
];

function usePhase(total) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) % total), 60);
    return () => clearInterval(id);
  }, [total]);
  return elapsed;
}

export default function WebSearchDemo() {
  const elapsed = usePhase(TOTAL_LOOP);

  // Typing animation for the query
  const queryVisible = Math.min(QUERY.length, Math.floor(elapsed / 40));
  const queryDone = queryVisible >= QUERY.length;

  // Steps
  const answerStart = 13500;
  const wordsVisible = elapsed > answerStart
    ? Math.min(ANSWER_WORDS.length, Math.floor(((elapsed - answerStart) / 4000) * ANSWER_WORDS.length))
    : 0;

  return (
    <section className="hp-section" id="search-demo">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Live Demo</span>
          <h2 className="hp-h2">See the search pipeline in action</h2>
          <p className="hp-body--sm">
            Watch how BeeFlow expands your query, searches the web, fetches full pages, and ranks results — all on your own server.
          </p>
        </div>

        <div style={{
          maxWidth: 860, margin: '0 auto',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 18px', background: '#f8fafc',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <span style={{ marginLeft: 10, fontSize: '.8rem', color: '#64748b', fontWeight: 500 }}>
              🔍 BeeFlow — Web Search
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: '.68rem', fontWeight: 700,
              color: '#d97706', background: '#fef9c3',
              border: '1px solid #fde68a', borderRadius: 999, padding: '2px 10px',
            }}>● Live Demo</span>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Query input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              background: '#f8fafc',
              border: '1.5px solid rgba(245,158,11,0.35)',
              borderRadius: 99,
              fontSize: '.85rem', color: '#0f172a',
            }}>
              <span style={{ color: '#94a3b8' }}>🔍</span>
              <span>{QUERY.slice(0, queryVisible)}</span>
              {!queryDone && (
                <span style={{
                  display: 'inline-block', width: 2, height: '1em',
                  background: '#f59e0b', marginLeft: 1,
                  animation: 'hp-cursor 0.9s steps(1) infinite',
                }} />
              )}
            </div>

            {/* Pipeline steps */}
            {queryDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STEPS.map((step, i) => {
                  const isActive = elapsed >= step.delay;
                  const isDone = i < STEPS.length - 1
                    ? elapsed >= STEPS[i + 1].delay
                    : elapsed >= answerStart;

                  return (
                    <div key={step.num} style={{
                      display: 'grid', gridTemplateColumns: '42px 1fr',
                      gap: 10, alignItems: 'flex-start',
                      opacity: isActive ? 1 : 0.25,
                      transition: 'opacity .4s ease',
                      animation: isActive && !isDone ? 'none' : 'none',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: isActive ? `${step.color}12` : '#f1f5f9',
                        border: `1.5px solid ${isActive ? step.color + '35' : 'rgba(0,0,0,0.07)'}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                        transition: 'all .3s ease',
                      }}>
                        {isDone ? '✓' : step.icon}
                        <span style={{ fontSize: 8, fontWeight: 800, color: step.color, marginTop: 1 }}>
                          {step.num}
                        </span>
                      </div>
                      <div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontWeight: 600, fontSize: '.82rem', color: '#0f172a', marginBottom: 3,
                        }}>
                          <span>{step.label}</span>
                          {isActive && !isDone && (
                            <span style={{
                              fontSize: '.65rem', fontWeight: 700, color: step.color,
                              background: `${step.color}10`, border: `1px solid ${step.color}25`,
                              borderRadius: 99, padding: '1px 7px',
                            }}>Running...</span>
                          )}
                          {isDone && (
                            <span style={{
                              fontSize: '.65rem', fontWeight: 700, color: '#16a34a',
                              background: '#dcfce7', border: '1px solid #bbf7d0',
                              borderRadius: 99, padding: '1px 7px',
                            }}>Done</span>
                          )}
                        </div>

                        {isActive && step.detail && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {step.detail.map((d, j) => (
                              <div key={j} style={{
                                fontSize: '.72rem', color: '#64748b',
                                fontFamily: j === 0 && i === 0 ? 'monospace' : 'inherit',
                              }}>
                                {i === 0 ? `"${d.replace(/"/g, '')}"` : d}
                              </div>
                            ))}
                          </div>
                        )}

                        {isActive && step.scores && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {step.scores.map((s, j) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '.7rem', color: '#64748b', width: 160, flexShrink: 0 }}>
                                  {s.url}
                                </span>
                                <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: 99,
                                    background: step.color,
                                    width: isDone ? `${s.score * 100}%` : '0%',
                                    transition: 'width 1s ease',
                                  }} />
                                </div>
                                <span style={{ fontSize: '.7rem', fontWeight: 700, color: step.color, width: 32 }}>
                                  {isDone ? s.score.toFixed(2) : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Answer */}
            {wordsVisible > 0 && (
              <div style={{
                padding: '16px 18px',
                background: 'rgba(245,158,11,0.04)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 12,
                animation: 'hp-bFade .4s ease',
              }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  AI Answer
                </div>
                <div style={{ fontSize: '.82rem', color: '#334155', lineHeight: 1.8 }}>
                  {ANSWER_WORDS.slice(0, wordsVisible).join(' ').replace(/\*\*(.+?)\*\*/g, '')}
                  {wordsVisible < ANSWER_WORDS.length && (
                    <span style={{
                      display: 'inline-block', width: 2, height: '1em',
                      background: '#f59e0b', marginLeft: 2, verticalAlign: 'middle',
                      animation: 'hp-cursor 0.9s steps(1) infinite',
                    }} />
                  )}
                </div>

                {wordsVisible >= ANSWER_WORDS.length && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {SOURCES.map(s => (
                      <div key={s.url} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 99,
                        background: '#f8fafc', border: '1px solid rgba(0,0,0,0.1)',
                        fontSize: '.68rem', color: '#334155', fontWeight: 500,
                        animation: 'hp-bFade .3s ease',
                      }}>
                        <span style={{ color: '#94a3b8' }}>📎</span>
                        {s.title}
                        <span style={{
                          padding: '1px 6px', borderRadius: 4,
                          background: 'rgba(99,102,241,0.07)', color: '#6366f1',
                          fontSize: '.62rem', fontWeight: 700,
                        }}>{s.tag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
