import React, { useState, useEffect } from 'react';
import SearchableModelSelect from './shared/SearchableModelSelect';
import beeFlowIcon from '../../assets/BeeFlow-logo-Icon-2026.svg';
import { API_BASE, authFetch } from '../../utils/helpers';
import { getModelDisplayName } from '../../utils/modelMeta';

// Reuse model metadata from AIConfigPanel
const getModelMeta = (id) => {
    const meta = MODEL_META[id];
    if (meta) return meta;
    const prefixes = Object.keys(MODEL_META).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
        if (id.startsWith(prefix.replace(/-latest$/, '').replace(/-\d{4}$/, ''))) {
            return MODEL_META[prefix];
        }
    }
    return null;
};

// Detect models that support OpenAI reasoning settings
const isReasoningCapable = (modelId) => {
    if (!modelId) return false;
    if (/^o\d/.test(modelId)) return true;                          // o1, o3, o4-mini, etc.
    if (/^gpt-5/.test(modelId)) return true;                        // GPT-5 family
    if (/^claude-haiku-4-5/.test(modelId)) return false;            // Haiku 4.5: no adaptive thinking
    if (/^claude-(opus|sonnet)-[45]/.test(modelId)) return true;    // Claude Opus/Sonnet 4.x & 5.x
    if (/^claude-(fable|mythos)/.test(modelId)) return true;        // Fable/Mythos 5 (always-on thinking)
    return false;
};

// Detect Claude models specifically (they use adaptive thinking with effort levels)
const isClaudeReasoning = (modelId) => {
    if (!modelId) return false;
    if (/^claude-haiku-4-5/.test(modelId)) return false;
    return /^claude-(opus|sonnet)-[45]/.test(modelId) || /^claude-(fable|mythos)/.test(modelId);
};

// Adaptive-only Claude family: rejects a manual thinking budget and exposes the
// 'xhigh' effort level — Opus 4.7/4.8, Sonnet 5, Fable/Mythos 5. (Opus 4.6 /
// Sonnet 4.6 still accept a fixed budget.)
const isClaudeAdaptiveOnly = (modelId) => /^claude-(opus-4-[78]|sonnet-5|fable-5|mythos)/.test(modelId || '');

// Any Claude model (used to show Claude-specific tier settings inline)
const isClaudeModel = (modelId) => /^claude-/.test(modelId || '');

// OpenAI reasoning models (o-series + GPT-5 family)
const isOpenAIReasoning = (modelId) => /^gpt-5|^o\d/.test(modelId || '');
// GPT-5 family (supports the 'minimal' effort tier and the verbosity knob)
const isGpt5 = (modelId) => /^gpt-5/.test(modelId || '');
// Pro models reason at 'high' only (gpt-5-pro, gpt-5.2-pro, gpt-5.4-pro, …)
const isGpt5Pro = (modelId) => /^gpt-5(\.\d+)?-pro$/.test(modelId || '');
// Only codex-max accepts the 'xhigh' effort tier
const isCodexMax = (modelId) => /codex-max/.test(modelId || '');

const MODEL_META = {
    // Mistral
    'mistral-large-latest': { name: 'Mistral Large 3', cat: 'Generalist' },
    'mistral-medium-latest': { name: 'Mistral Medium 3.1', cat: 'Generalist' },
    'mistral-small-latest': { name: 'Mistral Small 3.2', cat: 'Generalist' },
    'ministral-8b-latest': { name: 'Ministral 3 8B', cat: 'Generalist' },
    'ministral-3b-latest': { name: 'Ministral 3 3B', cat: 'Generalist' },
    'magistral-medium-latest': { name: 'Magistral Medium 1.2', cat: 'Reasoning' },
    'magistral-small-latest': { name: 'Magistral Small 1.2', cat: 'Reasoning' },
    'codestral-latest': { name: 'Codestral', cat: 'Coding' },
    'devstral-latest': { name: 'Devstral 2', cat: 'Coding' },
    'devstral-small-latest': { name: 'Devstral Small 2', cat: 'Coding' },
    'pixtral-large-latest': { name: 'Pixtral Large', cat: 'Vision' },
    // OpenAI (GPT-5 family)
    'gpt-5.5': { name: 'GPT-5.5', cat: 'Reasoning' },
    'gpt-5.4': { name: 'GPT-5.4', cat: 'Reasoning' },
    'gpt-5.4-mini': { name: 'GPT-5.4 Mini', cat: 'Generalist' },
    'gpt-5.4-nano': { name: 'GPT-5.4 Nano', cat: 'Generalist' },
    'gpt-5.4-pro': { name: 'GPT-5.4 Pro', cat: 'Reasoning' },
    'gpt-5.2': { name: 'GPT-5.2', cat: 'Generalist' },
    'gpt-5.2-pro': { name: 'GPT-5.2 Pro', cat: 'Reasoning' },
    'gpt-5.1': { name: 'GPT-5.1', cat: 'Generalist' },
    'gpt-5.1-chat': { name: 'GPT-5.1 Chat', cat: 'Generalist' },
    'gpt-5.1-codex-max': { name: 'GPT-5.1 Codex Max', cat: 'Coding' },
    'gpt-5.1-codex': { name: 'GPT-5.1 Codex', cat: 'Coding' },
    'gpt-5': { name: 'GPT-5', cat: 'Reasoning' },
    'gpt-5-pro': { name: 'GPT-5 Pro', cat: 'Reasoning' },
    'gpt-5-chat': { name: 'GPT-5 Chat', cat: 'Generalist' },
    'gpt-5-codex': { name: 'GPT-5 Codex', cat: 'Coding' },
    'gpt-5-mini': { name: 'GPT-5 Mini', cat: 'Generalist' },
    'gpt-5-nano': { name: 'GPT-5 Nano', cat: 'Generalist' },
    'gpt-4o': { name: 'GPT-4o', cat: 'Generalist' },
    'gpt-4o-mini': { name: 'GPT-4o Mini', cat: 'Generalist' },
    'gpt-4.1': { name: 'GPT-4.1', cat: 'Generalist' },
    'gpt-4.1-mini': { name: 'GPT-4.1 Mini', cat: 'Generalist' },
    'gpt-4.1-nano': { name: 'GPT-4.1 Nano', cat: 'Generalist' },
    'o3': { name: 'o3', cat: 'Reasoning' },
    'o3-mini': { name: 'o3 Mini', cat: 'Reasoning' },
    'o4-mini': { name: 'o4 Mini', cat: 'Reasoning' },
    // Claude
    'claude-fable-5': { name: 'Claude Fable 5', cat: 'Reasoning' },
    'claude-opus-4-8': { name: 'Claude Opus 4.8', cat: 'Reasoning' },
    'claude-opus-4-7': { name: 'Claude Opus 4.7', cat: 'Reasoning' },
    'claude-opus-4-6': { name: 'Claude Opus 4.6', cat: 'Reasoning' },
    'claude-sonnet-5': { name: 'Claude Sonnet 5', cat: 'Generalist' },
    'claude-sonnet-4-6': { name: 'Claude Sonnet 4.6', cat: 'Generalist' },
    'claude-haiku-4-5': { name: 'Claude Haiku 4.5', cat: 'Generalist' },
};

