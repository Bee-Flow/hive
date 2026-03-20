import React from 'react';

export default function CtaSection({ onLoginClick }) {
  return (
    <section className="hp-cta hp-section--alt" id="signup">
      <div className="hp-container">
        <div className="hp-cta-inner hp-reveal">
          <span className="hp-label" style={{ textAlign: 'center', display: 'block' }}>Get Started</span>
          <h2 className="hp-h2">Start building smarter workflows today</h2>
          <p className="hp-body">
            Join teams that use Bee Flow to automate repetitive work, surface insights faster,
            and keep their data private — all from a single conversational interface.
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
              Learn more
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
