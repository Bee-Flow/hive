import React from 'react';

/**
 * SignatureBlock — Two-column signature area for client and company.
 * Each column has editable name, place, and date fields.
 */
export default function SignatureBlock({ block, onChange }) {
    const left = block.left || { label: '', name: '', place: '', date: '' };
    const right = block.right || { label: '', name: '', place: '', date: '' };

    const updateSide = (side, field, value) => {
        const updated = { ...block };
        updated[side] = { ...block[side], [field]: value };
        onChange(updated);
    };

    const SignatureColumn = ({ side, data }) => (
        <div style={{
            flex: 1, background: '#f3f4f6', borderRadius: '10px',
            padding: '24px', minHeight: '140px',
        }}>
            {/* Company/Client label */}
            <div
                contentEditable
                suppressContentEditableWarning
                onBlur={e => updateSide(side, 'label', e.target.innerText)}
                style={{
                    fontSize: '14px', fontWeight: 700, color: '#111827',
                    marginBottom: '24px', outline: 'none',
                }}
            >
                {data.label || (side === 'left' ? 'Opdrachtgever' : 'Opdrachtnemer')}
            </div>

            {/* Fields */}
            {['name', 'place', 'date'].map(field => (
                <div key={field} style={{ marginBottom: '8px', display: 'flex', gap: '4px' }}>
                    <span style={{
                        fontSize: '12px', fontWeight: 600, color: '#6366f1',
                        minWidth: '50px', textTransform: 'capitalize',
                    }}>
                        {field === 'name' ? 'Naam' : field === 'place' ? 'Plaats' : 'Datum'}:
                    </span>
                    <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => updateSide(side, field, e.target.innerText)}
                        style={{
                            fontSize: '13px', color: '#374151', outline: 'none',
                            flex: 1, borderBottom: '1px solid #d1d5db',
                            paddingBottom: '2px', minHeight: '18px',
                        }}
                    >
                        {data[field] || ''}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="proposal-block signature-block" style={{
            background: '#ffffff', borderRadius: '12px', padding: '32px 40px',
            border: '1px solid #e5e7eb',
        }}>
            <div
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onChange({ ...block, heading: e.target.innerText })}
                style={{
                    fontSize: '18px', fontWeight: 700, color: '#111827',
                    marginBottom: '20px', outline: 'none',
                }}
            >
                {block.heading || 'Ondertekening'}
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
                <SignatureColumn side="left" data={left} />
                <SignatureColumn side="right" data={right} />
            </div>
        </div>
    );
}
