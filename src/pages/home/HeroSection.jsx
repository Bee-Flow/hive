import React from 'react';

export default function HeroSection({ onLoginClick, onNavigate }) {
  const go = (path) => onNavigate && onNavigate(path);

  return (
    <section className="hp-hero" id="hero">
      <div className="hp-orb hp-orb--1" />
      <div className="hp-orb hp-orb--2" />

      <div className="hp-container">
        <div className="hp-hero-content">
          <div className="hp-hero-badge">
            <span>🐝</span>
            <span>AI-Driven Workflow Automation · Privacy by Design</span>
          </div>

          <h1 className="hp-h1">
            Build smarter workflows<br />
            with <span className="hp-grad-text">conversational AI</span>
          </h1>

          <p className="hp-body" style={{ maxWidth: 540, margin: '0 auto' }}>
            Describe what you need in plain language. Bee Flow translates it into
            automated workflows — connecting your tools, data, and AI agents in one place.
          </p>

          <div className="hp-hero-ctas">
            <button className="hp-btn hp-btn--primary" onClick={onLoginClick}>
              Get Started Free →
            </button>
            <button className="hp-btn hp-btn--outline" onClick={() => go('/how-it-works')}>
              See how it works
            </button>
          </div>
        </div>

        {/* App Mockup */}
        <div className="hp-mockup hp-reveal" style={{ marginTop: 60 }}>
          <div className="hp-mockup-bar">
            <div className="hp-mockup-dot" /><div className="hp-mockup-dot" /><div className="hp-mockup-dot" />
            <span className="hp-mockup-url">beeflow.ai — Agent Hub</span>
          </div>
          <div className="hp-mockup-body">
            <div className="hp-mockup-sidebar">
              {['Direct Chat','Research Agent','Writer Agent','Code Assistant','My Workflows'].map((name, i) => (
                <div key={name} className={`hp-mockup-si${i === 0 ? ' active' : ''}`}>
                  <div className="d" />{name}
                </div>
              ))}
            </div>
            <div className="hp-mockup-chat">
              <div className="hp-bubble hp-bubble--user">
                Summarise all emails from last week about the quarterly report and create a to-do list
              </div>
              <div className="hp-bubble hp-bubble--ai">
                Found 7 emails about the Q1 report. Here's a summary and your action list:<br /><br />
                ✅ Review slides by Friday · ✅ Confirm budget with finance · ✅ Share final draft
              </div>
              <div className="hp-bubble hp-bubble--ai hp-bubble--ai2">
                I've also created a task in YouTrack and drafted a follow-up email for your approval.
              </div>
              <div className="hp-typing"><span/><span/><span/></div>
            </div>
          </div>
        </div>

        {/* Trusted strip */}
        <div className="hp-trusted hp-reveal">
          <p>Trusted by teams that value privacy &amp; performance</p>
          <div className="hp-trusted-logos">
            {['Acme Corp','Nexoris','FieldEdge','Syntelo','Orbion','DataNest'].map(n => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
