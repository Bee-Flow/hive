/**
 * SlideFilmstrip — Vertical thumbnail navigation for all slides in a deck.
 * Supports click-to-select, add-new, and delete.
 */

import React from 'react';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { SlideThumbnail } from './SlideCanvas';
import { getDefaultElements } from './SlideThemes';

export default function SlideFilmstrip({
    slides = [],
    activeSlideIndex = 0,
    theme = 'corporate',
    onSelectSlide,
    onAddSlide,
    onDeleteSlide,
    onDuplicateSlide,
    onReorderSlides,
}) {
    const handleAddSlide = () => {
        const newSlide = {
            id: crypto.randomUUID?.() || `slide-${Date.now()}`,
            layout: 'content',
            elements: getDefaultElements('content', theme),
            notes: '',
            background: null,
            transition: 'fade',
        };
        onAddSlide?.(newSlide, activeSlideIndex + 1);
    };

    return (
        <div className="slide-filmstrip" style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)',
            width: '160px', minWidth: '160px',
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                shrink: 0,
            }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Slides
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {slides.length}
                </span>
            </div>

            {/* Slide list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {slides.map((slide, idx) => (
                    <div key={slide.id} className="filmstrip-item group" style={{ position: 'relative' }}>
                        <SlideThumbnail
                            slide={slide}
                            theme={theme}
                            isActive={idx === activeSlideIndex}
                            onClick={() => onSelectSlide?.(idx)}
                            index={idx}
                        />
                        {/* Hover actions */}
                        <div className="filmstrip-actions" style={{
                            position: 'absolute', top: '4px', right: '4px',
                            display: 'flex', gap: '2px', opacity: 0,
                            transition: 'opacity 0.15s ease',
                        }}>
                            {onDuplicateSlide && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDuplicateSlide(idx); }}
                                    title="Duplicate slide"
                                    style={{
                                        width: '18px', height: '18px', borderRadius: '4px',
                                        background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', padding: 0,
                                    }}
                                >
                                    <Copy style={{ width: '10px', height: '10px' }} />
                                </button>
                            )}
                            {slides.length > 1 && onDeleteSlide && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteSlide(idx); }}
                                    title="Delete slide"
                                    style={{
                                        width: '18px', height: '18px', borderRadius: '4px',
                                        background: 'rgba(220,38,38,0.7)', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', padding: 0,
                                    }}
                                >
                                    <Trash2 style={{ width: '10px', height: '10px' }} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add slide button */}
            <div style={{ padding: '8px', borderTop: '1px solid var(--border-subtle)', shrink: 0 }}>
                <button
                    onClick={handleAddSlide}
                    style={{
                        width: '100%', padding: '8px', borderRadius: '8px',
                        border: '2px dashed var(--border-default)', background: 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '6px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    Add Slide
                </button>
            </div>

            <style>{`
                .filmstrip-item:hover .filmstrip-actions { opacity: 1 !important; }
            `}</style>
        </div>
    );
}
