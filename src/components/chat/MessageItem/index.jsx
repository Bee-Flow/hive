import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Bot, ChevronDown, Send, ThumbsUp, ThumbsDown, RefreshCw, Pencil } from 'lucide-react';
import MarkdownRenderer from '../../MarkdownRenderer';
import MapEmbedRenderer from '../../MapEmbedRenderer';
import FormRenderer from '../../FormRenderer';
import { API_BASE, authFetch } from '../../../utils/helpers';
import AudioPlayerInline from './AudioPlayer';
import ImageLightbox from './ImageLightbox';
import ToolOutput from './ToolOutput';
import { SequentialThinking } from './ThinkingSteps';
import SwarmProgress from './SwarmProgress';
import BrowserProgress from './BrowserProgress';
import TerminalProgress from './TerminalProgress';
import EmailDraftCard from './EmailDraftCard';
import CalendarDraftCard from './CalendarDraftCard';
import LinkedInDraftCard from './LinkedInDraftCard';
import WhatsAppDraftCard from './WhatsAppDraftCard';
import { SheetsResultCard, SheetsDraftCard } from './SheetsResultCard';
import { SheetsReportCard } from './SheetsReportView';

const MessageItem = ({
    idx,
    msg,
    selectedAgent,
    onCopy,
    handleFormSubmit,
    isFormSubmitted,
    allMessages = [],
    conversationId,
    agentId,
    chatSource = 'agent',
    onRetry,
    onEditMessage,
    modelTiers = {},
    isLastAssistant = false
}) => {
    const [expandedBrainEntries, setExpandedBrainEntries] = useState({});
    const isUser = msg.role === 'user';
    const isTool = msg.role === 'tool';
    const [copied, setCopied] = useState(false);
    const [showSwarmLogs, setShowSwarmLogs] = useState(false);
    const [showBrain, setShowBrain] = useState(false);
    const [showBrowserActions, setShowBrowserActions] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [selectedBrowserAgent, setSelectedBrowserAgent] = useState(null);
    const [expandedWorkers, setExpandedWorkers] = useState({});
    const [selectedPhase, setSelectedPhase] = useState(null);
    const [emailDraftStatuses, setEmailDraftStatuses] = useState({});
    const [calendarDraftStatuses, setCalendarDraftStatuses] = useState({});
    const [linkedInDraftStatuses, setLinkedInDraftStatuses] = useState({});
    const [whatsappDraftStatuses, setWhatsappDraftStatuses] = useState({});
    const [sheetsDraftStatuses, setSheetsDraftStatuses] = useState({});
    const [feedbackRating, setFeedbackRating] = useState(null);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [showRetryMenu, setShowRetryMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const retryMenuRef = useRef(null);
    const [includeConversation, setIncludeConversation] = useState(false);

    // Click-outside handler for retry tier menu
    useEffect(() => {
        if (!showRetryMenu) return;
        const handler = (e) => {
            if (retryMenuRef.current && !retryMenuRef.current.contains(e.target)) setShowRetryMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showRetryMenu]);

    const submitFeedback = async (rating, comment = '', withConversation = false) => {
        try {
            const API = (typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api/feedback';
            const payload = {
                conversationId: conversationId || null,
                messageId: msg.id || `msg-${idx}`,
                agentId: agentId || null,
                rating,
                comment: comment || null,
                source: chatSource,
            };
            if (withConversation && allMessages?.length > 0) {
                payload.conversationSnapshot = allMessages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                }));
            }
            await authFetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (e) {
            console.error('[Feedback] Failed to submit:', e);
        }
    };

    const handleThumbClick = (rating) => {
        if (feedbackSubmitted && feedbackRating === rating) return;
        setFeedbackRating(rating);
        setShowFeedbackForm(true);
        setFeedbackSubmitted(false);
        submitFeedback(rating);
    };

    const handleFeedbackSubmit = () => {
        submitFeedback(feedbackRating, feedbackComment.trim(), includeConversation);
        setShowFeedbackForm(false);
        setFeedbackSubmitted(true);
        setIncludeConversation(false);
    };

    const handleFeedbackSkip = () => {
        setShowFeedbackForm(false);
        setFeedbackSubmitted(true);
    };

    const handleCopy = () => {
        onCopy(msg.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const allowCopy = !selectedAgent?.config || selectedAgent.config.allowCopy !== false;

    // Get render functions from ToolOutput
    const { renderToolOutput, renderToolCall } = ToolOutput({ msg });

    const hasSheets = !!(msg.sheetsResults || msg.sheetsDrafts || msg.sheetsReports);

    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group animate-fade-in w-full ${hasSheets ? '' : 'max-w-[900px] mx-auto'}`}>

            {/* Sender Info (Multi-agent support) */}
            {!isUser && !isTool && msg.respondingAgentName && (
                <div className="flex items-center gap-1.5 ml-1 mb-1 text-xs text-[var(--text-secondary)] opacity-80">
                    <div className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] overflow-hidden border border-[var(--border-subtle)]">
                        {msg.respondingAgentAvatar && (msg.respondingAgentAvatar.startsWith('data:') || msg.respondingAgentAvatar.startsWith('http')) ? (
                            <img src={msg.respondingAgentAvatar} alt="" className="w-full h-full object-cover" />
                        ) : msg.respondingAgentAvatar ? msg.respondingAgentAvatar : <Bot className="w-3 h-3" />}
                    </div>
                    <span className="font-medium">{msg.respondingAgentName}</span>
                </div>
            )}

            {/* Guardrail Violation Warning */}
            {msg.isGuardrailViolation && (
                <div className="mb-3 px-4 py-3 rounded-xl bg-red-600 border-2 border-red-400 text-white text-sm font-semibold flex items-center gap-3 shadow-lg">
                    <span className="text-xl">🛡️</span>
                    <div>
                        <div className="font-bold">
                            {msg.willRedact ? 'Content Policy Violation' : 'Message Policy Violation'}
                        </div>
                        {msg.violationCategories && (
                            <div className="text-xs text-white/90 mt-0.5 font-medium">
                                Detected: {msg.violationCategories}
                            </div>
                        )}
                        <div className="text-xs text-white/70 mt-0.5">
                            {msg.willRedact
                                ? `Sensitive content will be redacted in ${msg.deleteIn || 5} seconds`
                                : `This message will be deleted in ${msg.deleteIn || 5} seconds`
                            }
                        </div>
                    </div>
                </div>
            )}

            <div
                onCopy={(e) => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) return;
                    const range = sel.getRangeAt(0);
                    const frag = range.cloneContents();
                    const wrapper = document.createElement('div');
                    wrapper.appendChild(frag);
                    wrapper.querySelectorAll('*').forEach(el => {
                        el.style.removeProperty('background-color');
                        el.style.removeProperty('background');
                    });
                    wrapper.style.removeProperty('background-color');
                    wrapper.style.removeProperty('background');
                    e.clipboardData.setData('text/html', wrapper.innerHTML);
                    e.clipboardData.setData('text/plain', sel.toString());
                    e.preventDefault();
                }}
                className={`relative rounded-2xl p-4 transition-all duration-200 overflow-hidden
                    ${isUser
                        ? 'max-w-[85%] bg-[#e8e8eb] text-black rounded-br-none'
                        : isTool
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl w-full max-w-full'
                            : `${(msg.sheetsResults || msg.sheetsDrafts || msg.sheetsReports) ? 'max-w-full w-full' : 'max-w-3xl'} text-[var(--text-primary)] rounded-bl-none`
                    } 
                ${msg.isGuardrailViolation ? 'opacity-60 scale-95' : ''} 
                ${msg.isDeleted ? 'opacity-50 italic' : ''}`}>

                {/* Sequential Thinking — always at the top */}
                {!isUser && !isTool && msg.thinkingSteps?.length > 0 && <SequentialThinking msg={msg} />}

                {/* Reasoning Model — streaming indicator (above content) */}
                {!isUser && !isTool && msg.isStreaming && msg.thinking && !msg.content && (
                    <div className="mb-3">
                        <div className="flex items-center gap-2 text-xs text-purple-400/80 mb-2">
                            <span className="text-sm animate-pulse">🧠</span>
                            <span className="font-medium">Reasoning...</span>
                            <span className="flex items-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce"></span>
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '75ms' }}></span>
                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            </span>
                        </div>
                        <div
                            className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar"
                            ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                            style={{ fontStyle: 'italic', opacity: 0.75 }}
                        >
                            {msg.thinking}
                            <span className="inline-block w-1.5 h-3.5 bg-purple-400/60 ml-0.5 animate-pulse align-text-bottom" />
                        </div>
                    </div>
                )}

                {!isUser && !isTool && renderToolCall()}

                {/* Content */}
                <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${!isUser ? '' : 'text-black prose-headings:text-black prose-a:text-black prose-strong:text-black prose-code:text-black/90 [&_a]:!text-black [&_a]:underline'}`}>
                    {!isUser && msg.swarmActivity && (
                        <SwarmProgress
                            msg={msg}
                            showSwarmLogs={showSwarmLogs} setShowSwarmLogs={setShowSwarmLogs}
                            showBrain={showBrain} setShowBrain={setShowBrain}
                            expandedBrainEntries={expandedBrainEntries} setExpandedBrainEntries={setExpandedBrainEntries}
                            expandedWorkers={expandedWorkers} setExpandedWorkers={setExpandedWorkers}
                            selectedPhase={selectedPhase} setSelectedPhase={setSelectedPhase}
                        />
                    )}
                    {!isUser && msg.browserActivity && (
                        <BrowserProgress
                            msg={msg}
                            showBrowserActions={showBrowserActions} setShowBrowserActions={setShowBrowserActions}
                            selectedBrowserAgent={selectedBrowserAgent} setSelectedBrowserAgent={setSelectedBrowserAgent}
                            setLightboxImage={setLightboxImage}
                            selectedPhase={selectedPhase}
                        />
                    )}
                    {!isUser && msg.terminalActivity && (
                        <TerminalProgress msg={msg} allMessages={allMessages} />
                    )}
                    {!isUser && msg.emailDrafts && (
                        <EmailDraftCard msg={msg} emailDraftStatuses={emailDraftStatuses} setEmailDraftStatuses={setEmailDraftStatuses} />
                    )}
                    {!isUser && msg.calendarDrafts && (
                        <CalendarDraftCard msg={msg} calendarDraftStatuses={calendarDraftStatuses} setCalendarDraftStatuses={setCalendarDraftStatuses} />
                    )}
                    {!isUser && msg.linkedInDrafts && (
                        <LinkedInDraftCard msg={msg} linkedInDraftStatuses={linkedInDraftStatuses} setLinkedInDraftStatuses={setLinkedInDraftStatuses} />
                    )}
                    {!isUser && msg.whatsappDrafts && (
                        <WhatsAppDraftCard msg={msg} whatsappDraftStatuses={whatsappDraftStatuses} setWhatsappDraftStatuses={setWhatsappDraftStatuses} />
                    )}
                    {!isUser && msg.mapEmbeds && msg.mapEmbeds.length > 0 && (
                        <div className="map-embeds-container">
                            {msg.mapEmbeds.map((embed, i) => (
                                <MapEmbedRenderer
                                    key={i}
                                    embedUrl={embed.embedUrl}
                                    title={embed.title}
                                    mapsLink={embed.mapsLink}
                                />
                            ))}
                        </div>
                    )}
                    {isTool ? renderToolOutput() : (
                        msg.isError && msg.content ? (
                            <div className={`flex items-start gap-3 p-3 rounded-xl border ${msg.content.includes('limit') || msg.content.includes('subscription') || msg.content.includes('suspended') || msg.content.includes('cancelled')
                                ? 'bg-orange-100 dark:bg-amber-900/30 border-orange-400 dark:border-amber-500/50'
                                : 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-500/50'
                                }`}>
                                <span className="text-lg flex-shrink-0 mt-0.5">{msg.content.includes('limit') || msg.content.includes('subscription') ? '⚠️' : '❌'}</span>
                                <div>
                                    <div className={`font-semibold text-sm mb-0.5 ${msg.content.includes('limit') || msg.content.includes('subscription') || msg.content.includes('suspended') || msg.content.includes('cancelled')
                                        ? 'text-orange-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'
                                        }`}>
                                        {msg.content.includes('suspended')
                                            ? 'Subscription Suspended'
                                            : msg.content.includes('cancelled')
                                                ? 'Subscription Cancelled'
                                                : msg.content.includes('Chat') && msg.content.includes('type')
                                                    ? 'Chat Agent Limit Reached'
                                                    : msg.content.includes('Browser') && msg.content.includes('type')
                                                        ? 'Browser Agent Limit Reached'
                                                        : msg.content.includes('Terminal') && msg.content.includes('type')
                                                            ? 'Terminal Agent Limit Reached'
                                                            : msg.content.includes('Swarm') && msg.content.includes('type')
                                                                ? 'Swarm Limit Reached'
                                                                : msg.content.includes('message limit')
                                                                    ? 'Monthly Message Limit Reached'
                                                                    : msg.content.includes('token limit')
                                                                        ? 'Monthly Token Limit Reached'
                                                                        : msg.content.includes('cost limit')
                                                                            ? 'Monthly Cost Limit Reached'
                                                                            : (msg.content.includes('limit') || msg.content.includes('subscription'))
                                                                                ? 'Subscription Limit Reached'
                                                                                : 'Something went wrong'}
                                    </div>
                                    <div className={`text-xs ${msg.content.includes('limit') || msg.content.includes('subscription')
                                        ? 'text-orange-700 dark:text-amber-300/90' : 'text-red-700 dark:text-red-300/90'
                                        }`}>{msg.content}</div>
                                </div>
                            </div>
                        ) : msg.content ? (
                            <MarkdownRenderer content={msg.images?.length > 0 ? msg.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim() : msg.content} isLoading={msg.isStreaming} />
                        ) : msg.isStreaming && !msg.thinking ? (
                            <div className="flex items-center gap-3 py-1 animate-pulse">
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce"></div>
                                </div>
                                <span className="text-xs text-[var(--text-tertiary)] italic font-medium">
                                    Thinking...
                                </span>
                            </div>
                        ) : null
                    )}
                    {/* AI Generated Images — rendered after text (skip if album art for audio) */}
                    {!isUser && msg.images && msg.images.length > 0 && !(msg.audioFiles && msg.audioFiles.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {msg.images.map((img, i) => (
                                <div key={i} className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-lg group/img max-w-md">
                                    <img
                                        src={`data:${img.mimeType};base64,${img.data}`}
                                        alt="AI generated image"
                                        className="w-full h-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                        style={{ background: 'var(--bg-tertiary)', maxHeight: '400px' }}
                                        onClick={() => setLightboxImage(`data:${img.mimeType};base64,${img.data}`)}
                                    />
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                        <a
                                            href={`data:${img.mimeType};base64,${img.data}`}
                                            download={`ai-image-${Date.now()}.png`}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors"
                                        >
                                            ⬇ Download
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* AI Generated Audio — Premium Player with Album Art */}
                    {!isUser && msg.audioFiles && msg.audioFiles.length > 0 && (() => {
                        // Use first image in the message as album art (generated in parallel)
                        const albumArt = msg.images && msg.images.length > 0
                            ? (msg.images[0].url || `data:${msg.images[0].mimeType};base64,${msg.images[0].data}`)
                            : null;
                        const sourceLabel = {
                            'elevenlabs_music': 'ElevenLabs Music',
                            'elevenlabs_tts': 'ElevenLabs TTS',
                            'elevenlabs_sfx': 'ElevenLabs SFX',
                        };
                        return (
                            <div className="mt-3 flex flex-col gap-2">
                                {msg.audioFiles.map((audio, i) => {
                                    const audioSrc = audio.url || (audio.data ? `data:${audio.mimeType};base64,${audio.data}` : null);
                                    if (!audioSrc) return null;
                                    return (
                                        <AudioPlayerInline
                                            key={i}
                                            src={audioSrc}
                                            albumArt={albumArt}
                                            title={`AI Generated ${audio.source?.includes('tts') ? 'Speech' : audio.source?.includes('sfx') ? 'Sound Effect' : 'Music'}`}
                                            subtitle={sourceLabel[audio.source] || 'ElevenLabs'}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })()}
                    {/* AI Generated Videos — Modern Player */}
                    {!isUser && msg.videoFiles && msg.videoFiles.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                            {msg.videoFiles.map((vid, i) => (
                                <div key={i} className="rounded-2xl overflow-hidden max-w-lg shadow-xl"
                                    style={{
                                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    }}>
                                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}>
                                            🎬
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-white">AI Generated Video</div>
                                            <div className="text-[10px] text-gray-400">Veo 3.1</div>
                                        </div>
                                    </div>
                                    <div className="px-3 pb-2">
                                        <video
                                            controls
                                            className="w-full rounded-xl"
                                            style={{
                                                maxHeight: '400px',
                                                background: '#000',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                            }}
                                            src={vid.url}
                                        />
                                    </div>
                                    <div className="px-4 pb-3 flex justify-end">
                                        <a href={vid.url} download={`ai-video-${Date.now()}.mp4`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
                                            style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.2)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                            Download MP4
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reasoning — collapsed below answer */}
                {!isUser && !isTool && msg.thinking && !msg.isStreaming && msg.content && (
                    <div className="mt-3 pt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.015)', border: '1px solid rgba(0,0,0,0.03)' }}>
                        <details className="group/reasoning">
                            <summary className="flex items-center gap-2 cursor-pointer text-xs transition-colors select-none list-none [&::-webkit-details-marker]:hidden" style={{ color: '#000' }}>
                                <span className="text-sm opacity-70">🧠</span>
                                <span className="font-medium">Reasoning</span>
                                <span className="opacity-50">·</span>
                                <span className="font-normal">How I got this answer</span>
                                <svg className="w-3 h-3 transition-transform group-open/reasoning:rotate-90 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </summary>
                            <div className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar" style={{ fontStyle: 'italic', opacity: 0.85, color: '#000' }}>
                                {msg.thinking}
                            </div>
                        </details>
                    </div>
                )}

                {/* KB Source References */}
                {!isUser && !isTool && msg.kbSources && msg.kbSources.length > 0 && !msg.isStreaming && (
                    <div className="mt-3 pt-2">
                        <details className="group/sources">
                            <summary className="flex items-center gap-2 cursor-pointer text-xs transition-colors select-none list-none [&::-webkit-details-marker]:hidden px-1 py-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50" style={{ color: 'var(--text-secondary)' }}>
                                <span className="text-sm opacity-70">📚</span>
                                <span className="font-medium">{(() => {
                                    const unique = [...new Set(msg.kbSources.map(s => s.title))];
                                    return `${unique.length} Source${unique.length !== 1 ? 's' : ''}`;
                                })()}</span>
                                <svg className="w-3 h-3 transition-transform group-open/sources:rotate-90 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </summary>
                            <div className="mt-2 space-y-1.5">
                                {(() => {
                                    const seen = new Map();
                                    msg.kbSources.forEach(s => {
                                        if (!seen.has(s.title) || (s.score || 0) > (seen.get(s.title).score || 0)) {
                                            seen.set(s.title, s);
                                        }
                                    });
                                    return [...seen.values()].map((source, i) => (
                                        <details key={i} className="group/src rounded-lg border transition-colors" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-xs" style={{ color: 'var(--text-primary)' }}>
                                                <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                <span className="font-medium truncate flex-1">{source.title}</span>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium opacity-60" style={{ background: 'var(--bg-tertiary)' }}>
                                                    {source.type === 'url_import' ? '🌐 URL' : source.type === 'file_upload' ? '📄 File' : source.type === 'kb_chunk' ? '📦 KB' : '📝'}
                                                </span>
                                                <svg className="w-3 h-3 transition-transform group-open/src:rotate-90 opacity-40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </summary>
                                            <div className="px-3 pb-3 pt-1 text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                                                {source.content}
                                            </div>
                                        </details>
                                    ));
                                })()}
                            </div>
                        </details>
                    </div>
                )}

                {/* Forms */}
                {msg.form && (
                    <div className="mt-4 bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border-subtle)] w-full">
                        <FormRenderer
                            code={msg.form}
                            onSubmit={(data) => {
                                handleFormSubmit(msg, { text: "Form Submitted", formData: data.formData }, `form-${msg.id || idx}`);
                            }}
                            initialSubmitted={isFormSubmitted || !!msg.savedFormData}
                            initialFormData={msg.savedFormData || {}}
                        />
                        {isFormSubmitted && (
                            <div className="mt-3 text-xs text-green-500 flex items-center gap-1 font-medium bg-green-500/10 p-2 rounded">
                                <Check className="w-3 h-3" /> Form Submitted Successfully
                            </div>
                        )}
                    </div>
                )}

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att, i) => (
                            <div key={i} className={`rounded p-1.5 text-xs border flex items-center gap-1 ${isUser ? 'bg-white/10 border-white/20' : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'}`}>
                                <span className="opacity-70">FILE:</span> <span className="font-medium">{att.name || 'Attachment'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Action Buttons + Timestamp row */}
                {!isUser && !msg.isStreaming && (
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                            {/* Copy */}
                            {allowCopy && (
                                <button
                                    onClick={handleCopy}
                                    className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                    title="Copy"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            )}
                            {/* Thumbs feedback */}
                            <button
                                onClick={() => handleThumbClick('up')}
                                className={`p-1.5 rounded transition-colors ${feedbackRating === 'up' ? 'text-green-500 bg-green-500/10' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                title="Good response"
                            >
                                <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => handleThumbClick('down')}
                                className={`p-1.5 rounded transition-colors ${feedbackRating === 'down' ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                title="Bad response"
                            >
                                <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            {feedbackSubmitted && (
                                <span className="text-[10px] text-green-500 ml-1 font-medium">Thanks!</span>
                            )}

                            {/* Retry button */}
                            {onRetry && (
                                <div className="relative ml-1" ref={retryMenuRef}>
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => onRetry(idx)}
                                            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                            title="Retry response"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setShowRetryMenu(!showRetryMenu)}
                                            className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors -ml-1"
                                            title="Retry with different model"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {showRetryMenu && (() => {
                                        const RETRY_TIERS = {
                                            auto: { icon: '🔀', label: 'Auto', desc: 'Optimal choice' },
                                            fast: { icon: '⚡', label: 'Fast', desc: 'Quick answers' },
                                            thinking: { icon: '🧠', label: 'Think', desc: 'Complex problems' },
                                            writer: { icon: '✍️', label: 'Write', desc: 'Long-form content' },
                                            pro: { icon: '✨', label: 'Deep Thinking', desc: 'Advanced reasoning' }
                                        };
                                        return (
                                            <div className="absolute bottom-full left-0 mb-2 rounded-xl shadow-2xl overflow-hidden z-[100] animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                                                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Retry with model</span>
                                                </div>
                                                {Object.entries(RETRY_TIERS).map(([key, meta]) => {
                                                    const isConfigured = key === 'auto' || !!modelTiers[key]?.modelId;
                                                    return (
                                                        <button
                                                            key={key}
                                                            onClick={() => { if (isConfigured) { onRetry(idx, key); setShowRetryMenu(false); } }}
                                                            disabled={!isConfigured}
                                                            className="w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2.5 hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-default"
                                                        >
                                                            <span className="text-lg w-6 text-center flex-shrink-0">{meta.icon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{meta.label}</div>
                                                                <div className="text-[11px] text-[var(--text-tertiary)]">
                                                                    {isConfigured ? meta.desc : 'Not configured'}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                        {/* Timestamp — right side */}
                        <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                            {msg.isError && <span className={`font-medium flex items-center gap-1 ${msg.content?.includes('limit') || msg.content?.includes('subscription') || msg.content?.includes('suspended') || msg.content?.includes('cancelled') ? 'text-amber-500' : 'text-red-500'}`}><span className={`w-1.5 h-1.5 rounded-full ${msg.content?.includes('limit') || msg.content?.includes('subscription') ? 'bg-amber-500' : 'bg-red-500'}`}></span> {msg.content?.includes('limit') || msg.content?.includes('subscription') || msg.content?.includes('suspended') || msg.content?.includes('cancelled') ? 'Usage limit reached' : 'Failed to send'}</span>}
                            {msg.timestamp && (
                                <span className="opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Feedback Form */}
                {showFeedbackForm && !isUser && (
                    <div className="mt-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] animate-fade-in">
                        <textarea
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="Any additional feedback? (optional)"
                            className="w-full text-xs p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                            rows={2}
                        />
                        <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeConversation}
                                onChange={(e) => setIncludeConversation(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-[var(--accent-primary)] cursor-pointer"
                            />
                            <span className="text-[11px] text-[var(--text-secondary)]">
                                Include conversation <span className="text-[var(--text-tertiary)]">— helps us reproduce the issue</span>
                            </span>
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={handleFeedbackSubmit}
                                className="px-3 py-1 text-[11px] font-semibold rounded-md bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all"
                            >
                                Submit
                            </button>
                            <button
                                onClick={handleFeedbackSkip}
                                className="px-3 py-1 text-[11px] font-medium rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User message actions + timestamp */}
            {isUser && !msg.isStreaming && (
                <div className="mt-1.5 text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mr-1 justify-end">
                    {onEditMessage && (
                        <button
                            onClick={() => { setIsEditing(true); setEditContent(msg.content || ''); }}
                            className="p-1 rounded hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                            title="Edit message"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    )}
                    {msg.timestamp && (
                        <span className="opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                </div>
            )}
            {/* Inline edit mode for user messages */}
            {isUser && isEditing && (
                <div className="mt-2 animate-fade-in">
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-sm p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--accent-primary)] text-[var(--text-primary)] resize-none focus:outline-none min-h-[60px]"
                        rows={3}
                        autoFocus
                    />
                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 text-xs font-medium rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (editContent.trim() && onEditMessage) {
                                    onEditMessage(idx, editContent.trim());
                                    setIsEditing(false);
                                }
                            }}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all flex items-center gap-1.5"
                        >
                            <Send className="w-3 h-3" /> Save & Regenerate
                        </button>
                    </div>
                </div>
            )}

            {/* Sheets cards — outside bubble, full-width side-by-side layout */}
            {!isUser && (msg.sheetsResults || msg.sheetsDrafts || msg.sheetsReports) && (
                <div className="w-full mt-2">
                    {/* Side-by-side: spreadsheet left, report right */}
                    {(msg.sheetsDrafts || msg.sheetsResults) && msg.sheetsReports ? (
                        <div className="flex gap-3 w-full" style={{ flexWrap: 'nowrap' }}>
                            {/* Spreadsheet data — left side */}
                            <div className="flex-1 min-w-0" style={{ flex: '1 1 55%' }}>
                                {msg.sheetsResults && <SheetsResultCard msg={msg} />}
                                {msg.sheetsDrafts && (
                                    <SheetsDraftCard msg={msg} sheetsDraftStatuses={sheetsDraftStatuses} setSheetsDraftStatuses={setSheetsDraftStatuses} />
                                )}
                            </div>
                            {/* Report dashboard — right side */}
                            <div className="flex-1 min-w-0" style={{ flex: '1 1 45%' }}>
                                <SheetsReportCard msg={msg} />
                            </div>
                        </div>
                    ) : (
                        /* Only one type — full width */
                        <>
                            {msg.sheetsResults && <SheetsResultCard msg={msg} />}
                            {msg.sheetsDrafts && (
                                <SheetsDraftCard msg={msg} sheetsDraftStatuses={sheetsDraftStatuses} setSheetsDraftStatuses={setSheetsDraftStatuses} />
                            )}
                            {msg.sheetsReports && <SheetsReportCard msg={msg} />}
                        </>
                    )}
                </div>
            )}

            {/* Image Lightbox */}
            <ImageLightbox lightboxImage={lightboxImage} setLightboxImage={setLightboxImage} />
        </div>
    );
};

export default React.memo(MessageItem);
