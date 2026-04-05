import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * PricingTable — Interactive pricing table with auto-calculation.
 * Supports line items, subtotal, VAT, and total.
 */
export default function PricingTable({ block, onChange }) {
    const items = block.items || [
        { description: '', amount: 0 },
    ];
    const vatRate = block.vatRate ?? 21;
    const currency = block.currency || 'EUR';
    const currencySymbol = currency === 'EUR' ? '€' : currency;

    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    const updateItem = (index, field, value) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: field === 'amount' ? value : value };
        onChange({ ...block, items: updated });
    };

    const addItem = () => {
        onChange({ ...block, items: [...items, { description: '', amount: 0 }] });
    };

    const removeItem = (index) => {
        if (items.length <= 1) return;
        onChange({ ...block, items: items.filter((_, i) => i !== index) });
    };

    const formatAmount = (num) => {
        return `${currencySymbol} ${parseFloat(num || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="proposal-block pricing-block" style={{
            background: '#ffffff', borderRadius: '12px',
            border: '1px solid #e5e7eb', overflow: 'hidden',
        }}>
            {/* Heading */}
            <div style={{ padding: '24px 40px 0' }}>
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => onChange({ ...block, heading: e.target.innerText })}
                    style={{
                        fontSize: '22px', fontWeight: 700, color: '#111827',
                        marginBottom: '20px', outline: 'none',
                    }}
                >
                    {block.heading || 'Investering'}
                </div>
            </div>

            {/* Table */}
            <div style={{ padding: '0 40px 24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#1e1b4b', color: '#fff' }}>
                            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px 0 0 0' }}>
                                Omschrijving
                            </th>
                            <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '13px', fontWeight: 600, width: '140px', borderRadius: '0 8px 0 0' }}>
                                Bedrag
                            </th>
                            <th style={{ width: '36px', background: '#1e1b4b', borderRadius: '0 8px 0 0' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={e => updateItem(i, 'description', e.target.value)}
                                        placeholder="Omschrijving..."
                                        style={{
                                            width: '100%', border: 'none', background: 'transparent',
                                            fontSize: '14px', color: '#374151', outline: 'none',
                                        }}
                                    />
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    <input
                                        type="number"
                                        value={item.amount || ''}
                                        onChange={e => updateItem(i, 'amount', e.target.value)}
                                        placeholder="0.00"
                                        style={{
                                            width: '100%', border: 'none', background: 'transparent',
                                            fontSize: '14px', color: '#374151', outline: 'none',
                                            textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                        }}
                                    />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {items.length > 1 && (
                                        <button onClick={() => removeItem(i)} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#d1d5db', padding: '4px',
                                        }} title="Verwijder regel">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    {/* Totals */}
                    <tfoot>
                        <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                            <td style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>
                                Subtotaal
                            </td>
                            <td style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 600, color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {formatAmount(subtotal)}
                            </td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 16px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
                                BTW ({vatRate}%)
                            </td>
                            <td style={{ padding: '4px 16px', fontSize: '14px', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {formatAmount(vatAmount)}
                            </td>
                            <td></td>
                        </tr>
                        <tr style={{ background: '#1e1b4b' }}>
                            <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#fff', textAlign: 'right', borderRadius: '0 0 0 8px' }}>
                                Totaal
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '16px', fontWeight: 700, color: '#fff', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: '0 0 8px 0' }}>
                                {formatAmount(total)}
                            </td>
                            <td style={{ background: '#1e1b4b', borderRadius: '0 0 8px 0' }}></td>
                        </tr>
                    </tfoot>
                </table>

                {/* Add row button */}
                <button onClick={addItem} style={{
                    marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', color: '#6366f1', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px 0',
                }}>
                    <Plus size={14} /> Regel toevoegen
                </button>
            </div>
        </div>
    );
}
