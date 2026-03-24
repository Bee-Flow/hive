import React from 'react';

const CATEGORIES = [
  { icon: '💻', name: 'Development', count: 11, examples: 'GitHub, GitLab, Playwright, Sentry' },
  { icon: '💬', name: 'Communication', count: 5, examples: 'Slack, Discord, Telegram, Email' },
  { icon: '📋', name: 'Productivity', count: 14, examples: 'Notion, Jira, Figma, Google Workspace' },
  { icon: '🗄️', name: 'Data & Databases', count: 8, examples: 'PostgreSQL, Redis, MongoDB, Supabase' },
  { icon: '🔍', name: 'Search & Web', count: 7, examples: 'Brave Search, Exa, ArXiv, Puppeteer' },
  { icon: '🤖', name: 'AI & Tools', count: 6, examples: 'Memory, HuggingFace, Langfuse' },
  { icon: '🚀', name: 'DevOps', count: 7, examples: 'Docker, Kubernetes, Terraform, Vercel' },
  { icon: '💳', name: 'Finance', count: 3, examples: 'Stripe, Shopify, CoinMarketCap' },
  { icon: '📊', name: 'Analytics', count: 3, examples: 'PostHog, Grafana, Datadog' },
  { icon: '🌐', name: 'Social', count: 4, examples: 'Twitter/X, Bluesky, YouTube, Reddit' },
];

const HIGHLIGHTS = [
  { icon: '🖱️', title: 'One-Click Install', desc: 'Browse the curated registry and install any server with a single click. Tools are auto-discovered and cached.' },
  { icon: '🔑', title: 'Per-User Credentials', desc: 'Each user provides their own API keys via settings. Credentials are stored encrypted and never shared between users.' },
  { icon: '🔄', title: 'Dual Transport', desc: 'Spawn local processes via stdio or connect to remote HTTP endpoints — both protocols supported out of the box.' },
  { icon: '⏱️', title: 'Connection Pooling', desc: 'Per-user connection pools with 5-minute idle timeout. Processes are reused across conversations for efficiency.' },
  { icon: '🧪', title: 'Admin Testing', desc: 'Admins can test-spawn any server before enabling it for the organisation. Verify tools are discoverable and working.' },
  { icon: '🛠️', title: 'Custom Servers', desc: 'Add any custom MCP server by specifying command + args (stdio) or a remote URL (HTTP). Full flexibility beyond the registry.' },
];

export default function McpMarketplaceSection() {
  const totalServers = CATEGORIES.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      {/* ── Stats Row ───────────────────────────────────────── */}
      <section className="hp-section" id="mcp-stats">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Scale</span>
            <h2 className="hp-h2">{totalServers} servers, 10 categories, zero config</h2>
            <p className="hp-body--sm">
              Every server in the registry is pre-configured with the right command, arguments, and credential requirements — just install and go.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, maxWidth: 600, margin: '0 auto 40px' }}>
            {[
              { value: totalServers + '+', label: 'Curated Servers' },
              { value: '10', label: 'Categories' },
              { value: '2', label: 'Transports' },
            ].map(s => (
              <div key={s.label} className="hp-card hp-reveal hp-d1" style={{ padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Grid ───────────────────────────────────── */}
      <section className="hp-section hp-section--alt" id="mcp-categories">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Browse by Category</span>
            <h2 className="hp-h2">Tools for every workflow</h2>
            <p className="hp-body--sm">
              From developer tools to social media integrations — find the right MCP servers for your team.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, maxWidth: 960, margin: '0 auto' }}>
            {CATEGORIES.map((cat, i) => (
              <div key={cat.name} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '20px 20px', display: 'flex', alignItems: 'start', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                }}>
                  {cat.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#0f172a' }}>{cat.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: '.72rem', fontWeight: 700,
                      background: '#fef3c7', color: '#92400e',
                    }}>
                      {cat.count}
                    </span>
                  </div>
                  <div style={{ fontSize: '.78rem', color: '#94a3b8', lineHeight: 1.4 }}>{cat.examples}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture Highlights ──────────────────────────── */}
      <section className="hp-section" id="mcp-architecture">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">How It Works</span>
            <h2 className="hp-h2">Built for security and performance</h2>
            <p className="hp-body--sm">
              Per-user credential isolation, connection pooling, and dual transport support — enterprise-ready MCP integration.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {HIGHLIGHTS.map((h, i) => (
              <div key={h.title} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`} style={{ padding: '24px 22px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{h.icon}</div>
                <h3 className="hp-h3" style={{ marginBottom: 6, fontSize: '.95rem' }}>{h.title}</h3>
                <p style={{ fontSize: '.83rem', lineHeight: 1.5 }}>{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
