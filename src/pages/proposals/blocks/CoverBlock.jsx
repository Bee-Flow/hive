import React, { useRef } from 'react';

/**
 * CoverBlock — Dark gradient cover page for proposals.
 * Displays title, subtitle, and company logo on a dark background.
 */
export default function CoverBlock({ block, onChange, brandColors, logo }) {
    const colors = brandColors || { primary: '#1a1a2e', accent: '#6366f1' };

    const update = (field, value) => {
        onChange({ ...block, [field]: value });
    };

    return (
        <div
            className="proposal-block cover-block"
            style={{
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primary}ee 60%, ${colors.accent}44 100%)`,
                color: '#ffffff',
                padding: '64px 48px',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '280px',
            }}
        >
            {/* Decorative gradient overlay */}
            <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%',
                background: `linear-gradient(135deg, transparent 0%, ${colors.accent}15 100%)`,
                pointerEvents: 'none',
            }} />

            {/* Logo */}
            {logo && (
                <img
                    src={logo}
                    alt="Logo"
                    style={{
                        position: 'absolute', top: '32px', right: '40px',
                        maxHeight: '80px', maxWidth: '120px', objectFit: 'contain',
                    }}
                />
            )}

            <div style={{ position: 'relative', zIndex: 1, maxWidth: '70%' }}>
                {/* Label */}
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => update('label', e.target.innerText)}
                    style={{
                        fontSize: '14px', fontWeight: 500, opacity: 0.7,
                        marginBottom: '8px', outline: 'none', letterSpacing: '0.5px',
                    }}
                >
                    {block.label || 'Offerte:'}
                </div>

                {/* Title */}
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => update('title', e.target.innerText)}
                    style={{
                        fontSize: '32px', fontWeight: 700, lineHeight: 1.2,
                        marginBottom: '16px', outline: 'none',
                    }}
                >
                    {block.title || 'Projecttitel'}
                </div>

                {/* Subtitle */}
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => update('subtitle', e.target.innerText)}
                    style={{
                        fontSize: '15px', opacity: 0.8, lineHeight: 1.6,
                        outline: 'none', maxWidth: '500px',
                    }}
                >
                    {block.subtitle || 'Korte beschrijving van het project of de aanbieding.'}
                </div>
            </div>
        </div>
    );
}
