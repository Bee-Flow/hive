import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, ToggleLeft, ToggleRight, Check, Settings, Plus, Trash2, RefreshCw, Plug, ChevronDown, ExternalLink, Mail, Send, Layers, Search as SearchIcon, Cloud, BookOpen, FolderKanban, Sparkles, FileDown, Maximize2, LayoutList } from 'lucide-react';
import McpMarketplace from './McpMarketplace';

const SECTIONS = [
    { id: 'features', labelKey: 'admin.integ_features', icon: Layers, color: '#10b981' },
    { id: 'integrations', labelKey: 'admin.integ_integrations', icon: Settings, color: '#6366f1' },
    { id: 'email', labelKey: 'admin.integ_email', icon: Mail, color: '#ea4335' },
    { id: 'search', labelKey: 'admin.integ_search', icon: SearchIcon, color: '#10b981' },
    { id: 'transcription', labelKey: 'admin.integ_transcription', icon: Cloud, color: '#8b5cf6' },
    { id: 'services', labelKey: 'admin.integ_services', icon: ExternalLink, color: '#0A66C2' },
    { id: 'mcp', labelKey: 'admin.integ_mcp', icon: Plug, color: '#f59e0b' },
];

const ALL_INTEGRATIONS = [
    { id: 'gmail', label: 'Gmail', description: 'Send and read emails', category: 'Google' },
    { id: 'google-calendar', label: 'Calendar', description: 'Manage calendar events', category: 'Google' },
    { id: 'google-drive', label: 'Drive', description: 'Access and manage files', category: 'Google' },
    { id: 'google-slides', label: 'Slides', description: 'Create presentations', category: 'Google' },
    { id: 'google-sheets', label: 'Sheets', description: 'Work with spreadsheets', category: 'Google' },
    { id: 'google-docs', label: 'Docs', description: 'Create and edit documents', category: 'Google' },
    { id: 'google-contacts', label: 'Contacts', description: 'Search, create & update contacts', category: 'Google' },
    { id: 'google-keep', label: 'Keep', description: 'List, create & delete notes (Workspace only)', category: 'Google' },
    { id: 'outlook', label: 'Outlook', description: 'Send and read emails', category: 'Microsoft' },
    { id: 'ms-calendar', label: 'Calendar', description: 'Manage calendar events', category: 'Microsoft' },
    { id: 'onedrive', label: 'OneDrive', description: 'Access and manage files', category: 'Microsoft' },
    { id: 'ms-contacts', label: 'Contacts', description: 'Search, create & update contacts', category: 'Microsoft' },
    { id: 'image-gen', label: 'Image Generation', description: 'Generate images with AI', category: 'AI' },
    { id: 'music-gen', label: 'Music Generation', description: 'Generate music with AI (ElevenLabs)', category: 'AI' },
    { id: 'video-gen', label: 'Video Generation', description: 'Generate short videos with AI (Veo)', category: 'AI' },
    { id: 'elevenlabs', label: 'ElevenLabs', description: 'Music with vocals, TTS & sound effects', category: 'AI' },
    { id: 'agent-search', label: 'Agent Search', description: 'AI-powered web search with reranking', category: 'AI' },
    { id: 'transcription', label: 'Meeting Transcription', description: 'Transcribe audio with speaker diarization (Voxtral or Azure AI Speech)', category: 'AI' },
    { id: 'fireflies', label: 'Fireflies', description: 'Meeting transcripts', category: 'Third-Party' },
    { id: 'youtrack', label: 'YouTrack', description: 'Issue tracking', category: 'Third-Party' },
    { id: 'gamma', label: 'Gamma', description: 'Create presentations', category: 'Third-Party' },
    { id: 'n8n', label: 'n8n', description: 'Workflow automation', category: 'Third-Party' },
    { id: 'linkedin', label: 'LinkedIn', description: 'Post to LinkedIn', category: 'Third-Party' },
    { id: 'github', label: 'GitHub', description: 'Repository management, view code', category: 'Third-Party' },
];

