import { Cloud, Shield, Layers, FileText } from 'lucide-react';

/* ── Sub-sections ─────────────────────────────────────────────────────── */
export const SUB_SECTIONS = [
    { id: 'openai', labelKey: 'azure.openai_label', icon: Cloud, color: '#0078D4', descKey: 'azure.openai_desc' },
    { id: 'chatModels', labelKey: 'azure.chat_tiers_label', icon: Layers, color: '#5B5FC7', descKey: 'azure.chat_tiers_desc' },
    { id: 'docProcessing', labelKey: 'azure.doc_processing_label', icon: FileText, color: '#0078D4', descKey: 'azure.doc_processing_desc' },
    { id: 'sso', labelKey: 'azure.sso_label', icon: Shield, color: '#00a4ef', descKey: 'azure.sso_desc' },
];

/* ── Chat Model Tier definitions ─────────────────────────────────────── */
export const TIERS = [
    { key: 'fast', icon: '⚡', labelKey: 'azure.tier_fast', descKey: 'azure.tier_fast_desc' },
    { key: 'thinking', icon: '🧠', labelKey: 'azure.tier_thinking', descKey: 'azure.tier_thinking_desc' },
    { key: 'writer', icon: '✍️', labelKey: 'azure.tier_writer', descKey: 'azure.tier_writer_desc' },
    { key: 'pro', icon: '✨', labelKey: 'azure.tier_pro', descKey: 'azure.tier_pro_desc' },
];

export const TIER_DEFAULTS = {
    fast: { maxTokens: 8192, temperature: 0.7 },
    thinking: { maxTokens: 40960, temperature: 0.7 },
    writer: { maxTokens: 16384, temperature: 0.7 },
    pro: { maxTokens: 40960, temperature: 0.7 },
};

/* ── Model metadata for display names ────────────────────────────────── */
const MODEL_META = {
    'mistral-large-latest': { name: 'Mistral Large 3', cat: 'Generalist' },
    'mistral-medium-latest': { name: 'Mistral Medium 3.1', cat: 'Generalist' },
    'mistral-small-latest': { name: 'Mistral Small 3.2', cat: 'Generalist' },
    'gpt-5.2': { name: 'GPT-5.2', cat: 'Generalist' },
    'gpt-5.2-pro': { name: 'GPT-5.2 Pro', cat: 'Reasoning' },
    'gpt-5-mini': { name: 'GPT-5 Mini', cat: 'Generalist' },
    'gpt-4o': { name: 'GPT-4o', cat: 'Generalist' },
    'gpt-4o-mini': { name: 'GPT-4o Mini', cat: 'Generalist' },
    'gpt-4.1': { name: 'GPT-4.1', cat: 'Generalist' },
    'gpt-4.1-mini': { name: 'GPT-4.1 Mini', cat: 'Generalist' },
    'gpt-4.1-nano': { name: 'GPT-4.1 Nano', cat: 'Generalist' },
    'o3': { name: 'o3', cat: 'Reasoning' },
    'o3-mini': { name: 'o3 Mini', cat: 'Reasoning' },
    'o4-mini': { name: 'o4 Mini', cat: 'Reasoning' },
    'magistral-medium-latest': { name: 'Magistral Medium 1.2', cat: 'Reasoning' },
    'magistral-small-latest': { name: 'Magistral Small 1.2', cat: 'Reasoning' },
    'codestral-latest': { name: 'Codestral', cat: 'Coding' },
    'devstral-latest': { name: 'Devstral 2', cat: 'Coding' },
};

export const getModelMeta = (id) => {
    if (MODEL_META[id]) return MODEL_META[id];
    const prefixes = Object.keys(MODEL_META).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
        if (id.startsWith(prefix.replace(/-latest$/, '').replace(/-\d{4}$/, ''))) {
            return MODEL_META[prefix];
        }
    }
    return null;
};

export const formatModelId = (id) => {
    if (!id) return id;
    let name = id.replace(/-\d{6,8}$/, '').replace(/-\d{4}$/, '');
    return name.split('-').map(part => /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

export const getDisplayName = (model) => {
    const meta = getModelMeta(model.id || model);
    if (meta?.name) return meta.name;
    if (model.name && model.name !== model.id) return model.name;
    return formatModelId(model.id || model);
};

export const isReasoningCapable = (modelId) => {
    if (!modelId) return false;
    if (/^o\d/.test(modelId)) return true;
    if (/^gpt-5/.test(modelId)) return true;
    if (/^claude-(opus|sonnet|haiku)-4/.test(modelId)) return true;
    return false;
};

export const isClaudeReasoning = (modelId) => {
    if (!modelId) return false;
    return /^claude-(opus|sonnet|haiku)-4/.test(modelId);
};

