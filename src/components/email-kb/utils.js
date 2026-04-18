import { API_BASE } from '../../utils/helpers';

export const api = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}/api/email-kb${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
};

export const timeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

export const DEFAULT_PIPELINE_CONFIG = {
    language: '',
    ingestion_mode: 'category_merge',
    article: { modelTier: 'fast', systemPrompt: '' },
    category: { modelTier: 'fast', systemPrompt: '' },
    merge: { modelTier: 'fast', systemPrompt: '' },
};

export const mergePipelineConfig = (pc) => ({
    ...DEFAULT_PIPELINE_CONFIG,
    ...pc,
    article: { ...DEFAULT_PIPELINE_CONFIG.article, ...pc?.article },
    category: { ...DEFAULT_PIPELINE_CONFIG.category, ...pc?.category },
    merge: { ...DEFAULT_PIPELINE_CONFIG.merge, ...pc?.merge },
});

export const settingsFromConnection = (conn) => ({
    sync_interval_minutes: conn.sync_interval_minutes || 60,
    group_threads: conn.group_threads,
    process_attachments: conn.process_attachments,
    enabled: conn.enabled,
    folder_filter: conn.folder_filter || ['INBOX'],
    sender_blacklist: conn.sender_blacklist || [],
    knowledge_base_id: conn.knowledge_base_id,
    ai_system_prompt: conn.ai_system_prompt || '',
    redact_pii: conn.redact_pii !== false,
    max_emails_per_sync: conn.max_emails_per_sync || 50,
    sync_after_date: conn.sync_after_date || '',
    pipeline_config: mergePipelineConfig(conn.pipeline_config),
});
