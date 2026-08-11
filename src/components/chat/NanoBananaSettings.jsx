import { X } from 'lucide-react';
import React, { useState, useRef } from 'react';
import SettingsDropdown from './settings/SettingsDropdown';
import { TTS_MODELS, TTS_VOICES, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from '../../constants/elevenLabsOptions';
import useOutsideDismiss from '../../hooks/useOutsideDismiss';
import { mediaGenSettingsStore } from '../../utils/mediaGenSettingsStore';

const ACCENT = '#4285f4';

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

const TABS = [
    { id: 'image', label: 'Image', icon: '🖼️' },
    { id: 'elevenlabs', label: 'Music & TTS', icon: '🎵' },
    { id: 'sfx', label: 'SFX', icon: '🔊' },
];

// ─── Storage ────────────────────────────────────────────────────
// Kept as named exports for existing callers (e.g. the appearance studio's
// IconsEditor); both delegate to the shared media-gen settings store, which
// handles the legacy imageGenSettings migration/mirroring.
const loadSettings = mediaGenSettingsStore.getAll;
const saveSettings = mediaGenSettingsStore.saveAll;

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
            style={{ background: `linear-gradient(to right, ${ACCENT} ${((value ?? defaultVal) - min) / (max - min) * 100}%, var(--border-subtle) ${((value ?? defaultVal) - min) / (max - min) * 100}%)` }}
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
            style={{ background: value ? ACCENT : 'var(--border-subtle)' }}
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
                        color: value === opt.value ? ACCENT : 'var(--text-tertiary)',
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
            <SettingsDropdown label="Model" options={IMAGE_MODELS} value={s.model || 'gemini-3.1-flash-image-preview'} onChange={v => update('model', v)} accentColor={ACCENT} />
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
            <SettingsDropdown label="Voice" options={TTS_VOICES} value={s.ttsVoice || DEFAULT_TTS_VOICE} onChange={v => update('ttsVoice', v)} accentColor={ACCENT} />
            <SettingsDropdown label="TTS Model" options={TTS_MODELS} value={s.ttsModel || DEFAULT_TTS_MODEL} onChange={v => update('ttsModel', v)} accentColor={ACCENT} />
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

const NanoBananaSettings = ({ isOpen, onClose, settings, onSettingsChange }) => {
    const panelRef = useRef(null);
    const [activeTab, setActiveTab] = useState('image');

    // Close on outside click / Escape
    useOutsideDismiss(panelRef, onClose, { enabled: isOpen });

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
                            color: activeTab === tab.id ? ACCENT : 'var(--text-muted)',
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
