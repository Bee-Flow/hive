import React, { useState } from 'react';

// All integrations from McpMarketplace + toolDispatcher
const CATEGORIES = [
  {
    name: 'Google Workspace',
    icon: '🏢',
    color: '#4285F4',
    bg: '#EFF6FF',
    items: ['Gmail', 'Calendar', 'Docs', 'Sheets', 'Slides', 'Drive', 'Keep', 'Contacts', 'Maps', 'Groups'],
  },
  {
    name: 'Microsoft 365',
    icon: '🪟',
    color: '#0078D4',
    bg: '#EFF6FF',
    items: ['Outlook', 'Calendar', 'Contacts', 'OneDrive'],
  },
  {
    name: 'Development',
    icon: '💻',
    color: '#7C3AED',
    bg: '#F5F3FF',
    items: ['GitHub', 'GitLab', 'Bitbucket', 'Git', 'Filesystem', 'Sentry', 'Playwright', 'Repomix', 'NPM Search', 'Chrome DevTools'],
  },
  {
    name: 'Project Management',
    icon: '📋',
    color: '#0891B2',
    bg: '#ECFEFF',
    items: ['YouTrack', 'Jira', 'Confluence', 'Linear', 'Notion', 'Trello', 'Asana', 'Todoist', 'Airtable', 'Figma'],
  },
  {
    name: 'Communication',
    icon: '💬',
    color: '#059669',
    bg: '#ECFDF5',
    items: ['Slack', 'Discord', 'Telegram', 'Email (IMAP)', 'Twilio', 'WhatsApp', 'LinkedIn', 'ElevenLabs TTS'],
  },
  {
    name: 'Databases',
    icon: '🗄️',
    color: '#B45309',
    bg: '#FFFBEB',
    items: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis', 'Supabase', 'ClickHouse', 'Neo4j'],
  },
  {
    name: 'Search & Web',
    icon: '🔍',
    color: '#DC2626',
    bg: '#FEF2F2',
    items: ['Brave Search', 'Tavily', 'Exa Search', 'Kagi', 'Bing Search', 'ArXiv', 'Web Fetch', 'Puppeteer', 'Context7 Docs'],
  },
  {
    name: 'DevOps & Cloud',
    icon: '🚀',
    color: '#6D28D9',
    bg: '#F5F3FF',
    items: ['Docker', 'Kubernetes', 'AWS KB', 'Cloudflare', 'Vercel', 'GitHub Actions', 'Terraform'],
  },
  {
    name: 'Finance',
    icon: '💳',
    color: '#065F46',
    bg: '#ECFDF5',
    items: ['Stripe', 'Shopify', 'CoinMarketCap'],
  },
  {
    name: 'Analytics',
    icon: '📊',
    color: '#92400E',
    bg: '#FFFBEB',
    items: ['PostHog', 'Grafana', 'Datadog', 'Fireflies.ai'],
  },
  {
    name: 'Social Media',
    icon: '🌐',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    items: ['Twitter / X', 'Bluesky', 'YouTube', 'Reddit'],
  },
  {
    name: 'Automation & AI',
    icon: '🤖',
    color: '#D97706',
    bg: '#FFFBEB',
    items: ['n8n Workflows', 'Custom Webhooks', 'Script Executor', 'Task Scheduler', 'Persistent Memory', 'HuggingFace', 'EverArt', 'Langfuse', 'Regex Generator', 'Sequential Thinking'],
  },
];

const FEATURED = [
  'Gmail', 'GitHub', 'Slack', 'Notion', 'Google Drive', 'Jira', 'Stripe',
  'PostgreSQL', 'Docker', 'WhatsApp', 'Figma', 'Linear', 'Brave Search',
  'Discord', 'Twilio', 'n8n Workflows', 'Supabase', 'Vercel', 'Datadog', 'YouTube',
];

