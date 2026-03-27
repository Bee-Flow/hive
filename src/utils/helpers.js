import { v4 as uuidv4 } from 'uuid';

// In production (built app), always use relative URLs so nginx handles proxying
// In development, use the same hostname but port 3001 (allows network access from any IP)
// This ensures that if you access from 10.5.0.2:5175, API calls go to 10.5.0.2:3001
function getApiBase() {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    if (import.meta.env.PROD) {
        return ''; // Relative URLs in production (nginx proxy)
    }
    // Development: use same host as frontend but port 3001
    const host = window.location.hostname;
    return `http://${host}:3001`;
}
export const API_BASE = getApiBase();

export const generateMessageId = () => uuidv4();

export const authFetch = async (url, options = {}) => {
    const defaultOptions = {
        credentials: 'include',
    };

    const finalOptions = {
        ...defaultOptions,
        ...options
    };

    // Merge headers if provided
    if (options.headers) {
        finalOptions.headers = { ...options.headers };
    }

    const response = await fetch(url, finalOptions);

    // If server returns 401 (user deleted / session invalid), force logout
    // Skip for auth endpoints that handle their own auth flow or are called during login
    // Auto-reload on 401 ONLY for app-level API calls (user is logged in but session
    // expired).  Skip all /auth/ routes (login page uses these before authentication)
    // and /api/health (public, no session required) to avoid an infinite reload loop
    // in private-cloud mode where LoginPage renders immediately while unauthenticated.
    if (response.status === 401 && !url.includes('/auth/') && !url.includes('/api/health')) {
        window.location.reload();
        return response;
    }

    return response;
};

export const getAgentInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

export const getAgentColor = (name) => {
    if (!name) return 'var(--accent-primary)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 40%)`;
};

/**
 * Returns a human-friendly relative time string (e.g., "3 days ago")
 * @param {string|Date} date - The date to format
 * @returns {string}
 */
export const getRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
};

/**
 * Maps technical tool IDs to human-friendly names
 */
export const TOOL_NAME_MAP = {
    'google_search': 'Google Search',
    'terminal_exec': 'Terminal',
    'python_interpreter': 'Python',
    'web_browser': 'Web Browser',
    'sql_query': 'Database',
    'file_read': 'File System',
    'api_fetcher': 'API Fetcher',
    'sequentialthinking': 'Reasoning',
    'browser_agent': 'Web Automation',
    'document_reader': 'Doc Parser',
    'arxiv_search': 'arXiv',
    'scholar_search': 'Google Scholar',
    'pubmed_search': 'PubMed',
    'crossref_lookup': 'CrossRef',
    'serper_search': 'Web Search',
};

/**
 * Returns a human-friendly label for a tool name.
 * Falls back to prettifying the raw name (snake_case → Title Case).
 */
export const getToolLabel = (name) => {
    if (!name) return 'Tool';
    if (TOOL_NAME_MAP[name]) return TOOL_NAME_MAP[name];
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Returns an emoji icon for a known tool, or a generic wrench.
 */
export const getToolIcon = (name) => {
    const icons = {
        'agent_search': '🔍', 'google_search': '🔍', 'serper_search': '🔍',
        'scholar_search': '🔍', 'arxiv_search': '🔍', 'pubmed_search': '🔍', 'crossref_lookup': '🔍',
        'web_browser': '🌐', 'browser_agent': '🌐',
        'terminal_exec': '💻', 'python_interpreter': '🐍',
        'notebook_doc_write': '📝', 'notebook_add_source': '📎',
        'sql_query': '🗄️', 'file_read': '📂', 'document_reader': '📄',
        'gmail_tool': '📧', 'calendar_tool': '📅',
        'sequentialthinking': '🧠', 'api_fetcher': '🔗',
    };
    return icons[name] || '🔧';
};