const TIERS = [
    { key: 'fast', icon: '⚡', label: 'Fast', desc: 'Quick responses for simple questions' },
    { key: 'standard', icon: '🐝', iconSrc: beeFlowIcon, label: 'Flow (Direct)', desc: 'Direct chat tier with per-chat orchestrated stages' },
    { key: 'swarm', icon: '🐝🐝', iconSrc: beeFlowIcon, label: 'Swarm (Direct)', desc: 'Direct chat tier that runs a multi-agent swarm (Deep Research) and synthesises one answer' },
    { key: 'thinking', icon: '🧠', label: 'Thinking', desc: 'Complex reasoning and analysis' },
    { key: 'writer', icon: '✍️', label: 'Writer', desc: 'Long-form content and reports' },
    { key: 'pro', icon: '✨', label: 'Deep Thinking', desc: 'Maximum quality output' }
];

// Must match the server-side TIER_DEFAULTS in server/core/modelResolver.js —
// keep these two tables in sync so the admin UI shows the real fallback.
const TIER_DEFAULTS = {
    fast: { maxTokens: 4096, temperature: 0.2, verbosity: 'low' },
    standard: { maxTokens: 16384, temperature: 0.5, verbosity: 'medium' },
    thinking: { maxTokens: 32768, temperature: 0.7, verbosity: 'medium' },
    writer: { maxTokens: 32768, temperature: 0.7, verbosity: 'high' },
    pro: { maxTokens: 64000, temperature: 0.7, verbosity: 'high' },
};

// Custom tier defaults when creating a new one
const CUSTOM_TIER_DEFAULTS = { maxTokens: 32768, temperature: 0.7 };

// ── Bee Flow recommended Claude defaults per tier ────────────────────
// Applied by the "Claude Settings" panel's Apply buttons. Values picked
// from Anthropic docs (Sonnet 64K / Opus 128K max output, Haiku no
// adaptive thinking, Opus 4.7 adaptive-only with no manual budget).
const CLAUDE_RECOMMENDED = {
    fast: {
        modelId: 'claude-haiku-4-5',
        maxTokens: 4096, temperature: 0.2,
        reasoningEffort: undefined, reasoningSummary: false, budgetTokens: undefined,
        note: 'Haiku 4.5 has no adaptive thinking — effort stays off.',
    },
    standard: {
        modelId: 'claude-sonnet-4-6',
        maxTokens: 16384, temperature: 0.5,
        reasoningEffort: 'low', reasoningSummary: false, budgetTokens: undefined,
        note: 'Flow: multi-stage workflow with light adaptive thinking.',
    },
    swarm: {
        modelId: 'claude-sonnet-4-6',
        maxTokens: 16384, temperature: 0.5,
        reasoningEffort: 'low', reasoningSummary: false, budgetTokens: undefined,
        note: 'Per-agent depth handled by the swarm runtime.',
    },
    thinking: {
        modelId: 'claude-sonnet-5',
        maxTokens: 32768, temperature: 1,
        reasoningEffort: 'medium', reasoningSummary: true, budgetTokens: undefined,
        note: 'Sonnet 5 adaptive-only — Effort controls thinking depth (no manual budget).',
    },
    writer: {
        modelId: 'claude-sonnet-4-6',
        maxTokens: 32768, temperature: 0.7,
        reasoningEffort: 'low', reasoningSummary: false, budgetTokens: undefined,
        note: 'Long-form prose with light adaptive thinking.',
    },
    pro: {
        modelId: 'claude-opus-4-7',
        maxTokens: 64000, temperature: 0.7,
        reasoningEffort: 'high', reasoningSummary: true, budgetTokens: undefined,
        note: 'Opus 4.7 adaptive-only — effort controls thinking budget internally.',
    },
};

const CLAUDE_REC_TIER_ORDER = ['fast', 'standard', 'swarm', 'thinking', 'writer', 'pro'];

const TASK_TYPES = [
    { key: 'direct_chat', label: 'Direct Chat' },
    { key: 'agent_chat', label: 'Agent Chat' },
    { key: 'email_kb', label: 'Email Knowledge Base' },
];

