import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Sparkles, Eye, Palette, ChevronRight, FileText, Gem, BookOpen } from 'lucide-react';
import { useTheme, THEME_PRESETS } from '../ThemeContext';
import WallpaperPresets from './WallpaperPresets';
import { ACCENT_PRESETS } from '../admin/appearance-studio/look/sections/AccentSection';
import { toast } from '../shared/Toast';

/**
 * ThemeQuickPicker — sidebar entry point for end-user theme overrides.
 *
 * Two render modes (set by `variant`):
 *   - "icon":  collapsed-sidebar mode — single round button that opens the
 *              popover to the right.
 *   - "row":   expanded-sidebar mode — full-width clickable row meant for
 *              the profile dropdown.
 *
 * Both hide themselves entirely when the admin has set `allowUserOverride =
 * false` so members can't try and silently fail.
 */

const PRESET_META = {
    light: { label: 'Light', Icon: Sun },
    dark: { label: 'Dark', Icon: Moon },
    glass: { label: 'Glass', Icon: Sparkles },
    'glass-dark': { label: 'Glass Dark', Icon: Sparkles },
    paper: { label: 'Paper', Icon: FileText },
    obsidian: { label: 'Obsidian', Icon: Gem },
    sepia: { label: 'Sepia', Icon: BookOpen },
    'high-contrast': { label: 'High Contrast', Icon: Eye },
    custom: { label: 'Custom', Icon: Palette },
};

export default function ThemeQuickPicker({ variant = 'icon', onNavigate }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (theme.allowUserOverride === false) return null;

    const current = PRESET_META[theme.preset] || PRESET_META.light;
    const CurrentIcon = current.Icon;
    const isGlassPreset = theme.preset === 'glass' || theme.preset === 'glass-dark';

    const apply = async (patch, label) => {
        try {
            await theme.setUserOverride(patch);
            toast.success(`Switched to ${label}`);
        } catch (e) {
            toast.error(e?.message || 'Could not apply theme');
        }
    };

    const trigger =
        variant === 'icon' ? (
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="Change theme"
                title="Change theme"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
            >
                <CurrentIcon className="w-4 h-4" />
            </button>
        ) : (
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-primary)' }}
            >
                <CurrentIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span className="flex-1 min-w-0 truncate text-sm">Theme</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{current.label}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            </button>
        );

    return (
        <span className="relative inline-flex">
            {trigger}
            {open && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Theme picker"
                    data-surface="opaque"
                    className="absolute z-50 w-64 p-3 rounded-xl shadow-xl border"
                    style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-primary)',
                        // Position: icon mode opens to the right; row mode opens below.
                        ...(variant === 'icon'
                            ? { left: 'calc(100% + 8px)', bottom: 0 }
                            : { left: 0, top: 'calc(100% + 4px)' }),
                    }}
                >
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        Preset
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {THEME_PRESETS.filter((p) => p.id !== 'custom').map((p) => {
                            const meta = PRESET_META[p.id] || PRESET_META.light;
                            const Icon = meta.Icon;
                            const active = theme.preset === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => apply({ preset: p.id }, meta.label)}
                                    aria-pressed={active}
                                    className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg border transition-colors"
                                    style={{
                                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                        background: active ? 'var(--bg-card-hover)' : 'transparent',
                                        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    }}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-[10px] font-medium" style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                        {meta.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        Accent
                    </div>
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        {ACCENT_PRESETS.map((c) => {
                            const active = c.toLowerCase() === (theme.accent || '').toLowerCase();
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => apply({ accent: c }, c)}
                                    aria-pressed={active}
                                    aria-label={`Accent ${c}`}
                                    className="w-6 h-6 rounded-full border-2 transition-transform"
                                    style={{
                                        background: c,
                                        borderColor: active ? 'var(--text-primary)' : 'transparent',
                                        transform: active ? 'scale(1.12)' : 'scale(1)',
                                    }}
                                />
                            );
                        })}
                    </div>

                    {isGlassPreset && (
                        <>
                            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                Mood
                            </div>
                            <div className="mb-3">
                                <WallpaperPresets
                                    value={theme.wallpaperPreset || 'mono'}
                                    onChange={(id) => apply({ wallpaperPreset: id }, id)}
                                />
                            </div>
                        </>
                    )}

                    <div className="border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onNavigate?.('settings/appearance');
                            }}
                            className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-[var(--bg-tertiary)] inline-flex items-center justify-between"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span>More options</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                        {theme.source === 'user' && (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await theme.clearUserOverride();
                                        toast.success('Reverted to organisation default');
                                    } catch (e) {
                                        toast.error(e?.message || 'Could not reset');
                                    }
                                }}
                                className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Reset to organisation default
                            </button>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
}
