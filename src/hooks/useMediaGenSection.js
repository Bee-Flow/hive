import { useState, useEffect } from 'react';
import { mediaGenSettingsStore } from '../utils/mediaGenSettingsStore';

/**
 * Read one media-gen settings section from `mediaGenSettingsStore`, re-reading
 * when `isOpen` flips true (so an edit made elsewhere shows on reopen), and
 * persist edits. Returns `[settings, update(key, val)]`.
 *
 * Replaces the getSection + read-on-open useEffect + update triad that each
 * media settings panel re-implemented.
 */
export default function useMediaGenSection(section, isOpen) {
    const [settings, setSettings] = useState(() => mediaGenSettingsStore.getSection(section));

    useEffect(() => {
        if (isOpen) setSettings(mediaGenSettingsStore.getSection(section));
    }, [isOpen, section]);

    const update = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        mediaGenSettingsStore.saveSection(section, next);
    };

    return [settings, update];
}
