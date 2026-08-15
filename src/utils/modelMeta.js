import { API_BASE, authFetch } from './helpers';
// Shared model metadata, whitelist, and helpers
// Used by AIConfigPanel, AgentDesigner, MultiAgentConfig, etc.

// Human-readable metadata for Mistral models (prices in $ per million tokens unless noted)
export const MISTRAL_MODEL_META = {
    // --- Frontier: Generalist ---
    'mistral-large-latest': { name: 'Mistral Large 3', desc: 'State-of-the-art open-weight multimodal model', cat: 'Generalist', input: 0.5, output: 1.5 },
    'mistral-large-2411': { name: 'Mistral Large 2.1', desc: 'Top-tier large model for high-complexity tasks', cat: 'Generalist', input: 0.5, output: 1.5 },
    'mistral-medium-latest': { name: 'Mistral Medium 3.1', desc: 'Frontier-class multimodal model', cat: 'Generalist', input: 0.4, output: 2.0 },
    'mistral-medium': { name: 'Mistral Medium 3', desc: 'Frontier-class multimodal model', cat: 'Generalist', input: 0.4, output: 2.0 },
    'mistral-medium-2505': { name: 'Mistral Medium 3', desc: 'Frontier-class multimodal model', cat: 'Generalist', input: 0.4, output: 2.0 },
    'mistral-medium-2508': { name: 'Mistral Medium 3.1', desc: 'Frontier-class multimodal model', cat: 'Generalist', input: 0.4, output: 2.0 },
    'mistral-small-latest': { name: 'Mistral Small 3.2', desc: 'Compact and efficient model', cat: 'Generalist', input: 0.1, output: 0.3 },
    'mistral-small-2506': { name: 'Mistral Small 3.2', desc: 'Compact and efficient model', cat: 'Generalist', input: 0.1, output: 0.3 },
    'ministral-8b-latest': { name: 'Ministral 3 8B', desc: 'Powerful and efficient text + vision model', cat: 'Generalist', input: 0.15, output: 0.15 },
    'ministral-3b-latest': { name: 'Ministral 3 3B', desc: 'Tiny and efficient text + vision model', cat: 'Generalist', input: 0.1, output: 0.1 },
    'open-mistral-nemo': { name: 'Mistral Nemo 12B', desc: 'Best multilingual open-source model', cat: 'Generalist', input: 0.15, output: 0.15 },
    'open-mistral-nemo-2407': { name: 'Mistral Nemo 12B', desc: 'Multilingual open source model', cat: 'Generalist', input: 0.15, output: 0.15 },
    'mistral-tiny-latest': { name: 'Mistral Tiny', desc: 'Lightweight model for simple tasks', cat: 'Generalist', input: 0.1, output: 0.1 },
    'mistral-tiny-2407': { name: 'Mistral Tiny', desc: 'Lightweight model', cat: 'Generalist', input: 0.1, output: 0.1 },
    // --- Reasoning ---
    'magistral-medium-latest': { name: 'Magistral Medium 1.2', desc: 'Frontier-class multimodal reasoning model', cat: 'Reasoning', input: 2.0, output: 5.0 },
    'magistral-medium-2509': { name: 'Magistral Medium 1.2', desc: 'Frontier-class multimodal reasoning model', cat: 'Reasoning', input: 2.0, output: 5.0 },
    'magistral-small-latest': { name: 'Magistral Small 1.2', desc: 'Small multimodal reasoning model', cat: 'Reasoning', input: 0.5, output: 1.5 },
    'magistral-small-2509': { name: 'Magistral Small 1.2', desc: 'Small multimodal reasoning model', cat: 'Reasoning', input: 0.5, output: 1.5 },
    // --- Coding ---
    'codestral-latest': { name: 'Codestral', desc: 'Cutting-edge code completion model', cat: 'Coding', input: 0.3, output: 0.9 },
    'codestral-2508': { name: 'Codestral', desc: 'Code completion model', cat: 'Coding', input: 0.3, output: 0.9 },
    'devstral-latest': { name: 'Devstral 2', desc: 'Frontier code agent for software engineering', cat: 'Coding', input: 0.4, output: 2.0 },
    'devstral-2512': { name: 'Devstral 2', desc: 'Frontier code agent for SWE tasks', cat: 'Coding', input: 0.4, output: 2.0 },
    'devstral-small-latest': { name: 'Devstral Small 2', desc: 'Code agent for exploring and editing codebases', cat: 'Coding', input: 0.1, output: 0.3 },
    'devstral-small-2507': { name: 'Devstral Small 1.1', desc: 'Open source SWE model', cat: 'Coding', input: 0.1, output: 0.3 },
    'devstral-medium-latest': { name: 'Devstral Medium 1.0', desc: 'Enterprise-grade text model for SWE', cat: 'Coding', input: 0.4, output: 2.0 },
    'devstral-medium-2507': { name: 'Devstral Medium 1.0', desc: 'Enterprise-grade SWE model', cat: 'Coding', input: 0.4, output: 2.0 },
    'mistral-vibe-cli-latest': { name: 'Mistral Vibe CLI', desc: 'CLI-optimized development model', cat: 'Coding' },
    'mistral-vibe-cli-with-tools': { name: 'Mistral Vibe CLI + Tools', desc: 'CLI model with tool-use support', cat: 'Coding' },
    // --- Vision ---
    'pixtral-large-latest': { name: 'Pixtral Large', desc: 'Frontier-class multimodal model', cat: 'Vision', input: 2.0, output: 6.0 },
    'pixtral-large-2411': { name: 'Pixtral Large', desc: 'Multimodal model', cat: 'Vision', input: 2.0, output: 6.0 },
    'mistral-large-pixtral-2411': { name: 'Pixtral (Large base)', desc: 'Pixtral on Mistral Large backbone', cat: 'Vision', input: 2.0, output: 6.0 },
    // --- Audio ---
    'voxtral-mini-latest': { name: 'Voxtral Mini Transcribe 2', desc: 'Audio transcription model', cat: 'Audio', price: '$0.003/min' },
    'voxtral-small-latest': { name: 'Voxtral Small', desc: 'Audio input model for instruct use cases', cat: 'Audio', output: 0.3 },
    'voxtral-small-2507': { name: 'Voxtral Small', desc: 'Audio input model', cat: 'Audio', output: 0.3 },
    'voxtral-mini-2507': { name: 'Voxtral Mini', desc: 'Mini audio input model', cat: 'Audio', price: '$0.003/min' },
    // --- Embeddings ---
    'mistral-embed': { name: 'Mistral Embed', desc: 'Semantic text embedding model', cat: 'Embedding', input: 0.1 },
    'codestral-embed-2505': { name: 'Codestral Embed', desc: 'Code embedding model', cat: 'Embedding', input: 0.15 },
    // --- OCR ---
    'mistral-ocr-latest': { name: 'Mistral OCR 3', desc: 'Document OCR for PDFs and images', cat: 'OCR', price: '$2/1K pages' },
    // --- Moderation ---
    'mistral-moderation-latest': { name: 'Mistral Moderation', desc: 'Content moderation and safety', cat: 'Moderation', input: 0.1 },
    // --- Creative ---
    'labs-mistral-small-creative': { name: 'Mistral Small Creative', desc: 'Creative writing and character interaction', cat: 'Generalist', input: 0.1, output: 0.3 },
    // --- Legacy ---
    'open-mixtral-8x22b': { name: 'Mixtral 8x22B', desc: 'Large mixture-of-experts model', cat: 'Generalist', input: 2.0, output: 6.0 },
    'open-mixtral-8x7b': { name: 'Mixtral 8x7B', desc: 'Mixture-of-experts model', cat: 'Generalist', input: 0.7, output: 0.7 },
    'open-mistral-7b': { name: 'Mistral 7B', desc: 'Compact open-source model', cat: 'Generalist', input: 0.25, output: 0.25 },
    // --- OpenAI: Flagship (GPT-5 family) ---
    // Newest first. Pricing is indicative for cost estimation; verify against
    // the Azure/OpenAI pricing pages for billing-grade figures.
    'gpt-5.5': { name: 'GPT-5.5', desc: 'Frontier reasoning with deep long-context & agentic execution', cat: 'Reasoning' },
    'gpt-5.4': { name: 'GPT-5.4', desc: 'Strong multi-step reasoning for enterprise agents', cat: 'Reasoning' },
    'gpt-5.4-mini': { name: 'GPT-5.4 Mini', desc: 'Real-time reasoning for apps and agents', cat: 'Generalist' },
    'gpt-5.4-nano': { name: 'GPT-5.4 Nano', desc: 'Ultra-low-latency reasoning, smallest tier', cat: 'Generalist' },
    'gpt-5.4-pro': { name: 'GPT-5.4 Pro', desc: 'Pro reasoning (high effort only)', cat: 'Reasoning' },
    'gpt-5.2': { name: 'GPT-5.2', desc: 'Flagship model for coding and agentic tasks', cat: 'Generalist', input: 1.75, output: 14.0 },
    'gpt-5.2-pro': { name: 'GPT-5.2 Pro', desc: 'Smartest model for top-quality execution', cat: 'Reasoning', input: 21.0, output: 168.0 },
    'gpt-5.1': { name: 'GPT-5.1', desc: 'General reasoning with flexible effort (defaults to none)', cat: 'Generalist', input: 1.25, output: 10.0 },
    'gpt-5.1-chat': { name: 'GPT-5.1 Chat', desc: 'Chat-optimised reasoning model', cat: 'Generalist', input: 1.25, output: 10.0 },
    'gpt-5': { name: 'GPT-5', desc: 'Base full reasoning model', cat: 'Reasoning', input: 1.25, output: 10.0 },
    'gpt-5-pro': { name: 'GPT-5 Pro', desc: 'Pro reasoning tier (high effort only)', cat: 'Reasoning', input: 15.0, output: 120.0 },
    'gpt-5-chat': { name: 'GPT-5 Chat', desc: 'Chat-optimised GPT-5', cat: 'Generalist', input: 1.25, output: 10.0 },
    'gpt-5-mini': { name: 'GPT-5 Mini', desc: 'Fast cost-efficient model for well-defined tasks', cat: 'Generalist', input: 0.25, output: 2.0 },
    'gpt-5-nano': { name: 'GPT-5 Nano', desc: 'Ultra-light, lowest-latency reasoning', cat: 'Generalist', input: 0.05, output: 0.40 },
    'gpt-4o': { name: 'GPT-4o', desc: 'Multimodal model (retires 2026-03-31 — migrate to GPT-5/4.1)', cat: 'Generalist', input: 2.5, output: 10.0 },
    'gpt-4o-mini': { name: 'GPT-4o Mini', desc: 'Fast, affordable small model', cat: 'Generalist', input: 0.15, output: 0.60 },
    'gpt-4.1': { name: 'GPT-4.1', desc: 'Flagship model for complex tasks', cat: 'Generalist', input: 2.0, output: 8.0 },
    'gpt-4.1-mini': { name: 'GPT-4.1 Mini', desc: 'Balanced performance and cost', cat: 'Generalist', input: 0.40, output: 1.60 },
    'gpt-4.1-nano': { name: 'GPT-4.1 Nano', desc: 'Fastest and cheapest model', cat: 'Generalist', input: 0.10, output: 0.40 },
    // --- OpenAI: Coding (Codex) ---
    'gpt-5.3-codex': { name: 'GPT-5.3 Codex', desc: 'Code generation with reasoning', cat: 'Coding' },
    'gpt-5.2-codex': { name: 'GPT-5.2 Codex', desc: 'Code generation with reasoning', cat: 'Coding' },
    'gpt-5.1-codex': { name: 'GPT-5.1 Codex', desc: 'Code generation with reasoning', cat: 'Coding' },
    'gpt-5.1-codex-mini': { name: 'GPT-5.1 Codex Mini', desc: 'Lightweight code generation', cat: 'Coding' },
    'gpt-5.1-codex-max': { name: 'GPT-5.1 Codex Max', desc: 'Code generation with xHigh reasoning effort', cat: 'Coding' },
    'gpt-5-codex': { name: 'GPT-5 Codex', desc: 'Code generation with reasoning', cat: 'Coding' },
    // --- OpenAI: Reasoning (o-series) ---
    'o3': { name: 'o3', desc: 'Powerful reasoning model', cat: 'Reasoning', input: 2.0, output: 8.0 },
    'o3-mini': { name: 'o3 Mini', desc: 'Fast reasoning model', cat: 'Reasoning', input: 1.10, output: 4.40 },
    'o4-mini': { name: 'o4 Mini', desc: 'Latest fast reasoning model', cat: 'Reasoning', input: 1.10, output: 4.40 },
    // --- Claude ---
    'claude-fable-5': { name: 'Claude Fable 5', cat: 'Reasoning' },
    'claude-opus-4-8': { name: 'Claude Opus 4.8', cat: 'Reasoning' },
    'claude-sonnet-5': { name: 'Claude Sonnet 5', cat: 'Generalist' },
    'claude-opus-4-7': { name: 'Claude Opus 4.7', desc: 'Most capable Claude — adaptive thinking, agentic coding, 1M context', cat: 'Reasoning', input: 5.0, output: 25.0 },
    'claude-opus-4-6': { name: 'Claude Opus 4.6', desc: 'Powerful reasoning with adaptive thinking', cat: 'Reasoning', input: 5.0, output: 25.0 },
    'claude-sonnet-4-6': { name: 'Claude Sonnet 4.6', desc: 'Balanced speed and intelligence, 1M context', cat: 'Generalist', input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { name: 'Claude Haiku 4.5', desc: 'Fastest Claude with near-frontier intelligence', cat: 'Generalist', input: 1.0, output: 5.0 },
};

// Only these models are shown by default
export const VISIBLE_MODELS = new Set([
    // Mistral
    'codestral-latest',
    'mistral-medium-latest',
    'mistral-large-latest',
    'ministral-3b-latest',
    'ministral-8b-latest',
    'ministral-14b-latest',
    'mistral-embed',
    'devstral-latest',
    'devstral-small-latest',
    'mistral-small-latest',
    'pixtral-large-latest',
    'magistral-small-latest',
    // OpenAI
    'gpt-5.2',
    'gpt-5.2-pro',
    'gpt-5-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3',
    'o3-mini',
    'o4-mini',
    // Claude
    'claude-opus-4-7',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
]);

// Get metadata for a model ID (exact then fuzzy prefix match)
export const getModelMeta = (id) => {
    if (MISTRAL_MODEL_META[id]) return MISTRAL_MODEL_META[id];
    const prefixes = Object.keys(MISTRAL_MODEL_META).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
        if (id.startsWith(prefix.replace(/-latest$/, '').replace(/-\d{4}$/, ''))) {
            return MISTRAL_MODEL_META[prefix];
        }
    }
    return null;
};