// Convert a free-form label into a stable custom tier id (slug, namespaced).
const slugifyTierLabel = (label) => {
    const slug = String(label || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug ? `custom:${slug}` : '';
};


const ChatModelTiersConfig = ({ allModels = [] }) => {
    const [config, setConfig] = useState({
        fast: { modelId: '', label: 'Fast' },
        standard: { modelId: '', label: 'Flow (Direct)' },
        swarm: { modelId: '', label: 'Swarm (Direct)' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [euConfig, setEuConfig] = useState({
        fast: { modelId: '', label: 'Fast' },
        standard: { modelId: '', label: 'Flow (Direct)' },
        swarm: { modelId: '', label: 'Swarm (Direct)' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [customTiers, setCustomTiers] = useState([]);
    const [customMessage, setCustomMessage] = useState(null);
    const [customSaving, setCustomSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [euSaving, setEuSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [euMessage, setEuMessage] = useState(null);
    const [expandedTier, setExpandedTier] = useState(null);
    const [expandedCustomId, setExpandedCustomId] = useState(null);
    const [classifierModel, setClassifierModel] = useState('');
    const [classifierSaving, setClassifierSaving] = useState(false);
    const [classifierMessage, setClassifierMessage] = useState(null);
    const [titleModel, setTitleModel] = useState('');
    const [titleModelSaving, setTitleModelSaving] = useState(false);
    const [titleModelMessage, setTitleModelMessage] = useState(null);
    const [hiddenModelIds, setHiddenModelIds] = useState([]);
    const [claudeAutoRetry, setClaudeAutoRetry] = useState(true);
    const [claudeSaving, setClaudeSaving] = useState(false);
    const [claudeMessage, setClaudeMessage] = useState(null);
    const [claudeRecAppliedTier, setClaudeRecAppliedTier] = useState(null);

    useEffect(() => {
        loadConfig();
        loadEuConfig();
        loadCustomTiers();
        loadClassifierModel();
        loadTitleModel();
        loadHiddenModels();
        loadClaudeSettings();
    }, []);

    const loadClaudeSettings = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/claude-settings`);
            if (res.ok) {
                const data = await res.json();
                setClaudeAutoRetry(data.autoRetryOnEmpty !== false);
            }
        } catch (e) { console.error('Failed to load Claude settings:', e); }
    };

    const saveClaudeSettings = async (next = claudeAutoRetry) => {
        setClaudeSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/claude-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoRetryOnEmpty: next }),
            });
            if (res.ok) {
                setClaudeMessage({ type: 'success', text: 'Claude settings saved' });
                setTimeout(() => setClaudeMessage(null), 3000);
            } else {
                setClaudeMessage({ type: 'error', text: 'Failed to save Claude settings' });
            }
        } catch (e) {
            setClaudeMessage({ type: 'error', text: 'Failed to save Claude settings' });
        }
        setClaudeSaving(false);
    };

    // Patch the local tier `config` state with the recommended Claude values.
    // The admin still has to hit "Save Tier Configuration" to persist — keeps
    // the action reviewable. Flashing the row provides feedback.
    const applyClaudeRecommendedForTier = (tierKey) => {
        const rec = CLAUDE_RECOMMENDED[tierKey];
        if (!rec) return;
        setConfig(prev => ({
            ...prev,
            [tierKey]: {
                ...(prev[tierKey] || {}),
                modelId: rec.modelId,
                maxTokens: rec.maxTokens,
                temperature: rec.temperature,
                reasoningEffort: rec.reasoningEffort,
                reasoningSummary: rec.reasoningSummary,
                budgetTokens: rec.budgetTokens,
            },
        }));
        setClaudeRecAppliedTier(tierKey);
        setTimeout(() => setClaudeRecAppliedTier(curr => curr === tierKey ? null : curr), 1500);
    };

    const applyAllClaudeRecommended = () => {
        const next = { ...config };
        for (const tierKey of CLAUDE_REC_TIER_ORDER) {
            const rec = CLAUDE_RECOMMENDED[tierKey];
            if (!rec) continue;
            next[tierKey] = {
                ...(next[tierKey] || {}),
                modelId: rec.modelId,
                maxTokens: rec.maxTokens,
                temperature: rec.temperature,
                reasoningEffort: rec.reasoningEffort,
                reasoningSummary: rec.reasoningSummary,
                budgetTokens: rec.budgetTokens,
            };
        }
        setConfig(next);
        setClaudeMessage({ type: 'success', text: 'Recommended Claude defaults applied to all tiers — click Save Tier Configuration to persist.' });
        setTimeout(() => setClaudeMessage(null), 5000);
    };

    const loadHiddenModels = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/hidden-models`);
            if (res.ok) {
                const data = await res.json();
                setHiddenModelIds(Array.isArray(data.modelIds) ? data.modelIds : []);
            }
        } catch (e) { console.error('Failed to load hidden models:', e); }
    };

    // Optimistically toggle and persist. Roll back on failure so the picker
    // and the server never disagree.
    const toggleHiddenModel = async (modelId) => {
        const prev = hiddenModelIds;
        const next = prev.includes(modelId)
            ? prev.filter(id => id !== modelId)
            : [...prev, modelId];
        setHiddenModelIds(next);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/hidden-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelIds: next }),
            });
            if (!res.ok) throw new Error('save failed');
            const data = await res.json();
            if (Array.isArray(data.modelIds)) setHiddenModelIds(data.modelIds);
        } catch (e) {
            console.error('Failed to save hidden models:', e);
            setHiddenModelIds(prev);
        }
    };

    const loadClassifierModel = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/auto-classifier`);
            if (res.ok) {
                const data = await res.json();
                setClassifierModel(typeof data.modelId === 'string' ? data.modelId : '');
            }
        } catch (e) { console.error('Failed to load classifier model:', e); }
    };

    const saveClassifierModel = async (next = classifierModel) => {
        setClassifierSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/auto-classifier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId: next || null }),
            });
            if (res.ok) {
                const data = await res.json();
                setClassifierModel(typeof data.modelId === 'string' ? data.modelId : '');
                setClassifierMessage({ type: 'success', text: 'Classifier model saved' });
                setTimeout(() => setClassifierMessage(null), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setClassifierMessage({ type: 'error', text: data.error || 'Failed to save classifier model' });
            }
        } catch (e) {
            setClassifierMessage({ type: 'error', text: 'Failed to save classifier model' });
        }
        setClassifierSaving(false);
    };

    const loadTitleModel = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/title-model`);
            if (res.ok) {
                const data = await res.json();
                setTitleModel(typeof data.modelId === 'string' ? data.modelId : '');
            }
        } catch (e) { console.error('Failed to load title model:', e); }
    };

    const saveTitleModel = async (next = titleModel) => {
        setTitleModelSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/title-model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId: next || null }),
            });
            if (res.ok) {
                const data = await res.json();
                setTitleModel(typeof data.modelId === 'string' ? data.modelId : '');
                setTitleModelMessage({ type: 'success', text: 'Title model saved' });
                setTimeout(() => setTitleModelMessage(null), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setTitleModelMessage({ type: 'error', text: data.error || 'Failed to save title model' });
            }
        } catch (e) {
            setTitleModelMessage({ type: 'error', text: 'Failed to save title model' });
        }
        setTitleModelSaving(false);
    };

    const loadConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models`);
            if (res.ok) setConfig(await res.json());
        } catch (e) { console.error('Failed to load chat model tiers:', e); }
    };

    const loadEuConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models-eu`);
            if (res.ok) setEuConfig(await res.json());
        } catch (e) { console.error('Failed to load EU chat model tiers:', e); }
    };

    const save = async () => {
        setSaving(true);
        try {
            // Save standard tiers + custom tiers together so a single click
            // persists everything the user edited in this section.
            const [res, customRes] = await Promise.all([
                authFetch(`${API_BASE}/ai/config/chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                }),
                authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tiers: customTiers })
                })
            ]);
            const bothOk = res.ok && customRes.ok;
            let warn = '';
            try {
                const j = customRes.ok ? await customRes.json() : null;
                if (j && Array.isArray(j.warnings) && j.warnings.length > 0) warn = ' (' + j.warnings.join('; ') + ')';
                if (j && Array.isArray(j.tiers)) setCustomTiers(j.tiers);
            } catch (_) { /* ignore */ }
            if (bothOk) {
                setMessage({ type: warn ? 'warning' : 'success', text: `Chat model tiers saved${warn}` });
                setTimeout(() => setMessage(null), 4000);
            } else {
                setMessage({ type: 'error', text: 'Failed to save (one or more configs)' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save tier config' });
        }
        setSaving(false);
    };

    const loadCustomTiers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/custom-chat-models`);
            if (res.ok) {
                const data = await res.json();
                setCustomTiers(Array.isArray(data.tiers) ? data.tiers : []);
            }
        } catch (e) { console.error('Failed to load custom tiers:', e); }
    };

    const saveCustomTiers = async (next = customTiers) => {
        setCustomSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tiers: next }),
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.tiers)) setCustomTiers(data.tiers);
                const warn = Array.isArray(data.warnings) && data.warnings.length > 0
                    ? `Saved, with warnings: ${data.warnings.join('; ')}`
                    : 'Custom tiers saved!';
                setCustomMessage({ type: data.warnings?.length ? 'warning' : 'success', text: warn });
                setTimeout(() => setCustomMessage(null), 4000);
            } else {
                setCustomMessage({ type: 'error', text: 'Failed to save custom tiers' });
            }
        } catch (e) {
            setCustomMessage({ type: 'error', text: 'Failed to save custom tiers' });
        }
        setCustomSaving(false);
    };

    const addCustomTier = () => {
        // Generate a unique placeholder id so the new card has a stable key
        let n = customTiers.length + 1;
        let placeholderId = `custom:new-tier-${n}`;
        while (customTiers.some(t => t.id === placeholderId)) {
            n += 1;
            placeholderId = `custom:new-tier-${n}`;
        }
        setCustomTiers(prev => [
            ...prev,
            {
                id: placeholderId,
                label: `New tier ${n}`,
                icon: '✨',
                description: '',
                modelId: '',
                maxTokens: CUSTOM_TIER_DEFAULTS.maxTokens,
                temperature: CUSTOM_TIER_DEFAULTS.temperature,
                reasoningEffort: undefined,
                reasoningSummary: false,
                allowedTaskTypes: ['direct_chat', 'agent_chat', 'email_kb'],
                _isNew: true, // local-only flag: show the label/id editor pre-expanded
            },
        ]);
        setExpandedCustomId(placeholderId);
    };

    const updateCustomTier = (id, patch) => {
        setCustomTiers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    };

    const renameCustomTier = (currentId, newLabel) => {
        const newId = slugifyTierLabel(newLabel);
        setCustomTiers(prev => {
            const next = prev.map(t => {
                if (t.id !== currentId) return t;
                return { ...t, label: newLabel, id: newId || currentId };
            });
            return next;
        });
        if (newId && newId !== currentId) setExpandedCustomId(newId);
    };

    const removeCustomTier = (id) => {
        if (!window.confirm('Delete this custom tier? This cannot be undone.')) return;
        setCustomTiers(prev => prev.filter(t => t.id !== id));
    };

    const toggleCustomTaskType = (id, taskKey) => {
        setCustomTiers(prev => prev.map(t => {
            if (t.id !== id) return t;
            const set = new Set(t.allowedTaskTypes || []);
            if (set.has(taskKey)) set.delete(taskKey);
            else set.add(taskKey);
            return { ...t, allowedTaskTypes: Array.from(set) };
        }));
    };

    const saveEu = async () => {
        setEuSaving(true);
        try {
            // Save EU standard tiers AND the full custom tiers array (which now
            // contains each custom tier's euModelId). The custom-chat-models
            // endpoint overwrites wholesale so race with `save()` is avoided as
            // long as both callers write from the same local state.
            const [res, customRes] = await Promise.all([
                authFetch(`${API_BASE}/ai/config/chat-models-eu`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(euConfig)
                }),
                authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tiers: customTiers })
                })
            ]);
            if (res.ok && customRes.ok) {
                setEuMessage({ type: 'success', text: 'EU model tiers saved!' });
                setTimeout(() => setEuMessage(null), 3000);
            } else {
                setEuMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setEuMessage({ type: 'error', text: 'Failed to save EU tier config' });
        }
        setEuSaving(false);
    };

    // Filter to only chat-compatible models
    const chatModels = allModels.filter(m => {
        const meta = getModelMeta(m.id);
        if (!meta) return true; // Unknown models are shown
        return !['Embedding', 'OCR', 'Moderation', 'Audio'].includes(meta.cat);
    });

    const updateTier = (tierKey, field, value) => {
        setConfig(prev => ({
            ...prev,
            [tierKey]: { ...prev[tierKey], [field]: value }
        }));
    };

    const updateEuTier = (tierKey, field, value) => {
        setEuConfig(prev => ({
            ...prev,
            [tierKey]: { ...prev[tierKey], [field]: value }
        }));
    };

    // Build grouped model list (reused by both sections)
    const byProvider = {};
    chatModels.forEach(m => {
        const key = m.providerName || 'Unknown';
        if (!byProvider[key]) byProvider[key] = [];
        byProvider[key].push(m);
    });

    const renderTierCard = (tier, tierConfig, updateFn, defaults) => {
        const isExpanded = expandedTier === tier.key;
        const selectedModel = chatModels.find(m => m.id === tierConfig.modelId);
        const displayName = selectedModel ? getModelDisplayName(selectedModel) : null;
        const selectedLabel = selectedModel
            ? (displayName !== selectedModel.id
                ? displayName
                : selectedModel.id)
            : '— Not configured —';

        return (
            <div key={tier.key} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        {tier.iconSrc
                            ? <img src={tier.iconSrc} alt="" className="w-6 h-6 object-contain" />
                            : <span className="text-xl">{tier.icon}</span>}
                        <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tier.label}</span>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tier.desc}</p>
                        </div>
                        {defaults && (
                            <button
                                onClick={() => setExpandedTier(isExpanded ? null : tier.key)}
                                className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {isExpanded ? '▲ Settings' : '▼ Settings'}
                            </button>
                        )}
                    </div>
                    <SearchableModelSelect
                        value={tierConfig.modelId || ''}
                        label={selectedLabel}
                        groups={byProvider}
                        onChange={({ modelId }) => updateFn(tier.key, 'modelId', modelId)}
                        hiddenIds={hiddenModelIds}
                        onToggleHidden={toggleHiddenModel}
                    />
                    {/* Bootstrap-only model picker for the Standard tier — used
                        for the per-conversation skill bootstrap pass to keep
                        cost down (e.g. Haiku) regardless of the main model. */}
                    {tier.key === 'standard' && (() => {
                        const bootstrapModel = chatModels.find(m => m.id === tierConfig.bootstrapModelId);
                        const bootstrapDisplayName = bootstrapModel ? getModelDisplayName(bootstrapModel) : null;
                        const bootstrapLabel = bootstrapModel
                            ? (bootstrapDisplayName !== bootstrapModel.id ? bootstrapDisplayName : bootstrapModel.id)
                            : '— Same as main model —';
                        return (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
                                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    Bootstrap model (cheap & fast)
                                </label>
                                <SearchableModelSelect
                                    value={tierConfig.bootstrapModelId || ''}
                                    label={bootstrapLabel}
                                    groups={byProvider}
                                    onChange={({ modelId }) => updateFn(tier.key, 'bootstrapModelId', modelId || '')}
                                    hiddenIds={hiddenModelIds}
                                    onToggleHidden={toggleHiddenModel}
                                />
                                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Used once per direct chat to plan the conversation's Flow stages. Pick a small/fast model (e.g. Haiku) to cut planning cost. Leave empty to reuse the main model.
                                </p>
                            </div>
                        );
                    })()}
                </div>
                {defaults && isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border-default)' }}>
                        {/* Bee Flow recommended-defaults banner — only when a Claude model is selected */}
                        {isClaudeModel(tierConfig.modelId) && CLAUDE_RECOMMENDED[tier.key] && (() => {
                            const rec = CLAUDE_RECOMMENDED[tier.key];
                            return (
                                <div className="mb-3 mt-2 p-2.5 rounded-lg border flex items-center gap-3" style={{ background: 'rgba(217, 119, 6, 0.08)', borderColor: 'rgba(217, 119, 6, 0.3)' }}>
                                    <span className="text-base">💡</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>Bee Flow recommends</div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {(getModelMeta(rec.modelId)?.name || rec.modelId)} · {rec.maxTokens.toLocaleString()} tokens · {rec.reasoningEffort || 'no'} effort · {rec.budgetTokens ? `extended (${rec.budgetTokens.toLocaleString()})` : 'adaptive'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => applyClaudeRecommendedForTier(tier.key)}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:bg-white/5 transition-colors shrink-0"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        Apply
                                    </button>
                                </div>
                            );
                        })()}

                        <div className="flex gap-4 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Max Tokens</label>
                                <input
                                    type="number"
                                    value={tierConfig.maxTokens !== undefined ? tierConfig.maxTokens : defaults.maxTokens}
                                    onChange={e => updateFn(tier.key, 'maxTokens', parseInt(e.target.value) || defaults.maxTokens)}
                                    min={256} max={131072} step={256}
                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Default: {defaults.maxTokens.toLocaleString()}. Thinking models need higher values.
                                </p>
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Temperature</label>
                                <input
                                    type="number"
                                    value={tierConfig.temperature !== undefined ? tierConfig.temperature : defaults.temperature}
                                    onChange={e => updateFn(tier.key, 'temperature', parseFloat(e.target.value) || defaults.temperature)}
                                    min={0} max={2} step={0.1}
                                    disabled={isClaudeAdaptiveOnly(tierConfig.modelId)}
                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm disabled:opacity-60"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {isClaudeAdaptiveOnly(tierConfig.modelId)
                                        ? 'This model rejects temperature — thinking depth is set by Effort.'
                                        : `0 = deterministic, 1 = creative. Default: ${defaults.temperature}`}
                                </p>
                            </div>
                            {isReasoningCapable(tierConfig.modelId) && (
                                <>
                                    <div className="flex-1 min-w-[180px]">
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 {isClaudeReasoning(tierConfig.modelId) ? 'Thinking Effort' : 'Reasoning Effort'}</label>
                                        <select
                                            value={isGpt5Pro(tierConfig.modelId)
                                                ? 'high'
                                                : (tierConfig.reasoningEffort || (isClaudeReasoning(tierConfig.modelId) ? 'medium' : 'none'))}
                                            onChange={e => updateFn(tier.key, 'reasoningEffort', e.target.value)}
                                            disabled={isGpt5Pro(tierConfig.modelId)}
                                            className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm disabled:opacity-60"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            {isGpt5Pro(tierConfig.modelId) ? (
                                                <option value="high">High — pro models reason at high only</option>
                                            ) : isClaudeReasoning(tierConfig.modelId) ? (
                                                <>
                                                    <option value="none">None (disabled)</option>
                                                    <option value="low">Low — quick tasks</option>
                                                    <option value="medium">Medium — balanced (default)</option>
                                                    <option value="high">High — complex reasoning</option>
                                                    {isClaudeAdaptiveOnly(tierConfig.modelId) ? (
                                                        <>
                                                            <option value="xhigh">xHigh — extended exploration</option>
                                                            <option value="max">Max — no thinking constraints</option>
                                                        </>
                                                    ) : (
                                                        <option value="xhigh">Max — deepest thinking</option>
                                                    )}
                                                </>
                                            ) : (
                                                /* OpenAI o-series / GPT-5 */
                                                <>
                                                    <option value="none">None (disabled)</option>
                                                    {isGpt5(tierConfig.modelId) && <option value="minimal">Minimal — fastest, lightest reasoning</option>}
                                                    <option value="low">Low — quick tasks</option>
                                                    <option value="medium">Medium — balanced (default)</option>
                                                    <option value="high">High — complex reasoning</option>
                                                    {isCodexMax(tierConfig.modelId) && <option value="xhigh">xHigh — deepest reasoning</option>}
                                                </>
                                            )}
                                        </select>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {isGpt5Pro(tierConfig.modelId)
                                                ? 'Pro models always reason at high effort.'
                                                : isClaudeReasoning(tierConfig.modelId)
                                                    ? 'How deep Claude thinks before answering. Default: Medium.'
                                                    : isGpt5(tierConfig.modelId)
                                                        ? 'How much the model reasons. Minimal is the fast/cheap GPT-5 tier.'
                                                        : 'Controls how much the model reasons before responding.'}
                                        </p>
                                    </div>
                                    {!isClaudeReasoning(tierConfig.modelId) && (
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>📝 Reasoning Summary</label>
                                            <div
                                                className="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                                onClick={() => updateFn(tier.key, 'reasoningSummary', !tierConfig.reasoningSummary)}
                                            >
                                                <div className={`w-9 h-5 rounded-full relative transition-colors ${tierConfig.reasoningSummary ? 'bg-green-500' : 'bg-gray-600'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tierConfig.reasoningSummary ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                </div>
                                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                                    {tierConfig.reasoningSummary ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Show a summary of the model's reasoning process.
                                            </p>
                                        </div>
                                    )}
                                    {isGpt5(tierConfig.modelId) && (
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🗣️ Verbosity</label>
                                            <select
                                                value={tierConfig.verbosity || defaults.verbosity || 'medium'}
                                                onChange={e => updateFn(tier.key, 'verbosity', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="low">Low — concise</option>
                                                <option value="medium">Medium — balanced (default)</option>
                                                <option value="high">High — detailed</option>
                                            </select>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                GPT-5 output length / level of detail.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Claude-specific row: thinking mode + budget tokens.
                            Only Sonnet 4.6 / Opus 4.6 honour budget_tokens — the
                            adaptive-only family (Opus 4.7/4.8, Sonnet 5, Fable 5)
                            rejects manual budget and Haiku has no thinking at all. */}
                        {isClaudeReasoning(tierConfig.modelId) && !isClaudeAdaptiveOnly(tierConfig.modelId) && (() => {
                            const mode = (tierConfig.budgetTokens && tierConfig.budgetTokens > 0) ? 'extended' : 'adaptive';
                            return (
                                <div className="mt-4 pt-4 border-t flex gap-4 flex-wrap" style={{ borderColor: 'var(--border-default)' }}>
                                    <div className="flex-1 min-w-[260px]">
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Thinking Mode</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateFn(tier.key, 'budgetTokens', undefined)}
                                                className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                                                style={{
                                                    background: mode === 'adaptive' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                    borderColor: mode === 'adaptive' ? 'var(--accent-primary)' : 'var(--border-default)',
                                                    color: mode === 'adaptive' ? '#fff' : 'var(--text-primary)',
                                                }}
                                            >
                                                Adaptive
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const rec = CLAUDE_RECOMMENDED[tier.key];
                                                    const fallback = rec?.budgetTokens || 10000;
                                                    updateFn(tier.key, 'budgetTokens', fallback);
                                                }}
                                                className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                                                style={{
                                                    background: mode === 'extended' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                    borderColor: mode === 'extended' ? 'var(--accent-primary)' : 'var(--border-default)',
                                                    color: mode === 'extended' ? '#fff' : 'var(--text-primary)',
                                                }}
                                            >
                                                Extended (fixed budget)
                                            </button>
                                        </div>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {mode === 'adaptive'
                                                ? 'Claude decides the thinking depth based on Effort. Shares the output budget — heavy turns can leave no room for the answer.'
                                                : 'Fixed thinking budget. Output is guaranteed (max tokens − budget). Safer for long answers.'}
                                        </p>
                                    </div>
                                    {mode === 'extended' && (
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Thinking Budget</label>
                                            <input
                                                type="number"
                                                value={tierConfig.budgetTokens || ''}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value, 10);
                                                    updateFn(tier.key, 'budgetTokens', isNaN(v) || v <= 0 ? undefined : v);
                                                }}
                                                min={1024} max={64000} step={1024}
                                                placeholder="10000"
                                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Tokens reserved for thinking. Must be {'<'} Max Tokens.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Adaptive-only explainer — manual budgets are not supported */}
                        {isClaudeAdaptiveOnly(tierConfig.modelId) && (
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{getModelMeta(tierConfig.modelId)?.name || 'This model'} uses adaptive thinking only.</span> The API rejects manual thinking budgets and the temperature setting — the Effort dropdown above controls how deep the model thinks. Use Auto-retry on empty output (Claude Settings panel) as a safety net for heavy reasoning runs.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderCustomTierCard = (tier) => {
        const isExpanded = expandedCustomId === tier.id;
        const selectedModel = chatModels.find(m => m.id === tier.modelId);
        const displayName = selectedModel ? getModelDisplayName(selectedModel) : null;
        const selectedLabel = selectedModel
            ? (displayName !== selectedModel.id ? displayName : selectedModel.id)
            : '— Not configured —';
        const taskTypes = new Set(tier.allowedTaskTypes || []);

        return (
            <div key={tier.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <input
                            type="text"
                            value={tier.icon || ''}
                            onChange={e => updateCustomTier(tier.id, { icon: e.target.value.slice(0, 4) })}
                            maxLength={4}
                            className="w-12 text-center text-xl px-1 py-1 rounded-lg border outline-none"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            title="Icon or emoji"
                        />
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={tier.label || ''}
                                onChange={e => renameCustomTier(tier.id, e.target.value)}
                                placeholder="Tier name"
                                className="w-full text-sm font-semibold px-2 py-1 rounded-lg border outline-none"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{tier.id}</p>
                        </div>
                        <button
                            onClick={() => setExpandedCustomId(isExpanded ? null : tier.id)}
                            className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            {isExpanded ? '▲ Settings' : '▼ Settings'}
                        </button>
                        <button
                            onClick={() => removeCustomTier(tier.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            title="Delete tier"
                        >✕</button>
                    </div>

                    <input
                        type="text"
                        value={tier.description || ''}
                        onChange={e => updateCustomTier(tier.id, { description: e.target.value })}
                        placeholder="Short description (shown in tier picker)"
                        className="w-full text-xs px-3 py-2 mb-3 rounded-lg border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />

                    <SearchableModelSelect
                        value={tier.modelId || ''}
                        label={selectedLabel}
                        groups={byProvider}
                        onChange={({ modelId }) => updateCustomTier(tier.id, { modelId })}
                        hiddenIds={hiddenModelIds}
                        onToggleHidden={toggleHiddenModel}
                    />

                    <div className="mt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Available for
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {TASK_TYPES.map(tt => {
                                const active = taskTypes.has(tt.key);
                                return (
                                    <button
                                        key={tt.key}
                                        type="button"
                                        onClick={() => toggleCustomTaskType(tier.id, tt.key)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                            color: active ? '#fff' : 'var(--text-muted)',
                                            border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                        }}
                                    >
                                        {active ? '✓ ' : ''}{tt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t flex gap-4 flex-wrap" style={{ borderColor: 'var(--border-default)' }}>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Max Tokens</label>
                            <input
                                type="number"
                                value={tier.maxTokens !== undefined ? tier.maxTokens : CUSTOM_TIER_DEFAULTS.maxTokens}
                                onChange={e => updateCustomTier(tier.id, { maxTokens: parseInt(e.target.value) || CUSTOM_TIER_DEFAULTS.maxTokens })}
                                min={256} max={131072} step={256}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Temperature</label>
                            <input
                                type="number"
                                value={tier.temperature !== undefined ? tier.temperature : CUSTOM_TIER_DEFAULTS.temperature}
                                onChange={e => updateCustomTier(tier.id, { temperature: parseFloat(e.target.value) || CUSTOM_TIER_DEFAULTS.temperature })}
                                min={0} max={2} step={0.1}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        {isReasoningCapable(tier.modelId) && (
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 {isClaudeReasoning(tier.modelId) ? 'Thinking Effort' : 'Reasoning Effort'}</label>
                                <select
                                    value={isGpt5Pro(tier.modelId) ? 'high' : (tier.reasoningEffort || 'none')}
                                    onChange={e => updateCustomTier(tier.id, { reasoningEffort: e.target.value === 'none' ? undefined : e.target.value })}
                                    disabled={isGpt5Pro(tier.modelId)}
                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm disabled:opacity-60"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    {isGpt5Pro(tier.modelId) ? (
                                        <option value="high">High (pro: locked)</option>
                                    ) : (
                                        <>
                                            <option value="none">None (disabled)</option>
                                            {isGpt5(tier.modelId) && <option value="minimal">Minimal</option>}
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            {isClaudeAdaptiveOnly(tier.modelId) && <option value="xhigh">xHigh</option>}
                                            {isClaudeAdaptiveOnly(tier.modelId) && <option value="max">Max</option>}
                                            {isCodexMax(tier.modelId) && <option value="xhigh">xHigh</option>}
                                        </>
                                    )}
                                </select>
                            </div>
                        )}
                        {isGpt5(tier.modelId) && (
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🗣️ Verbosity</label>
                                <select
                                    value={tier.verbosity || 'medium'}
                                    onChange={e => updateCustomTier(tier.id, { verbosity: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <option value="low">Low — concise</option>
                                    <option value="medium">Medium — balanced</option>
                                    <option value="high">High — detailed</option>
                                </select>
                            </div>
                        )}
                        {/* Claude thinking mode + budget tokens (Sonnet/Opus 4.6 only —
                            the adaptive-only family Opus 4.7/4.8, Sonnet 5, Fable 5 has no manual budget). */}
                        {isClaudeReasoning(tier.modelId) && !isClaudeAdaptiveOnly(tier.modelId) && (() => {
                            const mode = (tier.budgetTokens && tier.budgetTokens > 0) ? 'extended' : 'adaptive';
                            return (
                                <div className="w-full flex gap-4 flex-wrap mt-2">
                                    <div className="flex-1 min-w-[260px]">
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Thinking Mode</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateCustomTier(tier.id, { budgetTokens: undefined })}
                                                className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                                                style={{
                                                    background: mode === 'adaptive' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                    borderColor: mode === 'adaptive' ? 'var(--accent-primary)' : 'var(--border-default)',
                                                    color: mode === 'adaptive' ? '#fff' : 'var(--text-primary)',
                                                }}
                                            >
                                                Adaptive
                                            </button>
                                            <button
                                                onClick={() => updateCustomTier(tier.id, { budgetTokens: tier.budgetTokens || 10000 })}
                                                className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                                                style={{
                                                    background: mode === 'extended' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                    borderColor: mode === 'extended' ? 'var(--accent-primary)' : 'var(--border-default)',
                                                    color: mode === 'extended' ? '#fff' : 'var(--text-primary)',
                                                }}
                                            >
                                                Extended (fixed budget)
                                            </button>
                                        </div>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {mode === 'adaptive'
                                                ? 'Claude decides depth from Effort. Shares Max Tokens with output.'
                                                : 'Fixed thinking budget. Output is guaranteed (max tokens − budget).'}
                                        </p>
                                    </div>
                                    {mode === 'extended' && (
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Thinking Budget</label>
                                            <input
                                                type="number"
                                                value={tier.budgetTokens || ''}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value, 10);
                                                    updateCustomTier(tier.id, { budgetTokens: isNaN(v) || v <= 0 ? undefined : v });
                                                }}
                                                min={1024} max={64000} step={1024}
                                                placeholder="10000"
                                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Tokens reserved for thinking. Must be {'<'} Max Tokens.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        {isClaudeAdaptiveOnly(tier.modelId) && (
                            <div className="w-full mt-2">
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {getModelMeta(tier.modelId)?.name || 'This model'} uses adaptive thinking only — the Effort dropdown controls how deep the model thinks. Manual thinking budgets and the temperature setting are not supported.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Compact EU model picker for a custom tier — lives inside the EU section.
    const renderCustomTierEuRow = (tier) => {
        const selectedModel = chatModels.find(m => m.id === tier.euModelId);
        const displayName = selectedModel ? getModelDisplayName(selectedModel) : null;
        const label = selectedModel
            ? (displayName !== selectedModel.id ? displayName : selectedModel.id)
            : '— Not configured —';
        return (
            <div key={tier.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">{tier.icon || '✨'}</span>
                        <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tier.label}</span>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {tier.description || <span className="italic opacity-60">Custom tier</span>}
                            </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>custom</span>
                    </div>
                    <SearchableModelSelect
                        value={tier.euModelId || ''}
                        label={label}
                        groups={byProvider}
                        onChange={({ modelId }) => updateCustomTier(tier.id, { euModelId: modelId })}
                        hiddenIds={hiddenModelIds}
                        onToggleHidden={toggleHiddenModel}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Regular Chat Model Tiers */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>💬</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Chat Model Tiers</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Assign a model to each tier for Direct Chat mode
                        </p>
                    </div>
                </div>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-4">
                    {TIERS.map(tier => renderTierCard(tier, config[tier.key] || {}, updateTier, TIER_DEFAULTS[tier.key]))}
                </div>

                {/* Custom tiers — live inside the same section as the standard four */}
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Custom Tiers
                            </h4>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Extra tiers beyond the standard four. Restrict each tier to specific task types and per-group access from the Organisation admin.
                            </p>
                        </div>
                        <button
                            onClick={addCustomTier}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            + Add Custom Tier
                        </button>
                    </div>
                    {customTiers.length === 0 ? (
                        <div className="p-4 rounded-lg border text-center text-xs" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                            No custom tiers yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {customTiers.map(renderCustomTierCard)}
                        </div>
                    )}
                </div>

                <button
                    onClick={save}
                    disabled={saving}
                    className="mt-6 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {saving ? 'Saving...' : 'Save Tier Configuration'}
                </button>
            </div>

            {/* Claude Settings — model-specific recommendations + robustness toggles */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(217, 119, 6, 0.15)' }}>🧠</div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Claude Settings</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Bee Flow's recommended Claude defaults per tier, plus Claude-specific robustness knobs.
                        </p>
                    </div>
                    <button
                        onClick={applyAllClaudeRecommended}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        Apply all recommended
                    </button>
                </div>

                {claudeMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${claudeMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {claudeMessage.text}
                    </div>
                )}

                {/* Per-tier recommendations table */}
                <div className="rounded-xl border overflow-hidden mb-5" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Tier</th>
                                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Model</th>
                                    <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider">Max tokens</th>
                                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Effort</th>
                                    <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider">Budget</th>
                                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Notes</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {CLAUDE_REC_TIER_ORDER.map(tierKey => {
                                    const rec = CLAUDE_RECOMMENDED[tierKey];
                                    const tier = TIERS.find(t => t.key === tierKey);
                                    const flash = claudeRecAppliedTier === tierKey;
                                    const meta = getModelMeta(rec.modelId);
                                    const displayName = meta?.name || rec.modelId;
                                    return (
                                        <tr key={tierKey}
                                            style={{
                                                borderTop: '1px solid var(--border-default)',
                                                background: flash ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                                transition: 'background 300ms ease',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            <td className="px-3 py-2">
                                                <span className="font-medium">{tier?.label || tierKey}</span>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                {displayName}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {rec.maxTokens.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2">
                                                {rec.reasoningEffort || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {rec.budgetTokens
                                                    ? rec.budgetTokens.toLocaleString()
                                                    : <span style={{ color: 'var(--text-muted)' }}>adaptive</span>}
                                            </td>
                                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                                                {rec.note}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    onClick={() => applyClaudeRecommendedForTier(tierKey)}
                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:bg-white/5 transition-colors"
                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                >
                                                    Apply
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <p className="text-[11px] mb-5 italic" style={{ color: 'var(--text-muted)' }}>
                    Apply patches the local tier configuration above — click "Save Tier Configuration" to persist.
                </p>

                {/* Robustness toggles */}
                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <div className="flex items-start gap-3">
                        <div
                            className="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer shrink-0"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                            onClick={() => { const next = !claudeAutoRetry; setClaudeAutoRetry(next); saveClaudeSettings(next); }}
                        >
                            <div className={`w-9 h-5 rounded-full relative transition-colors ${claudeAutoRetry ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${claudeAutoRetry ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                {claudeAutoRetry ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                Auto-retry on empty output
                            </div>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                When a Claude turn finishes with thinking but no text (adaptive thinking consumed the whole budget), do one follow-up call without thinking so the model writes a real answer based on what it already deliberated. Strongly recommended.
                            </p>
                            {claudeSaving && (
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Saving…</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Auto-tier Classifier Model */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>🔀</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Auto-tier Classifier Model</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Picks the model used to classify Auto-tier prompts. Choose the cheapest, fastest model — classification only needs ~8 tokens of output. Defaults to the Fast tier model when unset.
                        </p>
                    </div>
                </div>

                {classifierMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${classifierMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {classifierMessage.text}
                    </div>
                )}

                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Classifier model
                    </label>
                    {(() => {
                        const selected = chatModels.find(m => m.id === classifierModel);
                        const display = selected ? getModelDisplayName(selected) : null;
                        const label = selected
                            ? (display !== selected.id ? display : selected.id)
                            : '— Use Fast tier model —';
                        return (
                            <SearchableModelSelect
                                value={classifierModel || ''}
                                label={label}
                                groups={byProvider}
                                onChange={({ modelId }) => setClassifierModel(modelId || '')}
                                hiddenIds={hiddenModelIds}
                                onToggleHidden={toggleHiddenModel}
                            />
                        );
                    })()}
                </div>

                <button
                    onClick={() => saveClassifierModel()}
                    disabled={classifierSaving}
                    className="mt-4 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {classifierSaving ? 'Saving...' : 'Save Classifier Model'}
                </button>
            </div>

            {/* Title Generation Model */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>🏷️</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Title Generation Model</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Model used to name conversations — a tiny, tool-free call made after the second reply. Pick the cheapest, fastest model so a heavy Fast tier doesn't make titling expensive. Defaults to the Fast tier model when unset.
                        </p>
                    </div>
                </div>

                {titleModelMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${titleModelMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {titleModelMessage.text}
                    </div>
                )}

                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Title model
                    </label>
                    {(() => {
                        const selected = chatModels.find(m => m.id === titleModel);
                        const display = selected ? getModelDisplayName(selected) : null;
                        const label = selected
                            ? (display !== selected.id ? display : selected.id)
                            : '— Use Fast tier model —';
                        return (
                            <SearchableModelSelect
                                value={titleModel || ''}
                                label={label}
                                groups={byProvider}
                                onChange={({ modelId }) => setTitleModel(modelId || '')}
                                hiddenIds={hiddenModelIds}
                                onToggleHidden={toggleHiddenModel}
                            />
                        );
                    })()}
                </div>

                <button
                    onClick={() => saveTitleModel()}
                    disabled={titleModelSaving}
                    className="mt-4 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {titleModelSaving ? 'Saving...' : 'Save Title Model'}
                </button>
            </div>

            {/* EU Chat Model Tiers */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(0, 51, 153, 0.15)' }}>🇪🇺</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>EU Chat Model Tiers</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            EU-hosted models used when an organization has EU mode enabled in their Privacy Shield
                        </p>
                    </div>
                </div>

                {euMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${euMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {euMessage.text}
                    </div>
                )}

                <div className="space-y-4">
                    {TIERS.map(tier => renderTierCard(tier, euConfig[tier.key] || {}, updateEuTier, null))}
                </div>

                {/* Custom tiers — EU model picker per tier. Only shown when any custom tier exists. */}
                {customTiers.length > 0 && (
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-default)' }}>
                        <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            Custom Tiers — EU override
                        </h4>
                        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                            Pick an EU-hosted model for each custom tier. Used automatically when an organization has EU mode enabled.
                        </p>
                        <div className="space-y-4">
                            {customTiers.map(renderCustomTierEuRow)}
                        </div>
                    </div>
                )}

                <button
                    onClick={saveEu}
                    disabled={euSaving}
                    className="mt-6 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {euSaving ? 'Saving...' : 'Save EU Tier Configuration'}
                </button>
            </div>
        </div>
    );
};

export default ChatModelTiersConfig;