function Chip({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg || '#F8FAFC', border: `1px solid ${color}30`,
      color: color || '#334155', borderRadius: 20, padding: '4px 12px',
      fontSize: '.78rem', fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function IntegrationsSection({ preview }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const totalTools = CATEGORIES.reduce((a, c) => a + c.items.length, 0);

  if (preview) {
    return (
      <section className="hp-section hp-section--alt" id="integrations">
        <div className="hp-container">
          <div className="hp-section-hdr hp-reveal">
            <span className="hp-label">Integrations</span>
            <h2 className="hp-h2">Connect everything you already use</h2>
            <p className="hp-body--sm">
              {totalTools}+ integrations across 12 categories — works natively with the tools your team already uses.
            </p>
          </div>

          {/* Logo cloud */}
          <div className="hp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 720, margin: '0 auto 28px' }}>
            {FEATURED.map(name => {
              const cat = CATEGORIES.find(c => c.items.includes(name));
              return <Chip key={name} label={name} color={cat?.color} bg={cat?.bg} />;
            })}
          </div>

          {/* Category mini grid */}
          <div className="hp-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.name} style={{
                background: cat.bg, border: `1px solid ${cat.color}25`,
                borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                <div>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: cat.color }}>{cat.name}</div>
                  <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>{cat.items.length} tools</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hp-reveal" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '.83rem', color: '#64748b' }}>
              Plus databases, DevOps, finance, analytics, social, and automation —{' '}
              <a href="/integrations" style={{ color: '#d97706', fontWeight: 600 }}>see all {totalTools}+ integrations →</a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Full integrations page
  const filters = ['All', ...CATEGORIES.map(c => c.name)];
  const visible = activeFilter === 'All' ? CATEGORIES : CATEGORIES.filter(c => c.name === activeFilter);

  return (
    <section className="hp-section hp-section--alt" id="integrations">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">Integrations</span>
          <h2 className="hp-h2">Connect everything you already use</h2>
          <p className="hp-body--sm">
            {totalTools}+ integrations across 12 categories. Any tool with a webhook or API can also be added as a custom integration.
          </p>
        </div>

        {/* Stats row */}
        <div className="hp-reveal" style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', marginBottom: 36 }}>
          {[
            { n: `${totalTools}+`, l: 'integrations' },
            { n: '12', l: 'categories' },
            { n: '∞', l: 'custom tools via API' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="hp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28, justifyContent: 'center' }}>
          {filters.map(f => {
            const cat = CATEGORIES.find(c => c.name === f);
            const isActive = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  border: isActive ? `1.5px solid ${cat?.color || '#d97706'}` : '1px solid #e2e8f0',
                  background: isActive ? (cat?.bg || '#FFF8ED') : '#fff',
                  color: isActive ? (cat?.color || '#d97706') : '#64748b',
                  borderRadius: 20, padding: '5px 14px', fontSize: '.78rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all .2s',
                }}
              >
                {cat?.icon || '🔮'} {f === 'All' ? 'All categories' : f}
              </button>
            );
          })}
        </div>

        {/* Category sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {visible.map((cat, i) => (
            <div key={cat.name} className={`hp-reveal hp-d${(i % 2) + 1}`}>
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: cat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', border: `1px solid ${cat.color}20`,
                }}>
                  {cat.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: cat.color, fontSize: '.9rem' }}>{cat.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8' }}>{cat.items.length} tools available</div>
                </div>
              </div>
              {/* Tool chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {cat.items.map(item => (
                  <Chip key={item} label={item} color={cat.color} bg={cat.bg} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Custom integration callout */}
        <div className="hp-reveal" style={{ marginTop: 40, background: '#FFF8ED', border: '1px solid #fbbf24', borderRadius: 12, padding: '18px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.4rem' }}>💡</span>
          <div>
            <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Connect any tool</div>
            <p style={{ fontSize: '.83rem', color: '#92400e', margin: 0 }}>
              Any service with a webhook, REST API, or stdio interface can be connected as a custom integration — no coding required. Your own workflows are available as AI-callable tools automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