// Auto-format a raw model ID into a readable name: strip trailing date
// stamps (e.g. -20251101 or -2411) and title-case the hyphenated parts.
export const formatModelId = (id) => {
    if (!id) return id;
    const name = String(id).replace(/-\d{6,8}$/, '').replace(/-\d{4}$/, '');
    return name.split('-').map(part => /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

// Get the display name for a model. Accepts either a raw model ID string or
// a model object ({ id, name }). Resolution order: user alias → self-hosted
// label from the server → metadata name → server-provided name (object form
// only) → auto-formatted ID.
export const getModelDisplayName = (model) => {
    const id = typeof model === 'string' ? model : model?.id;
    if (!id) return '';
    const aliases = JSON.parse(localStorage.getItem('modelAliases') || '{}');
    if (aliases[id]) return aliases[id];
    // Self-hosted models: the server already produced the label (it is the only
    // side that knows the parameter size / quantisation the runtime reported),
    // and the tag itself — `qwen3:30b-a3b` — is what the admin recognises.
    // formatModelId would mangle it into "Qwen3:30b A3b", so never apply it.
    if (typeof model === 'object' && model?.local) return model.name || id;
    const meta = getModelMeta(id);
    if (meta?.name) return meta.name;
    if (typeof model === 'object' && model?.name && model.name !== id) return model.name;
    return formatModelId(id);
};

// Coarse model-family bucket for a model ID — powers the "Family" filter
// chips in the shared searchable model picker.
export const getModelFamily = (modelId) => {
    if (/^gpt-5/.test(modelId)) return 'GPT-5';
    if (/^gpt-4\.1/.test(modelId)) return 'GPT-4.1';
    if (/^gpt-4o/.test(modelId)) return 'GPT-4o';
    if (/^gpt-4/.test(modelId)) return 'GPT-4';
    if (/^o\d/.test(modelId)) return 'o-series';
    if (/^claude-/.test(modelId)) return 'Claude';
    if (/^gemini-/.test(modelId)) return 'Gemini';
    if (/^mistral-large/.test(modelId)) return 'Mistral Large';
    if (/^mistral-medium/.test(modelId)) return 'Mistral Medium';
    if (/^mistral-small/.test(modelId)) return 'Mistral Small';
    if (/^magistral/.test(modelId)) return 'Magistral';
    if (/^codestral/.test(modelId)) return 'Codestral';
    if (/^devstral/.test(modelId)) return 'Devstral';
    if (/^pixtral/.test(modelId)) return 'Pixtral';
    if (/^ministral/.test(modelId)) return 'Ministral';
    if (/^mistral/.test(modelId)) return 'Mistral Other';
    // Open-weight families served from a self-hosted runtime. Matched loosely
    // because the same weights arrive under three different id shapes
    // (`qwen3:8b`, `Qwen/Qwen3-8B`, `Qwen3-8B-Q4_K_M.gguf`).
    const local = String(modelId).toLowerCase();
    if (/qwq|qwen/.test(local)) return 'Qwen';
    if (/deepseek/.test(local)) return 'DeepSeek';
    if (/llama|llava/.test(local)) return 'Llama';
    if (/gemma/.test(local)) return 'Gemma';
    if (/gpt-?oss/.test(local)) return 'gpt-oss';
    if (/phi-?\d/.test(local)) return 'Phi';
    if (/glm-?\d/.test(local)) return 'GLM';
    if (/granite/.test(local)) return 'Granite';
    if (/embed|bge-|gte-|minilm/.test(local)) return 'Embedding';
    return 'Other';
};

// Cache for allowed models config (fetched from server DB)
let _allowedModelsCache = null;
let _allowedModelsFetchPromise = null;

// Fetch allowed models config from server and cache it
export const fetchAllowedModelsByAgentType = async () => {
    if (_allowedModelsCache) return _allowedModelsCache;
    if (_allowedModelsFetchPromise) return _allowedModelsFetchPromise;

    _allowedModelsFetchPromise = (async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                _allowedModelsCache = data.allowedModelsByAgentType || {};
            } else {
                _allowedModelsCache = {};
            }
        } catch (e) {
            _allowedModelsCache = {};
        }
        _allowedModelsFetchPromise = null;
        return _allowedModelsCache;
    })();

    return _allowedModelsFetchPromise;
};

