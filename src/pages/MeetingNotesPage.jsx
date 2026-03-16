import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE, authFetch, generateMessageId } from '../utils/helpers';
import {
    ArrowLeft, Upload, Mic, Clock, Users, FileAudio, Trash2, Pencil, Check, X,
    Share2, Loader2, Search, ChevronDown, ChevronRight, Play, Download, Copy, UserPlus,
    Square, MicOff, FileText, RefreshCw, MessageSquare, Send, Bot, Pause, Volume2, Video, Settings
} from 'lucide-react';
import useChatEngine from '../hooks/useChatEngine';
import MessageItem from '../components/chat/MessageItem';
import InputArea from '../components/InputArea';
import MarkdownRenderer from '../components/MarkdownRenderer';

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
}

const LANGUAGES = [
    { code: 'nl', label: '🇳🇱 Dutch' },
    { code: 'en', label: '🇬🇧 English' },
    { code: 'de', label: '🇩🇪 German' },
    { code: 'fr', label: '🇫🇷 French' },
    { code: 'es', label: '🇪🇸 Spanish' },
    { code: 'it', label: '🇮🇹 Italian' },
    { code: 'pt', label: '🇵🇹 Portuguese' },
    { code: 'pl', label: '🇵🇱 Polish' },
    { code: 'tr', label: '🇹🇷 Turkish' },
    { code: 'ja', label: '🇯🇵 Japanese' },
    { code: 'zh', label: '🇨🇳 Chinese' },
    { code: 'ko', label: '🇰🇷 Korean' },
    { code: 'ar', label: '🇸🇦 Arabic' },
    { code: 'ru', label: '🇷🇺 Russian' },
];

// ── Speaker color palette ───────────────────────────────
const SPEAKER_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316',
];

