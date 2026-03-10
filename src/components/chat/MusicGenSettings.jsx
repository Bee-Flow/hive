import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'nanoBananaSettings';

function getSettings() {
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        return s ? JSON.parse(s) : {};
    } catch { return {}; }
}

function saveSettings(section, data) {
    const all = getSettings();
    all[section] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all;
}

// ─── Reusable UI ────────────────────────────────────────────────

const Slider = ({ label, value, min, max, step, defaultVal, unit, onChange }) => {
    const v = value ?? defaultVal;
    const pct = ((v - min) / (max - min)) * 100;
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {v}{unit || ''}
                </span>
            </div>
            <input type="range" min={min} max={max} step={step} value={v} onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500"
                style={{ background: `linear-gradient(to right, #8B5CF6 ${pct}%, var(--border-subtle) ${pct}%)` }}
            />
            <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <span>{min}{unit || ''}</span><span>{max}{unit || ''}</span>
            </div>
        </div>
    );
};

const Toggle = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between py-0.5">
        <div>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            {desc && <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
        </div>
        <button onClick={() => onChange(!value)}
            className="w-8 h-[18px] rounded-full transition-all relative flex-shrink-0"
            style={{ background: value ? '#8B5CF6' : 'var(--border-subtle)' }}>
            <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm"
                 style={{ left: value ? '15px' : '2px' }} />
        </button>
    </div>
);

const Pill = ({ label, selected, onClick }) => (
    <button onClick={onClick}
        className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
        style={{
            background: selected ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-tertiary)',
            color: selected ? '#8B5CF6' : 'var(--text-tertiary)',
            border: `1px solid ${selected ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-subtle)'}`,
        }}>
        {label}
    </button>
);

// ─── Component ──────────────────────────────────────────────────

const MusicGenSettings = ({ isOpen, onClose, anchorRef }) => {
    const panelRef = useRef(null);
    const [settings, setSettings] = useState(() => getSettings().lyria || {});

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose, anchorRef]);

    // Re-read from localStorage when opening
    useEffect(() => {
        if (isOpen) setSettings(getSettings().lyria || {});
    }, [isOpen]);

    if (!isOpen) return null;

    const update = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        saveSettings('lyria', next);
    };

    return (
        <div ref={panelRef}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-base">🎹</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Google Music (Lyria)</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Instrumental music via Google Lyria. These defaults apply when generating music.
                </p>
                <Slider label="BPM" value={settings.bpm} min={60} max={200} step={1} defaultVal={90} onChange={v => update('bpm', v)} />
                <Slider label="Duration" value={settings.durationSeconds} min={5} max={30} step={1} defaultVal={10} unit="s" onChange={v => update('durationSeconds', v)} />
                <Slider label="Density" value={settings.density} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => update('density', v)} />
                <Slider label="Brightness" value={settings.brightness} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => update('brightness', v)} />
                <Slider label="Guidance" value={settings.guidance} min={0} max={6} step={0.1} defaultVal={4} onChange={v => update('guidance', v)} />

                <div>
                    <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Mode</label>
                    <div className="flex gap-1">
                        <Pill label="Quality" selected={(settings.mode || 'QUALITY') === 'QUALITY'} onClick={() => update('mode', 'QUALITY')} />
                        <Pill label="Diversity" selected={settings.mode === 'DIVERSITY'} onClick={() => update('mode', 'DIVERSITY')} />
                    </div>
                </div>

                <Toggle label="Mute Bass" value={!!settings.muteBass} onChange={v => update('muteBass', v)} />
                <Toggle label="Mute Drums" value={!!settings.muteDrums} onChange={v => update('muteDrums', v)} />
            </div>
        </div>
    );
};

export default MusicGenSettings;
