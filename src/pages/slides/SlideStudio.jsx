/**
 * SlideStudio — Right panel for the Slides feature.
 *
 * Two-tab layout:
 *   💬 Chat  — AI chat using real ModelTierSelector + InputArea (same as NotebookChat)
 *   📁 Sources — NotebookSources reused to upload files/URLs/text to the slides API
 *
 * Mirrors the NotebookChat + NotebookSources architecture exactly.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RotateCcw, MessageSquare, Database } from 'lucide-react';
import MessageItem from '../../components/chat/MessageItem';
import InputArea from '../../components/InputArea';
import NotebookSources from '../notebooks/NotebookSources';
import { API_BASE, authFetch } from '../../utils/helpers';

const TABS = [
    { id: 'chat',    label: 'Chat',    Icon: MessageSquare },
    { id: 'sources', label: 'Sources', Icon: Database },
];

export default function SlideStudio({
    deckId,
    // Model tier — passed from SlidesPage (loaded via /ai/config/chat-models)
    modelTiers,
    selectedTier,
    onChangeTier,
    // Chat
    chatMessages = [],
    chatLoading = false,
    onSendMessage,
    onClearChat,
    onStop,
    // Sources
    sources = [],
    onSourcesChange,
}) {
    const [activeTab, setActiveTab] = useState('chat');
    const [chatInput, setChatInput] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const endRef = useRef(null);

    // Auto-scroll chat
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ── Source handlers ──────────────────────────────────────────

    const handleFileUpload = async (files) => {
        if (!deckId || !files?.length) return;
        const fileArray = Array.from(files);
        for (const file of fileArray) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources/file`, {
                    method: 'POST',
                    body: formData,
                });
                if (res.ok) {
                    const source = await res.json();
                    onSourcesChange?.(prev => [...prev, source]);
                    pollSourceStatus(source.id);
                }
            } catch (err) {
                console.error('[SlideStudio] File upload failed:', err);
            }
        }
    };

    const handleAddUrl = async (url) => {
        if (!deckId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (res.ok) {
                const source = await res.json();
                onSourcesChange?.(prev => [...prev, source]);
                pollSourceStatus(source.id);
            }
        } catch (err) {
            console.error('[SlideStudio] URL source failed:', err);
        }
    };

    const handleAddText = async (text, name) => {
        if (!deckId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, name }),
            });
            if (res.ok) {
                const source = await res.json();
                onSourcesChange?.(prev => [...prev, source]);
            }
        } catch (err) {
            console.error('[SlideStudio] Text source failed:', err);
        }
    };

    const handleAddMeeting = async (meetingId) => {
        if (!deckId) return;
        try {
            // Fetch meeting content first
            const mRes = await authFetch(`${API_BASE}/api/transcriptions/${meetingId}`);
            if (!mRes.ok) return;
            const meeting = await mRes.json();
            const content = meeting.content || meeting.fullText || meeting.summary || '';
            const title = meeting.title || 'Meeting Notes';
            if (!content.trim()) return;

            const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources/meeting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId, content, title }),
            });
            if (res.ok) {
                const source = await res.json();
                onSourcesChange?.(prev => [...prev, source]);
            }
        } catch (err) {
            console.error('[SlideStudio] Meeting source failed:', err);
        }
    };

    const handleDeleteSource = async (sourceId) => {
        if (!deckId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources/${sourceId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                onSourcesChange?.(prev => prev.filter(s => s.id !== sourceId));
            }
        } catch (err) {
            console.error('[SlideStudio] Delete source failed:', err);
        }
    };

    // Poll a source until it's no longer in 'processing' state
    const pollSourceStatus = (sourceId) => {
        if (!deckId) return;
        const interval = setInterval(async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/slides/${deckId}/sources`);
                if (!res.ok) { clearInterval(interval); return; }
                const all = await res.json();
                const src = all.find(s => s.id === sourceId);
                if (!src || src.status !== 'processing') {
                    clearInterval(interval);
                    if (src) {
                        onSourcesChange?.(prev => prev.map(s => s.id === sourceId ? src : s));
                    }
                }
            } catch { clearInterval(interval); }
        }, 3000);
        // Safety: stop after 5 minutes
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
    };

    // Derived stats for sources panel footer
    const readyCount = sources.filter(s => s.status === 'ready').length;
    const totalWords = sources.reduce((sum, s) => sum + (s.wordCount || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>

            {/* ── Tab header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 12px', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, background: 'var(--bg-secondary)',
            }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                    {TABS.map(({ id, label, Icon }) => {
                        const isActive = activeTab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '8px 10px', fontSize: '11px', fontWeight: isActive ? 600 : 400,
                                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Icon style={{ width: '12px', height: '12px' }} />
                                {label}
                                {id === 'sources' && sources.length > 0 && (
                                    <span style={{
                                        fontSize: '9px', fontWeight: 700,
                                        background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: isActive ? '#fff' : 'var(--text-tertiary)',
                                        borderRadius: '99px', padding: '1px 5px',
                                        minWidth: '16px', textAlign: 'center',
                                    }}>
                                        {sources.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Clear / header actions for chat tab */}
                {activeTab === 'chat' && (
                    <button
                        onClick={onClearChat}
                        title="Clear chat"
                        style={{
                            padding: '4px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                        }}
                    >
                        <RotateCcw style={{ width: '13px', height: '13px' }} />
                    </button>
                )}
            </div>

            {/* ── Chat tab ── */}
            {activeTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {/* Messages */}
                    <div
                        className="custom-scrollbar"
                        style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                        {chatMessages.length === 0 ? (
                            <StudioWelcome onSend={onSendMessage} />
                        ) : (
                            chatMessages.map((msg, idx) => (
                                <MessageItem
                                    key={msg.id || idx}
                                    msg={msg}
                                    idx={idx}
                                    isUser={msg.role === 'user'}
                                    allMessages={chatMessages}
                                    modelTiers={modelTiers || {}}
                                />
                            ))
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input — uses real InputArea with ModelTierSelector, identical to NotebookChat */}
                    <div
                        className="shrink-0 px-2 py-2 border-t"
                        style={{ borderColor: 'var(--border-subtle)', flexShrink: 0 }}
                    >
                        <InputArea
                            input={chatInput}
                            setInput={setChatInput}
                            onSendMessage={(text, attachments) => {
                                onSendMessage(text, attachments);
                                setChatInput('');
                            }}
                            isLoading={chatLoading}
                            onStopGenerating={onStop}
                            directMode={true}
                            modelTiers={modelTiers}
                            selectedTier={selectedTier}
                            onTierChange={onChangeTier}
                            placeholder="Ask AI to create slides..."
                            compact={true}
                        />
                    </div>
                </div>
            )}

            {/* ── Sources tab ── */}
            {activeTab === 'sources' && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <NotebookSources
                        sources={sources}
                        onFileUpload={handleFileUpload}
                        onAddUrl={handleAddUrl}
                        onAddText={handleAddText}
                        onAddMeeting={handleAddMeeting}
                        onDeleteSource={handleDeleteSource}
                        dragOver={dragOver}
                        setDragOver={setDragOver}
                        totalWords={totalWords}
                        readyCount={readyCount}
                        showMeetingNotes={true}
                    />
                </div>
            )}
        </div>
    );
}

function StudioWelcome({ onSend }) {
    const suggestions = [
        'Create a 10-slide pitch deck about…',
        'Make a title slide for…',
        'Add speaker notes to all slides',
        'Redesign this deck with the dark theme',
    ];

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', textAlign: 'center',
            padding: '24px', color: 'var(--text-muted)',
        }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎯</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Slide Studio
            </div>
            <div style={{ fontSize: '12px', lineHeight: '1.6', maxWidth: '220px', marginBottom: '16px' }}>
                Ask me to build presentations, add slides, or generate content from your sources.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '260px' }}>
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => onSend?.(s)}
                        style={{
                            padding: '8px 12px', borderRadius: '8px',
                            background: 'var(--bg-secondary)', fontSize: '11px',
                            color: 'var(--text-secondary)', textAlign: 'left',
                            border: '1px solid var(--border-subtle)', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        💡 {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
