import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Search, Plus, Check, ChevronDown, RefreshCw, Trash2, ToggleLeft, ToggleRight, Loader2, Plug, ExternalLink, Globe, Terminal, X, Wrench } from 'lucide-react';

// ─── Curated MCP Server Registry ──────────────────────────────────
const MCP_REGISTRY = [
    // ── Development ──────────────────────────────────────────────────
    { id: 'github', name: 'GitHub', description: 'Repository management, issues, PRs, code search, and CI/CD.', icon: '🐙', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], required_credentials: [{ key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub PAT' }] },
    { id: 'gitlab', name: 'GitLab', description: 'Repository management, merge requests, issues, and pipelines.', icon: '🦊', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'], required_credentials: [{ key: 'GITLAB_PERSONAL_ACCESS_TOKEN', label: 'GitLab PAT' }, { key: 'GITLAB_API_URL', label: 'GitLab API URL' }] },
    { id: 'bitbucket', name: 'Bitbucket', description: 'Atlassian Bitbucket — repos, pull requests, and code review.', icon: '🪣', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@aashari/mcp-server-atlassian-bitbucket'], required_credentials: [{ key: 'ATLASSIAN_SITE_NAME', label: 'Atlassian Site' }, { key: 'ATLASSIAN_USER_EMAIL', label: 'Atlassian Email' }, { key: 'ATLASSIAN_API_TOKEN', label: 'Atlassian API Token' }] },
    { id: 'git', name: 'Git', description: 'Read, search, and manipulate local Git repositories.', icon: '📦', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'] },
    { id: 'filesystem', name: 'Filesystem', description: 'Secure file operations with configurable access controls.', icon: '📁', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
    { id: 'sentry', name: 'Sentry', description: 'Access error tracking, issues, and performance data.', icon: '🐛', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@sentry/mcp-server'], required_credentials: [{ key: 'SENTRY_AUTH_TOKEN', label: 'Sentry Auth Token' }] },
    { id: 'playwright', name: 'Playwright', description: 'Browser automation, testing, screenshots, and UI interaction.', icon: '🎭', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp'] },
    { id: 'repomix', name: 'Repomix', description: 'Pack entire codebases into AI-friendly formats for analysis.', icon: '📋', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', 'repomix', '--mcp'] },
    { id: 'npm_search', name: 'NPM Search', description: 'Search and discover npm packages with detailed info.', icon: '📦', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', 'npm-search-mcp-server'] },
    { id: 'chrome_devtools', name: 'Chrome DevTools', description: 'Debug, audit performance, and inspect web pages via Chrome.', icon: '🔧', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
    { id: 'magic_ui', name: '21st Magic', description: 'Create crafted UI components inspired by top design engineers.', icon: '✨', category: 'development', transport: 'stdio', command: 'npx', args: ['-y', '@21st-dev/magic-mcp'], required_credentials: [{ key: 'TWENTYFIRST_API_KEY', label: '21st.dev API Key' }] },

    // ── Communication ────────────────────────────────────────────────
    { id: 'slack', name: 'Slack', description: 'Send messages, manage channels, and search conversations.', icon: '💬', category: 'communication', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-slack'], required_credentials: [{ key: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token' }, { key: 'SLACK_TEAM_ID', label: 'Slack Team ID' }] },
    { id: 'discord', name: 'Discord', description: '50+ tools for Discord server management, messages, and channels.', icon: '🎮', category: 'communication', transport: 'stdio', command: 'npx', args: ['-y', '@scarecr0w12/discord-mcp'], required_credentials: [{ key: 'DISCORD_BOT_TOKEN', label: 'Discord Bot Token' }] },
    { id: 'telegram', name: 'Telegram', description: 'Read/send messages, manage groups, and interact via Telegram.', icon: '✈️', category: 'communication', transport: 'stdio', command: 'npx', args: ['-y', '@chaindead/telegram-mcp'], required_credentials: [{ key: 'TELEGRAM_API_ID', label: 'Telegram API ID' }, { key: 'TELEGRAM_API_HASH', label: 'Telegram API Hash' }] },
    { id: 'email', name: 'Email (IMAP)', description: 'Read, search, send, and manage emails across multiple IMAP/SMTP accounts.', icon: '📧', category: 'communication', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-email'], required_credentials: [{ key: 'IMAP_HOST', label: 'IMAP Host' }, { key: 'EMAIL_USER', label: 'Email Address' }, { key: 'EMAIL_PASS', label: 'Email Password' }] },
    { id: 'twilio', name: 'Twilio', description: 'Send SMS, make calls, and manage communication workflows.', icon: '📱', category: 'communication', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-twilio'], required_credentials: [{ key: 'TWILIO_ACCOUNT_SID', label: 'Account SID' }, { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token' }] },

    // ── Productivity & Project Management ─────────────────────────────
    { id: 'google_drive', name: 'Google Drive', description: 'Access, search, and manage Google Drive files and folders.', icon: '📂', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-gdrive'] },
    { id: 'notion', name: 'Notion', description: 'Read, create, and search Notion pages and databases.', icon: '📝', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@notionhq/mcp-server'], required_credentials: [{ key: 'NOTION_API_KEY', label: 'Notion Integration Token' }] },
    { id: 'linear', name: 'Linear', description: 'Issue tracking, project management, and team workflows.', icon: '📐', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-linear'], required_credentials: [{ key: 'LINEAR_API_KEY', label: 'Linear API Key' }] },
    { id: 'jira', name: 'Jira', description: 'Manage issues, search, handle comments, and workflow transitions.', icon: '🔵', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@aashari/mcp-server-atlassian-jira'], required_credentials: [{ key: 'ATLASSIAN_SITE_NAME', label: 'Atlassian Site' }, { key: 'ATLASSIAN_USER_EMAIL', label: 'Atlassian Email' }, { key: 'ATLASSIAN_API_TOKEN', label: 'Atlassian API Token' }] },
    { id: 'confluence', name: 'Confluence', description: 'Search, read, and manage Confluence pages and spaces.', icon: '📘', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@aashari/mcp-server-atlassian-confluence'], required_credentials: [{ key: 'ATLASSIAN_SITE_NAME', label: 'Atlassian Site' }, { key: 'ATLASSIAN_USER_EMAIL', label: 'Atlassian Email' }, { key: 'ATLASSIAN_API_TOKEN', label: 'Atlassian API Token' }] },
    { id: 'trello', name: 'Trello', description: 'Create/move cards, update boards, and track activity.', icon: '📋', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-trello'], required_credentials: [{ key: 'TRELLO_API_KEY', label: 'Trello API Key' }, { key: 'TRELLO_TOKEN', label: 'Trello Token' }] },
    { id: 'todoist', name: 'Todoist', description: 'Task management, project organization, and productivity tracking.', icon: '✅', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-todoist'], required_credentials: [{ key: 'TODOIST_API_TOKEN', label: 'Todoist API Token' }] },
    { id: 'asana', name: 'Asana', description: 'Manage tasks, projects, workspaces, and team assignments.', icon: '🎯', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-asana'], required_credentials: [{ key: 'ASANA_ACCESS_TOKEN', label: 'Asana Access Token' }] },
    { id: 'google_calendar', name: 'Google Calendar', description: 'View, create, and manage calendar events and schedules.', icon: '📅', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-google-calendar'] },
    { id: 'google_maps', name: 'Google Maps', description: 'Geocoding, directions, place search, and distance calculations.', icon: '🗺️', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-maps'], required_credentials: [{ key: 'GOOGLE_MAPS_API_KEY', label: 'Google Maps API Key' }] },
    { id: 'google_workspace', name: 'Google Workspace', description: '23 tools for Drive, Sheets, Calendar, Docs, and Gmail.', icon: '🏢', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-google-workspace'] },
    { id: 'airtable', name: 'Airtable', description: 'Access, query, and manage Airtable bases, tables, and records.', icon: '📊', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-airtable'], required_credentials: [{ key: 'AIRTABLE_API_KEY', label: 'Airtable API Key' }] },
    { id: 'figma', name: 'Figma', description: 'Access design files, components, styles, and variables.', icon: '🎨', category: 'productivity', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-figma'], required_credentials: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Figma Access Token' }] },

    // ── Data & Databases ─────────────────────────────────────────────
    { id: 'postgres', name: 'PostgreSQL', description: 'Query PostgreSQL databases with read-only access.', icon: '🐘', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'], required_credentials: [{ key: 'POSTGRES_CONNECTION_STRING', label: 'PostgreSQL Connection String' }] },
    { id: 'sqlite', name: 'SQLite', description: 'Read and query local SQLite databases.', icon: '🗄️', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'] },
    { id: 'redis_mcp', name: 'Redis', description: 'Interact with Redis key-value store, caching, and pub/sub.', icon: '🔴', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-redis'], required_credentials: [{ key: 'REDIS_URL', label: 'Redis URL' }] },
    { id: 'mysql', name: 'MySQL', description: 'Query MySQL and MariaDB databases with read access.', icon: '🐬', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-mysql'], required_credentials: [{ key: 'MYSQL_HOST', label: 'MySQL Host' }, { key: 'MYSQL_USER', label: 'MySQL User' }, { key: 'MYSQL_PASSWORD', label: 'MySQL Password' }] },
    { id: 'mongodb', name: 'MongoDB', description: 'Query and manage MongoDB collections and documents.', icon: '🍃', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-mongodb'], required_credentials: [{ key: 'MONGODB_URI', label: 'MongoDB Connection URI' }] },
    { id: 'supabase', name: 'Supabase', description: 'SQL queries, database exploration, and Supabase management.', icon: '⚡', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@supabase/mcp-server-supabase'], required_credentials: [{ key: 'SUPABASE_URL', label: 'Supabase URL' }, { key: 'SUPABASE_SERVICE_KEY', label: 'Service Key' }] },
    { id: 'clickhouse', name: 'ClickHouse', description: 'Query and inspect ClickHouse analytical databases.', icon: '🔶', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-clickhouse'], required_credentials: [{ key: 'CLICKHOUSE_HOST', label: 'ClickHouse Host' }, { key: 'CLICKHOUSE_PASSWORD', label: 'ClickHouse Password' }] },
    { id: 'neo4j', name: 'Neo4j', description: 'Query and visualize graph databases with Cypher.', icon: '🕸️', category: 'data', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-neo4j'], required_credentials: [{ key: 'NEO4J_URI', label: 'Neo4j URI' }, { key: 'NEO4J_USER', label: 'Neo4j User' }, { key: 'NEO4J_PASSWORD', label: 'Neo4j Password' }] },

    // ── Search & Web ─────────────────────────────────────────────────
    { id: 'brave_search', name: 'Brave Search', description: 'Web and local search using Brave Search API.', icon: '🦁', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-brave-search'], required_credentials: [{ key: 'BRAVE_API_KEY', label: 'Brave API Key' }] },
    { id: 'fetch', name: 'Fetch', description: 'Fetch and convert web content for LLM consumption.', icon: '🌐', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] },
    { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation, screenshots, and web scraping.', icon: '🕷️', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-puppeteer'] },
    { id: 'exa', name: 'Exa', description: 'Advanced AI-powered web search with up-to-date results.', icon: '🔎', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-exa'], required_credentials: [{ key: 'EXA_API_KEY', label: 'Exa API Key' }] },
    { id: 'context7', name: 'Context7', description: 'Up-to-date code documentation for LLMs and AI editors.', icon: '📚', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
    { id: 'kagi', name: 'Kagi Search', description: 'Premium, ad-free web search via Kagi API.', icon: '🔮', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-kagi'], required_credentials: [{ key: 'KAGI_API_KEY', label: 'Kagi API Key' }] },
    { id: 'arxiv', name: 'ArXiv', description: 'Search and read scientific research papers from ArXiv.', icon: '📄', category: 'search', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-arxiv'] },

    // ── AI & Tools ───────────────────────────────────────────────────
    { id: 'memory', name: 'Memory', description: 'Persistent knowledge graph memory for AI conversations.', icon: '🧠', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
    { id: 'sequential_thinking', name: 'Sequential Thinking', description: 'Dynamic problem-solving through structured thought sequences.', icon: '💭', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequentialthinking'] },
    { id: 'everart', name: 'EverArt', description: 'AI image generation using multiple models and styles.', icon: '🎨', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-everart'], required_credentials: [{ key: 'EVERART_API_KEY', label: 'EverArt API Key' }] },
    { id: 'huggingface', name: 'HuggingFace', description: 'Search models, datasets, and Spaces on HuggingFace Hub.', icon: '🤗', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-huggingface'], required_credentials: [{ key: 'HF_TOKEN', label: 'HuggingFace Token' }] },
    { id: 'langfuse', name: 'Langfuse', description: 'LLM observability — traces, sessions, prompts, and debugging.', icon: '📡', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-langfuse'], required_credentials: [{ key: 'LANGFUSE_PUBLIC_KEY', label: 'Langfuse Public Key' }, { key: 'LANGFUSE_SECRET_KEY', label: 'Langfuse Secret Key' }] },
    { id: 'everything', name: 'MCP Everything', description: 'Test server demonstrating all MCP protocol features.', icon: '🧪', category: 'ai', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'] },

    // ── DevOps & Infrastructure ──────────────────────────────────────
    { id: 'docker', name: 'Docker', description: 'Manage containers, images, networks, and volumes.', icon: '🐳', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@thelord/mcp-server-docker-npx'] },
    { id: 'kubernetes', name: 'Kubernetes', description: 'Manage K8s clusters, pods, deployments, and services.', icon: '☸️', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', 'mcp-server-kubernetes'] },
    { id: 'aws_kb', name: 'AWS KB Retrieval', description: 'Query AWS Knowledge Bases for RAG-style retrieval.', icon: '☁️', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-aws-kb-retrieval'], required_credentials: [{ key: 'AWS_ACCESS_KEY_ID', label: 'AWS Access Key' }, { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Key' }] },
    { id: 'cloudflare', name: 'Cloudflare', description: 'Manage Workers, KV, R2, and D1 via Cloudflare API.', icon: '⚡', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-cloudflare'], required_credentials: [{ key: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare API Token' }] },
    { id: 'vercel', name: 'Vercel', description: 'Manage deployments, domains, and environment variables.', icon: '▲', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-vercel'], required_credentials: [{ key: 'VERCEL_TOKEN', label: 'Vercel Token' }] },
    { id: 'github_actions', name: 'GitHub Actions', description: 'Trigger, monitor, and manage CI/CD workflows.', icon: '🔄', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-github-actions'], required_credentials: [{ key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub PAT' }] },
    { id: 'terraform', name: 'Terraform', description: 'Infrastructure as code — plan, apply, and manage resources.', icon: '🏗️', category: 'devops', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-terraform'] },

    // ── Finance & Commerce ───────────────────────────────────────────
    { id: 'stripe', name: 'Stripe', description: 'Official Stripe integration for payments, subscriptions, and invoices.', icon: '💳', category: 'finance', transport: 'stdio', command: 'npx', args: ['-y', '@stripe/mcp'], required_credentials: [{ key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key' }] },
    { id: 'shopify', name: 'Shopify', description: 'Manage products, orders, customers, and store data.', icon: '🛒', category: 'finance', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-shopify'], required_credentials: [{ key: 'SHOPIFY_ACCESS_TOKEN', label: 'Shopify Access Token' }, { key: 'SHOPIFY_STORE_URL', label: 'Store URL' }] },
    { id: 'coinmarket', name: 'CoinMarketCap', description: 'Cryptocurrency listings, prices, and market data.', icon: '₿', category: 'finance', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-coinmarket'], required_credentials: [{ key: 'COINMARKETCAP_API_KEY', label: 'CoinMarketCap API Key' }] },

    // ── Analytics & Monitoring ───────────────────────────────────────
    { id: 'posthog', name: 'PostHog', description: 'Product analytics, user tracking, and A/B testing data.', icon: '🦔', category: 'analytics', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-posthog'], required_credentials: [{ key: 'POSTHOG_API_KEY', label: 'PostHog API Key' }, { key: 'POSTHOG_HOST', label: 'PostHog Host' }] },
    { id: 'grafana', name: 'Grafana', description: 'Search dashboards, investigate incidents, and query data sources.', icon: '📊', category: 'analytics', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-grafana'], required_credentials: [{ key: 'GRAFANA_URL', label: 'Grafana URL' }, { key: 'GRAFANA_API_KEY', label: 'Grafana API Key' }] },
    { id: 'datadog', name: 'Datadog', description: 'Monitor infrastructure, APM, logs, and metrics.', icon: '🐕', category: 'analytics', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-datadog'], required_credentials: [{ key: 'DD_API_KEY', label: 'Datadog API Key' }, { key: 'DD_APP_KEY', label: 'Datadog App Key' }] },

    // ── Social Media ─────────────────────────────────────────────────
    { id: 'twitter', name: 'Twitter / X', description: 'Post tweets, search, read timelines, and manage engagement.', icon: '🐦', category: 'social', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-twitter'], required_credentials: [{ key: 'TWITTER_API_KEY', label: 'Twitter API Key' }, { key: 'TWITTER_API_SECRET', label: 'Twitter API Secret' }] },
    { id: 'bluesky', name: 'Bluesky', description: 'Post, search, and interact on the Bluesky social network.', icon: '🦋', category: 'social', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-bluesky'], required_credentials: [{ key: 'BLUESKY_HANDLE', label: 'Bluesky Handle' }, { key: 'BLUESKY_APP_PASSWORD', label: 'App Password' }] },
    { id: 'youtube', name: 'YouTube', description: 'Search videos, fetch transcripts, and analyze channels.', icon: '▶️', category: 'social', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-youtube'], required_credentials: [{ key: 'YOUTUBE_API_KEY', label: 'YouTube API Key' }] },
    { id: 'reddit', name: 'Reddit', description: 'Browse posts, search content, and analyze subreddit activity.', icon: '🤖', category: 'social', transport: 'stdio', command: 'npx', args: ['-y', '@anthropic/mcp-server-reddit'] },
];

const CATEGORIES = [
    { id: 'all', label: 'All', icon: '🔮' },
    { id: 'development', label: 'Development', icon: '💻' },
    { id: 'communication', label: 'Communication', icon: '💬' },
    { id: 'productivity', label: 'Productivity', icon: '📋' },
    { id: 'data', label: 'Data', icon: '🗄️' },
    { id: 'search', label: 'Search & Web', icon: '🔍' },
    { id: 'ai', label: 'AI & Tools', icon: '🤖' },
    { id: 'devops', label: 'DevOps', icon: '🚀' },
    { id: 'finance', label: 'Finance', icon: '💳' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'social', label: 'Social', icon: '🌐' },
];

export default function McpMarketplace({ setMessage }) {
    // ─── State ──────────────────────────────────────────────────────
    const [installedServers, setInstalledServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [expandedServer, setExpandedServer] = useState(null);
    const [installing, setInstalling] = useState(null);
    const [showCustomAdd, setShowCustomAdd] = useState(false);
    const [showInstalled, setShowInstalled] = useState(false);

    // Custom server form state
    const [customName, setCustomName] = useState('');
    const [customTransport, setCustomTransport] = useState('stdio');
    const [customCommand, setCustomCommand] = useState('');
    const [customArgs, setCustomArgs] = useState('');
    const [customUrl, setCustomUrl] = useState('');
    const [customCreds, setCustomCreds] = useState('');
    const [customCategory, setCustomCategory] = useState('development');
    const [customTesting, setCustomTesting] = useState(false);
    const [customTestResult, setCustomTestResult] = useState(null);
    const [customAdding, setCustomAdding] = useState(false);

    // ─── Data Loading ───────────────────────────────────────────────
    const loadServers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`);
            if (res.ok) {
                const data = await res.json();
                setInstalledServers(data.servers || []);
            }
        } catch (e) {
            console.error('Failed to load MCP servers:', e);
        }
        setLoading(false);
    };

    useEffect(() => { loadServers(); }, []);

    const installedIds = useMemo(() => new Set(installedServers.map(s => s.id)), [installedServers]);
    const activeCount = useMemo(() => installedServers.filter(s => s.enabled && s.status === 'ready').length, [installedServers]);

    // ─── Filtered Registry ──────────────────────────────────────────
    const filteredRegistry = useMemo(() => {
        let items = MCP_REGISTRY;
        if (activeCategory !== 'all') {
            items = items.filter(s => s.category === activeCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q)
            );
        }
        return items;
    }, [activeCategory, searchQuery]);

    // ─── Install a registry server ──────────────────────────────────
    const handleInstall = async (server) => {
        setInstalling(server.id);
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: server.name,
                    command: server.command,
                    args: server.args || [],
                    required_credentials: server.required_credentials || [],
                    transport: server.transport || 'stdio',
                    url: server.url || null,
                    category: server.category,
                    description: server.description,
                    icon: server.icon,
                    source: 'registry',
                }),
            });
            if (res.ok) {
                setMessage?.({ type: 'success', text: `${server.name} installed successfully` });
                await loadServers();
            } else {
                const err = await res.json();
                setMessage?.({ type: 'error', text: err.error || 'Installation failed' });
            }
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Installation failed: ' + e.message });
        }
        setInstalling(null);
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Uninstall ──────────────────────────────────────────────────
    const handleUninstall = async (serverId, serverName) => {
        if (!confirm(`Remove "${serverName}"? This will disconnect the server and remove its configuration.`)) return;
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${serverId}`, { method: 'DELETE' });
            setInstalledServers(prev => prev.filter(s => s.id !== serverId));
            setMessage?.({ type: 'success', text: `${serverName} removed` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Remove failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Toggle enable/disable ──────────────────────────────────────
    const handleToggle = async (server) => {
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${server.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !server.enabled }),
            });
            await loadServers();
            setMessage?.({ type: 'success', text: `${server.name} ${!server.enabled ? 'enabled' : 'disabled'}` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Toggle failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Refresh tools ──────────────────────────────────────────────
    const handleRefresh = async (server) => {
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${server.id}/refresh`, { method: 'POST' });
            await loadServers();
            setMessage?.({ type: 'success', text: `${server.name} tools refreshed` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Refresh failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Custom server add ──────────────────────────────────────────
    const handleTestCustom = async () => {
        setCustomTesting(true);
        setCustomTestResult(null);
        try {
            const args = customArgs.trim() ? customArgs.trim().split(/\s+/) : [];
            const res = await authFetch(`${API_BASE}/ai/mcp-servers/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: customCommand.trim() || undefined,
                    args,
                    transport: customTransport,
                    url: customUrl.trim() || undefined,
                }),
            });
            setCustomTestResult(await res.json());
        } catch (e) {
            setCustomTestResult({ success: false, error: e.message });
        }
        setCustomTesting(false);
    };

    const handleAddCustom = async () => {
        setCustomAdding(true);
        try {
            const args = customArgs.trim() ? customArgs.trim().split(/\s+/) : [];
            const required_credentials = customCreds.trim()
                ? customCreds.split(',').map(s => s.trim()).filter(Boolean).map(key => ({ key, label: key }))
                : [];
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: customName.trim(),
                    command: customCommand.trim() || undefined,
                    args,
                    required_credentials,
                    transport: customTransport,
                    url: customUrl.trim() || undefined,
                    category: customCategory,
                    source: 'manual',
                }),
            });
            if (res.ok) {
                setMessage?.({ type: 'success', text: 'Custom server added' });
                setCustomName(''); setCustomCommand(''); setCustomArgs(''); setCustomUrl(''); setCustomCreds('');
                setShowCustomAdd(false); setCustomTestResult(null);
                await loadServers();
            } else {
                const err = await res.json();
                setMessage?.({ type: 'error', text: err.error || 'Failed to add' });
            }
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Failed: ' + e.message });
        }
        setCustomAdding(false);
        setTimeout(() => setMessage?.(null), 3000);
    };

    const canTestCustom = customTransport === 'stdio' ? !!customCommand.trim() : !!customUrl.trim();
    const canAddCustom = !!customName.trim() && canTestCustom;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Plug className="w-5 h-5" style={{ color: '#f59e0b' }} />
                            MCP Server Marketplace
                            {activeCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">{activeCount} active</span>
                            )}
                        </h2>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Browse and install MCP servers to extend AI agent capabilities. Users configure their credentials in Settings.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowInstalled(!showInstalled)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                            style={{
                                background: showInstalled ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: showInstalled ? '#fff' : 'var(--text-primary)',
                                borderColor: showInstalled ? 'transparent' : 'var(--border-default)',
                            }}
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            Installed ({installedServers.length})
                        </button>
                        <button
                            onClick={() => { setShowCustomAdd(!showCustomAdd); setCustomTestResult(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            <Plus className="w-3.5 h-3.5" /> Custom Server
                        </button>
                    </div>
                </div>

                {/* Custom Server Form */}
                {showCustomAdd && (
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Add Custom MCP Server</h3>
                            <button onClick={() => setShowCustomAdd(false)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            {/* Transport toggle */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Transport:</label>
                                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                                    {[{ id: 'stdio', label: 'Local (stdio)', Icon: Terminal }, { id: 'http', label: 'Remote (HTTP)', Icon: Globe }].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setCustomTransport(t.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                                            style={{
                                                background: customTransport === t.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                                color: customTransport === t.id ? '#fff' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <t.Icon className="w-3.5 h-3.5" /> {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input value={customName} onChange={e => setCustomName(e.target.value)}
                                    placeholder="Server name" className="px-3 py-2 rounded-lg text-sm border outline-none transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <select value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                                    className="px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                            </div>

                            {customTransport === 'stdio' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input value={customCommand} onChange={e => setCustomCommand(e.target.value)}
                                        placeholder="Command (e.g. npx)" className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                    <input value={customArgs} onChange={e => setCustomArgs(e.target.value)}
                                        placeholder="Arguments (e.g. -y @package/server)" className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                </div>
                            ) : (
                                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                                    placeholder="Server URL (e.g. https://my-mcp-server.com/mcp)" className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                            )}

                            <input value={customCreds} onChange={e => setCustomCreds(e.target.value)}
                                placeholder="Required credentials (comma-separated, e.g. GITHUB_TOKEN, API_KEY)"
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />

                            <div className="flex items-center gap-2">
                                <button onClick={handleTestCustom} disabled={customTesting || !canTestCustom}
                                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5 border"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
                                    {customTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />} Test
                                </button>
                                <button onClick={handleAddCustom} disabled={customAdding || !canAddCustom}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                    {customAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Server
                                </button>
                            </div>

                            {customTestResult && (
                                <div className={`text-xs px-3 py-2 rounded-lg ${customTestResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {customTestResult.success
                                        ? `✅ Connected — ${customTestResult.tools?.length || 0} tool(s): ${(customTestResult.tools || []).map(t => t.name).join(', ')}`
                                        : `❌ Failed: ${customTestResult.error}`}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Installed Servers Management */}
                {showInstalled && installedServers.length > 0 && (
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Wrench className="w-4 h-4" /> Installed Servers
                            </h3>
                        </div>
                        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                            {installedServers.map(server => {
                                const isExpanded = expandedServer === server.id;
                                const toolCount = server.tools_cache?.length || 0;
                                return (
                                    <div key={server.id}>
                                        <div className="flex items-center gap-3 px-5 py-3">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${server.status === 'ready' ? 'bg-green-500' : server.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`}
                                                title={server.status === 'error' ? server.error : server.status} />
                                            <span className="text-base flex-shrink-0">{server.icon || '🔌'}</span>
                                            <button onClick={() => setExpandedServer(isExpanded ? null : server.id)} className="flex-1 text-left min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{server.name}</div>
                                                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {server.transport === 'http' ? server.url : `${server.command} ${(server.args || []).join(' ')}`} · {toolCount} tool{toolCount !== 1 ? 's' : ''}
                                                    {server.category && ` · ${server.category}`}
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button onClick={() => handleRefresh(server)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Refresh tools">
                                                    <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                                <button onClick={() => handleToggle(server)} className="p-0.5">
                                                    {server.enabled
                                                        ? <ToggleRight className="w-5 h-5" style={{ color: '#10b981' }} />
                                                        : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
                                                </button>
                                                <button onClick={() => handleUninstall(server.id, server.name)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Remove">
                                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                </button>
                                                <button onClick={() => setExpandedServer(isExpanded ? null : server.id)} className="p-1">
                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-5 pb-4">
                                                {server.error && (
                                                    <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 mb-2">Error: {server.error}</div>
                                                )}
                                                {server.description && (
                                                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{server.description}</p>
                                                )}
                                                {(server.required_credentials || []).length > 0 && (
                                                    <div className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                        🔑 Required: {server.required_credentials.map(c => c.label || c.key).join(', ')}
                                                    </div>
                                                )}
                                                {toolCount === 0 ? (
                                                    <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No tools discovered. Try refreshing.</div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        {(server.tools_cache || []).map((tool, idx) => (
                                                            <div key={idx} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{tool.name}</div>
                                                                {tool.description && <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{tool.description}</div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Search + Categories */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search MCP servers..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                                style={{
                                    background: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                                    borderColor: activeCategory === cat.id ? 'transparent' : 'var(--border-default)',
                                }}
                            >
                                <span>{cat.icon}</span> {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Server Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRegistry.map(server => {
                        const isInstalled = installedIds.has(server.id);
                        const isInstalling = installing === server.id;
                        const installed = isInstalled ? installedServers.find(s => s.id === server.id) : null;
                        const credCount = (server.required_credentials || []).length;

                        return (
                            <div
                                key={server.id}
                                className="group rounded-xl border p-4 transition-all hover:shadow-lg hover:border-[var(--accent-primary)] relative"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    borderColor: isInstalled ? 'var(--accent-primary)' : 'var(--border-default)',
                                    opacity: isInstalled ? 0.85 : 1,
                                }}
                            >
                                {/* Installed badge */}
                                {isInstalled && (
                                    <div className="absolute top-3 right-3">
                                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                                            <Check className="w-3 h-3" /> Installed
                                        </span>
                                    </div>
                                )}

                                {/* Icon + Name */}
                                <div className="flex items-start gap-3 mb-2">
                                    <span className="text-2xl flex-shrink-0">{server.icon}</span>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{server.name}</h4>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                            {server.transport === 'http' ? '🌐 HTTP' : '💻 Local'}
                                        </span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    {server.description}
                                </p>

                                {/* Credentials needed */}
                                {credCount > 0 && (
                                    <div className="text-xs mb-3 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                        🔑 {credCount} credential{credCount !== 1 ? 's' : ''} needed
                                    </div>
                                )}

                                {/* Install / Status buttons */}
                                <div className="flex items-center gap-2">
                                    {isInstalled ? (
                                        <>
                                            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <div className={`w-2 h-2 rounded-full ${installed?.status === 'ready' ? 'bg-green-500' : installed?.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
                                                {installed?.tools_cache?.length || 0} tool{(installed?.tools_cache?.length || 0) !== 1 ? 's' : ''}
                                            </div>
                                            <div className="flex-1" />
                                            <button onClick={() => handleToggle(installed)} className="p-0.5" title={installed?.enabled ? 'Disable' : 'Enable'}>
                                                {installed?.enabled
                                                    ? <ToggleRight className="w-5 h-5" style={{ color: '#10b981' }} />
                                                    : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
                                            </button>
                                            <button onClick={() => handleUninstall(server.id, server.name)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Remove">
                                                <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleInstall(server)}
                                            disabled={isInstalling}
                                            className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                        >
                                            {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                            {isInstalling ? 'Installing...' : 'Install'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredRegistry.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-3xl mb-2">🔍</div>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            No servers found{searchQuery.trim() ? ` for "${searchQuery}"` : ' in this category'}.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
