import React from 'react';
import MeetingNotesDemo from './MeetingNotesDemo';

const INPUT_MODES = [
  {
    icon: '🎤',
    title: 'Browser Recording',
    desc: 'Record directly from your microphone. One click to start — the AI transcribes and enriches in real time.',
    detail: 'WebAudio API · Live waveform · Auto-silence detection',
    color: '#ef4444',
  },
  {
    icon: '📁',
    title: 'File Upload',
    desc: 'Drag and drop audio files in any format. Supports MP3, WAV, OGG, WebM, and more — processed securely on your server.',
    detail: 'Drag-and-drop · Batch upload · All major audio formats',
    color: '#3b82f6',
  },
  {
    icon: '🤖',
    title: 'Google Meet Bot',
    desc: 'Enter a Meet link and Bee Flow\'s bot joins the call, records audio via PulseAudio virtual sink, and transcribes when the meeting ends.',
    detail: 'Auto-join · PulseAudio capture · Configurable bot name',
    color: '#22c55e',
  },
];

const AI_FEATURES = [
  { icon: '🗣️', name: 'AI Transcription', desc: 'WhisperX and Voxtral models for accurate speech-to-text' },
  { icon: '👥', name: 'Speaker Diarisation', desc: 'Detect and label multiple speakers automatically' },
  { icon: '📋', name: 'AI Summary', desc: 'Automatic meeting summary with key topics and decisions' },
  { icon: '✅', name: 'Action Items', desc: 'Extract action items and assign to participants' },
  { icon: '🔍', name: 'Searchable Transcript', desc: 'Full-text search across all your meeting transcripts' },
  { icon: '💬', name: 'AI Chat', desc: 'Ask questions about any meeting — AI answers with transcript context' },
  { icon: '📤', name: 'Export & Share', desc: 'Export to multiple formats and share with team members' },
  { icon: '📓', name: 'Notebook Import', desc: 'Import transcripts as sources into AI Notebooks' },
];

const LANGUAGES = [
  'English', 'Dutch', 'German', 'French', 'Spanish', 'Portuguese',
  'Italian', 'Polish', 'Russian', 'Chinese', 'Japanese', 'Korean',
  'Arabic', 'Hindi',
];

export default function MeetingNotesSection() {
  return (
    <>
      <MeetingNotesDemo />
      {/* ── Input Modes ─────────────────────────────────────── */}
      <section className="hp-section" id="meeting-input-modes">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Three Ways to Capture</span>
            <h2 className="hp-h2">Record, upload, or let the bot join</h2>
            <p className="hp-body--sm">
              Whether you're in a live meeting or have a recording — Bee Flow handles the transcription and enrichment.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
            {INPUT_MODES.map((mode, i) => (
              <div key={mode.title} className={`hp-card hp-reveal hp-d${i + 1}`} style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
                  background: `${mode.color}10`, border: `1.5px solid ${mode.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                }}>
                  {mode.icon}
                </div>
                <h3 className="hp-h3" style={{ marginBottom: 8 }}>{mode.title}</h3>
                <p style={{ marginBottom: 12 }}>{mode.desc}</p>
                <span className="hp-tag--tech">⚙ {mode.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Features ─────────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="meeting-ai-features">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">AI Enrichment</span>
            <h2 className="hp-h2">More than just a transcript</h2>
            <p className="hp-body--sm">
              Every recording is enriched with speaker detection, summaries, action items, and a searchable AI chat interface.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, maxWidth: 960, margin: '0 auto' }}>
            {AI_FEATURES.map((f, i) => (
              <div key={f.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '18px 18px', display: 'flex', alignItems: 'start', gap: 12 }}>
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

      {/* ── Language Support ─────────────────────────────────── */}
      <section className="hp-section" id="meeting-languages">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Multilingual</span>
            <h2 className="hp-h2">14 languages supported</h2>
            <p className="hp-body--sm">
              Powered by WhisperX and Voxtral multilingual models — transcribe meetings in any of these languages.
            </p>
          </div>

          <div className="hp-reveal hp-d1" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
            {LANGUAGES.map(lang => (
              <span key={lang} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: '.85rem', fontWeight: 600,
                background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0',
              }}>
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
