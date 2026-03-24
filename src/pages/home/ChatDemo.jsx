import React, { useState, useEffect } from 'react';

const TOTAL_LOOP = 18000;

const AGENT = { name: 'HR Assistant', emoji: '🤖', kb: 'Employee Handbook · HR Policies' };

const MESSAGES = [
  {
    role: 'user',
    text: 'What is our vacation policy for new employees?',
    delay: 1500,
  },
  {
    role: 'ai',
    text: 'Based on your **Employee Handbook** (p. 4), new employees receive **20 vacation days** per year from their start date, with a 3-month accrual clause. Days unused at year-end roll over up to a maximum of 10 days.',
    source: 'Employee_Handbook.pdf · Page 4',
    delay: 4000,
  },
  {
    role: 'user',
    text: 'Can you draft a short email explaining this to a new hire?',
    delay: 9000,
  },
  {
    role: 'ai',
    text: `Subject: Your Vacation Days — Welcome Aboard 🎉

Hi [Name],

Welcome to the team! As part of your benefits, you start with **20 vacation days** per year. These begin accruing from your first day.

A few key points:
• Unused days roll over (max 10 days)
• Please submit requests 2 weeks in advance
• Full policy: Employee Handbook, Section 3.4

Looking forward to having you with us!

Best,
HR Team`,
    source: 'Generated from Employee_Handbook.pdf',
    delay: 12000,
  },
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

function renderMarkdown(text) {
  return text
    .split('\n')
    .map((line, i) => {
      const processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('• ')) {
        return <div key={i} style={{ paddingLeft: 12 }}>• <span dangerouslySetInnerHTML={{ __html: processedLine.slice(2) }} /></div>;
      }
      if (line.startsWith('Subject:')) {
        return <div key={i} style={{ fontWeight: 700, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: processedLine }} />;
      }
      if (line === '') return <div key={i} style={{ height: 6 }} />;
      return <div key={i} dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
}

export default function ChatDemo() {
  const elapsed = usePhase(TOTAL_LOOP);

  // Determine visible messages and streaming progress
  const visibleMessages = [];
  let showTyping = false;

  for (const msg of MESSAGES) {
    if (elapsed < msg.delay) break;

    if (msg.role === 'ai') {
      const streamDuration = msg.text.length * 18; // ~18ms per char
      const streamElapsed = elapsed - msg.delay;
      const charsVisible = Math.min(msg.text.length, Math.floor(streamElapsed / 18));
      const isStreaming = charsVisible < msg.text.length;
      visibleMessages.push({ ...msg, visibleText: msg.text.slice(0, charsVisible), isStreaming });
    } else {
      visibleMessages.push({ ...msg, visibleText: msg.text });
    }
  }

  // Show typing indicator if next AI message is expected soon
  const nextMsg = MESSAGES.find(m => m.delay > elapsed && m.role === 'ai');
  if (nextMsg && nextMsg.delay - elapsed < 1800) showTyping = true;

  return (
    <section className="hp-section" id="chat-demo">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Live Demo</span>
          <h2 className="hp-h2">See it in action</h2>
          <p className="hp-body--sm">
            Ask your AI assistant questions grounded in your own documents — every answer includes the exact source reference.
          </p>
        </div>

        <div style={{
          maxWidth: 720, margin: '0 auto',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{AGENT.name}</div>
                <div style={{ fontSize: '.65rem', color: '#94a3b8' }}>📚 {AGENT.kb}</div>
              </div>
            </div>
            <span style={{
              marginLeft: 'auto', fontSize: '.68rem', fontWeight: 700,
              color: '#d97706', background: '#fef9c3',
              border: '1px solid #fde68a', borderRadius: 999, padding: '2px 10px',
            }}>● Live Demo</span>
          </div>

          {/* Chat messages */}
          <div style={{
            padding: '20px 18px',
            display: 'flex', flexDirection: 'column', gap: 14,
            minHeight: 280,
            maxHeight: 380,
            overflowY: 'hidden',
          }}>
            {/* Welcome message */}
            <div style={{
              textAlign: 'center', fontSize: '.75rem', color: '#94a3b8',
              padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
            }}>
              Connected to: Employee Handbook · HR Policies · 3 sources
            </div>

            {visibleMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'hp-bFade .25s ease',
              }}>
                {msg.role === 'ai' && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, marginRight: 8, marginTop: 2,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#334155',
                  fontSize: '.8rem', lineHeight: 1.6,
                }}>
                  <div>{msg.role === 'ai' ? renderMarkdown(msg.visibleText) : msg.visibleText}</div>
                  {msg.isStreaming && (
                    <span style={{
                      display: 'inline-block', width: 2, height: '0.9em',
                      background: '#64748b', marginLeft: 2, verticalAlign: 'middle',
                      animation: 'hp-cursor 0.9s steps(1) infinite',
                    }} />
                  )}
                  {msg.source && !msg.isStreaming && (
                    <div style={{
                      marginTop: 8, fontSize: '.66rem', color: '#94a3b8',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      📎 <span>{msg.source}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'hp-bFade .25s ease' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>🤖</div>
                <div style={{
                  padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                  background: '#f1f5f9', display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#94a3b8',
                      animation: `hp-typ 1.3s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              flex: 1, padding: '8px 14px',
              background: '#f8fafc', borderRadius: 99,
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '.8rem', color: '#94a3b8',
              fontStyle: 'italic',
            }}>
              Ask your HR Assistant anything...
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', cursor: 'pointer',
            }}>↑</div>
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