// Invalidate cache (call after saving new config)
export const invalidateAllowedModelsCache = () => {
    _allowedModelsCache = null;
    _allowedModelsFetchPromise = null;
};

// Filter models to only visible ones (respecting whitelist + manual hides + per-agent-type restrictions)
// agentType is optional: 'chat'
// allowedConfig is optional: pre-fetched allowedModelsByAgentType object (avoids async)
export const filterVisibleModels = (models, agentType = null, allowedConfig = null) => {
    const hiddenModels = JSON.parse(localStorage.getItem('hiddenModels') || '{}');
    // VISIBLE_MODELS is a hand-curated allow-list of cloud model ids, so it can
    // never contain a self-hosted one — whatever the customer pulled onto their
    // own box is by definition not in a list shipped with the product. Local
    // models are admitted on the `local` flag the server stamps on them; they
    // are still subject to the manual hide list and per-agent-type limits.
    let filtered = models
        .filter(m => !hiddenModels[m.id] && (m.local || VISIBLE_MODELS.has(m.id)));

    // Apply per-agent-type restrictions if provided
    if (agentType && allowedConfig) {
        const allowed = allowedConfig[agentType];
        if (allowed && Array.isArray(allowed) && allowed.length > 0) {
            filtered = filtered.filter(m => allowed.includes(m.id));
        }
    }

    return filtered.map(m => {
        const meta = MISTRAL_MODEL_META[m.id] || getModelMeta(m.id);
        // Pass the model object (not the bare id) so a self-hosted model keeps
        // the label and category the server derived for it.
        const displayName = getModelDisplayName(m);
        return {
            ...m,
            displayName,
            name: displayName,
            desc: meta?.desc || (m.local ? 'Self-hosted' : ''),
            cat: meta?.cat || m.cat || '',
        };
    });
};

export const CAT_COLORS = {
    Generalist: 'rgba(59, 130, 246, 0.2)',
    Reasoning: 'rgba(168, 85, 247, 0.2)',
    Coding: 'rgba(16, 185, 129, 0.2)',
    Vision: 'rgba(245, 158, 11, 0.2)',
    Audio: 'rgba(236, 72, 153, 0.2)',
    Embedding: 'rgba(107, 114, 128, 0.2)',
    OCR: 'rgba(249, 115, 22, 0.2)',
    Moderation: 'rgba(239, 68, 68, 0.2)',
};
