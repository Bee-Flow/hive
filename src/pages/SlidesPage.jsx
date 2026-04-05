/**
 * SlidesPage — Main page for the Slides feature.
 *
 * 3-panel layout mirroring NotebooksPage:
 * Left: Filmstrip (slide thumbnails)
 * Center: SlideCanvas + SlideEditor toolbar
 * Right: SlideStudio (AI chat) or Sources panel
 *
 * List + Detail views with CRUD for decks.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Plus, Search, Trash2, Loader2, ArrowLeft,
    Download, Presentation, PanelRightOpen,
    PanelRightClose, StickyNote,
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useChatEngine from '../hooks/useChatEngine';
import SlideCanvas from './slides/SlideCanvas';
import SlideFilmstrip from './slides/SlideFilmstrip';
import SlideEditor from './slides/SlideEditor';
import SlideStudio from './slides/SlideStudio';
import { getDefaultElements, THEMES } from './slides/SlideThemes';

export default function SlidesPage({ user, onBack }) {

    // ─── State ────────────────────────────────────────────────────
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [slidesContent, setSlidesContent] = useState([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [sources, setSources] = useState([]);
    const [showStudio, setShowStudio] = useState(true);
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [theme, setTheme] = useState('corporate');
    const [speakerNotes, setSpeakerNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    const saveTimeoutRef = useRef(null);

    // ─── Load model tiers (same as NotebooksPage) ────────────────
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    // ─── Load decks ───────────────────────────────────────────────
    useEffect(() => {
        loadDecks();
    }, []);

    const loadDecks = async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_BASE}/api/slides`);
            if (res.ok) {
                const data = await res.json();
                setDecks(data);

                // Auto-select from URL
                const urlParams = new URLSearchParams(window.location.search);
                const deckId = urlParams.get('id');
                if (deckId) {
                    const found = data.find(d => d.id === deckId);
                    if (found) selectDeck(found);
                }
            }
        } catch (err) {
            console.error('[Slides] Failed to load decks:', err);
        } finally {
            setLoading(false);
        }
    };

    // ─── Select deck ──────────────────────────────────────────────
    const selectDeck = useCallback(async (deck) => {
        setSelected(deck);
        window.history.replaceState({}, '', `/app/slides?id=${deck.id}`);
        setSlidesContent(deck.slidesContent || []);
        setActiveSlideIndex(0);
        setTheme(deck.settings?.theme || 'corporate');

        // Load sources
        try {
            const res = await authFetch(`${API_BASE}/api/slides/${deck.id}/sources`);
            if (res.ok) setSources(await res.json());
        } catch (e) { console.warn('Failed to load sources:', e); }
    }, [authFetch]);

    // ─── Create deck ──────────────────────────────────────────────
    const createDeck = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/slides`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Untitled Presentation', description: '' }),
            });
            if (res.ok) {
                const deck = await res.json();
                setDecks(prev => [deck, ...prev]);
                selectDeck(deck);
            }
        } catch (err) {
            console.error('[Slides] Failed to create deck:', err);
        }
    };

    // ─── Delete deck ──────────────────────────────────────────────
    const deleteDeck = async (deckId) => {
        if (!confirm('Delete this presentation? This cannot be undone.')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/slides/${deckId}`, { method: 'DELETE' });
            if (res.ok) {
                setDecks(prev => prev.filter(d => d.id !== deckId));
                if (selected?.id === deckId) {
                    setSelected(null);
                    window.history.replaceState({}, '', '/app/slides');
                }
            }
        } catch (err) {
            console.error('[Slides] Failed to delete deck:', err);
        }
    };

    // ─── Auto-save slides ─────────────────────────────────────────
    const saveSlidesContent = useCallback((newContent) => {
        if (!selected) return;
        setSlidesContent(newContent);

        // Debounced save
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                setSaving(true);
                await authFetch(`${API_BASE}/api/slides/${selected.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slidesContent: newContent }),
                });
            } catch (err) {
                console.error('[Slides] Auto-save failed:', err);
            } finally {
                setSaving(false);
            }
        }, 1500);
    }, [selected, authFetch]);

    // ─── Slide CRUD operations ────────────────────────────────────
    const handleUpdateSlide = useCallback((updatedSlide) => {
        const newContent = slidesContent.map(s => s.id === updatedSlide.id ? updatedSlide : s);
        saveSlidesContent(newContent);
    }, [slidesContent, saveSlidesContent]);

    const handleAddSlide = useCallback((newSlide, position) => {
        const newContent = [...slidesContent];
        if (position !== undefined && position >= 0 && position <= newContent.length) {
            newContent.splice(position, 0, newSlide);
            setActiveSlideIndex(position);
        } else {
            newContent.push(newSlide);
            setActiveSlideIndex(newContent.length - 1);
        }
        saveSlidesContent(newContent);
    }, [slidesContent, saveSlidesContent]);

    const handleDeleteSlide = useCallback((index) => {
        if (slidesContent.length <= 1) return;
        const newContent = slidesContent.filter((_, i) => i !== index);
        saveSlidesContent(newContent);
        if (activeSlideIndex >= newContent.length) {
            setActiveSlideIndex(Math.max(0, newContent.length - 1));
        }
    }, [slidesContent, activeSlideIndex, saveSlidesContent]);

    const handleDuplicateSlide = useCallback((index) => {
        const slide = slidesContent[index];
        if (!slide) return;
        const id = crypto.randomUUID?.() || `slide-${Date.now()}`;
        const duplicated = {
            ...JSON.parse(JSON.stringify(slide)),
            id,
            elements: slide.elements.map(e => ({
                ...e,
                id: crypto.randomUUID?.() || `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            })),
        };
        const newContent = [...slidesContent];
        newContent.splice(index + 1, 0, duplicated);
        saveSlidesContent(newContent);
        setActiveSlideIndex(index + 1);
    }, [slidesContent, saveSlidesContent]);

    // ─── Theme change ─────────────────────────────────────────────
    const handleChangeTheme = useCallback(async (newTheme) => {
        setTheme(newTheme);
        if (selected) {
            try {
                await authFetch(`${API_BASE}/api/slides/${selected.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: { ...(selected.settings || {}), theme: newTheme } }),
                });
            } catch (err) {
                console.warn('[Slides] Theme save failed:', err);
            }
        }
    }, [selected, authFetch]);

    // ─── Speaker notes ────────────────────────────────────────────
    useEffect(() => {
        const slide = slidesContent[activeSlideIndex];
        setSpeakerNotes(slide?.notes || '');
    }, [activeSlideIndex, slidesContent]);

    const handleNotesChange = useCallback((e) => {
        const notes = e.target.value;
        setSpeakerNotes(notes);
        const newContent = slidesContent.map((s, i) =>
            i === activeSlideIndex ? { ...s, notes } : s
        );
        saveSlidesContent(newContent);
    }, [activeSlideIndex, slidesContent, saveSlidesContent]);

    // ─── useChatEngine ────────────────────────────────────────────
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
    } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getNotebookPayload: useCallback(() => ({}), []),
        onNotebookUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedTier,
            customEndpoint: selected ? '/ai/chat/slides/stream' : undefined,
            getExtraPayload: () => selected ? { deckId: selected.id, slidesContent } : {},
        }), [selectedTier, selected?.id, slidesContent]),
        onDirectConversationCreated: useCallback(() => {}, []),
        onNotebookDocUpdate: useCallback((content) => {
            // When AI updates slides via tool calls
            if (Array.isArray(content)) {
                saveSlidesContent(content);
            }
        }, [saveSlidesContent]),
        onNotebookSourceAdded: useCallback((source) => {
            setSources(prev => [...prev, source]);
        }, []),
        onNotebookThemeUpdate: useCallback((theme) => {
            if (theme) setSelectedTheme(theme);
        }, []),
    });

    const handleSendMessage = useCallback((text, attachments) => {
        if (!text?.trim() && (!attachments || attachments.length === 0)) return;
        sendChatMessage(text, attachments);
    }, [sendChatMessage]);

    // ─── Filtered decks ──────────────────────────────────────────
    const filteredDecks = decks.filter(d =>
        !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ─── Active slide ─────────────────────────────────────────────
    const activeSlide = slidesContent[activeSlideIndex] || null;

    // ─── Render ───────────────────────────────────────────────────

    // LIST VIEW (no deck selected)
    if (!selected) {
        return (
            <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-primary)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Presentation style={{ width: '22px', height: '22px', color: 'var(--accent-primary)' }} />
                            Slides
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Create presentations with AI
                        </p>
                    </div>
                    <button
                        onClick={createDeck}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                            borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px',
                            fontWeight: 600, color: '#fff',
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%)',
                            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                            transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus style={{ width: '16px', height: '16px' }} />
                        New Presentation
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 24px' }}>
                    <div style={{
                        position: 'relative', maxWidth: '400px',
                    }}>
                        <Search style={{
                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                            width: '16px', height: '16px', color: 'var(--text-muted)',
                        }} />
                        <input
                            type="text"
                            placeholder="Search presentations..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-secondary)',
                                fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
                            }}
                        />
                    </div>
                </div>

                {/* Deck grid */}
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : filteredDecks.length === 0 ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '60px', color: 'var(--text-muted)',
                        }}>
                            <Presentation style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.4 }} />
                            <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                                {searchQuery ? 'No presentations found' : 'No presentations yet'}
                            </div>
                            <div style={{ fontSize: '13px' }}>
                                {searchQuery ? 'Try a different search' : 'Create your first AI-powered presentation'}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '16px',
                        }}>
                            {filteredDecks.map(deck => (
                                <DeckCard
                                    key={deck.id}
                                    deck={deck}
                                    onClick={() => selectDeck(deck)}
                                    onDelete={() => deleteDeck(deck.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // DETAIL VIEW (deck selected)
    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)' }}>
            {/* Left: Filmstrip */}
            <SlideFilmstrip
                slides={slidesContent}
                activeSlideIndex={activeSlideIndex}
                theme={theme}
                onSelectSlide={setActiveSlideIndex}
                onAddSlide={handleAddSlide}
                onDeleteSlide={handleDeleteSlide}
                onDuplicateSlide={handleDuplicateSlide}
            />

            {/* Center: Canvas + Toolbar */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {/* Top bar */}
                <div style={{
                    padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
                    background: 'var(--bg-secondary)',
                }}>
                    <button
                        onClick={() => { setSelected(null); window.history.replaceState({}, '', '/app/slides'); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                            borderRadius: '6px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px',
                        }}
                    >
                        <ArrowLeft style={{ width: '14px', height: '14px' }} />
                        Back
                    </button>
                    <DeckNameEditor
                        name={selected.name}
                        onSave={async (name) => {
                            try {
                                await authFetch(`${API_BASE}/api/slides/${selected.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name }),
                                });
                                setSelected(prev => ({ ...prev, name }));
                                setDecks(prev => prev.map(d => d.id === selected.id ? { ...d, name } : d));
                            } catch (err) {
                                console.error('Failed to rename:', err);
                            }
                        }}
                    />
                    <div style={{ flex: 1 }} />
                    {saving && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                            Saving...
                        </span>
                    )}
                    {/* Speaker notes toggle */}
                    <button
                        onClick={() => setShowNotes(!showNotes)}
                        title="Speaker Notes"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                            borderRadius: '6px', border: 'none',
                            background: showNotes ? 'var(--bg-tertiary)' : 'transparent',
                            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px',
                        }}
                    >
                        <StickyNote style={{ width: '14px', height: '14px' }} />
                        Notes
                    </button>
                    {/* Studio toggle */}
                    <button
                        onClick={() => setShowStudio(!showStudio)}
                        title={showStudio ? 'Hide Studio' : 'Show Studio'}
                        style={{
                            display: 'flex', alignItems: 'center', padding: '4px',
                            borderRadius: '6px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-secondary)',
                        }}
                    >
                        {showStudio
                            ? <PanelRightClose style={{ width: '16px', height: '16px' }} />
                            : <PanelRightOpen style={{ width: '16px', height: '16px' }} />
                        }
                    </button>
                    {/* Export */}
                    <button
                        onClick={async () => {
                            try {
                                const res = await authFetch(`${API_BASE}/api/slides/${selected.id}/export/pdf`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ slides: slidesContent, title: selected.name, theme }),
                                });
                                if (res.ok) {
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${selected.name || 'slides'}.pdf`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }
                            } catch (err) {
                                console.error('Export failed:', err);
                            }
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                            borderRadius: '6px', border: '1px solid var(--border-default)',
                            background: 'var(--bg-primary)', cursor: 'pointer',
                            color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                        }}
                    >
                        <Download style={{ width: '14px', height: '14px' }} />
                        PDF
                    </button>
                </div>

                {/* Slide editor toolbar */}
                <SlideEditor
                    slide={activeSlide}
                    theme={theme}
                    onUpdateSlide={handleUpdateSlide}
                    onChangeTheme={handleChangeTheme}
                />

                {/* Canvas area — dark immersive "presentation room" */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '32px 40px', overflow: 'auto',
                    background: '#141418',
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    position: 'relative',
                }}>
                    {/* Ambient glow under slide */}
                    <div style={{
                        position: 'absolute', top: '35%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60%', height: '40%',
                        background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />
                    <div style={{ width: '100%', maxWidth: '1000px', position: 'relative', zIndex: 1 }}>
                        <SlideCanvas
                            slide={activeSlide}
                            theme={theme}
                            onUpdateSlide={handleUpdateSlide}
                            isEditing={true}
                        />
                    </div>
                </div>

                {/* Speaker notes panel */}
                {showNotes && (
                    <div style={{
                        borderTop: '1px solid var(--border-subtle)', padding: '12px 16px',
                        background: 'var(--bg-secondary)', flexShrink: 0, maxHeight: '150px',
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Speaker Notes — Slide {activeSlideIndex + 1}
                        </div>
                        <textarea
                            value={speakerNotes}
                            onChange={handleNotesChange}
                            placeholder="Add speaker notes for this slide..."
                            style={{
                                width: '100%', height: '80px', padding: '8px', borderRadius: '6px',
                                border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                                fontSize: '12px', color: 'var(--text-primary)', resize: 'vertical',
                                outline: 'none', fontFamily: 'inherit', lineHeight: '1.5',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Right: Studio (Chat + Sources) */}
            {showStudio && (
                <div style={{
                    width: '340px', minWidth: '300px', borderLeft: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <SlideStudio
                        deckId={selected.id}
                        modelTiers={modelTiers}
                        selectedTier={selectedTier}
                        onChangeTier={setSelectedTier}
                        chatMessages={chatMessages}
                        chatLoading={chatLoading}
                        onSendMessage={handleSendMessage}
                        onClearChat={() => setChatMessages([])}
                        onStop={stopChatGenerating}
                        sources={sources}
                        onSourcesChange={setSources}
                    />
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────

function DeckCard({ deck, onClick, onDelete }) {
    const slideCount = deck.slidesContent?.length || 0;
    const updatedAt = new Date(deck.updatedAt || deck.createdAt);
    const timeAgo = getTimeAgo(updatedAt);

    return (
        <div
            onClick={onClick}
            style={{
                padding: '16px', borderRadius: '12px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-secondary)', cursor: 'pointer',
                transition: 'all 0.15s ease', position: 'relative',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {/* Preview area */}
            <div style={{
                aspectRatio: '16/9', borderRadius: '8px', marginBottom: '12px',
                background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-primary) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                <Presentation style={{ width: '32px', height: '32px', color: 'var(--text-muted)', opacity: 0.4 }} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deck.name || 'Untitled'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>{slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{timeAgo}</span>
            </div>
            {/* Delete button */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                    position: 'absolute', top: '8px', right: '8px',
                    padding: '4px', borderRadius: '6px', border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    color: 'var(--text-muted)', opacity: 0,
                    transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--error)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
            >
                <Trash2 style={{ width: '14px', height: '14px' }} />
            </button>
        </div>
    );
}

function DeckNameEditor({ name, onSave }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    const inputRef = useRef(null);

    useEffect(() => { setValue(name); }, [name]);
    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    if (!editing) {
        return (
            <span
                onClick={() => setEditing(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'text' }}
            >
                {name || 'Untitled'}
            </span>
        );
    }

    return (
        <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => { setEditing(false); if (value.trim() && value !== name) onSave(value.trim()); }}
            onKeyDown={e => {
                if (e.key === 'Enter') { setEditing(false); if (value.trim() && value !== name) onSave(value.trim()); }
                if (e.key === 'Escape') { setEditing(false); setValue(name); }
            }}
            style={{
                fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                border: '1px solid var(--accent-primary)', borderRadius: '4px',
                background: 'var(--bg-primary)', padding: '2px 6px', outline: 'none',
                width: '200px',
            }}
        />
    );
}

// ChatInputInline removed — InputArea with ModelTierSelector is now used directly in SlideStudio

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
