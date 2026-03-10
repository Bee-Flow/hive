import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Check } from 'lucide-react';

const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1', icon: '⬛' },
    { label: '16:9', value: '16:9', icon: '🖥️' },
    { label: '9:16', value: '9:16', icon: '📱' },
    { label: '4:3', value: '4:3', icon: '🖼️' },
    { label: '3:4', value: '3:4', icon: '📋' },
];

const MODELS = [
    { label: 'Flash Image (Fast)', value: 'gemini-3.1-flash-image-preview' },
    { label: 'Pro Image (Quality)', value: 'gemini-3-pro-image-preview' },
];

const STORAGE_KEY = 'imageGenSettings';

function loadSettings() {
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        return s ? JSON.parse(s) : {};
    } catch { return {}; }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const ImageGenSettings = ({ isOpen, onClose, anchorRef, settings, onSettingsChange }) => {
    const panelRef = useRef(null);

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

    const currentAspect = settings.aspectRatio || '1:1';
    const currentModel = settings.model || 'gemini-3.1-flash-image-preview';

    return (
        <div
            ref={panelRef}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-lg">🍌</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Image Generation</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {/* Info */}
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Just ask the AI to generate an image in your message. It will automatically use these settings.
                </p>

                {/* Aspect Ratio */}
                <div>
                    <label className="block text-[11px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Default Aspect Ratio
                    </label>
                    <div className="flex gap-1">
                        {ASPECT_RATIOS.map(ar => (
                            <button
                                key={ar.value}
                                onClick={() => {
                                    const updated = { ...settings, aspectRatio: ar.value };
                                    onSettingsChange(updated);
                                    saveSettings(updated);
                                }}
                                className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                                style={{
                                    background: currentAspect === ar.value ? 'rgba(66, 133, 244, 0.15)' : 'var(--bg-tertiary)',
                                    color: currentAspect === ar.value ? '#4285f4' : 'var(--text-tertiary)',
                                    border: `1px solid ${currentAspect === ar.value ? 'rgba(66, 133, 244, 0.3)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                <span className="text-xs">{ar.icon}</span>
                                <span>{ar.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Model */}
                <div>
                    <label className="block text-[11px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Model
                    </label>
                    <div className="space-y-1">
                        {MODELS.map(m => (
                            <button
                                key={m.value}
                                onClick={() => {
                                    const updated = { ...settings, model: m.value };
                                    onSettingsChange(updated);
                                    saveSettings(updated);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
                                style={{
                                    background: currentModel === m.value ? 'rgba(66, 133, 244, 0.1)' : 'transparent',
                                    color: currentModel === m.value ? '#4285f4' : 'var(--text-secondary)',
                                    border: `1px solid ${currentModel === m.value ? 'rgba(66, 133, 244, 0.25)' : 'var(--border-subtle)'}`,
                                }}
                            >
                                {currentModel === m.value ? (
                                    <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }} />
                                )}
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export { loadSettings };
export default ImageGenSettings;
