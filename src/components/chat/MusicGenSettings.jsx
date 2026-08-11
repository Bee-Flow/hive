import React from 'react';
import MediaSettingsPopover from './settings/MediaSettingsPopover';
import { Slider, Toggle, PillSelect } from './settings/mediaControls';
import useMediaGenSection from '../../hooks/useMediaGenSection';

const ACCENT = '#8B5CF6';

const MusicGenSettings = ({ isOpen, onClose }) => {
    const [settings, update] = useMediaGenSection('lyria', isOpen);

    return (
        <MediaSettingsPopover
            isOpen={isOpen}
            onClose={onClose}
            icon="🎹"
            title="Google Music (Lyria)"
            bodyClassName="p-4 space-y-3 max-h-[360px] overflow-y-auto"
        >
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Instrumental music via Google Lyria. These defaults apply when generating music.
            </p>
            <Slider label="BPM" value={settings.bpm} min={60} max={200} step={1} defaultVal={90} onChange={v => update('bpm', v)} accent={ACCENT} />
            <Slider label="Duration" value={settings.durationSeconds} min={5} max={30} step={1} defaultVal={10} unit="s" onChange={v => update('durationSeconds', v)} accent={ACCENT} />
            <Slider label="Density" value={settings.density} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => update('density', v)} accent={ACCENT} />
            <Slider label="Brightness" value={settings.brightness} min={0} max={1} step={0.05} defaultVal={0.5} onChange={v => update('brightness', v)} accent={ACCENT} />
            <Slider label="Guidance" value={settings.guidance} min={0} max={6} step={0.1} defaultVal={4} onChange={v => update('guidance', v)} accent={ACCENT} />

            <PillSelect
                label="Mode"
                options={[{ value: 'QUALITY', label: 'Quality' }, { value: 'DIVERSITY', label: 'Diversity' }]}
                value={settings.mode || 'QUALITY'}
                onChange={v => update('mode', v)}
                accent={ACCENT}
            />

            <Toggle label="Mute Bass" value={!!settings.muteBass} onChange={v => update('muteBass', v)} accent={ACCENT} />
            <Toggle label="Mute Drums" value={!!settings.muteDrums} onChange={v => update('muteDrums', v)} accent={ACCENT} />
        </MediaSettingsPopover>
    );
};

export default MusicGenSettings;
