import React, { useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import scopedStorage from '../utils/scopedStorage';

const EFFORT_OPTIONS = [
    { value: 'none', label: 'Off', desc: 'No extra thinking' },
    { value: 'low', label: 'Low', desc: 'Quick reasoning' },
    { value: 'medium', label: 'Medium', desc: 'Default — balanced' },
    { value: 'high', label: 'High', desc: 'Deeper, slower' },
    { value: 'xhigh', label: 'Extreme', desc: 'Claude Opus 4.7 only' },
];

const STORAGE_KEY = 'reasoningEffort';

/**
 * Composer-level thinking effort selector.
 *
 * Persists the user's choice in localStorage under `reasoningEffort`.
 * useChatEngine reads from the same key on send, so no prop wiring needed.
 *
 * @param {{ available?: boolean, modelId?: string, dropDirection?: 'up'|'down' }} props
 *   - `available`: parent decides whether the current model supports reasoning.
 *     When false, the selector is hidden (non-thinking model → nothing to adjust).
 *   - `modelId`: passed through to scope the "Extreme" option, which is only a real
 *     effort level on Claude Opus 4.7.
 */
function readStored() {
    const v = scopedStorage.getItem(STORAGE_KEY);
    return EFFORT_OPTIONS.find(o => o.value === v)?.value || 'medium';
}

export default function EffortSelector({ available = true, modelId = '', dropDirection = 'up' }) {
    const [value, setValue] = useState(readStored);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = (next) => {
        setValue(next);
        scopedStorage.setItem(STORAGE_KEY, next);
        setOpen(false);
    };

    if (!available) return null;

    const isOpus47 = /claude-opus-4-7/.test(modelId || '');
    const visibleOptions = isOpus47
        ? EFFORT_OPTIONS
        : EFFORT_OPTIONS.filter(o => o.value !== 'xhigh');
    const current = EFFORT_OPTIONS.find(o => o.value === value) || EFFORT_OPTIONS[2];

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} data-testid="effort-selector">
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 500, transition: 'all 0.15s',
                    whiteSpace: 'nowrap', height: '36px',
                }}
                title={`Thinking effort: ${current.label}`}
                aria-label="Thinking effort"
                aria-haspopup="listbox"
                aria-expanded={open}
                data-testid="effort-selector-trigger"
            >
                <Brain className="w-3.5 h-3.5" style={{ color: value === 'none' ? 'var(--text-tertiary)' : '#a855f7' }} />
                <span>{current.label}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div
                    role="listbox"
                    style={{
                        position: 'absolute',
                        ...(dropDirection === 'down'
                            ? { top: '100%', marginTop: '6px' }
                            : { bottom: '100%', marginBottom: '6px' }),
                        right: 0, minWidth: '240px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        overflow: 'hidden', zIndex: 100,
                    }}
                >
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Thinking effort
                    </div>
                    {visibleOptions.map(opt => (
                        <button
                            key={opt.value}
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => handleChange(opt.value)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', padding: '10px 12px',
                                background: opt.value === value ? 'var(--bg-tertiary)' : 'transparent',
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                color: 'var(--text-primary)', fontSize: '13px',
                            }}
                            onMouseEnter={(e) => { if (opt.value !== value) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={(e) => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div>
                                <div style={{ fontWeight: 500 }}>{opt.label}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    {opt.desc}
                                </div>
                            </div>
                            {opt.value === value && (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#a855f7' }}>
                                    <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
