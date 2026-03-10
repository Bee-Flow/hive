import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';

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

// ─── Constants ──────────────────────────────────────────────────

const TTS_MODELS = [
    { label: 'Flash v2.5 (Fast)', value: 'eleven_flash_v2_5' },
    { label: 'v3 (Highest Quality)', value: 'eleven_v3' },
    { label: 'Multilingual v2', value: 'eleven_multilingual_v2' },
];

const TTS_VOICES = [
    { label: 'George (Default)', value: 'JBFqnCBsd6RMkjVDRZzb' },
    { label: 'Rachel', value: '21m00Tcm4TlvDq8ikWAM' },
    { label: 'Drew', value: '29vD33N1CtxCmqQRPOHJ' },
    { label: 'Clyde', value: '2EiwWnXFnvU5JabPnv8n' },
    { label: 'Paul', value: '5Q0t7uMcjvnagumLfvZi' },
    { label: 'Domi', value: 'AZnzlk1XvdvUeBnXmlld' },
    { label: 'Bella', value: 'EXAVITQu4vr4xnSDxMaL' },
    { label: 'Antoni', value: 'ErXwobaYiN019PkySvjV' },
    { label: 'Elli', value: 'MF3mGyEYCl7XYWbV9V6O' },
    { label: 'Josh', value: 'TxGEqnHWrfWFTfGW9XjX' },
    { label: 'Arnold', value: 'VR6AewLTigWG4xSOukaG' },
    { label: 'Adam', value: 'pNInz6obpgDQGcFmaJgB' },
    { label: 'Sam', value: 'yoZ06aMxZJJ28mfd3POQ' },
];

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
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-pink-500"
                style={{ background: `linear-gradient(to right, #EC4899 ${pct}%, var(--border-subtle) ${pct}%)` }}
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
            style={{ background: value ? '#EC4899' : 'var(--border-subtle)' }}>
            <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm"
                 style={{ left: value ? '15px' : '2px' }} />
        </button>
    </div>
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
                            style={{ color: value === opt.value ? '#EC4899' : 'var(--text-secondary)' }}>
                            {value === opt.value ? <Check className="w-3 h-3 text-pink-500 flex-shrink-0" /> : <div className="w-3 h-3" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Component ──────────────────────────────────────────────────

const ElevenLabsSettings = ({ isOpen, onClose, anchorRef }) => {
    const panelRef = useRef(null);
    const [elSettings, setElSettings] = useState(() => getSettings().elevenlabs || {});
    const [sfxSettings, setSfxSettings] = useState(() => getSettings().sfx || {});

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
        if (isOpen) {
            const all = getSettings();
            setElSettings(all.elevenlabs || {});
            setSfxSettings(all.sfx || {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const updateEl = (key, val) => {
        const next = { ...elSettings, [key]: val };
        setElSettings(next);
        saveSettings('elevenlabs', next);
    };

    const updateSfx = (key, val) => {
        const next = { ...sfxSettings, [key]: val };
        setSfxSettings(next);
        saveSettings('sfx', next);
    };

    return (
        <div ref={panelRef}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-base">🎵</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>ElevenLabs</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

                {/* Music */}
                <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px]">🎤</span>
                    <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>MUSIC (WITH VOCALS)</span>
                </div>
                <Slider label="Song Duration" value={elSettings.musicDuration} min={3} max={120} step={1} defaultVal={30} unit="s" onChange={v => updateEl('musicDuration', v)} />
                <Toggle label="Force Instrumental" desc="Guarantee no vocals" value={!!elSettings.instrumental} onChange={v => updateEl('instrumental', v)} />

                {/* TTS */}
                <div className="flex items-center gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-[10px]">🗣️</span>
                    <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>TEXT-TO-SPEECH</span>
                </div>
                <Dropdown label="Voice" options={TTS_VOICES} value={elSettings.ttsVoice || 'JBFqnCBsd6RMkjVDRZzb'} onChange={v => updateEl('ttsVoice', v)} />
                <Dropdown label="Model" options={TTS_MODELS} value={elSettings.ttsModel || 'eleven_flash_v2_5'} onChange={v => updateEl('ttsModel', v)} />

                {/* SFX */}
                <div className="flex items-center gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-[10px]">🔊</span>
                    <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>SOUND EFFECTS</span>
                </div>
                <Slider label="Duration" value={sfxSettings.duration} min={0.5} max={30} step={0.5} defaultVal={5} unit="s" onChange={v => updateSfx('duration', v)} />
                <Slider label="Prompt Influence" value={sfxSettings.promptInfluence} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => updateSfx('promptInfluence', v)} />
            </div>
        </div>
    );
};

export default ElevenLabsSettings;
