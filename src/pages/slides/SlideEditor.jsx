/**
 * SlideEditor — Toolbar for slide editing actions.
 * Layout picker, add element, theme selector, and slide controls.
 */

import React, { useState } from 'react';
import {
    Layout, Type, Image, List, Code, Palette, ChevronDown,
    AlignLeft, AlignCenter, AlignRight, Bold, Italic,
    Minus, Plus, SlidersHorizontal
} from 'lucide-react';
import { THEMES, LAYOUTS, getDefaultElements } from './SlideThemes';

export default function SlideEditor({
    slide,
    theme = 'corporate',
    onUpdateSlide,
    onChangeTheme,
}) {
    const [showLayoutPicker, setShowLayoutPicker] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);

    if (!slide) return null;

    const handleLayoutChange = (layout) => {
        if (!onUpdateSlide) return;
        const elements = getDefaultElements(layout, theme);
        onUpdateSlide({ ...slide, layout, elements });
        setShowLayoutPicker(false);
    };

    const handleAddElement = (type) => {
        if (!onUpdateSlide) return;
        const themeObj = THEMES[theme] || THEMES.corporate;
        const id = crypto.randomUUID?.() || `el-${Date.now()}`;

        const defaultPositions = {
            heading: { x: 10, y: 10, width: 80, height: 12 },
            text: { x: 10, y: 30, width: 80, height: 40 },
            list: { x: 10, y: 30, width: 80, height: 50 },
            image: { x: 20, y: 20, width: 60, height: 60 },
            code: { x: 10, y: 25, width: 80, height: 55 },
        };

        const defaultContent = {
            heading: 'New Heading',
            text: 'New text block',
            list: '<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>',
            image: '',
            code: '// Code here',
        };

        const newElement = {
            id,
            type,
            content: defaultContent[type] || '',
            position: defaultPositions[type] || { x: 10, y: 10, width: 80, height: 30 },
            style: {
                fontSize: type === 'heading' ? '32px' : type === 'code' ? '14px' : '18px',
                fontWeight: type === 'heading' ? 'bold' : 'normal',
                color: themeObj.colors.text,
            },
        };

        onUpdateSlide({ ...slide, elements: [...(slide.elements || []), newElement] });
    };

    const currentLayout = LAYOUTS[slide.layout] || LAYOUTS.content;

    return (
        <div className="slide-editor-toolbar" style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
            flexWrap: 'wrap', minHeight: '44px',
        }}>
            {/* Layout picker */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => { setShowLayoutPicker(!showLayoutPicker); setShowThemePicker(false); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '6px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-primary)', cursor: 'pointer', fontSize: '12px',
                        color: 'var(--text-primary)', fontWeight: 500,
                    }}
                >
                    <Layout style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
                    {currentLayout.name}
                    <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                </button>

                {showLayoutPicker && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50,
                        background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
                        borderRadius: '10px', padding: '6px', minWidth: '200px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    }}>
                        {Object.entries(LAYOUTS).map(([key, layout]) => (
                            <button
                                key={key}
                                onClick={() => handleLayoutChange(key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                    padding: '8px 10px', borderRadius: '6px', border: 'none',
                                    background: slide.layout === key ? 'var(--bg-tertiary)' : 'transparent',
                                    cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)',
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: '16px' }}>{layout.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{layout.name}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{layout.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Separator */}
            <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 4px' }} />

            {/* Add element buttons */}
            <ToolbarButton icon={<Type style={{ width: '14px', height: '14px' }} />} label="Text" onClick={() => handleAddElement('text')} />
            <ToolbarButton icon={<Bold style={{ width: '14px', height: '14px' }} />} label="Heading" onClick={() => handleAddElement('heading')} />
            <ToolbarButton icon={<List style={{ width: '14px', height: '14px' }} />} label="List" onClick={() => handleAddElement('list')} />
            <ToolbarButton icon={<Image style={{ width: '14px', height: '14px' }} />} label="Image" onClick={() => handleAddElement('image')} />
            <ToolbarButton icon={<Code style={{ width: '14px', height: '14px' }} />} label="Code" onClick={() => handleAddElement('code')} />

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Theme picker */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => { setShowThemePicker(!showThemePicker); setShowLayoutPicker(false); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        borderRadius: '6px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-primary)', cursor: 'pointer', fontSize: '12px',
                        color: 'var(--text-primary)', fontWeight: 500,
                    }}
                >
                    <Palette style={{ width: '14px', height: '14px', color: 'var(--accent-primary)' }} />
                    {THEMES[theme]?.name || 'Corporate'}
                    <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                </button>

                {showThemePicker && (
                    <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 50,
                        background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
                        borderRadius: '10px', padding: '6px', minWidth: '180px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    }}>
                        {Object.entries(THEMES).map(([key, t]) => (
                            <button
                                key={key}
                                onClick={() => { onChangeTheme?.(key); setShowThemePicker(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                    padding: '8px 10px', borderRadius: '6px', border: 'none',
                                    background: theme === key ? 'var(--bg-tertiary)' : 'transparent',
                                    cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)',
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: '16px' }}>{t.icon}</span>
                                <span style={{ fontWeight: 500 }}>{t.name}</span>
                                {/* Theme color preview dots */}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.colors.primary }} />
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.colors.secondary || t.colors.accent }} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Close dropdowns on outside click */}
            {(showLayoutPicker || showThemePicker) && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => { setShowLayoutPicker(false); setShowThemePicker(false); }}
                />
            )}
        </div>
    );
}

function ToolbarButton({ icon, label, onClick, active = false }) {
    return (
        <button
            onClick={onClick}
            title={label}
            style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px',
                borderRadius: '6px', border: 'none',
                background: active ? 'var(--bg-tertiary)' : 'transparent',
                cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)',
                fontWeight: 500, transition: 'all 0.1s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
        >
            {icon}
            {label}
        </button>
    );
}
