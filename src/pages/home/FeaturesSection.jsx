import React from 'react';

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Agent Designer',
    desc: 'Build custom AI assistants via a no-code visual designer. Attach knowledge bases, assign tools, pick from 7+ AI providers including local models. No programming required — any team member can build their own expert.',
    tech: 'No-code builder · 7+ AI providers · GPT-5, Gemini, Claude, Mistral, Azure, local',
  },
  {
    icon: '📚',
    title: 'Knowledge Bases & RAG',
    desc: 'Build searchable AI memory from PDFs, Word, Excel, URLs, and sitemaps. Hybrid vector + full-text search with AI reranking. Every answer includes exact source and section references.',
    tech: 'pgvector · FTS · BAAI/bge-reranker · Mistral OCR · Website crawler',
  },
  {
    icon: '🎙️',
    title: 'Meeting Notes & Transcription',
    desc: 'Upload a recording or send a bot to your Google Meet. BeeFlow auto-transcribes, identifies who said what, extracts action items, and delivers structured summaries — in 14+ languages.',
    tech: 'WhisperX · Voxtral · Speaker diarization · Meet Bot · 14 languages',
  },
  {
    icon: '📓',
    title: 'AI Notebooks',
    desc: 'A research workspace where you add sources (PDFs, URLs, meeting notes, Drive docs) and generate summaries, FAQ, flashcards, quizzes, podcasts, and blog posts — automatically.',
    tech: 'Multi-source ingestion · ElevenLabs TTS · AI Fill · Word template export',
  },
  {
    icon: '📂',
    title: 'Projects & Team Sharing',
    desc: 'Group conversations, knowledge bases, and AI instructions into projects. Share with individuals or groups with view/edit permissions, custom instructions, and per-project AI memories.',
    tech: 'Custom instructions · KB linking · Project Memories · View/edit RBAC',
  },
  {
    icon: '🛡️',
    title: 'Enterprise-Grade Security',
    desc: 'AES-256-GCM zero-knowledge encryption, per-user DEK/KEK keys, Argon2id key derivation, RBAC, content moderation (Llama Guard), and PII detection across 28+ categories.',
    tech: 'AES-256-GCM · Argon2id · Llama Guard 1B/8B · 28+ PII categories · RBAC',
  },
  {
    icon: '⚡',
    title: 'Task Automation',
    desc: 'AI scans your email, calendar, Drive, Sheets, and project tools. It proposes and executes automations on a schedule — always with human approval before acting.',
    tech: 'Cross-app scanning · Human-in-the-loop · Triggers · AI-generated scripts',
  },
  {
    icon: '💬',
    title: 'Conversational AI Hub',
    desc: 'A full-featured AI chat interface with streaming responses, multi-model switching, workspace side-panel, chat labels, and project grouping — all encrypted end-to-end.',
    tech: 'SSE streaming · Workspace side-panel · Chat labels · Project memories',
  },
  {
    icon: '📄',
    title: 'Document Templates & AI Fill',
    desc: 'Upload a Word template — BeeFlow auto-detects fill-in fields like [Client Name], [Date], converts them to smart parameters, and completes the entire document with one click.',
    tech: 'Auto-detection · AI parameterisation · One-click fill · DOCX export',
  },
  {
    icon: '📊',
    title: 'Monitoring Dashboards',
    desc: 'Build visual dashboards from your apps with a no-code query builder. Import data from Gmail, Calendar, Sheets, YouTrack and more via AI-generated import scripts.',
    tech: 'Visual query builder · Multi-source import · Drag-and-drop layout',
  },
  {
    icon: '🔍',
    title: 'Self-Hosted Search Engine',
    desc: 'Web search via Serper.dev/Bing/Tavily with full-page extraction and AI cleanup. Hybrid knowledge base search with GPU-accelerated embeddings and cross-encoder reranking.',
    tech: 'Serper.dev · bge-m3 · bge-reranker · Qwen3.5-2B · Redis cache',
  },
  {
    icon: '📂',
    title: 'Projects & Team Sharing',
    desc: 'Group conversations, knowledge bases, and AI instructions into projects. Share with individuals or groups with view/edit permissions, custom instructions, and per-project memories.',
    tech: 'Custom instructions · KB linking · Project Memories · RBAC',
  },
  {
    icon: '📝',
    title: 'Workspace — AI Side Panel',
    desc: 'A live document panel next to your chat where AI and user co-author documents. Select text for inline actions: rewrite, shorten, expand, or generate images. Export as PDF.',
    tech: 'Markdown editor · Floating toolbar · PDF export · Per-conversation persistence',
  },
  {
    icon: '🔗',
    title: '40+ Native Integrations',
    desc: 'Google Workspace, Microsoft 365, WhatsApp, GitHub, YouTrack, Fireflies, n8n, Gamma, ElevenLabs and more — all available as AI-callable tools with MCP protocol support.',
    tech: 'Google Workspace · MS 365 · WhatsApp · GitHub · MCP protocol · n8n',
  },
  {
    icon: '🔬',
    title: 'Deep Research Agent',
    desc: 'Multi-agent research pipeline with query clarification, parallel web + knowledge base research, iterative reflection loops, and fully cited synthesis reports.',
    tech: '4-phase pipeline · Citation manager · 3 depth presets · Multi-agent',
  },
  {
    icon: '🌍',
    title: 'Multi-Platform',
    desc: 'Available as a responsive web app (PWA), native desktop app (Electron) for Windows, macOS and Linux, Android app, and embeddable chat widget for any website.',
    tech: 'Web PWA · Electron · Android · Embeddable widget · White-label',
  },
  {
    icon: '🔌',
    title: 'MCP Server Marketplace',
    desc: 'Browse and install 65+ pre-configured MCP servers across 10 categories — Development, Productivity, Data, DevOps, and more. Add custom servers via stdio or HTTP.',
    tech: 'MCP protocol · Per-user credentials · Auto tool discovery · stdio/HTTP',
  },
  {
    icon: '🤖',
    title: 'Multi-Agent Swarm Orchestration',
    desc: 'Deploy specialised AI agents that work in parallel, share context via Hive Mind memory, and combine browser, terminal, and LLM workers to tackle complex tasks.',
    tech: 'Phase-driven orchestrator · Hive Mind · Browser agent · Terminal agent',
  },
  {
    icon: '🏷️',
    title: 'Chat Labels',
    desc: 'Organise conversations with custom colour-coded labels. Create labels with name and colour — e.g. 🔴 Urgent, 🟢 Client, 🔵 Internal — and filter your inbox instantly.',
    tech: 'Per-user labels · Colour picker · Quick filter',
  },
  {
    icon: '🔑',
    title: 'OPAQUE Authentication',
    desc: 'Your password never leaves your browser. The server stores only a cryptographic record — a database breach cannot expose your password or your encryption keys.',
    tech: 'OPAQUE RFC 9807 · WebAssembly · PAKE · SSO: Google, Microsoft, Nextcloud',
  },
  {
    icon: '🌐',
    title: 'Autonomous Browser Agent',
    desc: 'AI navigates the web, fills forms, and extracts information using a three-agent loop (Planner, Executor, Coordinator) with multimodal screenshot grounding.',
    tech: 'Playwright · Multimodal grounding · Domain restrictions · Loop detection',
  },
];

