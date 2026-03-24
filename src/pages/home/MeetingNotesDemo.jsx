import React, { useState, useEffect } from 'react';

// Phase durations (ms)
const PHASE_UPLOAD   = 0;
const PHASE_PROCESS  = 3000;
const PHASE_RESULT   = 7000;
const TOTAL_LOOP     = 14000;

const TRANSCRIPT = [
  { t: '00:01', speaker: 'Tom',   color: '#3b82f6', text: "Let's start with the Q3 goals. Sarah, can you take us through the roadmap?" },
  { t: '00:18', speaker: 'Sarah', color: '#22c55e', text: "Sure. We're targeting a 30% user growth and completing the EU compliance audit by end of September." },
  { t: '00:34', speaker: 'Mark',  color: '#8b5cf6', text: "On the engineering side, the new search pipeline is on track. We need a decision on GPU hosting by Friday." },
  { t: '00:51', speaker: 'Tom',   color: '#3b82f6', text: "Agreed. Mark, you'll own the GPU vendor comparison. Sarah, please schedule the compliance review." },
];

const ACTION_ITEMS = [
  { owner: 'Mark',  text: 'Complete GPU vendor comparison by Friday', due: 'Fri 26 Mar' },
  { owner: 'Sarah', text: 'Schedule EU compliance audit review meeting', due: 'Mon 29 Mar' },
  { owner: 'Tom',   text: 'Share Q3 roadmap with board — awaiting final slides', due: 'Wed 31 Mar' },
];

function usePhase(total) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - start) % total;
      setElapsed(t);
    }, 80);
    return () => clearInterval(id);
  }, [total]);
  return elapsed;
}

export default function MeetingNotesDemo() {
  const elapsed = usePhase(TOTAL_LOOP);

  const phase = elapsed < PHASE_PROCESS ? 'upload'
    : elapsed < PHASE_RESULT ? 'process'
    : 'result';

  const progress = phase === 'process'
    ? Math.min(99, Math.round(((elapsed - PHASE_PROCESS) / (PHASE_RESULT - PHASE_PROCESS)) * 100))
    : 0;

  const visibleLines = phase === 'result'
    ? Math.min(TRANSCRIPT.length, Math.floor(((elapsed - PHASE_RESULT) / 2000) * TRANSCRIPT.length) + 1)
    : 0;

  const visibleActions = phase === 'result'
    ? Math.min(ACTION_ITEMS.length, Math.floor(((elapsed - PHASE_RESULT - 800) / 1500) * ACTION_ITEMS.length) + 1)
    : 0;

  return (
    <section className="hp-section" id="meeting-demo">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Live Demo</span>
          <h2 className="hp-h2">See it in action</h2>
          <p className="hp-body--sm">
            Upload a recording — BeeFlow transcribes, detects speakers, and extracts action items automatically.
          </p>
        </div>

        <div style={{
          maxWidth: 860, margin: '0 auto',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          position: 'relative',
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
              🎙️ BeeFlow — Meeting Notes
            </span>
            <span style={{
              marginLeft: 'auto',
              fontSize: '.68rem', fontWeight: 700,
              color: phase === 'result' ? '#16a34a' : '#d97706',
              background: phase === 'result' ? '#dcfce7' : '#fef9c3',
              border: `1px solid ${phase === 'result' ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 999, padding: '2px 10px',
            }}>
              {phase === 'result' ? '✓ Complete' : phase === 'process' ? '⏳ Processing' : '● Live Demo'}
            </span>
          </div>

          {/* PHASE: UPLOAD */}
          {phase === 'upload' && (
            <div style={{
              padding: '48px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
              textAlign: 'center',
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: 20,
                background: 'rgba(245,158,11,0.08)',
                border: '2px dashed rgba(245,158,11,0.35)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, animation: 'hp-orbF 2s ease-in-out infinite',
              }}>
                📁
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 6 }}>
                  Q3_Planning_Meeting.mp3
                </div>
                <div style={{ fontSize: '.85rem', color: '#64748b' }}>42 min · 38.4 MB · Dropping file...</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['WhisperX', 'Voxtral', 'Speaker Diarisation', '14 languages'].map(t => (
                  <span key={t} style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: '.72rem', fontWeight: 600,
                    background: 'rgba(99,102,241,0.07)', color: '#6366f1',
                    border: '1px solid rgba(99,102,241,0.18)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* PHASE: PROCESSING */}
          {phase === 'process' && (
            <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {/* Waveform bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
                {Array.from({ length: 28 }, (_, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: `rgba(245,158,11,${0.3 + 0.7 * Math.sin(i * 0.8 + elapsed / 120) ** 2})`,
                    height: `${18 + 30 * Math.abs(Math.sin(i * 0.7 + elapsed / 100))}px`,
                    transition: 'height 0.08s ease',
                  }} />
                ))}
              </div>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#0f172a' }}>
                Transcribing with WhisperX...
              </div>
              <div style={{ width: '100%', maxWidth: 400 }}>
                <div style={{
                  width: '100%', height: 8, borderRadius: 99,
                  background: 'rgba(0,0,0,0.07)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    width: `${progress}%`, transition: 'width 0.08s ease',
                  }} />
                </div>
                <div style={{ fontSize: '.8rem', color: '#94a3b8', marginTop: 6 }}>
                  {progress}% · Speaker detection running · Dutch + English detected
                </div>
              </div>
            </div>
          )}

          {/* PHASE: RESULT */}
          {phase === 'result' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280 }}>
              {/* Transcript */}
              <div style={{ padding: '20px', borderRight: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                  Transcript
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {TRANSCRIPT.slice(0, visibleLines).map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: '.78rem', animation: 'hp-bFade .3s ease' }}>
                      <span style={{ color: '#94a3b8', flexShrink: 0, fontFamily: 'monospace', fontSize: '.7rem', marginTop: 1 }}>{line.t}</span>
                      <div>
                        <span style={{ fontWeight: 700, color: line.color }}>{line.speaker}: </span>
                        <span style={{ color: '#334155', lineHeight: 1.5 }}>{line.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Summary + Actions */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    AI Summary
                  </div>
                  <div style={{
                    fontSize: '.8rem', color: '#334155', lineHeight: 1.6,
                    background: 'rgba(245,158,11,0.04)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    borderRadius: 10, padding: '10px 12px',
                  }}>
                    Q3 planning session covered growth targets (30%), EU compliance audit timeline, and GPU hosting decision. Engineering search pipeline on track.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    ✅ Action Items
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {ACTION_ITEMS.slice(0, visibleActions).map((a, i) => (
                      <div key={i} style={{
                        fontSize: '.76rem', lineHeight: 1.5,
                        border: '1px solid rgba(0,0,0,0.07)', borderRadius: 9, padding: '8px 10px',
                        animation: 'hp-bFade .3s ease',
                        display: 'flex', flexDirection: 'column', gap: 3,
                      }}>
                        <div style={{ color: '#0f172a' }}>
                          <span style={{ fontWeight: 700, color: '#d97706' }}>@{a.owner}</span> — {a.text}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '.7rem' }}>Due: {a.due}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
