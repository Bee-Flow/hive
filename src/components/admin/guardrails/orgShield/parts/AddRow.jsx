import { Plus } from 'lucide-react';
import React, { useId, useState } from 'react';

/**
 * Input + Add button + inline error, with Enter as a first-class submit.
 *
 * Shared by the two list editors because "type a value, press Enter, see why
 * it was refused" is the only thing they genuinely have in common — the lists
 * themselves are a table and a chip row, and forcing those into one component
 * with a `variant` flag would be worse than two small honest ones.
 *
 * `onAdd` returns an error string to refuse the value, or null/undefined to
 * accept it. Validation therefore lives with the list that knows the rules,
 * and this component never has to guess.
 */
export function AddRow({ onAdd, placeholder, addLabel, disabled = false, mono = false }) {
    const [value, setValue] = useState('');
    const [error, setError] = useState(null);
    const errorId = useId();

    const submit = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const err = onAdd(trimmed);
        if (err) { setError(err); return; }
        setValue('');
        setError(null);
    };

    return (
        <div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    disabled={disabled}
                    aria-label={placeholder}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={e => { setValue(e.target.value); if (error) setError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                    placeholder={placeholder}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm ${mono ? 'font-mono text-xs' : ''}`}
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
                <button
                    type="button"
                    onClick={submit}
                    disabled={disabled || !value.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    {addLabel}
                </button>
            </div>
            {error && (
                <p id={errorId} role="alert" className="text-[11px] mt-1.5" style={{ color: '#ef4444' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

export default AddRow;