export default function FeaturesSection({ preview }) {
  const items = preview ? FEATURES.slice(0, 6) : FEATURES;

  return (
    <section className={`hp-section${!preview ? ' hp-section--alt' : ''}`} id="features">
      <div className="hp-container">
        <div className="hp-section-hdr hp-reveal">
          <span className="hp-label">{preview ? 'Platform Modules' : 'All Features'}</span>
          <h2 className="hp-h2">
            {preview ? 'Everything your organisation needs — in one AI platform' : 'Every capability, built in'}
          </h2>
          <p className="hp-body--sm">
            {preview
              ? `${FEATURES.length} integrated modules — AI agent builder, knowledge bases, meeting transcription, task automation, document templates, monitoring dashboards, and enterprise security. All self-hosted.`
              : 'From no-code AI agent design and hybrid knowledge search to zero-knowledge encryption and GPU-accelerated local inference — built for teams that need power, privacy, and simplicity.'}
          </p>
        </div>
        <div className="hp-features-grid">
          {items.map((f, i) => (
            <div key={f.title} className={`hp-card hp-reveal hp-d${(i % 3) + 1}`}>
              <div className="hp-feature-icon">{f.icon}</div>
              <h3 className="hp-h3" style={{ marginBottom: 7 }}>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="hp-tag--tech">⚙ {f.tech}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