export default function IntegrationsAdminPanel({ activeSection: activeProp = 'features', onNavigate }) {
    const { t } = useTranslation();
    const active = SECTIONS.map(s => s.id).includes(activeProp) ? activeProp : 'features';
    const handleSectionClick = (id) => {
        if (onNavigate) onNavigate(`admin/integrations/${id}`);
    };
    const [defaults, setDefaults] = useState(null); // null = all enabled
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedOrg, setExpandedOrg] = useState(null);
    const [agentSearchUrl, setAgentSearchUrl] = useState('');
    const [hasAgentSearchUrl, setHasAgentSearchUrl] = useState(false);
    const [savingSearchUrl, setSavingSearchUrl] = useState(false);
    const [serperApiKey, setSerperApiKey] = useState('');
    const [hasSerperKey, setHasSerperKey] = useState(false);
    const [savingSerperKey, setSavingSerperKey] = useState(false);
    const [searchProvider, setSearchProvider] = useState('agent-search');
    const [bingSearchKey, setBingSearchKey] = useState('');
    const [hasBingSearchKey, setHasBingSearchKey] = useState(false);
    const [bingSearchMarket, setBingSearchMarket] = useState('');
    const [savingBingKey, setSavingBingKey] = useState(false);
    const [agentSearchDefaults, setAgentSearchDefaults] = useState({
        mode: 'web', include_citations: true,
        web: { max_results: 5, fetch_top_n: 3, max_tokens_markdown: 2000 },
        web_fast: { max_results: 10, max_tokens_markdown: 1500 },
    });
    const [savingSearchDefaults, setSavingSearchDefaults] = useState(false);
    const [linkedinClientId, setLinkedinClientId] = useState('');
    const [linkedinClientSecret, setLinkedinClientSecret] = useState('');
    const [hasLinkedInConfig, setHasLinkedInConfig] = useState(false);
    const [savingLinkedIn, setSavingLinkedIn] = useState(false);
    // Azure Document Intelligence + Azure OpenAI Embeddings
    const [azureDocEndpoint, setAzureDocEndpoint] = useState('');
    const [azureDocKey, setAzureDocKey] = useState('');
    const [hasAzureDocEndpoint, setHasAzureDocEndpoint] = useState(false);
    const [hasAzureDocKey, setHasAzureDocKey] = useState(false);
    const [savingAzureDoc, setSavingAzureDoc] = useState(false);
    const [azureEmbedEndpoint, setAzureEmbedEndpoint] = useState('');
    const [azureEmbedKey, setAzureEmbedKey] = useState('');
    const [azureEmbedModel, setAzureEmbedModel] = useState('text-embedding-3-small');
    const [hasAzureEmbedEndpoint, setHasAzureEmbedEndpoint] = useState(false);
    const [hasAzureEmbedKey, setHasAzureEmbedKey] = useState(false);
    const [savingAzureEmbed, setSavingAzureEmbed] = useState(false);
    const [useAzureDocProcessing, setUseAzureDocProcessing] = useState(false);
    const [savingAzureToggle, setSavingAzureToggle] = useState(false);
    // Azure AI Speech (Meeting Transcription)
    const [azureSpeechKey, setAzureSpeechKey] = useState('');
    const [azureSpeechRegion, setAzureSpeechRegion] = useState('');
    const [hasAzureSpeechKey, setHasAzureSpeechKey] = useState(false);
    const [savingAzureSpeech, setSavingAzureSpeech] = useState(false);
    const [transcriptionProvider, setTranscriptionProvider] = useState('voxtral');
    const [savingTranscriptionProvider, setSavingTranscriptionProvider] = useState(false);
    // WhisperX self-hosted
    const [whisperxUrl, setWhisperxUrl] = useState('');
    const [whisperxToken, setWhisperxToken] = useState('');
    const [hasWhisperxUrl, setHasWhisperxUrl] = useState(false);
    const [hasWhisperxToken, setHasWhisperxToken] = useState(false);
    const [savingWhisperx, setSavingWhisperx] = useState(false);

    // Service Email (Gmail SMTP)
    const [serviceEmailAddress, setServiceEmailAddress] = useState('');
    const [serviceEmailPassword, setServiceEmailPassword] = useState('');
    const [serviceEmailDisplayName, setServiceEmailDisplayName] = useState('');
    const [hasServiceEmail, setHasServiceEmail] = useState(false);
    const [savingServiceEmail, setSavingServiceEmail] = useState(false);
    const [testingServiceEmail, setTestingServiceEmail] = useState(false);
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [showTestEmail, setShowTestEmail] = useState(false);

    // MCP Servers
    const [mcpServers, setMcpServers] = useState([]);
    const [mcpExpanded, setMcpExpanded] = useState(null);
    const [mcpNewName, setMcpNewName] = useState('');
    const [mcpNewCommand, setMcpNewCommand] = useState('');
    const [mcpNewArgs, setMcpNewArgs] = useState('');
    const [mcpNewCreds, setMcpNewCreds] = useState('');
    const [mcpAdding, setMcpAdding] = useState(false);
    const [mcpTesting, setMcpTesting] = useState(false);
    const [mcpTestResult, setMcpTestResult] = useState(null);
    const [mcpShowAdd, setMcpShowAdd] = useState(false);

    // Feature flags
    const [notebooksEnabled, setNotebooksEnabled] = useState(true);
    const [savingNotebooks, setSavingNotebooks] = useState(false);
    const [projectsEnabled, setProjectsEnabled] = useState(true);
    const [savingProjects, setSavingProjects] = useState(false);
    const [askAiEnabled, setAskAiEnabled] = useState(true);
    const [savingAskAi, setSavingAskAi] = useState(false);
    const [exportEnabled, setExportEnabled] = useState(true);
    const [savingExport, setSavingExport] = useState(false);
    const [openInNotebookEnabled, setOpenInNotebookEnabled] = useState(true);
    const [savingOpenInNotebook, setSavingOpenInNotebook] = useState(false);
    const [notebooksMenuEnabled, setNotebooksMenuEnabled] = useState(true);
    const [savingNotebooksMenu, setSavingNotebooksMenu] = useState(false);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [defRes, orgsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/default-integrations`),
                authFetch(`${API_BASE}/auth/organizations`),
            ]);
            if (defRes.ok) {
                const data = await defRes.json();
                setDefaults(data.defaults);
            }
            if (orgsRes.ok) {
                const orgs = await orgsRes.json();
                setOrganizations(orgs);
            }
        } catch (e) { console.error(e); }
        // Load config status
        try {
            const configRes = await authFetch(`${API_BASE}/ai/config`);
            if (configRes.ok) {
                const configData = await configRes.json();
                setHasAgentSearchUrl(!!configData.hasAgentSearchUrl);
                if (configData.agentSearchUrl) setAgentSearchUrl(configData.agentSearchUrl);
                setHasLinkedInConfig(!!configData.hasLinkedInConfig);
                setHasSerperKey(!!configData.hasSerperKey);
                setSearchProvider(configData.searchProvider || 'agent-search');
                setHasBingSearchKey(!!configData.hasBingSearchKey);
                if (configData.bingSearchMarket) setBingSearchMarket(configData.bingSearchMarket);
                // Azure Document Intelligence
                setHasAzureDocEndpoint(!!configData.hasAzureDocIntelligenceEndpoint);
                setHasAzureDocKey(!!configData.hasAzureDocIntelligenceKey);
                // Azure OpenAI Embeddings
                setHasAzureEmbedEndpoint(!!configData.hasAzureOpenaiEmbeddingEndpoint);
                setHasAzureEmbedKey(!!configData.hasAzureOpenaiEmbeddingKey);
                if (configData.azureOpenaiEmbeddingModel) setAzureEmbedModel(configData.azureOpenaiEmbeddingModel);
                setUseAzureDocProcessing(!!configData.useAzureDocProcessing);
                // Azure AI Speech
                setHasAzureSpeechKey(!!configData.hasAzureSpeechKey);
                if (configData.azureSpeechRegion) setAzureSpeechRegion(configData.azureSpeechRegion);
                setTranscriptionProvider(configData.transcriptionProvider || 'voxtral');
                // WhisperX
                setHasWhisperxUrl(!!configData.hasWhisperxUrl);
                setHasWhisperxToken(!!configData.hasWhisperxToken);
                // Service Email
                setHasServiceEmail(!!configData.hasServiceEmail);
                if (configData.serviceEmailDisplayName) setServiceEmailDisplayName(configData.serviceEmailDisplayName);
                // Feature flags
                if (configData.notebooksEnabled !== undefined) setNotebooksEnabled(configData.notebooksEnabled);
                if (configData.projectsEnabled !== undefined) setProjectsEnabled(configData.projectsEnabled);
                if (configData.askAiEnabled !== undefined) setAskAiEnabled(configData.askAiEnabled);
                if (configData.exportEnabled !== undefined) setExportEnabled(configData.exportEnabled);
                if (configData.openInNotebookEnabled !== undefined) setOpenInNotebookEnabled(configData.openInNotebookEnabled);
                if (configData.notebooksMenuEnabled !== undefined) setNotebooksMenuEnabled(configData.notebooksMenuEnabled);
            }
        } catch (e) { console.error(e); }
        try {
            const searchDefRes = await authFetch(`${API_BASE}/ai/agent-search/defaults`);
            if (searchDefRes.ok) {
                const d = await searchDefRes.json();
                setAgentSearchDefaults(prev => ({ ...prev, ...d }));
            }
        } catch (e) { console.error(e); }
        // Load MCP servers
        try {
            const mcpRes = await authFetch(`${API_BASE}/ai/mcp-servers`);
            if (mcpRes.ok) {
                const mcpData = await mcpRes.json();
                setMcpServers(mcpData.servers || []);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const saveDefaults = async (newDefaults) => {
        setDefaults(newDefaults);
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/auth/default-integrations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaults: newDefaults }),
            });
            setMessage({ type: 'success', text: 'Default integrations updated' });
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const saveOrgIntegrations = async (orgId, enabledIntegrations) => {
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/auth/organizations/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledIntegrations }),
            });
            setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, enabledIntegrations } : o));
            setMessage({ type: 'success', text: `Updated integrations for organization` });
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    // Build combined integrations list: built-in + installed MCP servers
    const allIntegrations = useMemo(() => {
        const mcpIntegrations = mcpServers.map(s => ({
            id: `mcp:${s.id}`,
            label: s.name,
            description: s.description || `${(s.tools_cache || []).length} tool(s)`,
            category: 'MCP',
            icon: s.icon || '🔌',
        }));
        return [...ALL_INTEGRATIONS, ...mcpIntegrations];
    }, [mcpServers]);

    const isDefaultEnabled = (id) => !defaults || defaults.includes(id);
    const toggleDefault = (id) => {
        if (defaults === null) {
            // Switch from "all enabled" to custom — enable all except this one
            saveDefaults(allIntegrations.map(i => i.id).filter(x => x !== id));
        } else {
            const newDefaults = defaults.includes(id)
                ? defaults.filter(x => x !== id)
                : [...defaults, id];
            // If all are enabled, switch back to null
            saveDefaults(newDefaults.length === allIntegrations.length ? null : newDefaults);
        }
    };

    const enableAllDefaults = () => saveDefaults(null);
    const disableAllDefaults = () => saveDefaults([]);

    const getOrgIntegrations = (org) => {
        if (!org.enabledIntegrations) return null;
        return typeof org.enabledIntegrations === 'string'
            ? JSON.parse(org.enabledIntegrations)
            : org.enabledIntegrations;
    };

    const isOrgIntegrationEnabled = (org, id) => {
        const ints = getOrgIntegrations(org);
        return !ints || ints.includes(id);
    };

    const categories = [...new Set(allIntegrations.map(i => i.category))];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading integrations...
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* ── Left Sidebar ── */}
            <div style={{
                width: '56px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 0',
                background: 'var(--bg-secondary, #111)',
                borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            }}>
                {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => handleSectionClick(sec.id)}
                            title={t(sec.labelKey)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '10px 4px',
                                margin: '0 4px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}
                        >
                            <Icon style={{
                                width: 20, height: 20,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                transition: 'color 0.15s ease',
                            }} />
                            <span style={{
                                fontSize: '9px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center',
                                lineHeight: 1.1,
                                transition: 'color 0.15s ease',
                            }}>
                                {t(sec.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Main Content Panel ── */}
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {/* Status message toast */}
            {message && (
                <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '8px 24px' }}>
                    <span className={`text-sm font-medium px-3 py-1.5 rounded-lg inline-block ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {message.text}
                    </span>
                </div>
            )}

            {active === 'features' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Feature Flags */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Feature Flags</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Enable or disable platform features globally. Changes take effect on next page load for all users.
                        </p>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {/* Notebooks Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: notebooksEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${notebooksEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <BookOpen className="w-5 h-5 shrink-0" style={{ color: notebooksEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: notebooksEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Notebooks</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-powered collaborative notebooks</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !notebooksEnabled;
                                        setSavingNotebooks(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ notebooksEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setNotebooksEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Notebooks enabled' : 'Notebooks disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update notebooks setting' });
                                        }
                                        setSavingNotebooks(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingNotebooks}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notebooksEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notebooksEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {/* Projects Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: projectsEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${projectsEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <FolderKanban className="w-5 h-5 shrink-0" style={{ color: projectsEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: projectsEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Projects</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Organize chats into shared project folders</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !projectsEnabled;
                                        setSavingProjects(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ projectsEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setProjectsEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Projects enabled' : 'Projects disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update projects setting' });
                                        }
                                        setSavingProjects(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingProjects}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${projectsEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${projectsEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Ask AI Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: askAiEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${askAiEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <Sparkles className="w-5 h-5 shrink-0" style={{ color: askAiEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: askAiEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Ask AI</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable AI assistance in notebooks</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !askAiEnabled;
                                        setSavingAskAi(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ askAiEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setAskAiEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Ask AI enabled' : 'Ask AI disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update Ask AI setting' });
                                        }
                                        setSavingAskAi(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingAskAi}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${askAiEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${askAiEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Export Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: exportEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${exportEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <FileDown className="w-5 h-5 shrink-0" style={{ color: exportEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: exportEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Export</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable exporting notebooks to Word/PDF</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !exportEnabled;
                                        setSavingExport(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ exportEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setExportEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Export enabled' : 'Export disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update export setting' });
                                        }
                                        setSavingExport(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingExport}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${exportEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${exportEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Open in Notebook Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: openInNotebookEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${openInNotebookEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <Maximize2 className="w-5 h-5 shrink-0" style={{ color: openInNotebookEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: openInNotebookEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Open in Notebook</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Allow opening chats as full notebooks</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !openInNotebookEnabled;
                                        setSavingOpenInNotebook(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ openInNotebookEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setOpenInNotebookEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Open in Notebook enabled' : 'Open in Notebook disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update open in notebook setting' });
                                        }
                                        setSavingOpenInNotebook(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingOpenInNotebook}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${openInNotebookEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${openInNotebookEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Notebooks Menu Toggle */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                style={{
                                    background: notebooksMenuEnabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)',
                                    border: `1px solid ${notebooksMenuEnabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <LayoutList className="w-5 h-5 shrink-0" style={{ color: notebooksMenuEnabled ? '#10b981' : 'var(--text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium" style={{ color: notebooksMenuEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>Notebooks Menu</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Show 'Notebooks' in the sidebar menu</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !notebooksMenuEnabled;
                                        setSavingNotebooksMenu(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ notebooksMenuEnabled: newVal }),
                                            });
                                            if (res.ok) {
                                                setNotebooksMenuEnabled(newVal);
                                                setMessage({ type: 'success', text: newVal ? 'Notebooks menu enabled' : 'Notebooks menu disabled' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to update notebooks menu setting' });
                                        }
                                        setSavingNotebooksMenu(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingNotebooksMenu}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notebooksMenuEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notebooksMenuEnabled ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            </div>
            )}

            {active === 'integrations' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Global Defaults */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Global Defaults</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Default integrations for new organizations. Changes here don't affect existing orgs.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={enableAllDefaults} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                Enable All
                            </button>
                            <button onClick={disableAllDefaults} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                Disable All
                            </button>
                        </div>
                    </div>
                    <div className="p-4">
                        {categories.map(cat => (
                            <div key={cat} className="mb-4 last:mb-0">
                                <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--text-muted)' }}>{cat}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {allIntegrations.filter(i => i.category === cat).map(integ => {
                                        const enabled = isDefaultEnabled(integ.id);
                                        return (
                                            <button key={integ.id} onClick={() => toggleDefault(integ.id)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                                                style={{ background: enabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)', border: `1px solid ${enabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}` }}>
                                                {enabled
                                                    ? <ToggleRight className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                                                    : <ToggleLeft className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                }
                                                {integ.icon && <span className="text-base shrink-0">{integ.icon}</span>}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium truncate" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{integ.label}</div>
                                                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{integ.description}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Per-Organization Overrides */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Organization Overrides</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Override integrations for specific organizations. "Using Defaults" means the org inherits the global defaults above.
                        </p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {organizations.map(org => {
                            const orgInts = getOrgIntegrations(org);
                            const isExpanded = expandedOrg === org.id;
                            const usingDefaults = orgInts === null;
                            const enabledCount = usingDefaults
                                ? (defaults === null ? allIntegrations.length : defaults.length)
                                : orgInts.length;

                            return (
                                <div key={org.id}>
                                    <button onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                                        className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <div className="flex items-center gap-3">
                                            {org.logo ? (
                                                <img src={org.logo.startsWith('/') ? `${API_BASE}${org.logo}` : org.logo} alt="" className="w-8 h-8 object-contain rounded-lg" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                                    {org.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{org.name}</div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{org.id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${usingDefaults ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {usingDefaults ? 'Using Defaults' : `Custom (${enabledCount}/${allIntegrations.length})`}
                                            </span>
                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-6 pb-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <button onClick={() => saveOrgIntegrations(org.id, null)}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${usingDefaults ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                    Use Defaults
                                                </button>
                                                <button onClick={() => {
                                                    if (usingDefaults) {
                                                        // Switch to custom — copy current effective integrations
                                                        const effective = defaults === null ? allIntegrations.map(i => i.id) : [...defaults];
                                                        saveOrgIntegrations(org.id, effective);
                                                    }
                                                }}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${!usingDefaults ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                    Custom
                                                </button>
                                                {!usingDefaults && (
                                                    <>
                                                        <div className="flex-1" />
                                                        <button onClick={() => saveOrgIntegrations(org.id, allIntegrations.map(i => i.id))}
                                                            className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ color: '#10b981' }}>
                                                            Enable All
                                                        </button>
                                                        <button onClick={() => saveOrgIntegrations(org.id, [])}
                                                            className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ color: '#ef4444' }}>
                                                            Disable All
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {!usingDefaults && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {allIntegrations.map(integ => {
                                                        const enabled = isOrgIntegrationEnabled(org, integ.id);
                                                        return (
                                                            <button key={integ.id} onClick={() => {
                                                                const current = orgInts || [];
                                                                const newInts = enabled
                                                                    ? current.filter(x => x !== integ.id)
                                                                    : [...current, integ.id];
                                                                saveOrgIntegrations(org.id, newInts);
                                                            }}
                                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
                                                                style={{ background: enabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)', border: `1px solid ${enabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}` }}>
                                                                {enabled
                                                                    ? <ToggleRight className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} />
                                                                    : <ToggleLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                                }
                                                                {integ.icon && <span className="text-sm shrink-0">{integ.icon}</span>}
                                                                <span className="text-sm" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{integ.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {organizations.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                                No organizations found. Create one in Security → Organizations.
                            </div>
                        )}
                    </div>
                </div>

            </div>
            </div>
            )}

            {active === 'email' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Service Email (Gmail SMTP) */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Mail className="w-4 h-4" style={{ color: '#ea4335' }} />
                            Service Email (Gmail)
                            {hasServiceEmail && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Configure a Gmail service account to send emails to customers from the platform.
                        </p>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="space-y-2">
                            <input
                                type="email"
                                value={serviceEmailAddress}
                                onChange={e => setServiceEmailAddress(e.target.value)}
                                placeholder={hasServiceEmail ? 'Update Gmail address' : 'service@yourcompany.com'}
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={serviceEmailPassword}
                                    onChange={e => setServiceEmailPassword(e.target.value)}
                                    placeholder={hasServiceEmail ? '••••••••••••••••' : 'Gmail App Password'}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <input
                                    type="text"
                                    value={serviceEmailDisplayName}
                                    onChange={e => setServiceEmailDisplayName(e.target.value)}
                                    placeholder="Display Name (e.g. BeeFlow)"
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    if (!serviceEmailAddress.trim() && !serviceEmailPassword.trim()) return;
                                    setSavingServiceEmail(true);
                                    try {
                                        const body = {};
                                        if (serviceEmailAddress.trim()) body.serviceEmailAddress = serviceEmailAddress;
                                        if (serviceEmailPassword.trim()) body.serviceEmailPassword = serviceEmailPassword;
                                        if (serviceEmailDisplayName.trim()) body.serviceEmailDisplayName = serviceEmailDisplayName;
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(body),
                                        });
                                        if (res.ok) {
                                            setHasServiceEmail(true);
                                            setServiceEmailAddress('');
                                            setServiceEmailPassword('');
                                            setMessage({ type: 'success', text: 'Service email credentials saved' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save service email credentials' });
                                    }
                                    setSavingServiceEmail(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingServiceEmail || (!serviceEmailAddress.trim() && !serviceEmailPassword.trim())}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {savingServiceEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save
                            </button>
                            {hasServiceEmail && (
                                <button
                                    onClick={() => setShowTestEmail(!showTestEmail)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
                                    style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Send Test Email
                                </button>
                            )}
                        </div>
                        {/* Test Email inline form */}
                        {showTestEmail && hasServiceEmail && (
                            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <input
                                    type="email"
                                    value={testEmailRecipient}
                                    onChange={e => setTestEmailRecipient(e.target.value)}
                                    placeholder="recipient@example.com"
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && testEmailRecipient.trim()) {
                                            e.preventDefault();
                                            document.getElementById('btn-send-test-email')?.click();
                                        }
                                    }}
                                />
                                <button
                                    id="btn-send-test-email"
                                    onClick={async () => {
                                        if (!testEmailRecipient.trim()) return;
                                        setTestingServiceEmail(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config/test-service-email`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ testRecipient: testEmailRecipient }),
                                            });
                                            const data = await res.json();
                                            if (res.ok && data.success) {
                                                setMessage({ type: 'success', text: `Test email sent to ${testEmailRecipient}` });
                                                setTestEmailRecipient('');
                                                setShowTestEmail(false);
                                            } else {
                                                setMessage({ type: 'error', text: data.error || 'Failed to send test email' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to send test email' });
                                        }
                                        setTestingServiceEmail(false);
                                        setTimeout(() => setMessage(null), 5000);
                                    }}
                                    disabled={testingServiceEmail || !testEmailRecipient.trim()}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: '#10b981', color: '#fff' }}
                                >
                                    {testingServiceEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Send
                                </button>
                            </div>
                        )}
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Requires a Gmail account with <strong>2-Step Verification</strong> enabled. Generate an App Password from your{' '}
                            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Google Account → App Passwords</a>.
                        </p>
                    </div>
                </div>

            </div>
            </div>
            )}

            {active === 'services' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* LinkedIn Configuration */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2v-7zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v1h0c.27-.5 .92-1.1 1.9-1.1 2 0 2.4 1.3 2.4 3.1v3.6h-2v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.7v3.3h-2v-6.6z" fill="white" /></svg>
                            LinkedIn Configuration
                            {hasLinkedInConfig && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Set LinkedIn API credentials. Users can then connect their LinkedIn accounts from Settings → Integrations.
                        </p>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={linkedinClientId}
                                onChange={e => setLinkedinClientId(e.target.value)}
                                placeholder={hasLinkedInConfig ? '••••••••••••••••' : 'Client ID'}
                                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                            <input
                                type="password"
                                value={linkedinClientSecret}
                                onChange={e => setLinkedinClientSecret(e.target.value)}
                                placeholder={hasLinkedInConfig ? '••••••••••••••••' : 'Client Secret'}
                                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                            <button
                                onClick={async () => {
                                    if (!linkedinClientId.trim() || !linkedinClientSecret.trim()) return;
                                    setSavingLinkedIn(true);
                                    try {
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ linkedinClientId, linkedinClientSecret }),
                                        });
                                        if (res.ok) {
                                            setHasLinkedInConfig(true);
                                            setLinkedinClientId('');
                                            setLinkedinClientSecret('');
                                            setMessage({ type: 'success', text: 'LinkedIn credentials saved' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save LinkedIn credentials' });
                                    }
                                    setSavingLinkedIn(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingLinkedIn || !linkedinClientId.trim() || !linkedinClientSecret.trim()}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {savingLinkedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save
                            </button>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Get credentials from your <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>LinkedIn Developer App</a> — enable "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect".
                        </p>
                    </div>
                </div>

                {/* Azure Document Processing */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#0078D4"/><path d="M2 17l10 5 10-5" stroke="#0078D4" strokeWidth="2" fill="none"/><path d="M2 12l10 5 10-5" stroke="#50A0E0" strokeWidth="2" fill="none"/></svg>
                            Azure Document Processing
                            {(hasAzureDocEndpoint && hasAzureDocKey) && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Use Azure AI Document Intelligence for high-quality document extraction + Azure OpenAI for embeddings.
                        </p>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Global toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--bg-primary)', borderColor: useAzureDocProcessing ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)' }}>
                            <div className="flex items-center gap-3">
                                <span className="text-lg">☁️</span>
                                <div>
                                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Use Azure for Knowledge Bases</div>
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>All file uploads will use Azure Document Intelligence + Azure OpenAI embeddings.</div>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVal = !useAzureDocProcessing;
                                    setSavingAzureToggle(true);
                                    try {
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ useAzureDocProcessing: newVal }),
                                        });
                                        if (res.ok) {
                                            setUseAzureDocProcessing(newVal);
                                            setMessage({ type: 'success', text: newVal ? 'Azure processing enabled for Knowledge Bases' : 'Switched to local processing for Knowledge Bases' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to update setting' });
                                    }
                                    setSavingAzureToggle(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingAzureToggle}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${useAzureDocProcessing ? 'bg-blue-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useAzureDocProcessing ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                        {/* Document Intelligence */}
                        <div>
                            <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                Document Intelligence
                                {(hasAzureDocEndpoint && hasAzureDocKey) && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Connected</span>}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={azureDocEndpoint}
                                    onChange={e => setAzureDocEndpoint(e.target.value)}
                                    placeholder={hasAzureDocEndpoint ? '••••••••••••••••' : 'https://your-resource.cognitiveservices.azure.com'}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <input
                                    type="password"
                                    value={azureDocKey}
                                    onChange={e => setAzureDocKey(e.target.value)}
                                    placeholder={hasAzureDocKey ? '••••••••••••••••' : 'API Key'}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <button
                                    onClick={async () => {
                                        if (!azureDocEndpoint.trim() && !azureDocKey.trim()) return;
                                        setSavingAzureDoc(true);
                                        try {
                                            const body = {};
                                            if (azureDocEndpoint.trim()) body.azureDocIntelligenceEndpoint = azureDocEndpoint;
                                            if (azureDocKey.trim()) body.azureDocIntelligenceKey = azureDocKey;
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(body),
                                            });
                                            if (res.ok) {
                                                if (azureDocEndpoint.trim()) setHasAzureDocEndpoint(true);
                                                if (azureDocKey.trim()) setHasAzureDocKey(true);
                                                setAzureDocEndpoint('');
                                                setAzureDocKey('');
                                                setMessage({ type: 'success', text: 'Document Intelligence credentials saved' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to save credentials' });
                                        }
                                        setSavingAzureDoc(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingAzureDoc || (!azureDocEndpoint.trim() && !azureDocKey.trim())}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {savingAzureDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                Create a resource at <a href="https://portal.azure.com/#create/Microsoft.CognitiveServicesFormRecognizer" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Azure Portal → AI Document Intelligence</a>.
                            </p>
                        </div>

                        {/* Azure OpenAI Embeddings */}
                        <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                Azure OpenAI Embeddings
                                {(hasAzureEmbedEndpoint && hasAzureEmbedKey) && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Connected</span>}
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={azureEmbedEndpoint}
                                    onChange={e => setAzureEmbedEndpoint(e.target.value)}
                                    placeholder={hasAzureEmbedEndpoint ? '••••••••••••••••' : 'https://your-resource.openai.azure.com'}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <input
                                    type="password"
                                    value={azureEmbedKey}
                                    onChange={e => setAzureEmbedKey(e.target.value)}
                                    placeholder={hasAzureEmbedKey ? '••••••••••••••••' : 'API Key'}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <button
                                    onClick={async () => {
                                        if (!azureEmbedEndpoint.trim() && !azureEmbedKey.trim()) return;
                                        setSavingAzureEmbed(true);
                                        try {
                                            const body = { azureOpenaiEmbeddingModel: azureEmbedModel };
                                            if (azureEmbedEndpoint.trim()) body.azureOpenaiEmbeddingEndpoint = azureEmbedEndpoint;
                                            if (azureEmbedKey.trim()) body.azureOpenaiEmbeddingKey = azureEmbedKey;
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(body),
                                            });
                                            if (res.ok) {
                                                if (azureEmbedEndpoint.trim()) setHasAzureEmbedEndpoint(true);
                                                if (azureEmbedKey.trim()) setHasAzureEmbedKey(true);
                                                setAzureEmbedEndpoint('');
                                                setAzureEmbedKey('');
                                                setMessage({ type: 'success', text: 'Azure OpenAI embedding credentials saved' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to save credentials' });
                                        }
                                        setSavingAzureEmbed(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingAzureEmbed || (!azureEmbedEndpoint.trim() && !azureEmbedKey.trim())}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {savingAzureEmbed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Model:</label>
                                <select
                                    value={azureEmbedModel}
                                    onChange={e => setAzureEmbedModel(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <option value="text-embedding-3-small">text-embedding-3-small (1536 dims)</option>
                                    <option value="text-embedding-3-large">text-embedding-3-large (3072 dims)</option>
                                    <option value="text-embedding-ada-002">text-embedding-ada-002 (1536 dims)</option>
                                </select>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                Deploy an embedding model in your <a href="https://oai.azure.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Azure OpenAI Studio</a>. Used for KB document embeddings when Azure processing is enabled.
                            </p>
                        </div>
                    </div>
                </div>


            </div>
            </div>
            )}

            {active === 'search' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Global API Keys for Integrations */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Settings className="w-4 h-4" /> Agent Search Configuration
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Configure your self-hosted Agent Search service.
                        </p>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Search Provider Selector */}
                        <div>
                            <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                Search Provider
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={searchProvider}
                                    onChange={async (e) => {
                                        const val = e.target.value;
                                        setSearchProvider(val);
                                        try {
                                            await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ searchProvider: val }),
                                            });
                                            setMessage({ type: 'success', text: `Search provider set to ${val === 'disabled' ? 'Disabled' : val === 'bing' ? 'Azure Bing Search' : 'Self-hosted Agent Search'}` });
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to save search provider' });
                                        }
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                >
                                    <option value="agent-search">Self-hosted (Agent Search + Serper)</option>
                                    <option value="bing">Azure Bing Web Search</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                Choose which search provider powers web search for AI agents. Select "Disabled" to turn off web search entirely.
                            </p>
                        </div>

                        {/* Bing Search Settings — only shown when Bing is selected */}
                        {searchProvider === 'bing' && (
                            <>
                                <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                        Bing Search API Key
                                        {hasBingSearchKey && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={bingSearchKey}
                                            onChange={e => setBingSearchKey(e.target.value)}
                                            placeholder={hasBingSearchKey ? '••••••••••••••••' : 'Enter Bing Search API subscription key'}
                                            className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                        />
                                        <button
                                            onClick={async () => {
                                                setSavingBingKey(true);
                                                try {
                                                    const res = await authFetch(`${API_BASE}/ai/config`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ bingSearchKey, bingSearchMarket }),
                                                    });
                                                    if (res.ok) {
                                                        setHasBingSearchKey(!!bingSearchKey);
                                                        setBingSearchKey('');
                                                        setMessage({ type: 'success', text: bingSearchKey ? 'Bing Search settings saved' : 'Bing Search key removed' });
                                                    }
                                                } catch (e) {
                                                    setMessage({ type: 'error', text: 'Failed to save Bing settings' });
                                                }
                                                setSavingBingKey(false);
                                                setTimeout(() => setMessage(null), 3000);
                                            }}
                                            disabled={savingBingKey}
                                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                        >
                                            {savingBingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Save
                                        </button>
                                    </div>
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                        Get your key from <a href="https://portal.azure.com/#create/microsoft.bingsearch" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Azure Portal → Bing Search v7</a>.
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                        Market (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={bingSearchMarket}
                                        onChange={e => setBingSearchMarket(e.target.value)}
                                        placeholder="e.g. nl-NL, en-US (leave empty for auto)"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                        Set the market for locale-aware results (e.g. nl-NL for Dutch). Leave empty for auto-detection.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Self-hosted Agent Search Settings — only shown when agent-search is selected */}
                        {searchProvider === 'agent-search' && (
                            <div className="space-y-4">
                                {/* Agent Search Service URL — read-only from env var */}
                                <div>
                                    <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                        Agent Search Service URL
                                        {hasAgentSearchUrl && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                                    </label>
                                    <div className="px-3 py-2 rounded-lg text-sm border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                        {agentSearchUrl || <span style={{ color: 'var(--text-muted)' }}>Not configured — set SEARCH_SERVICE_URL env var</span>}
                                    </div>
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                        Controlled by the <code>SEARCH_SERVICE_URL</code> environment variable on the server.
                                    </p>
                                </div>
                                <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                        Serper.dev API Key
                                        {hasSerperKey && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={serperApiKey}
                                            onChange={e => setSerperApiKey(e.target.value)}
                                            placeholder={hasSerperKey ? '••••••••••••••••' : 'Enter Serper.dev API key'}
                                            className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                        />
                                        <button
                                            onClick={async () => {
                                                setSavingSerperKey(true);
                                                try {
                                                    const res = await authFetch(`${API_BASE}/ai/config`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ serperApiKey }),
                                                    });
                                                    if (res.ok) {
                                                        setHasSerperKey(!!serperApiKey);
                                                        setSerperApiKey('');
                                                        setMessage({ type: 'success', text: serperApiKey ? 'Serper API key saved' : 'Serper API key removed' });
                                                    }
                                                } catch (e) {
                                                    setMessage({ type: 'error', text: 'Failed to save Serper API key' });
                                                }
                                                setSavingSerperKey(false);
                                                setTimeout(() => setMessage(null), 3000);
                                            }}
                                            disabled={savingSerperKey}
                                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                        >
                                            {savingSerperKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Save
                                        </button>
                                    </div>
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                        Get your API key from <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>serper.dev</a>. Used by the search service for Google web search results.
                                    </p>
                                </div>
                            </div>
                        )}

                        {searchProvider === 'agent-search' && (
                            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <label className="text-sm font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                                    <Settings className="w-4 h-4" /> Agent Search Default Options
                                </label>

                                {/* Global settings */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Default Mode</label>
                                        <select
                                            value={agentSearchDefaults.mode}
                                            onChange={e => setAgentSearchDefaults(p => ({ ...p, mode: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="web">Web (full pages + reranking)</option>
                                            <option value="web_fast">Web Fast (snippets only)</option>
                                            <option value="kb">Knowledge Base</option>
                                            <option value="auto">Auto (KB + web fallback)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={agentSearchDefaults.include_citations}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, include_citations: e.target.checked }))}
                                                className="rounded"
                                            />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Include citations</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Web Mode Settings */}
                                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--accent-primary)' }}>
                                        🌐 Web Mode
                                        <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>— full page content + reranking</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Results</label>
                                            <input
                                                type="number" min="1" max="10"
                                                value={agentSearchDefaults.web?.max_results || 5}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, max_results: parseInt(e.target.value) || 5 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Fetch Top N</label>
                                            <input
                                                type="number" min="1" max="5"
                                                value={agentSearchDefaults.web?.fetch_top_n || 3}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, fetch_top_n: parseInt(e.target.value) || 3 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Tokens</label>
                                            <input
                                                type="number" min="500" max="5000" step="100"
                                                value={agentSearchDefaults.web?.max_tokens_markdown || 2000}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, max_tokens_markdown: parseInt(e.target.value) || 2000 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Detail Level</label>
                                            <select
                                                value={agentSearchDefaults.web?.detail_level || 'detailed'}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, detail_level: e.target.value } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="basic">Basic (compact)</option>
                                                <option value="detailed">Detailed (default)</option>
                                                <option value="highly_detailed">Highly Detailed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Web Fast Mode Settings */}
                                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#f59e0b' }}>
                                        ⚡ Web Fast Mode
                                        <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>— snippets + AI synthesis</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Results</label>
                                            <input
                                                type="number" min="1" max="20"
                                                value={agentSearchDefaults.web_fast?.max_results || 10}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, max_results: parseInt(e.target.value) || 10 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Tokens</label>
                                            <input
                                                type="number" min="500" max="5000" step="100"
                                                value={agentSearchDefaults.web_fast?.max_tokens_markdown || 1500}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, max_tokens_markdown: parseInt(e.target.value) || 1500 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Detail Level</label>
                                            <select
                                                value={agentSearchDefaults.web_fast?.detail_level || 'detailed'}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, detail_level: e.target.value } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="basic">Basic (compact)</option>
                                                <option value="detailed">Detailed (default)</option>
                                                <option value="highly_detailed">Highly Detailed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={async () => {
                                            setSavingSearchDefaults(true);
                                            try {
                                                await authFetch(`${API_BASE}/ai/agent-search/defaults`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(agentSearchDefaults),
                                                });
                                                setMessage({ type: 'success', text: 'Agent Search defaults saved' });
                                            } catch (e) {
                                                setMessage({ type: 'error', text: 'Failed to save defaults' });
                                            }
                                            setSavingSearchDefaults(false);
                                            setTimeout(() => setMessage(null), 3000);
                                        }}
                                        disabled={savingSearchDefaults}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    >
                                        {savingSearchDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Save Defaults
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

            </div>
            </div>
            )}


            {active === 'transcription' && (
            <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Cloud className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                        Meeting Transcription
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Configure which AI provider transcribes your meeting recordings. All providers support <strong>speaker diarization</strong> (who said what) and automatic
                        speaker name identification. Switch providers at any time without losing settings.
                    </p>
                </div>

                {/* Active provider picker */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Active Provider</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Choose which engine will be used when you transcribe audio in Meeting Notes.</p>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            {
                                id: 'voxtral',
                                name: 'Voxtral',
                                badge: 'Mistral Cloud',
                                emoji: '⚡',
                                badgeColor: '#f59e0b',
                                desc: 'Fast, high-quality cloud transcription with built-in diarization. Requires a Mistral API key.',
                                requires: 'Mistral API key (AI Config)',
                                ready: true, // always potentially ready via API key
                            },
                            {
                                id: 'azure',
                                name: 'Azure Speech',
                                badge: 'Microsoft Cloud',
                                emoji: '☁️',
                                badgeColor: '#0078D4',
                                desc: 'Enterprise-grade Whisper model on Azure. Great for compliance-conscious organisations.',
                                requires: 'Azure Speech key + region',
                                ready: hasAzureSpeechKey,
                            },
                            {
                                id: 'whisper_azure',
                                name: 'Azure Whisper',
                                badge: 'Batch API',
                                emoji: '🎙️',
                                badgeColor: '#0078D4',
                                desc: 'Higher accuracy via Azure Batch Transcription (Whisper model). Async — large files, up to 35 speakers. Uses RustFS for temp audio storage.',
                                requires: 'Azure Speech key + RustFS',
                                ready: hasAzureSpeechKey,
                            },
                            {
                                id: 'whisperx',
                                name: 'WhisperX',
                                badge: 'Self-hosted',
                                emoji: '🏠',
                                badgeColor: '#8b5cf6',
                                desc: 'Fully private. Run Whisper on your own server — audio never leaves your infrastructure.',
                                requires: 'Self-hosted server URL',
                                ready: hasWhisperxUrl,
                            },
                        ].map((p) => (
                            <button
                                key={p.id}
                                onClick={async () => {
                                    if (transcriptionProvider === p.id) return;
                                    setSavingTranscriptionProvider(true);
                                    try {
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ transcriptionProvider: p.id }),
                                        });
                                        if (res.ok) {
                                            setTranscriptionProvider(p.id);
                                            setMessage({ type: 'success', text: `Active provider set to ${p.name}` });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save provider' });
                                    }
                                    setSavingTranscriptionProvider(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingTranscriptionProvider}
                                className="relative rounded-xl border-2 p-4 text-left transition-all cursor-pointer disabled:opacity-50"
                                style={{
                                    background: transcriptionProvider === p.id ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-primary))' : 'var(--bg-primary)',
                                    borderColor: transcriptionProvider === p.id ? 'var(--accent-primary)' : 'var(--border-default)',
                                }}
                            >
                                {transcriptionProvider === p.id && (
                                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-400" />
                                )}
                                <div className="text-2xl mb-2">{p.emoji}</div>
                                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: p.badgeColor + '18', color: p.badgeColor }}>
                                    {p.badge}
                                </span>
                                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{p.desc}</p>
                                <p className="text-xs mt-2 font-medium" style={{ color: p.ready ? '#10b981' : 'var(--text-muted)' }}>
                                    {p.ready ? '✓ Configured' : `⚠ Needs: ${p.requires}`}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Provider 1: Voxtral ─────────────────────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                ⚡ Voxtral <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: '#f59e0b18', color: '#f59e0b' }}>Mistral Cloud</span>
                                {transcriptionProvider === 'voxtral' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Active</span>}
                            </h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Uses Mistral's <code>voxtral-mini-latest</code> model. Fast and accurate with speaker diarization.</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Mistral API Key</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Voxtral uses your existing Mistral API key configured in{' '}
                                <strong>Admin → AI Config → API Keys → Mistral</strong>. No additional setup needed here.
                            </p>
                        </div>
                        <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Capabilities</p>
                            <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                                <li>✅ Speaker diarization (who said what)</li>
                                <li>✅ Word and segment timestamps</li>
                                <li>✅ 30+ languages</li>
                                <li>✅ Context terms to boost accuracy</li>
                                <li>ℹ️ Audio sent to Mistral cloud servers</li>
                            </ul>
                        </div>
                        <a
                            href="https://console.mistral.ai"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm underline"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Open Mistral Console
                        </a>
                    </div>
                </div>

                {/* ── Provider 2: Azure AI Speech ─────────────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            ☁️ Azure AI Speech
                            <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: '#0078D418', color: '#0078D4' }}>Microsoft Cloud</span>
                            {transcriptionProvider === 'azure' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Active</span>}
                            {hasAzureSpeechKey && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>Key saved 🔒</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Azure Cognitive Services Speech with optional Whisper model. Enterprise SLAs, GDPR-compliant regions available.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Credentials */}
                        <div>
                            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Credentials</label>
                            <div className="flex gap-2 mb-2">
                                <div className="flex-1">
                                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Region (e.g. <code>westeurope</code>, <code>eastus</code>)</p>
                                    <input
                                        type="text"
                                        value={azureSpeechRegion}
                                        onChange={e => setAzureSpeechRegion(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="westeurope"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API Key (Key 1)</p>
                                    <input
                                        type="password"
                                        value={azureSpeechKey}
                                        onChange={e => setAzureSpeechKey(e.target.value)}
                                        placeholder={hasAzureSpeechKey ? '••••••••••••••••' : 'Paste your subscription key'}
                                        autoComplete="new-password"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!azureSpeechRegion.trim() && !azureSpeechKey.trim()) return;
                                    setSavingAzureSpeech(true);
                                    try {
                                        const body = {};
                                        if (azureSpeechRegion.trim()) body.azureSpeechRegion = azureSpeechRegion.trim();
                                        if (azureSpeechKey.trim()) body.azureSpeechKey = azureSpeechKey.trim();
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(body),
                                        });
                                        if (res.ok) {
                                            if (azureSpeechKey.trim()) setHasAzureSpeechKey(true);
                                            setAzureSpeechKey('');
                                            setMessage({ type: 'success', text: 'Azure Speech credentials saved securely' });
                                        } else {
                                            const err = await res.json().catch(() => ({}));
                                            setMessage({ type: 'error', text: err.error || 'Failed to save credentials' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save credentials' });
                                    }
                                    setSavingAzureSpeech(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingAzureSpeech || (!azureSpeechRegion.trim() && !azureSpeechKey.trim())}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {savingAzureSpeech ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save credentials
                            </button>
                        </div>
                        {/* Info */}
                        <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Capabilities</p>
                            <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                                <li>✅ Speaker diarization</li>
                                <li>✅ Whisper model available</li>
                                <li>✅ GDPR-compliant regions (e.g. <code>westeurope</code>)</li>
                                <li>✅ Enterprise SLA</li>
                                <li>🔒 Key encrypted at rest (AES-256-GCM) — never exposed in API responses</li>
                            </ul>
                        </div>
                        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: 'var(--accent-primary)10', border: '1px solid var(--accent-primary)30' }}>
                            <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Create a resource in the{' '}
                                <a href="https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Azure Portal → AI Speech</a>.
                                Copy <strong>Key 1</strong> and the <strong>Location / Region</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Provider 3: WhisperX self-hosted ────────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            🏠 WhisperX
                            <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>Self-hosted</span>
                            {transcriptionProvider === 'whisperx' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Active</span>}
                            {hasWhisperxUrl && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>URL saved 🔒</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Point BeeFlow at your own WhisperX or Faster-Whisper server. Audio never leaves your network.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Server URL */}
                        <div>
                            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>Server Configuration</label>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Server URL — base URL of your WhisperX HTTP API</p>
                                    <input
                                        type="url"
                                        value={whisperxUrl}
                                        onChange={e => setWhisperxUrl(e.target.value)}
                                        placeholder={hasWhisperxUrl ? '••••••••••••••••' : 'http://whisperx:9000'}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                </div>
                                <div>
                                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Bearer Token <em>(optional — only if your server requires authentication)</em></p>
                                    <input
                                        type="password"
                                        value={whisperxToken}
                                        onChange={e => setWhisperxToken(e.target.value)}
                                        placeholder={hasWhisperxToken ? '••••••••••••••••' : 'Leave empty if your server is internal-only'}
                                        autoComplete="new-password"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!whisperxUrl.trim() && !whisperxToken.trim()) return;
                                    setSavingWhisperx(true);
                                    try {
                                        const body = {};
                                        if (whisperxUrl.trim()) body.whisperxUrl = whisperxUrl.trim();
                                        if (whisperxToken !== '') body.whisperxToken = whisperxToken;
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(body),
                                        });
                                        if (res.ok) {
                                            if (whisperxUrl.trim()) setHasWhisperxUrl(true);
                                            if (whisperxToken.trim()) setHasWhisperxToken(true);
                                            setWhisperxUrl('');
                                            setWhisperxToken('');
                                            setMessage({ type: 'success', text: 'WhisperX server URL saved securely' });
                                        } else {
                                            const err = await res.json().catch(() => ({}));
                                            setMessage({ type: 'error', text: err.error || 'Failed to save WhisperX settings' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save WhisperX settings' });
                                    }
                                    setSavingWhisperx(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingWhisperx || (!whisperxUrl.trim() && !whisperxToken.trim())}
                                className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {savingWhisperx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save server config
                            </button>
                        </div>
                        {/* Capabilities */}
                        <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Capabilities</p>
                            <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                                <li>✅ Speaker diarization</li>
                                <li>✅ Fully private — audio stays on your server</li>
                                <li>✅ GPU-accelerated (faster than real-time)</li>
                                <li>✅ No per-minute cost</li>
                                <li>✅ Compatible with <code>whisperx-server</code> and <code>faster-whisper-server</code></li>
                                <li>🔒 URL stored encrypted (AES-256-GCM)</li>
                            </ul>
                        </div>
                        {/* Setup guide */}
                        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Quick setup with Docker</p>
                            <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{`docker run -d \\
  --name whisperx \\
  --gpus all \\
  -p 9000:9000 \\
  fedirz/faster-whisper-server:latest-cuda

# Then set Server URL to: http://your-host:9000`}</pre>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                CPU-only: replace <code>latest-cuda</code> with <code>latest-cpu</code>. Diarization requires a Hugging Face token — see the{' '}
                                <a href="https://github.com/fedirz/faster-whisper-server" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>faster-whisper-server docs</a>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* How transcription works */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>How Transcription Works</h3>
                    </div>
                    <div className="p-6">
                        <ol className="space-y-3">
                            {[
                                { step: '1', title: 'Upload audio', desc: 'In Meeting Notes, attach an audio file (MP3, WAV, M4A, WEBM, OGG, FLAC) to a message and say "Transcribe this".' },
                                { step: '2', title: 'Provider transcribes', desc: 'The active provider converts speech to text and returns timed segments with a generic speaker ID per segment (e.g. SPEAKER_00, Guest).' },
                                { step: '3', title: 'Speaker names identified', desc: 'Claude analyses the transcript context and maps generic speaker IDs to real names if they are mentioned in the conversation.' },
                                { step: '4', title: 'Result returned', desc: 'A formatted transcript with timestamps and speaker names is returned in the chat and can be exported or summarised.' },
                            ].map(item => (
                                <li key={item.step} className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--accent-primary)', color: '#fff' }}>{item.step}</span>
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

            </div>
            </div>
            )}

            {active === 'mcp' && (
                <McpMarketplace setMessage={setMessage} />
            )}

            </div>
        </div>
    );
}