export default function MeetingNotesPage({ user, onBack }) {
    const [transcriptions, setTranscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [selected, setSelected] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Upload state
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [uploadLang, setUploadLang] = useState('nl');
    const [uploadTerms, setUploadTerms] = useState('');
    const [uploadProvider, setUploadProvider] = useState('voxtral');
    const [dragOver, setDragOver] = useState(false);
    const [uploadMode, setUploadMode] = useState('record'); // 'record' | 'upload' | 'bot'
    const fileInputRef = useRef(null);

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    // Rename state
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Share state
    const [showShare, setShowShare] = useState(false);
    const [shareSearch, setShareSearch] = useState('');
    const [orgUsers, setOrgUsers] = useState([]);

    // Search / filter
    const [searchQuery, setSearchQuery] = useState('');

    // Detail view tab
    const [detailTab, setDetailTab] = useState('summary');

    // Reprocessing state
    const [reprocessingId, setReprocessingId] = useState(null);

    // Meet Bot state
    const [meetLink, setMeetLink] = useState('');
    const [botSessions, setBotSessions] = useState([]);
    const [sendingBot, setSendingBot] = useState(false);
    const [botCreds, setBotCreds] = useState({ configured: false, email: '' });
    const [showBotSettings, setShowBotSettings] = useState(false);
    const [botEmail, setBotEmail] = useState('');
    const [botPassword, setBotPassword] = useState('');
    const [savingCreds, setSavingCreds] = useState(false);

    // AI Chat state
    const [showChat, setShowChat] = useState(false);
    const [selectedChatTier, setSelectedChatTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [meetingChatInput, setMeetingChatInput] = useState('');
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Audio playback state
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioRef = useRef(null);

    // Build system prompt for meeting context
    const transcriptSystemPrompt = useMemo(() => {
        if (!selected) return '';
        return `You are a meeting assistant. The user is reviewing a meeting transcript. Help them understand, analyze, summarize, or find information in this meeting.\n\n--- MEETING TRANSCRIPT ---\nTitle: ${selected.title}\nDuration: ${formatDuration(selected.durationSeconds)}\nSpeakers: ${(selected.speakers || []).map(s => s.id).join(', ')}\nLanguage: ${selected.language}\n\n${selected.transcript || selected.fullText || 'No transcript available'}\n--- END TRANSCRIPT ---\n\nAnswer in the same language as the transcript unless the user asks otherwise.`;
    }, [selected?.id, selected?.transcript, selected?.fullText]);

    // useChatEngine — exact same as DirectChat
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading, sendMessage: sendChatMessage, stopGenerating: stopChatGenerating, retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat, submittedFormIds, setSubmittedFormIds } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getWorkspacePayload: useCallback(() => ({}), []),
        onWorkspaceUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedChatTier,
            systemPrompt: transcriptSystemPrompt,
        }), [selectedChatTier, transcriptSystemPrompt]),
        onDirectConversationCreated: useCallback(() => {}, []),
    });

    // Load model tiers
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    // Load & poll bot sessions
    const loadBotSessions = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/sessions`);
            if (res.ok) setBotSessions(await res.json());
        } catch (e) { /* ignore */ }
    }, []);

    // Load bot credentials status
    const loadBotCreds = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/credentials`);
            if (res.ok) {
                const data = await res.json();
                setBotCreds(data);
                if (!data.configured) setShowBotSettings(true);
            }
        } catch (e) { /* ignore */ }
    }, []);

    const saveBotCreds = async () => {
        if (!botEmail.trim() || !botPassword.trim()) return;
        setSavingCreds(true);
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: botEmail.trim(), password: botPassword.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setBotCreds({ configured: true, email: data.email });
                setShowBotSettings(false);
                setBotPassword('');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save credentials');
            }
        } catch (e) { alert('Failed to save credentials'); }
        setSavingCreds(false);
    };

    useEffect(() => { loadBotSessions(); loadBotCreds(); }, [loadBotSessions, loadBotCreds]);

    // Auto-poll while any session is active
    useEffect(() => {
        const hasActive = botSessions.some(s => ['pending', 'joining', 'recording', 'processing'].includes(s.status));
        if (!hasActive) return;
        const interval = setInterval(loadBotSessions, 5000);
        return () => clearInterval(interval);
    }, [botSessions, loadBotSessions]);

    // Send bot to meeting
    const sendBotToMeet = async () => {
        if (!meetLink.trim() || sendingBot) return;
        setSendingBot(true);
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetLink: meetLink.trim(), title: `Meeting ${new Date().toLocaleString()}`, language: uploadLang }),
            });
            if (res.ok) {
                setMeetLink('');
                loadBotSessions();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to send bot');
            }
        } catch (e) { alert('Failed to send bot'); }
        setSendingBot(false);
    };

    const stopBotSession = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/meet-bot/sessions/${id}/stop`, { method: 'POST' });
            loadBotSessions();
        } catch (e) { /* ignore */ }
    };

    // Load transcriptions
    const loadTranscriptions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/transcriptions`);
            if (res.ok) {
                const data = await res.json();
                setTranscriptions(data.transcriptions || []);
            }
        } catch (err) { console.error('Load error:', err); }
        setLoading(false);
    }, []);

    useEffect(() => { loadTranscriptions(); }, [loadTranscriptions]);

    // Load transcription detail
    const loadDetail = async (id) => {
        setSelectedId(id);
        setLoadingDetail(true);
        try {
            const res = await authFetch(`${API_BASE}/api/transcriptions/${id}`);
            if (res.ok) setSelected(await res.json());
        } catch (err) { console.error('Detail error:', err); }
        setLoadingDetail(false);
    };

    // Auto-generate title from date/time
    const generateTitle = () => {
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `Meeting ${date} ${time}`;
    };

    // ── Recording ────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const file = new File([blob], `recording.${ext}`, { type: mimeType });
                handleUpload(file);
            };

            recorder.start(1000); // collect chunks every second
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch (err) {
            console.error('Mic access denied:', err);
            setUploadProgress('Microphone access denied. Please allow access in your browser settings.');
            setTimeout(() => setUploadProgress(''), 5000);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        clearInterval(timerRef.current);
        setIsRecording(false);
        setRecordingTime(0);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            clearInterval(timerRef.current);
        };
    }, []);

    // Upload
    const handleUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        setUploadProgress('Uploading & transcribing...');

        const title = file.name.startsWith('recording.')
            ? generateTitle()
            : file.name.replace(/\.[^/.]+$/, '');

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('language', uploadLang);
        formData.append('title', title);
        formData.append('provider', uploadProvider);
        if (uploadTerms) formData.append('context_terms', uploadTerms);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min (WhisperX can be slower)
            const res = await authFetch(`${API_BASE}/api/transcriptions`, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const result = await res.json();
                setShowUpload(false);
                setUploadTerms('');
                await loadTranscriptions();
                loadDetail(result.id);
            } else {
                const err = await res.json();
                setUploadProgress(`Error: ${err.error}`);
                setTimeout(() => setUploadProgress(''), 5000);
            }
        } catch (err) {
            setUploadProgress(`Error: ${err.message}`);
            setTimeout(() => setUploadProgress(''), 5000);
        }
        setUploading(false);
    };

    // Delete
    const handleDelete = async (id) => {
        if (!confirm('Delete this transcription?')) return;
        await authFetch(`${API_BASE}/api/transcriptions/${id}`, { method: 'DELETE' });
        if (selectedId === id) { setSelected(null); setSelectedId(null); }
        loadTranscriptions();
    };

    // Rename
    const handleRename = async (id) => {
        if (!renameValue.trim()) return;
        await authFetch(`${API_BASE}/api/transcriptions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: renameValue.trim() }),
        });
        setRenamingId(null);
        loadTranscriptions();
        if (selectedId === id && selected) {
            setSelected(prev => ({ ...prev, title: renameValue.trim() }));
        }
    };

    // Share
    const loadOrgUsers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/users`);
            if (res.ok) {
                const users = await res.json();
                setOrgUsers(users.filter(u => u.id !== user?.id));
            }
        } catch (err) { console.error(err); }
    };

    const handleShare = async (userId) => {
        if (!selected) return;
        const res = await authFetch(`${API_BASE}/api/transcriptions/${selected.id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [userId] }),
        });
        if (res.ok) {
            const data = await res.json();
            setSelected(prev => ({ ...prev, sharedWith: data.sharedWith }));
        }
    };

    const handleUnshare = async (userId) => {
        if (!selected) return;
        const res = await authFetch(`${API_BASE}/api/transcriptions/${selected.id}/unshare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [userId] }),
        });
        if (res.ok) {
            const data = await res.json();
            setSelected(prev => ({ ...prev, sharedWith: data.sharedWith }));
        }
    };

    // Copy transcript
    const handleCopy = () => {
        if (selected?.transcript) {
            navigator.clipboard.writeText(selected.transcript);
        }
    };

    // Reprocess failed transcription
    const handleReprocess = async (id) => {
        setReprocessingId(id);
        try {
            const res = await authFetch(`${API_BASE}/api/transcriptions/${id}/reprocess`, { method: 'POST' });
            if (res.ok) {
                loadTranscriptions();
                // If we're viewing this one, reload it
                if (selected?.id === id) {
                    const detailRes = await authFetch(`${API_BASE}/api/transcriptions/${id}`);
                    if (detailRes.ok) setSelected(await detailRes.json());
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Reprocessing failed');
            }
        } catch (err) {
            alert('Reprocessing failed: ' + err.message);
        } finally {
            setReprocessingId(null);
        }
    };

    // Reset chat when changing transcription
    useEffect(() => {
        setChatMessages([]);
        setMeetingChatInput('');
    }, [selected?.id]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Filter
    const filtered = transcriptions.filter(t =>
        !searchQuery || t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || t.fileName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getSpeakerColor = (speakerId) => {
        if (!speakerId) return SPEAKER_COLORS[0];
        let hash = 0;
        for (let i = 0; i < speakerId.length; i++) {
            hash = speakerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
    };

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Meeting Notes</h1>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Upload recordings • AI transcription with speaker detection
                    </p>
                </div>
                <button
                    onClick={() => { setShowUpload(!showUpload); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                    <Upload className="w-4 h-4" />
                    New Transcription
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: List */}
                <div className="w-80 border-r flex flex-col" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    {/* Search */}
                    <div className="p-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search notes..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <Mic className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No transcriptions yet</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Upload an audio file to get started</p>
                            </div>
                        ) : (
                            filtered.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => loadDetail(t.id)}
                                    className={`w-full text-left px-4 py-3 border-b transition-all hover:bg-[var(--bg-tertiary)] ${selectedId === t.id ? 'bg-[var(--bg-tertiary)]' : ''}`}
                                    style={{ borderColor: 'var(--border-subtle)' }}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            {renamingId === t.id ? (
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                        className="flex-1 text-sm px-1.5 py-0.5 rounded border outline-none"
                                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--accent-primary)', color: 'var(--text-primary)' }}
                                                    />
                                                    <button onClick={() => handleRename(t.id)} className="p-0.5"><Check className="w-3.5 h-3.5 text-green-500" /></button>
                                                    <button onClick={() => setRenamingId(null)} className="p-0.5"><X className="w-3.5 h-3.5 text-red-400" /></button>
                                                </div>
                                            ) : (
                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.title}</div>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                    <Clock className="w-3 h-3" />
                                                    {formatDuration(t.durationSeconds)}
                                                </span>
                                                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                    <Users className="w-3 h-3" />
                                                    {t.speakerCount}
                                                </span>
                                                {t.isOwner === false && (
                                                    <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-500/10 text-blue-500 font-medium">shared</span>
                                                )}
                                                {t.status === 'failed' && (
                                                    <span className="text-[10px] px-1.5 py-px rounded-full bg-red-500/10 text-red-400 font-medium">failed</span>
                                                )}
                                            </div>
                                            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{timeAgo(t.createdAt)}</div>
                                        </div>
                                        {t.isOwner !== false && (
                                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                                {t.status === 'failed' && (
                                                    <button
                                                        onClick={() => handleReprocess(t.id)}
                                                        disabled={reprocessingId === t.id}
                                                        className="p-1 rounded hover:bg-green-500/10 transition-colors" title="Retry transcription"
                                                    >
                                                        {reprocessingId === t.id
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                                            : <RefreshCw className="w-3.5 h-3.5 text-green-500" />
                                                        }
                                                    </button>
                                                )}
                                                <button onClick={() => { setRenamingId(t.id); setRenameValue(t.title); }} className="p-1 rounded hover:bg-[var(--bg-secondary)] transition-colors" title="Rename">
                                                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                                <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-red-500/10 transition-colors" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Detail / Upload */}
                <div className="flex-1 overflow-auto">
                    {showUpload ? (
                        /* Upload Panel */
                        <div className="max-w-xl mx-auto p-8">
                            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>New Transcription</h2>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                                Record a meeting or upload an existing recording.
                            </p>

                            {/* Mode tabs */}
                            <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--bg-tertiary)' }}>
                                <button
                                    onClick={() => setUploadMode('record')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${uploadMode === 'record' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                                    style={{ color: uploadMode === 'record' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Mic className="w-4 h-4" />Record
                                </button>
                                <button
                                    onClick={() => setUploadMode('upload')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${uploadMode === 'upload' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                                    style={{ color: uploadMode === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Upload className="w-4 h-4" />Upload File
                                </button>
                                <button
                                    onClick={() => setUploadMode('bot')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${uploadMode === 'bot' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                                    style={{ color: uploadMode === 'bot' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Video className="w-4 h-4" />Meet Bot
                                </button>
                            </div>

                            {/* Provider + Language + Context (shared) */}
                            <div className="flex gap-3 mb-4">
                                <div style={{ minWidth: 140 }}>
                                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Provider</label>
                                    <select
                                        value={uploadProvider}
                                        onChange={e => setUploadProvider(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="voxtral">☁️ Voxtral</option>
                                        <option value="whisperx">🖥️ WhisperX</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Language</label>
                                    <select
                                        value={uploadLang}
                                        onChange={e => setUploadLang(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                                        Context Terms <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                                    </label>
                                    <input
                                        value={uploadTerms}
                                        onChange={e => setUploadTerms(e.target.value)}
                                        placeholder="AFAS, Bflow, N8N..."
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>

                            {uploadMode === 'record' ? (
                                /* Record mode */
                                <div className="border-2 rounded-2xl p-8 text-center transition-all" style={{ borderColor: isRecording ? '#ef4444' : 'var(--border-default)', background: isRecording ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-secondary)' }}>
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{uploadProgress}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Transcribing your recording...</p>
                                        </div>
                                    ) : isRecording ? (
                                        <div className="flex flex-col items-center gap-4">
                                            {/* Pulsing indicator */}
                                            <div className="relative">
                                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                                    <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                                                </div>
                                                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                                    {formatDuration(recordingTime)}
                                                </p>
                                                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Recording in progress...</p>
                                            </div>
                                            <button
                                                onClick={stopRecording}
                                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                style={{ background: '#ef4444' }}
                                            >
                                                <Square className="w-4 h-4" fill="white" />Stop & Transcribe
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))' }}>
                                                <Mic className="w-8 h-8" style={{ color: '#6366f1' }} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Ready to record</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Click to start capturing audio from your microphone</p>
                                            </div>
                                            <button
                                                onClick={startRecording}
                                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                            >
                                                <Mic className="w-4 h-4" />Start Recording
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : uploadMode === 'upload' ? (
                                /* Upload mode */
                                <div
                                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files?.[0]); }}
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]'}`}
                                    style={{ background: dragOver ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-secondary)' }}
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{uploadProgress}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This may take a few minutes for long recordings...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <FileAudio className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop an audio file here or click to browse</p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Supports MP3, WAV, M4A, OGG, WEBM, FLAC • Up to 3 hours</p>
                                        </>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.aac" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
                                </div>
                            ) : (
                                /* Meet Bot mode */
                                <div className="space-y-4">
                                    {/* Bot Account Settings */}
                                    {showBotSettings ? (
                                        <div className="border-2 rounded-2xl p-6" style={{ borderColor: 'var(--accent-primary)', background: 'var(--bg-secondary)' }}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Settings className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bot Google Account</p>
                                            </div>
                                            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                                                The bot needs a Google account to join meetings. Create a dedicated Google account and enter the credentials below. They are stored encrypted on the server.
                                            </p>
                                            <div className="space-y-3 max-w-sm">
                                                <input
                                                    value={botEmail}
                                                    onChange={e => setBotEmail(e.target.value)}
                                                    placeholder="bot@gmail.com"
                                                    type="email"
                                                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 transition-all"
                                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                                />
                                                <input
                                                    value={botPassword}
                                                    onChange={e => setBotPassword(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveBotCreds(); }}
                                                    placeholder="Password"
                                                    type="password"
                                                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 transition-all"
                                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={saveBotCreds}
                                                        disabled={!botEmail.trim() || !botPassword.trim() || savingCreds}
                                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                                        style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
                                                    >
                                                        {savingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                        {savingCreds ? 'Saving...' : 'Save Credentials'}
                                                    </button>
                                                    {botCreds.configured && (
                                                        <button
                                                            onClick={() => setShowBotSettings(false)}
                                                            className="px-4 py-2.5 rounded-xl text-sm border transition-all hover:bg-opacity-80"
                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                                        >Cancel</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : botCreds.configured ? (
                                        <div className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                                                    <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Bot account: <strong style={{ color: 'var(--text-primary)' }}>{botCreds.email}</strong></span>
                                            </div>
                                            <button onClick={() => { setShowBotSettings(true); setBotEmail(botCreds.email || ''); }} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>Change</button>
                                        </div>
                                    ) : null}

                                    {/* Send Bot to Meet */}
                                    <div className="border-2 rounded-2xl p-8 text-center" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))' }}>
                                            <Video className="w-8 h-8" style={{ color: '#10b981' }} />
                                        </div>
                                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Send Bot to Google Meet</p>
                                        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                                            Paste a Google Meet link and the bot will join as "Bee Flow - Meeting Assistant", record the meeting, and automatically transcribe it when done.
                                        </p>
                                        <div className="flex gap-2 max-w-md mx-auto">
                                            <input
                                                value={meetLink}
                                                onChange={e => setMeetLink(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') sendBotToMeet(); }}
                                                placeholder="meet.google.com/abc-defg-hij"
                                                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 transition-all"
                                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': '#10b981' }}
                                                disabled={sendingBot || !botCreds.configured}
                                            />
                                            <button
                                                onClick={sendBotToMeet}
                                                disabled={!meetLink.trim() || sendingBot || !botCreds.configured}
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
                                            >
                                                {sendingBot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                                                {sendingBot ? 'Sending...' : 'Send Bot'}
                                            </button>
                                        </div>
                                        {!botCreds.configured && !showBotSettings && (
                                            <p className="text-xs mt-3" style={{ color: '#f59e0b' }}>⚠ Configure a bot Google account above first</p>
                                        )}
                                    </div>

                                    {/* Active Bot Sessions */}
                                    {botSessions.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Bot Sessions</h3>
                                            <div className="space-y-2">
                                                {botSessions.map(s => (
                                                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                        <div className="shrink-0">
                                                            {['pending', 'joining', 'recording'].includes(s.status) ? (
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: s.status === 'recording' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)' }}>
                                                                    {s.status === 'recording'
                                                                        ? <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                                                        : <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                                                                    }
                                                                </div>
                                                            ) : s.status === 'processing' ? (
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                                                                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#f59e0b' }} />
                                                                </div>
                                                            ) : s.status === 'completed' ? (
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                                                                    <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                                                                    <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                                {s.status === 'pending' && 'Waiting...'}
                                                                {s.status === 'joining' && 'Joining meeting...'}
                                                                {s.status === 'recording' && '🔴 Recording in progress'}
                                                                {s.status === 'processing' && 'Transcribing...'}
                                                                {s.status === 'completed' && 'Done — transcription available'}
                                                                {s.status === 'failed' && (s.error || 'Failed')}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-1">
                                                            {['pending', 'joining', 'recording'].includes(s.status) && (
                                                                <button onClick={() => stopBotSession(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Stop bot">
                                                                    <Square className="w-3.5 h-3.5 text-red-400" />
                                                                </button>
                                                            )}
                                                            {s.status === 'completed' && s.transcriptionId && (
                                                                <button
                                                                    onClick={() => { loadDetail(s.transcriptionId); setShowUpload(false); }}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                                                    style={{ color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}
                                                                >
                                                                    View
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {uploadProgress && !uploading && (
                                <p className="text-xs mt-3 text-red-500 text-center">{uploadProgress}</p>
                            )}
                        </div>
                    ) : selected ? (
                        /* Transcript Viewer + AI Chat */
                        <div className="h-full flex flex-row">
                            {/* Transcript Content */}
                            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                            {/* Detail Header */}
                            <div className="px-6 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{selected.title}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                            <Clock className="w-3 h-3" />{formatDuration(selected.durationSeconds)}
                                        </span>
                                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                            <Users className="w-3 h-3" />{selected.speakerCount} speakers
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {selected.segmentCount} segments
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {LANGUAGES.find(l => l.code === selected.language)?.label || selected.language}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                            background: selected.provider === 'whisperx' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
                                            color: selected.provider === 'whisperx' ? 'rgb(34,197,94)' : 'rgb(99,102,241)',
                                        }}>
                                            {selected.provider === 'whisperx' ? '🖥️ WhisperX' : '☁️ Voxtral'}
                                        </span>
                                    </div>
                                </div>
                                {/* Audio Playback */}
                                {selected.audioPath && (
                                    <>
                                        <audio
                                            ref={audioRef}
                                            src={`${API_BASE}/api/transcriptions/${selected.id}/audio`}
                                            onPlay={() => setIsPlayingAudio(true)}
                                            onPause={() => setIsPlayingAudio(false)}
                                            onEnded={() => setIsPlayingAudio(false)}
                                        />
                                        <button
                                            onClick={() => {
                                                if (isPlayingAudio) audioRef.current?.pause();
                                                else audioRef.current?.play();
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isPlayingAudio ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                            style={{ color: isPlayingAudio ? 'var(--accent-primary)' : 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                                        >
                                            {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                            {isPlayingAudio ? 'Pause' : 'Listen'}
                                        </button>
                                    </>
                                )}
                                <div className="flex items-center gap-2">
                                    {selected.isOwner !== false && (
                                        <button
                                            onClick={() => { setShowShare(!showShare); if (!showShare) loadOrgUsers(); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                                        >
                                            <Share2 className="w-3.5 h-3.5" />Share
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                                    >
                                        <Copy className="w-3.5 h-3.5" />Copy
                                    </button>
                                    <button
                                        onClick={() => setShowChat(!showChat)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showChat ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                        style={{ color: showChat ? 'var(--accent-primary)' : 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />AI Chat
                                    </button>
                                </div>
                            </div>

                            {/* Share panel */}
                            {showShare && (
                                <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <UserPlus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Share with organisation members</span>
                                    </div>
                                    <input
                                        value={shareSearch}
                                        onChange={e => setShareSearch(e.target.value)}
                                        placeholder="Search users..."
                                        className="w-full px-3 py-1.5 rounded-lg text-sm border outline-none mb-2"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                    <div className="max-h-32 overflow-auto space-y-1">
                                        {orgUsers
                                            .filter(u => !shareSearch || u.name?.toLowerCase().includes(shareSearch.toLowerCase()) || u.email?.toLowerCase().includes(shareSearch.toLowerCase()))
                                            .map(u => {
                                                const isShared = (selected.sharedWith || []).includes(u.id);
                                                return (
                                                    <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#6366f1' }}>
                                                            {u.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{u.name || u.email}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => isShared ? handleUnshare(u.id) : handleShare(u.id)}
                                                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${isShared ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                                                        >
                                                            {isShared ? 'Remove' : 'Share'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Speaker legend */}
                            {selected.speakers?.length > 0 && (
                                <div className="px-6 py-2.5 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                    {selected.speakers.map((s, i) => (
                                        <div key={s.id} className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: getSpeakerColor(s.id) }} />
                                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.id}</span>
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({s.speakingTime})</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab switcher */}
                            <div className="px-6 py-2 border-b flex items-center gap-1" style={{ borderColor: 'var(--border-subtle)' }}>
                                <button
                                    onClick={() => setDetailTab('summary')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${detailTab === 'summary' ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    style={{ color: detailTab === 'summary' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <FileText className="w-3.5 h-3.5" />Summary
                                </button>
                                <button
                                    onClick={() => setDetailTab('transcript')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${detailTab === 'transcript' ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    style={{ color: detailTab === 'transcript' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Mic className="w-3.5 h-3.5" />Transcript
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto px-6 py-4">
                                {loadingDetail ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                ) : detailTab === 'summary' ? (
                                    /* Summary tab */
                                    selected.summary ? (
                                        <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-primary)' }}>
                                            <MarkdownRenderer content={selected.summary} />
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No summary available for this transcription</p>
                                        </div>
                                    )
                                ) : (
                                    /* Transcript tab */
                                    <div className="space-y-1">
                                        {(selected.segments || []).map((seg, idx) => (
                                            <div key={idx} className="group flex gap-3 py-2 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                                                <div className="shrink-0 pt-0.5">
                                                    <div
                                                        className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                                        style={{ background: getSpeakerColor(seg.speaker) }}
                                                    >
                                                        {seg.speaker}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{seg.text}</p>
                                                </div>
                                                <div className="shrink-0 pt-0.5">
                                                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                        {seg.startFormatted || ''}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Chat Sidebar */}
                        {showChat && (
                            <div className="w-[420px] shrink-0 border-l flex flex-col" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                {/* Chat Header */}
                                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <Bot className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meeting Assistant</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>AI</span>
                                </div>

                                {/* Chat Messages — exact DirectChat rendering */}
                                <div ref={chatContainerRef} className="flex-1 overflow-auto p-4 custom-scrollbar">
                                    {chatMessages.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Ask about this meeting</p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>I have the full transcript loaded as context</p>
                                            <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                                                {['Summarize key points', 'What were the action items?', 'What did the participants agree on?'].map((q, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => { setMeetingChatInput(q); }}
                                                        className="text-[11px] px-2.5 py-1.5 rounded-lg border transition-all hover:border-[var(--accent-primary)]" 
                                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-full mx-auto space-y-6 pb-4">
                                            {chatMessages.filter(m => !m.parentId).map((msg, idx) => (
                                                <MessageItem
                                                    key={msg.id || idx}
                                                    idx={idx}
                                                    msg={msg}
                                                    selectedAgent={{ name: 'Meeting Assistant', avatar: '🎙️' }}
                                                    onCopy={(txt) => navigator.clipboard.writeText(txt)}
                                                    allMessages={chatMessages}
                                                    chatSource="direct"
                                                    onRetry={retryChatMessage}
                                                    onEditMessage={editAndRegenerateChat}
                                                    modelTiers={modelTiers}
                                                />
                                            ))}
                                            <div ref={chatEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* InputArea — exact DirectChat input */}
                                <div className="w-full flex flex-col shrink-0">
                                    <InputArea
                                        onSendMessage={(text, attachments) => { sendChatMessage(text, attachments); }}
                                        onStopGenerating={stopChatGenerating}
                                        isLoading={chatLoading}
                                        directMode={true}
                                        modelTiers={modelTiers}
                                        selectedTier={selectedChatTier}
                                        onTierChange={setSelectedChatTier}
                                        input={meetingChatInput}
                                        setInput={setMeetingChatInput}
                                    />
                                </div>
                            </div>
                        )}
                        </div>
                    ) : (
                        /* Empty state */
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                                    <Mic className="w-8 h-8" style={{ color: '#6366f1', opacity: 0.6 }} />
                                </div>
                                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Select a transcription</h3>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Choose a note from the list or upload a new recording
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
