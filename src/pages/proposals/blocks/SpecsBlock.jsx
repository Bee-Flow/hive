import React from 'react';

/**
 * SpecsBlock — Key-value project specification card.
 * Shows client info, dates, amounts in a clean card layout with optional logo.
 */
export default function SpecsBlock({ block, onChange, logo }) {
    const specs = block.specs || [
        { key: 'Opdrachtgever', value: '' },
        { key: 'Opdrachtnemer', value: '' },
        { key: 'Datum offerte', value: new Date().toLocaleDateString('nl-NL') },
        { key: 'Projectduur', value: '' },
        { key: 'Totale investering', value: '' },
    ];

    const updateSpec = (index, field, value) => {
        const updated = [...specs];
        updated[index] = { ...updated[index], [field]: value };
        onChange({ ...block, specs: updated });
    };

    const addSpec = () => {
        onChange({ ...block, specs: [...specs, { key: 'Nieuw veld', value: '' }] });
    };

    const removeSpec = (index) => {
        const updated = specs.filter((_, i) => i !== index);
        onChange({ ...block, specs: updated });
    };

    return (
        <div className="proposal-block specs-block" style={{
            background: '#ffffff', borderRadius: '12px', padding: '32px 40px',
            border: '1px solid #e5e7eb', position: 'relative',
        }}>
            {/* Section title */}
            <div
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...block, heading: e.target.innerText })}
                style={{
                    fontSize: '18px', fontWeight: 700, color: '#111827',
                    marginBottom: '20px', outline: 'none',
                }}
            >
                {block.heading || 'Project specificaties'}
            </div>

            {/* Logo (optional) */}
            {logo && (
                <img src={logo} alt="Logo" style={{
                    position: 'absolute', top: '32px', right: '40px',
                    maxHeight: '60px', maxWidth: '100px', objectFit: 'contain',
                }} />
            )}

            {/* Key-value pairs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
                {specs.map((spec, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', group: 'true' }}>
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => updateSpec(i, 'key', e.target.innerText)}
                            style={{
                                fontSize: '13px', fontWeight: 600, color: '#6b7280',
                                minWidth: '140px', outline: 'none',
                            }}
                        >
                            {spec.key}:
                        </div>
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => updateSpec(i, 'value', e.target.innerText)}
                            style={{
                                fontSize: '14px', fontWeight: 500, color: '#111827',
                                flex: 1, outline: 'none',
                            }}
                        >
                            {spec.value || 'Klik om in te vullen'}
                        </div>
                        <button
                            onClick={() => removeSpec(i)}
                            style={{
                                opacity: 0, transition: 'opacity 0.15s', background: 'none',
                                border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px',
                                padding: '0 4px',
                            }}
                            className="spec-remove-btn"
                            title="Verwijder veld"
                        >×</button>
                    </div>
                ))}
            </div>

            <button
                onClick={addSpec}
                style={{
                    marginTop: '12px', fontSize: '12px', color: '#6366f1',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontWeight: 500, padding: '4px 0',
                }}
            >
                + Veld toevoegen
            </button>
        </div>
    );
}
