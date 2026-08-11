// Scoped-localStorage settings store for the media-generation popovers.
// Replaces the recurring
//   const STORAGE_KEY = 'nanoBananaSettings';
//   function getSettings() { return scopedStorage.getJSON(STORAGE_KEY, {}); }
//   function saveSettings(section, data) { ... }
// helper pair that was copy-pasted into ElevenLabsSettings, VideoGenSettings,
// MusicGenSettings and NanoBananaSettings. All four panels persist into the
// same 'nanoBananaSettings' blob, one section per panel ('image',
// 'elevenlabs', 'sfx', 'video', 'lyria') — use the shared
// `mediaGenSettingsStore` instance below so migration/mirroring stays
// consistent, or `createSettingsStore(key)` for a store on another key.

import scopedStorage from './scopedStorage';

/**
 * Build a sectioned settings store on top of a scopedStorage JSON key.
 *
 * @param {string} storageKey scopedStorage key holding the settings object
 * @param {object} [options]
 * @param {() => (object|null)} [options.migrate] called when the key is empty;
 *        may return an initial settings object recovered from a legacy key
 * @param {(settings: object) => void} [options.onSave] called after every
 *        persist — e.g. to mirror a section into a legacy key
 */
export function createSettingsStore(storageKey, { migrate, onSave } = {}) {
    const getAll = () => {
        const stored = scopedStorage.getJSON(storageKey, null);
        if (stored) return stored;
        return (migrate && migrate()) || {};
    };

    const saveAll = (settings) => {
        scopedStorage.setJSON(storageKey, settings);
        if (onSave) onSave(settings);
        return settings;
    };

    const getSection = (section) => getAll()[section] || {};

    const saveSection = (section, data) => saveAll({ ...getAll(), [section]: data });

    return { getAll, saveAll, getSection, saveSection };
}

// Shared store for the chat composer media popovers. The legacy
// 'imageGenSettings' key is migrated on first read and mirrored on save
// because the useChatEngine payload path still reads it directly.
export const mediaGenSettingsStore = createSettingsStore('nanoBananaSettings', {
    migrate: () => {
        const old = scopedStorage.getJSON('imageGenSettings', null);
        return old ? { image: old } : null;
    },
    onSave: (settings) => {
        if (settings.image) scopedStorage.setJSON('imageGenSettings', settings.image);
    },
});

export default mediaGenSettingsStore;
