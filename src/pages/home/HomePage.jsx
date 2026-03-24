import React from 'react';
import HomeLayout from './HomeLayout';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import HowItWorksSection from './HowItWorksSection';
import SecuritySection from './SecuritySection';
import IntegrationsSection from './IntegrationsSection';
import ArchitectureSection from './ArchitectureSection';
import CtaSection from './CtaSection';
import DeepResearchSection from './DeepResearchSection';
import NotebooksSection from './NotebooksSection';
import MeetingNotesSection from './MeetingNotesSection';
import McpMarketplaceSection from './McpMarketplaceSection';
import AgentDesignerSection from './AgentDesignerSection';
import KnowledgeBasesSection from './KnowledgeBasesSection';
import TaskAutomationSection from './TaskAutomationSection';
import SearchEngineSection from './SearchEngineSection';
import ChatDemo from './ChatDemo';

// ─── Sub-page wrappers ────────────────────────────────────────

export function FeaturesPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Platform Features</span>
          <h1 className="hp-h1">Every tool you need, built in</h1>
          <p className="hp-body--sm">From conversational AI to self-hosted inference — Bee Flow is engineered for teams that need power <em>and</em> privacy.</p>
        </div>
      </div>
      <FeaturesSection />
      <ArchitectureSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function HowItWorksPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">How it Works</span>
          <h1 className="hp-h1">From idea to automation in minutes</h1>
          <p className="hp-body--sm">No code, no drag-and-drop builder — just tell Bee Flow what you need and watch it build the workflow for you.</p>
        </div>
      </div>
      <HowItWorksSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function SecurityPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Security &amp; Privacy</span>
          <h1 className="hp-h1">Built for trust, not just compliance</h1>
          <p className="hp-body--sm">Zero-knowledge encryption, OPAQUE authentication, and a three-layer content moderation pipeline — privacy by design at every level.</p>
        </div>
      </div>
      <SecuritySection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function IntegrationsPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Integrations</span>
          <h1 className="hp-h1">Connect everything you already use</h1>
          <p className="hp-body--sm">65+ integrations available as AI-callable tools — Google Workspace, Microsoft 365, GitHub, WhatsApp, and much more.</p>
        </div>
      </div>
      <IntegrationsSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function AboutPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">About Bee Flow</span>
          <h1 className="hp-h1">AI automation built on open standards</h1>
          <p className="hp-body--sm">We believe powerful AI tools should be private, transparent, and run on your own infrastructure.</p>
        </div>
      </div>
      <section className="hp-section">
        <div className="hp-container" style={{ maxWidth: 760 }}>
          <div className="hp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <h2 className="hp-h2" style={{ marginBottom: 16 }}>What is Bee Flow?</h2>
              <p className="hp-body">
                Bee Flow is a modular AI platform that lets teams build and run workflows through a conversational interface. 
                The system translates natural language into executable workflow steps — connecting your apps, data, and AI agents in one place.
              </p>
              <p className="hp-body" style={{ marginTop: 12 }}>
                Built on open standards with privacy by design: zero-knowledge encryption, self-hosted AI inference, 
                OPAQUE password authentication (RFC 9807), and a three-layer content moderation pipeline. 
                No mandatory cloud calls, no data leaving your environment.
              </p>
            </div>
            <div>
              <h2 className="hp-h2" style={{ marginBottom: 16 }}>The Technology</h2>
              <p className="hp-body">
                Bee Flow is built with Node.js, React 18, and Python microservices (FastAPI). 
                It supports seven AI providers (OpenAI, Claude, Google Gemini, Vertex AI, Mistral, Azure OpenAI, and local models), 
                65+ live integrations, and runs fully in Docker on your own hardware.
              </p>
              <p className="hp-body" style={{ marginTop: 12 }}>
                The platform includes a self-hosted embedding and reranking inference server with automatic hardware detection 
                (Intel OpenVINO for AVX-512, CUDA for NVIDIA GPUs, PyTorch CPU fallback) — no dependency on external embedding APIs.
              </p>
            </div>
            <div>
              <h2 className="hp-h2" style={{ marginBottom: 16 }}>Privacy by Design</h2>
              <p className="hp-body">
                Every architectural decision starts from privacy. Conversation encryption uses Argon2id key derivation and per-conversation 
                HKDF-SHA256 key isolation — the server never has access to your plaintext data. 
                Password authentication uses the OPAQUE protocol (RFC 9807) via WebAssembly, 
                so your password never leaves your browser.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 8 }}>
              {[
                { n: '2250h', l: 'R&D hours logged' },
                { n: '22', l: 'technical novelties' },
                { n: '65+', l: 'live integrations' },
              ].map(s => (
                <div key={s.l} className="hp-stat">
                  <span className="n">{s.n}</span>
                  <span className="l">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function PrivacyPage({ onNavigate, onLoginClick }) {
  const sections = [
    {
      title: 'Zero-Knowledge Data Storage',
      body: `Bee Flow uses a DEK/KEK (Data Encryption Key / Key Encryption Key) envelope encryption architecture. 
      Your messages and conversation data are encrypted with AES-256-GCM using a Data Encryption Key (DEK). 
      The DEK is itself encrypted with a Key Encryption Key (KEK) derived from your password via Argon2id 
      (128 MB memory cost, 4 iterations) — a key derivation function designed to resist brute-force attacks.
      
      The server never stores your plaintext password or your plaintext messages. Even in the event of a database breach, 
      your data cannot be decrypted without your password. We call this zero-knowledge encryption.`,
    },
    {
      title: 'Password Authentication',
      body: `We use the OPAQUE protocol (RFC 9807, Password Authenticated Key Exchange) via WebAssembly. 
      During login, your password is processed locally in your browser and only a cryptographic record is sent to the server. 
      Your password never leaves your device — not during registration, not during login, not ever.
      
      For OAuth users (Google, Microsoft, Nextcloud), we use the same OPAQUE protocol for your encryption PIN, 
      providing the same zero-knowledge guarantees.`,
    },
    {
      title: 'Content Moderation & PII Detection',
      body: `Bee Flow runs a three-layer content moderation pipeline: 
      (1) configurable regex guardrails per agent, 
      (2) a self-hosted Llama Guard service (1B fast model + 8B escalation model) with automatic translation for non-English content, 
      and (3) Azure PII Detection covering 20+ categories (SSN, IBAN, credit cards, phone numbers, etc.).
      
      Organisation administrators can configure which categories are detected and what action is taken (redact or block). 
      All moderation runs server-side — no content is sent to third-party moderation APIs unless Azure Content Safety is explicitly configured.`,
    },
    {
      title: 'Data You Provide',
      body: `When you create an account, we store your name, email address, and hashed authentication record. 
      Any files, documents, or knowledge base data you upload are stored encrypted on your deployment's storage (RustFS/S3-compatible). 
      Conversation messages are encrypted end-to-end as described above.
      
      We do not sell your data. We do not use your conversation content for AI training.`,
    },
    {
      title: 'Third-Party AI Providers',
      body: `When you use AI features, your queries may be sent to third-party AI providers (OpenAI, Anthropic, Google, Mistral, Azure) 
      depending on which models your organisation has configured. These providers have their own privacy policies.
      
      You can configure Bee Flow to use only self-hosted or EU-based models via the EU Mode setting, 
      which prevents any data from leaving EU infrastructure.`,
    },
    {
      title: 'Data Retention & Deletion',
      body: `You can delete your account and all associated data at any time. 
      Because of the zero-knowledge architecture, deleted encrypted data cannot be recovered even by Bee Flow administrators. 
      Without your encryption key, deleted messages are permanently inaccessible.`,
    },
    {
      title: 'Contact',
      body: `For privacy inquiries, contact us at info@beeflow.ai. 
      This privacy policy was last updated March 2026.`,
    },
  ];
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Legal</span>
          <h1 className="hp-h1">Privacy Policy</h1>
          <p className="hp-body--sm">Last updated: March 2026 · Bee Flow BV</p>
        </div>
      </div>
      <section className="hp-section">
        <div className="hp-container" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {sections.map(s => (
              <div key={s.title} className="hp-reveal">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{s.title}</h2>
                {s.body.split('\n\n').map((p, i) => (
                  <p key={i} className="hp-body" style={{ marginBottom: 8 }}>{p.trim()}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </HomeLayout>
  );
}

export function TermsPage({ onNavigate, onLoginClick }) {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      body: `By accessing or using Bee Flow, you agree to be bound by these Terms of Service. 
      If you do not agree to these terms, do not use the service. 
      These terms apply to all users, including those on the free tier, trial, and paid plans.`,
    },
    {
      title: '2. Description of Service',
      body: `Bee Flow is an AI-driven workflow automation platform that allows users to build and execute automated workflows 
      through a conversational interface. The service includes AI agent functionality, integrations with third-party services, 
      and data storage capabilities.`,
    },
    {
      title: '3. User Accounts & Security',
      body: `You are responsible for maintaining the confidentiality of your account credentials. 
      Bee Flow uses zero-knowledge encryption — we cannot recover your data if you lose your password and recovery key. 
      You are responsible for keeping your recovery key safe. 
      You must notify us immediately of any unauthorized use of your account.`,
    },
    {
      title: '4. Acceptable Use',
      body: `You agree not to use Bee Flow to: violate any law or regulation; infringe on the rights of others; 
      distribute malware or harmful code; attempt to gain unauthorized access to systems; 
      use the service for spam or unsolicited communications; or circumvent security or content moderation features.
      
      Bee Flow's content moderation pipeline (Llama Guard, PII detection, regex guardrails) enforces 
      the MLCommons safety taxonomy. Attempts to circumvent these controls are a violation of these terms.`,
    },
    {
      title: '5. Third-Party Integrations',
      body: `Bee Flow enables connections to third-party services (Google, Microsoft, GitHub, etc.). 
      Your use of those services is governed by their respective terms and privacy policies. 
      Bee Flow is not responsible for the actions or data practices of third-party services.`,
    },
    {
      title: '6. Data & Privacy',
      body: `Your data is encrypted using zero-knowledge encryption as described in our Privacy Policy. 
      We do not use your conversation data for AI training. We do not sell your data. 
      You retain ownership of all content you create or upload to Bee Flow.`,
    },
    {
      title: '7. Limitation of Liability',
      body: `Bee Flow is provided "as is" without warranty of any kind. 
      To the maximum extent permitted by law, Bee Flow BV shall not be liable for any indirect, 
      incidental, special, consequential, or punitive damages arising from your use of the service.`,
    },
    {
      title: '8. Changes to Terms',
      body: `We may update these terms from time to time. 
      We will notify you of material changes via email or in-app notification. 
      Continued use of the service after notification constitutes acceptance of the updated terms.`,
    },
    {
      title: '9. Contact',
      body: `For questions about these terms, contact info@beeflow.ai. 
      These terms were last updated March 2026. Governing law: Netherlands.`,
    },
  ];
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Legal</span>
          <h1 className="hp-h1">Terms of Service</h1>
          <p className="hp-body--sm">Last updated: March 2026 · Bee Flow BV · Governing law: Netherlands</p>
        </div>
      </div>
      <section className="hp-section">
        <div className="hp-container" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {sections.map(s => (
              <div key={s.title} className="hp-reveal">
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{s.title}</h2>
                {s.body.split('\n\n').map((p, i) => (
                  <p key={i} className="hp-body" style={{ marginBottom: 6 }}>{p.trim()}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </HomeLayout>
  );
}

export function ContactPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Get in Touch</span>
          <h1 className="hp-h1">Contact Bee Flow</h1>
          <p className="hp-body--sm">Questions, enterprise enquiries, or just want to say hello — we'd love to hear from you.</p>
        </div>
      </div>
      <section className="hp-section">
        <div className="hp-container" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="hp-card hp-reveal" style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📧</div>
              <h3 className="hp-h3" style={{ marginBottom: 8 }}>Get in touch</h3>
              <a href="mailto:info@beeflow.ai" style={{ color: '#d97706', fontWeight: 700, fontSize: '1.05rem', display: 'block', marginBottom: 10 }}>info@beeflow.ai</a>
              <p style={{ fontSize: '.85rem', color: '#64748b', lineHeight: 1.6 }}>
                Questions about the platform, enterprise deployments, security disclosures, or anything else — we respond within 2 business days.
              </p>
            </div>
          </div>

          <div className="hp-reveal" style={{ marginTop: 48, background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: '28px 32px' }}>
            <h2 className="hp-h2" style={{ marginBottom: 6, fontSize: '1.3rem' }}>Company</h2>
            <p className="hp-body--sm" style={{ marginBottom: 16 }}>Bee Flow BV · The Netherlands</p>
            <p className="hp-body--sm">
              Response time: within 2 business days for general enquiries, within 72 hours for security disclosures.
            </p>
          </div>
        </div>
      </section>
    </HomeLayout>
  );
}

// ─── Feature deep-dive pages ──────────────────────────────────

export function DeepResearchPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Deep Research</span>
          <h1 className="hp-h1">AI-powered multi-agent research</h1>
          <p className="hp-body--sm">A 4-phase pipeline with 8 specialised agents that clarify, plan, research in parallel, and synthesise fully cited reports.</p>
        </div>
      </div>
      <DeepResearchSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function NotebooksFeaturePage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">AI Notebooks</span>
          <h1 className="hp-h1">Your AI-powered knowledge workspace</h1>
          <p className="hp-body--sm">Upload sources, write with AI assistance, and generate 10 content types — from executive summaries to AI podcasts.</p>
        </div>
      </div>
      <NotebooksSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function MeetingNotesFeaturePage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Meeting Notes</span>
          <h1 className="hp-h1">Record, transcribe, and enrich meetings</h1>
          <p className="hp-body--sm">AI transcription with speaker detection, automatic summaries, action items, and a searchable chat interface — in 14 languages.</p>
        </div>
      </div>
      <MeetingNotesSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function McpMarketplacePage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">MCP Marketplace</span>
          <h1 className="hp-h1">65+ tool servers, one click to install</h1>
          <p className="hp-body--sm">Browse a curated registry of MCP servers across 10 categories — Development, Productivity, Data, DevOps, and more.</p>
        </div>
      </div>
      <McpMarketplaceSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function AgentDesignerPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">AI Agent Designer</span>
          <h1 className="hp-h1">Build your own AI expert — no code needed</h1>
          <p className="hp-body--sm">Create custom AI assistants with a visual drag-and-drop builder. Attach knowledge bases, assign tools, choose from 7+ AI providers including local models.</p>
        </div>
      </div>
      <AgentDesignerSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function KnowledgeBasesPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Knowledge Bases</span>
          <h1 className="hp-h1">Your organisation's AI memory</h1>
          <p className="hp-body--sm">Build searchable knowledge bases from documents, URLs, and cloud storage. Hybrid search with AI reranking — fully self-hosted.</p>
        </div>
      </div>
      <KnowledgeBasesSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function TaskAutomationPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Task Automation</span>
          <h1 className="hp-h1">Your own digital employee</h1>
          <p className="hp-body--sm">AI scans your apps, discovers patterns, and automates tasks — with human approval on every action.</p>
        </div>
      </div>
      <TaskAutomationSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function SearchEnginePage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Search Engine</span>
          <h1 className="hp-h1">Self-hosted AI search engine</h1>
          <p className="hp-body--sm">Web search via Google/Bing/Tavily, hybrid knowledge base search, and local GPU inference — no data leaves your network.</p>
        </div>
      </div>
      <SearchEngineSection />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

export function ChatPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Direct Chat</span>
          <h1 className="hp-h1">Your AI assistant — grounded in your own knowledge</h1>
          <p className="hp-body--sm">Chat with any AI agent you've built. Every answer is grounded in your organisation's documents, with source citations included — no hallucinations.</p>
        </div>
      </div>
      <ChatDemo />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}

// ─── Main homepage (/) ────────────────────────────────────────
export default function HomePage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <HeroSection onLoginClick={onLoginClick} onNavigate={onNavigate} />
      <FeaturesSection preview />
      <HowItWorksSection />
      <SecuritySection preview />
      <IntegrationsSection preview />
      <CtaSection onLoginClick={onLoginClick} />
    </HomeLayout>
  );
}
