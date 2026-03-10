import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────
const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1', icon: '⬛' },
    { label: '16:9', value: '16:9', icon: '🖥️' },
    { label: '9:16', value: '9:16', icon: '📱' },
    { label: '4:3', value: '4:3', icon: '🖼️' },
    { label: '3:4', value: '3:4', icon: '📋' },
];

const IMAGE_MODELS = [
    { label: 'Flash Image (Fast)', value: 'gemini-3.1-flash-image-preview' },
    { label: 'Pro Image (Quality)', value: 'gemini-3-pro-image-preview' },
];

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

const TABS = [
    { id: 'image', label: 'Image', icon: '🖼️' },
    { id: 'elevenlabs', label: 'Music & TTS', icon: '🎵' },
    { id: 'sfx', label: 'SFX', icon: '🔊' },
];

// ─── Storage ────────────────────────────────────────────────────
const STORAGE_KEY = 'nanoBananaSettings';

function loadSettings() {
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) return JSON.parse(s);
        // Migrate from old imageGenSettings
        const old = localStorage.getItem('imageGenSettings');
        if (old) {
            const parsed = JSON.parse(old);
            return { image: parsed };
        }
        return {};
    } catch { return {}; }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Keep backward compat for imageGenSettings
    if (settings.image) {
        localStorage.setItem('imageGenSettings', JSON.stringify(settings.image));
    }
}

// ─── Reusable UI Components ─────────────────────────────────────

const SliderControl = ({ label, value, min, max, step, defaultVal, unit, onChange }) => (
    <div>
        <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {value ?? defaultVal}{unit || ''}
            </span>
        </div>
        <input
            type="range"
            min={min} max={max} step={step}
            value={value ?? defaultVal}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
            style={{ background: `linear-gradient(to right, #4285f4 ${((value ?? defaultVal) - min) / (max - min) * 100}%, var(--border-subtle) ${((value ?? defaultVal) - min) / (max - min) * 100}%)` }}
        />
        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span>{min}{unit || ''}</span>
            <span>{max}{unit || ''}</span>
        </div>
    </div>
);

const ToggleControl = ({ label, description, value, onChange }) => (
    <div className="flex items-center justify-between py-1">
        <div>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            {description && <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
        <button
            onClick={() => onChange(!value)}
            className="w-8 h-[18px] rounded-full transition-all relative flex-shrink-0"
            style={{ background: value ? '#4285f4' : 'var(--border-subtle)' }}
        >
            <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm"
                 style={{ left: value ? '15px' : '2px' }} />
        </button>
    </div>
);

const PillSelect = ({ label, options, value, onChange }) => (
    <div>
        <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        <div className="flex flex-wrap gap-1">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
                    style={{
                        background: value === opt.value ? 'rgba(66, 133, 244, 0.15)' : 'var(--bg-tertiary)',
                        color: value === opt.value ? '#4285f4' : 'var(--text-tertiary)',
                        border: `1px solid ${value === opt.value ? 'rgba(66, 133, 244, 0.3)' : 'var(--border-subtle)'}`,
                    }}
                >
                    {opt.icon && <span className="mr-1">{opt.icon}</span>}
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const DropdownSelect = ({ label, options, value, onChange }) => {
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
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-all"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
                <span>{selected.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
            </button>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-50 max-h-40 overflow-y-auto"
                     style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: value === opt.value ? '#4285f4' : 'var(--text-secondary)' }}
                        >
                            {value === opt.value ? <Check className="w-3 h-3 text-blue-500 flex-shrink-0" /> : <div className="w-3 h-3" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Tab Content Components ─────────────────────────────────────

const ImageTab = ({ settings, onUpdate }) => {
    const s = settings.image || {};
    const update = (key, val) => onUpdate({ image: { ...s, [key]: val } });

    return (
        <div className="space-y-3">
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Ask AI to generate an image. These settings apply automatically.
            </p>
            <PillSelect label="Aspect Ratio" options={ASPECT_RATIOS} value={s.aspectRatio || '1:1'} onChange={v => update('aspectRatio', v)} />
            <DropdownSelect label="Model" options={IMAGE_MODELS} value={s.model || 'gemini-3.1-flash-image-preview'} onChange={v => update('model', v)} />
        </div>
    );
};

const ElevenLabsTab = ({ settings, onUpdate }) => {
    const s = settings.elevenlabs || {};
    const update = (key, val) => onUpdate({ elevenlabs: { ...s, [key]: val } });

    return (
        <div className="space-y-3">
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                ElevenLabs — AI music (with or without vocals), text-to-speech, and sound effects.
            </p>

            {/* Music settings */}
            <div className="pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>🎵 MUSIC</span>
            </div>
            <SliderControl label="Song Duration" value={s.musicDuration} min={3} max={120} step={1} defaultVal={30} unit="s" onChange={v => update('musicDuration', v)} />
            <ToggleControl label="Force Instrumental" description="No vocals, instrumental only" value={!!s.instrumental} onChange={v => update('instrumental', v)} />

            {/* TTS settings */}
            <div className="pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>🗣️ TEXT-TO-SPEECH</span>
            </div>
            <DropdownSelect label="Voice" options={TTS_VOICES} value={s.ttsVoice || 'JBFqnCBsd6RMkjVDRZzb'} onChange={v => update('ttsVoice', v)} />
            <DropdownSelect label="TTS Model" options={TTS_MODELS} value={s.ttsModel || 'eleven_flash_v2_5'} onChange={v => update('ttsModel', v)} />
        </div>
    );
};

const SfxTab = ({ settings, onUpdate }) => {
    const s = settings.sfx || {};
    const update = (key, val) => onUpdate({ sfx: { ...s, [key]: val } });

    return (
        <div className="space-y-3">
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                ElevenLabs Sound Effects — ambient sounds, foley, cinematic effects.
            </p>
            <SliderControl label="Duration" value={s.duration} min={0.5} max={30} step={0.5} defaultVal={5} unit="s" onChange={v => update('duration', v)} />
            <SliderControl label="Prompt Influence" value={s.promptInfluence} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => update('promptInfluence', v)} />
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────

const NanoBananaSettings = ({ isOpen, onClose, anchorRef, settings, onSettingsChange }) => {
    const panelRef = useRef(null);
    const [activeTab, setActiveTab] = useState('image');

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    const handleUpdate = (partial) => {
        const updated = { ...settings, ...partial };
        onSettingsChange(updated);
        saveSettings(updated);
    };

    return (
        <div
            ref={panelRef}
            className="absolute bottom-full mb-2 left-0 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', width: '320px' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-base">🍌</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Nano Banana</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-all relative"
                        style={{
                            color: activeTab === tab.id ? '#4285f4' : 'var(--text-muted)',
                            background: activeTab === tab.id ? 'rgba(66,133,244,0.05)' : 'transparent',
                        }}
                    >
                        <span className="text-xs">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-blue-500" />
                        )}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="p-4 max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {activeTab === 'image' && <ImageTab settings={settings} onUpdate={handleUpdate} />}
                {activeTab === 'elevenlabs' && <ElevenLabsTab settings={settings} onUpdate={handleUpdate} />}
                {activeTab === 'sfx' && <SfxTab settings={settings} onUpdate={handleUpdate} />}
            </div>
        </div>
    );
};

export { loadSettings, saveSettings };
export default NanoBananaSettings;
