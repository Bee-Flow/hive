import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import MessageItem from '../../components/chat/MessageItem';
import InputArea from '../../components/InputArea';

/**
 * ProposalChat — AI chat panel for the proposal editor (right side).
 * Reuses the same MessageItem + InputArea as Notebook Chat / Direct Chat.
 */
export default function ProposalChat({
    messages, isLoading, onSend, onStop, onRetry, onEdit,
    modelTiers, selectedTier, onTierChange,
    submittedFormIds, setSubmittedFormIds,
    onApplyToBlock,
}) {
    const endRef = useRef(null);
    const containerRef = useRef(null);
    const [chatInput, setChatInput] = useState('');
    const [copied, setCopied] = useState(false);

    // Auto-scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCopy = (content) => {
        navigator.clipboard.writeText(content).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-subtle)',
        }}>
            {/* Chat header */}
            <div style={{
                padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
            }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    🤖 AI Assistent
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    Stel vragen of laat content genereren
                </span>
            </div>

            {/* Messages */}
            <div ref={containerRef} style={{
                flex: 1, overflowY: 'auto', padding: '12px',
                display: 'flex', flexDirection: 'column', gap: '12px',
            }} className="custom-scrollbar">
                {messages.length === 0 && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', textAlign: 'center',
                        padding: '32px 16px',
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '12px', fontSize: '18px',
                            background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                        }}>
                            🤖
                        </div>
                        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                            AI Assistent
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0, maxWidth: '200px', lineHeight: 1.5 }}>
                            Vraag me om content te schrijven, prijzen voor te stellen, of secties aan te passen
                        </p>

                        {/* Quick prompts */}
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            {[
                                'Schrijf een introductie tekst voor deze offerte',
                                'Genereer een aanpak/werkwijze sectie',
                                'Stel prijzen voor op basis van de beschrijving',
                            ].map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setChatInput('');
                                        onSend(prompt);
                                    }}
                                    style={{
                                        padding: '6px 10px', borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-secondary)',
                                        fontSize: '11px', color: 'var(--text-secondary)',
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => e.target.style.borderColor = 'var(--accent-primary)'}
                                    onMouseLeave={e => e.target.style.borderColor = 'var(--border-subtle)'}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className="relative group/msg">
                        <MessageItem
                            msg={msg}
                            idx={idx}
                            isUser={msg.role === 'user'}
                            onCopy={handleCopy}
                            allMessages={messages}
                            modelTiers={modelTiers || {}}
                            onRetry={onRetry}
                            onEditMessage={onEdit}
                        />
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{
                flexShrink: 0, padding: '8px',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                <InputArea
                    input={chatInput}
                    setInput={setChatInput}
                    onSendMessage={(text, attachments) => {
                        onSend(text, attachments);
                        setChatInput('');
                    }}
                    isLoading={isLoading}
                    onStopGenerating={onStop}
                    directMode={true}
                    modelTiers={modelTiers}
                    selectedTier={selectedTier}
                    onTierChange={onTierChange}
                    placeholder="Vraag de AI om hulp..."
                    compact={true}
                />
            </div>
        </div>
    );
}
