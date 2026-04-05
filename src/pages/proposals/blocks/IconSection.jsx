import React, { useRef, useEffect } from 'react';

/**
 * IconSection — Two-column layout with icon/image left and rich text right.
 * Used for implementation steps, features, etc.
 */
export default function IconSection({ block, onChange }) {
    const bodyRef = useRef(null);

    useEffect(() => {
        if (bodyRef.current && !bodyRef.current.innerHTML) {
            bodyRef.current.innerHTML = block.body || '<p>Klik hier om tekst toe te voegen...</p>';
        }
    }, []);

    const iconOptions = ['📋', '⚙️', '🔧', '🚀', '📊', '🔒', '💡', '📁', '✅', '🎯', '📅', '🏗️'];
    const currentIcon = block.icon || '📋';

    return (
        <div className="proposal-block icon-section" style={{
            background: block.accent ? '#f9fafb' : '#ffffff',
            borderRadius: '12px', padding: '32px 40px',
            border: '1px solid #e5e7eb',
            display: 'flex', gap: '24px', alignItems: 'flex-start',
        }}>
            {/* Icon area */}
            <div style={{ position: 'relative' }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '12px',
                    background: '#f3f4f6', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '24px', cursor: 'pointer',
                    flexShrink: 0, border: '1px solid #e5e7eb',
                }} title="Klik om icoon te wijzigen">
                    <select
                        value={currentIcon}
                        onChange={e => onChange({ ...block, icon: e.target.value })}
                        style={{
                            position: 'absolute', opacity: 0, width: '100%', height: '100%',
                            cursor: 'pointer', top: 0, left: 0,
                        }}
                    >
                        {iconOptions.map(icon => (
                            <option key={icon} value={icon}>{icon}</option>
                        ))}
                    </select>
                    {currentIcon}
                </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => onChange({ ...block, heading: e.target.innerText })}
                    style={{
                        fontSize: '16px', fontWeight: 700, color: '#111827',
                        marginBottom: '8px', outline: 'none',
                    }}
                >
                    {block.heading || 'Sectie titel'}
                </div>

                <div
                    ref={bodyRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => {
                        if (bodyRef.current) onChange({ ...block, body: bodyRef.current.innerHTML });
                    }}
                    className="proposal-text-body"
                    style={{
                        fontSize: '14px', color: '#374151', lineHeight: 1.7,
                        outline: 'none', minHeight: '24px',
                    }}
                    dangerouslySetInnerHTML={{ __html: block.body || '<p>Klik hier om tekst toe te voegen...</p>' }}
                />
            </div>
        </div>
    );
}
