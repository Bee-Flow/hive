import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import scopedStorage from '../../utils/scopedStorage';

const STORAGE_KEY = 'nanoBananaSettings';

function getSettings() {
    return scopedStorage.getJSON(STORAGE_KEY, {});
}

function saveSettings(section, data) {
    const all = getSettings();
    all[section] = data;
    scopedStorage.setJSON(STORAGE_KEY, all);
    return all;
}

// ─── Constants ──────────────────────────────────────────────────

const VIDEO_MODELS = [
    { label: 'Veo 3.1 (Quality)', value: 'veo-3.1-generate-preview' },
    { label: 'Veo 3.0 Fast (Speed)', value: 'veo-3.0-fast-generate-001' },
];

const ASPECT_RATIOS = [
    { label: '16:9', value: '16:9', icon: '🖥️' },
    { label: '9:16', value: '9:16', icon: '📱' },
];

const DURATIONS = [
    { label: '4s', value: 4 },
    { label: '6s', value: 6 },
    { label: '8s', value: 8 },
];

// ─── Reusable UI ────────────────────────────────────────────────

const Pill = ({ label, icon, selected, onClick }) => (
    <button onClick={onClick}
        className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
        style={{
            background: selected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
            color: selected ? '#3B82F6' : 'var(--text-tertiary)',
            border: `1px solid ${selected ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-subtle)'}`,
        }}>
        {icon && <span className="text-xs">{icon}</span>}
        {label}
    </button>
);

const Dropdown = ({ label, options, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = options.find(o => o.value === value) || options[0];

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

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
                            style={{ color: value === opt.value ? '#3B82F6' : 'var(--text-secondary)' }}>
                            {value === opt.value ? <Check className="w-3 h-3 text-blue-500 flex-shrink-0" /> : <div className="w-3 h-3" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Component ──────────────────────────────────────────────────

const VideoGenSettings = ({ isOpen, onClose, anchorRef }) => {
    const panelRef = useRef(null);
    const [settings, setSettings] = useState(() => getSettings().video || {});

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose, anchorRef]);

    useEffect(() => {
        if (isOpen) setSettings(getSettings().video || {});
    }, [isOpen]);

    if (!isOpen) return null;

    const update = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        saveSettings('video', next);
    };

    return (
        <div ref={panelRef}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-base">🎬</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Video Generation (Veo)</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Google Veo — AI video generation. Takes 1-3 minutes per clip.
                </p>

                <Dropdown label="Model" options={VIDEO_MODELS} value={settings.model || 'veo-3.1-generate-preview'} onChange={v => update('model', v)} />

                <div>
                    <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Aspect Ratio</label>
                    <div className="flex gap-1">
                        {ASPECT_RATIOS.map(ar => (
                            <Pill key={ar.value} label={ar.label} icon={ar.icon}
                                selected={(settings.aspectRatio || '16:9') === ar.value}
                                onClick={() => update('aspectRatio', ar.value)} />
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration</label>
                    <div className="flex gap-1">
                        {DURATIONS.map(d => (
                            <Pill key={d.value} label={d.label}
                                selected={(settings.duration || 8) === d.value}
                                onClick={() => update('duration', d.value)} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoGenSettings;
