import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';

/**
 * UserPicker — org-member <select> for the compliance forms (DPO, breach
 * recipients). Purely presentational: the caller fetches the directory
 * (GET /api/compliance/org-users) and handles the selection.
 *
 * Renders null when `users` is null or empty (endpoint failed, 403, or no
 * members) so the surrounding free-text inputs always remain the fallback —
 * an external DPO or a shared mailbox must stay possible.
 *
 * props:
 *   users         Array<{id, displayName, email, phone, orgRole}> | null
 *   mode          'single' | 'multi' — multi resets the select after each
 *                 pick (add-as-chip usage) and hides already-added emails
 *   label         already-translated label text
 *   placeholder   already-translated text for the disabled first option
 *   onSelect(u)   called with the full user object
 *   excludeEmails string[] — multi only; case-insensitive
 *   disabled      boolean
 */
export default function UserPicker({ users, mode = 'single', label, placeholder, onSelect, excludeEmails = [], disabled = false }) {
    const [value, setValue] = useState('');

    const visible = useMemo(() => {
        if (!Array.isArray(users)) return [];
        if (mode !== 'multi' || !excludeEmails.length) return users;
        const taken = new Set(excludeEmails.map(e => String(e).toLowerCase()));
        return users.filter(u => !taken.has(String(u.email).toLowerCase()));
    }, [users, mode, excludeEmails]);

    if (!visible.length) return null;

    const handleChange = (e) => {
        const id = e.target.value;
        const user = visible.find(u => u.id === id);
        if (!user) return;
        onSelect?.(user);
        setValue(mode === 'multi' ? '' : id);
    };

    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>
                <Users size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                {label}
            </span>
            <select value={value} onChange={handleChange} disabled={disabled} style={selectStyle}>
                <option value="" disabled>{placeholder}</option>
                {visible.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                ))}
            </select>
        </label>
    );
}

const labelStyle = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--text-muted, #888)',
};
const selectStyle = {
    background: 'var(--bg-card, #ffffff)',
    border: '1px solid var(--border-default, rgba(0,0,0,0.12))',
    borderRadius: 8, padding: '9px 12px', fontSize: 13,
    color: 'var(--text-primary, #0f172a)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
