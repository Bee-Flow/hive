import React, { useRef, useEffect } from 'react';

/**
 * TextSection — Rich content section with heading + body.
 * Uses contentEditable for inline editing. Supports optional accent background.
 */
export default function TextSection({ block, onChange }) {
    const bodyRef = useRef(null);
    const initialContent = useRef(block.body || '');

    // Only set innerHTML on mount, not on every render (prevents cursor jump)
    useEffect(() => {
        if (bodyRef.current && !bodyRef.current.innerHTML) {
            bodyRef.current.innerHTML = initialContent.current;
        }
    }, []);

    const handleBodyBlur = () => {
        if (bodyRef.current) {
            onChange({ ...block, body: bodyRef.current.innerHTML });
        }
    };

    const isAccent = block.accent;

    return (
        <div className="proposal-block text-section" style={{
            background: isAccent ? '#f9fafb' : '#ffffff',
            borderRadius: '12px', padding: '32px 40px',
            border: '1px solid #e5e7eb',
        }}>
            {/* Heading */}
            <div
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...block, heading: e.target.innerText })}
                style={{
                    fontSize: '22px', fontWeight: 700, color: '#111827',
                    marginBottom: '16px', outline: 'none', lineHeight: 1.3,
                }}
            >
                {block.heading || 'Sectie titel'}
            </div>

            {/* Body (rich HTML) */}
            <div
                ref={bodyRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={handleBodyBlur}
                className="proposal-text-body"
                style={{
                    fontSize: '14px', color: '#374151', lineHeight: 1.7,
                    outline: 'none', minHeight: '40px',
                }}
                dangerouslySetInnerHTML={{ __html: block.body || '<p>Klik hier om tekst toe te voegen...</p>' }}
            />
        </div>
    );
}
