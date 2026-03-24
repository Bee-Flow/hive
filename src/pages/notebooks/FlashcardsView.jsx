import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, ExternalLink } from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

function parseFlashcards(content) {
    if (!content) return [];
    
    // Flexible regex for matching Q: Question 1: **Q:** etc.
    const qSplit = content.split(/(?:\*\*)?Q(?:uestion)?(?:\s*\d+)?:\s*(?:\*\*)?/i);
    
    const cards = [];
    for (let block of qSplit) {
        if (!block.trim()) continue;
        
        // Match A: Answer 1: **A:** etc.
        const aSplit = block.split(/(?:\*\*)?A(?:nswer)?(?:\s*\d+)?:\s*(?:\*\*)?/i);
        if (aSplit.length >= 2) {
            const qText = aSplit[0].trim();
            const aText = aSplit.slice(1).join("").trim();
            
            if (qText && aText) {
                // Extract source citations from the answer
                const sources = [];
                const sourceRegex = /\[([^\]]+)\]/g;
                let match;
                while ((match = sourceRegex.exec(aText)) !== null) {
                    // Split comma-separated sources: [Volkskrant, Parool] → ['Volkskrant', 'Parool']
                    const names = match[1].split(',').map(s => s.trim()).filter(Boolean);
                    sources.push(...names);
                }
                cards.push({ q: qText, a: aText, sources: [...new Set(sources)] });
            }
        }
    }
    
    return cards;
}

/* Renders text with [Source] citations as clickable badges */
function CitedText({ text, onSourceClick }) {
    // Split text into segments: plain text and [citation] references
    const parts = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add plain text before the citation
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'citation', value: match[1] });
        lastIndex = match.index + match[0].length;
    }
    // Remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return (
        <span>
            {parts.map((part, i) => {
                if (part.type === 'citation') {
                    return (
                        <button
                            key={i}
                            onClick={(e) => {
                                e.stopPropagation(); // Don't flip card
                                onSourceClick?.(part.value);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-[11px] font-medium transition-all hover:brightness-110 cursor-pointer"
                            style={{
                                background: 'var(--accent-primary)',
                                color: 'white',
                                opacity: 0.85,
                            }}
                            title={`View source: ${part.value}`}
                        >
                            <ExternalLink className="w-3 h-3" />
                            {part.value}
                        </button>
                    );
                }
                return <span key={i}>{part.value}</span>;
            })}
        </span>
    );
}

export default function FlashcardsView({ content, sources, onSourceClick }) {
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        const parsed = parseFlashcards(content);
        setCards(parsed);
        setCurrentIndex(0);
        setIsFlipped(false);
    }, [content]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (cards.length === 0) return;
            if (e.key === 'ArrowRight') {
                nextCard();
            } else if (e.key === 'ArrowLeft') {
                prevCard();
            } else if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                setIsFlipped(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cards.length, currentIndex]);

    if (cards.length === 0) {
        // Fallback if we couldn't parse flashcards format
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={content} />
            </div>
        );
    }

    const currentCard = cards[currentIndex];

    const nextCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => Math.min(prev + 1, cards.length - 1));
        }, 150);
    };

    const prevCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => Math.max(prev - 1, 0));
        }, 150);
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto py-8 px-4 h-full">
            {/* Flashcard Container */}
            <div className="relative w-full aspect-[4/3] max-h-[400px] mb-8"
                style={{ perspective: '1000px' }}>
                
                <div className="w-full h-full cursor-pointer relative"
                     onClick={() => setIsFlipped(!isFlipped)}
                     style={{ 
                        transformStyle: 'preserve-3d', 
                        transition: 'transform 0.5s',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                     }}>
                     
                    {/* Front (Question) */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl shadow-lg border p-8 flex flex-col justify-center items-center text-center overflow-y-auto"
                         style={{ 
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            background: 'var(--bg-secondary)', 
                            borderColor: 'var(--border-subtle)' 
                         }}>
                        <div className="text-xs font-semibold tracking-wider uppercase mb-6" style={{ color: 'var(--text-tertiary)' }}>
                            Question
                        </div>
                        <div className="text-lg sm:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>
                            <CitedText text={currentCard.q} onSourceClick={onSourceClick} />
                        </div>
                        <div className="absolute bottom-4 right-4 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            Click to flip
                        </div>
                    </div>

                    {/* Back (Answer) */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl shadow-xl border p-8 flex flex-col justify-center items-center text-center overflow-y-auto"
                         style={{ 
                            backfaceVisibility: 'hidden', 
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            background: 'var(--bg-primary)', 
                            borderColor: 'var(--accent-primary)',
                         }}>
                        <div className="text-xs font-semibold tracking-wider uppercase mb-6" style={{ color: 'var(--accent-primary)' }}>
                            Answer
                        </div>
                        <div className="text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>
                            <CitedText text={currentCard.a} onSourceClick={onSourceClick} />
                        </div>
                    </div>
                    
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between w-full max-w-md px-4">
                <button 
                    onClick={prevCard}
                    disabled={currentIndex === 0}
                    className="p-3 rounded-full border transition-all disabled:opacity-30 hover:bg-[var(--bg-tertiary)]"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                >
                    <ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                </button>

                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {currentIndex + 1} / {cards.length}
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="p-3 rounded-full border transition-all hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                        title="Flip Card"
                    >
                        <RotateCcw className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                    </button>
                    <button 
                        onClick={nextCard}
                        disabled={currentIndex === cards.length - 1}
                        className="p-3 rounded-full border transition-all disabled:opacity-30 hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                    >
                        <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                    </button>
                </div>
            </div>
            
            <div className="mt-6 text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                Use ← and → arrow keys to navigate. Spacebar to flip.
            </div>
        </div>
    );
}

