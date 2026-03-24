import React from 'react';

export default function CtaSection({ onLoginClick }) {
  return (
    <section className="hp-cta hp-section--alt" id="signup">
      <div className="hp-container">
        <div className="hp-cta-inner hp-reveal">
          <span className="hp-label" style={{ textAlign: 'center', display: 'block' }}>Get Started</span>
          <h2 className="hp-h2">Your AI workplace — on your terms</h2>
          <p className="hp-body">
            Build custom AI assistants, make your organisation's knowledge instantly searchable,
            and keep full control of your data — all from a single platform that runs on your own infrastructure.
          </p>
          <div className="hp-cta-btns">
            <button className="hp-btn hp-btn--primary" onClick={onLoginClick}>
              🐝 Get Started Free
            </button>
            <a
              className="hp-btn hp-btn--outline"
              href="#features"
              onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              Explore features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
