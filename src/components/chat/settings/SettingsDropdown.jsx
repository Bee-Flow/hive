// Compact labelled dropdown for the chat composer media-settings popovers.
// Replaces the near-identical local `Dropdown` / `DropdownSelect` components
// (trigger button + ChevronDown + absolutely-positioned option list with its
// own outside-click effect) that were copy-pasted into ElevenLabsSettings,
// VideoGenSettings and NanoBananaSettings. Only the accent colour differed
// between the copies — pass it via `accentColor`.
//
// Usage:
//   <SettingsDropdown label="Voice" options={TTS_VOICES}
//       value={voice} onChange={setVoice} accentColor="#EC4899" />
//
// `options` is an array of { label, value }; the selected option falls back
// to the first entry when `value` matches nothing.

import { Check, ChevronDown } from 'lucide-react';
import React, { useRef, useState } from 'react';
import useOutsideDismiss from '../../../hooks/useOutsideDismiss';

const SettingsDropdown = ({ label, options, value, onChange, accentColor = '#3B82F6' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = options.find(o => o.value === value) || options[0];

    useOutsideDismiss(ref, () => setOpen(false), { enabled: open });

    return (
        <div ref={ref} className="relative">
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
            <button onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-all"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                <span>{selected.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
            </button>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-[60] max-h-40 overflow-y-auto"
                     style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {options.map(opt => (
                        <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: value === opt.value ? accentColor : 'var(--text-secondary)' }}>
                            {value === opt.value
                                ? <Check className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
                                : <div className="w-3 h-3" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SettingsDropdown;
