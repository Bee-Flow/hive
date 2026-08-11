import React from 'react';
import MediaSettingsPopover from './settings/MediaSettingsPopover';
import SettingsDropdown from './settings/SettingsDropdown';
import useMediaGenSection from '../../hooks/useMediaGenSection';

const ACCENT = '#3B82F6';

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
// Segmented, icon-above-label pill — distinct from the compact
// mediaControls Pill, so it stays local to this panel.

const Pill = ({ label, icon, selected, onClick }) => (
    <button onClick={onClick}
        className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
        style={{
            background: selected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
            color: selected ? ACCENT : 'var(--text-tertiary)',
            border: `1px solid ${selected ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-subtle)'}`,
        }}>
        {icon && <span className="text-xs">{icon}</span>}
        {label}
    </button>
);

// ─── Component ──────────────────────────────────────────────────

const VideoGenSettings = ({ isOpen, onClose }) => {
    const [settings, update] = useMediaGenSection('video', isOpen);

    return (
        <MediaSettingsPopover isOpen={isOpen} onClose={onClose} icon="🎬" title="Video Generation (Veo)" bodyClassName="p-4 space-y-3">
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Google Veo — AI video generation. Takes 1-3 minutes per clip.
            </p>

            <SettingsDropdown label="Model" options={VIDEO_MODELS} value={settings.model || 'veo-3.1-generate-preview'} onChange={v => update('model', v)} accentColor={ACCENT} />

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
        </MediaSettingsPopover>
    );
};

export default VideoGenSettings;
