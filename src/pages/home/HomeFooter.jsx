import React from 'react';

export default function HomeFooter({ onNavigate, onLoginClick }) {
  const go = (path) => { if (onNavigate) onNavigate(path); };
  const ext = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <footer className="hp-footer">
      <div className="hp-container">
        <div className="hp-footer-grid">
          <div className="hp-footer-brand">
            <button
              className="hp-logo"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => go('/')}
            >
              <img src="/bee-flow-logo.svg" alt="Bee Flow" />
              <span>Bee Flow<span className="dot">.</span></span>
            </button>
            <p>AI-driven workflow automation with open standards and privacy by design.</p>
            <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: 8 }}>
              Running at <strong>beeflow.ai</strong>
            </p>
          </div>

          <div className="hp-footer-col">
            <h4>Product</h4>
            <a href="/features" onClick={e => { e.preventDefault(); go('/features'); }}>Features</a>
            <a href="/how-it-works" onClick={e => { e.preventDefault(); go('/how-it-works'); }}>How it Works</a>
            <a href="/security" onClick={e => { e.preventDefault(); go('/security'); }}>Security</a>
            <a href="/integrations" onClick={e => { e.preventDefault(); go('/integrations'); }}>Integrations</a>
          </div>

          <div className="hp-footer-col">
            <h4>Solutions</h4>
            <a href="/agent-designer" onClick={e => { e.preventDefault(); go('/agent-designer'); }}>AI Agents</a>
            <a href="/knowledge-bases" onClick={e => { e.preventDefault(); go('/knowledge-bases'); }}>Knowledge Bases</a>
            <a href="/deep-research" onClick={e => { e.preventDefault(); go('/deep-research'); }}>Deep Research</a>
            <a href="/ai-notebooks" onClick={e => { e.preventDefault(); go('/ai-notebooks'); }}>AI Notebooks</a>
            <a href="/meeting-notes" onClick={e => { e.preventDefault(); go('/meeting-notes'); }}>Meeting Notes</a>
            <a href="/task-automation" onClick={e => { e.preventDefault(); go('/task-automation'); }}>Task Automation</a>
            <a href="/search-engine" onClick={e => { e.preventDefault(); go('/search-engine'); }}>Search Engine</a>
            <a href="/mcp-marketplace" onClick={e => { e.preventDefault(); go('/mcp-marketplace'); }}>MCP Marketplace</a>
          </div>

          <div className="hp-footer-col">
            <h4>Company</h4>
            <a href="/about" onClick={e => { e.preventDefault(); go('/about'); }}>About</a>
            <a href="/careers" onClick={e => { e.preventDefault(); go('/careers'); }}>Careers</a>
            <a href="/contact" onClick={e => { e.preventDefault(); go('/contact'); }}>Contact</a>
            <a href="/privacy" onClick={e => { e.preventDefault(); go('/privacy'); }}>Privacy Policy</a>
            <a href="/terms" onClick={e => { e.preventDefault(); go('/terms'); }}>Terms of Service</a>
          </div>

          <div className="hp-footer-col">
            <h4>Platform</h4>
            <a href="#" onClick={e => { e.preventDefault(); onLoginClick(); }}>Log in</a>
            <a href="#" onClick={e => { e.preventDefault(); onLoginClick(); }}>Get started</a>
            {/* Self-hosted deployment — docs live inside the repo */}
            <a href="#" onClick={e => { e.preventDefault(); ext('https://beeflow.ai/'); }} title="Deployment docs are included in the self-hosted repository">
              Deploy Guide
            </a>
            <a href="mailto:info@beeflow.ai">Contact Support</a>
          </div>
        </div>

        <div className="hp-footer-bottom">
          <span>© {new Date().getFullYear()} Bee Flow · Built with 🐝 and open standards · <a href="/privacy" onClick={e => { e.preventDefault(); go('/privacy'); }} style={{ color: 'inherit' }}>Privacy</a> · <a href="/terms" onClick={e => { e.preventDefault(); go('/terms'); }} style={{ color: 'inherit' }}>Terms</a></span>
          <div className="hp-socials" style={{ opacity: .5, fontSize: '.8rem', color: '#94a3b8' }}>
            beeflow.ai
          </div>
        </div>
      </div>
    </footer>
  );
}
