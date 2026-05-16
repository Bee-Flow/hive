import React from 'react';
import { Check } from 'lucide-react';

/**
 * Six curated wallpaper presets shown as a grid of click-cards.
 *
 * All presets share a minimalist neutral aesthetic — near-white bases, low
 * saturation, blob alphas 0.18-0.55. Each tile previews its actual gradient
 * stack so admins can compare at a glance. CSS lives in index.css under
 * `[data-wallpaper="..."]` and these previews mirror those values exactly.
 *
 *   value     — currently-selected preset id (`mono|slate|sand|frost|sage|ash`)
 *   onChange  — (id) => void, called when a card is clicked
 *   disabled  — disables interaction during save
 */

const PRESETS = [
    {
        id: 'mono', label: 'Mono', hint: 'Minimalist neutral (default)',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(148,163,184,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(100,116,139,0.45), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(6,182,212,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(148,163,184,0.35), transparent 62%),
            linear-gradient(180deg, #fafafa, #f3f4f6)`,
    },
    {
        id: 'slate', label: 'Slate', hint: 'Cool blue-gray',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(148,163,184,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(100,116,139,0.42), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(59,130,246,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(148,163,184,0.32), transparent 62%),
            linear-gradient(180deg, #f8fafc, #e2e8f0)`,
    },
    {
        id: 'sand', label: 'Sand', hint: 'Warm beige',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(168,162,158,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(120,113,108,0.42), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(245,158,11,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(168,162,158,0.32), transparent 62%),
            linear-gradient(180deg, #fafaf9, #f5f5f4)`,
    },
    {
        id: 'frost', label: 'Frost', hint: 'Cool seafoam',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(148,163,184,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(94,234,212,0.40), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(20,184,166,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(148,163,184,0.32), transparent 62%),
            linear-gradient(180deg, #f0fdfa, #f1f5f9)`,
    },
    {
        id: 'sage', label: 'Sage', hint: 'Muted green-gray',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(156,163,175,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(132,169,140,0.42), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(16,185,129,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(156,163,175,0.32), transparent 62%),
            linear-gradient(180deg, #f7faf7, #f0f4f0)`,
    },
    {
        id: 'ash', label: 'Ash', hint: 'Darker neutral',
        bg: `
            radial-gradient(60% 50% at 18% 22%, rgba(107,114,128,0.55), transparent 62%),
            radial-gradient(55% 45% at 82% 18%, rgba(75,85,99,0.42), transparent 62%),
            radial-gradient(60% 55% at 25% 82%, rgba(100,116,139,0.18), transparent 65%),
            radial-gradient(50% 50% at 85% 78%, rgba(107,114,128,0.32), transparent 62%),
            linear-gradient(180deg, #e5e7eb, #d1d5db)`,
    },
];

export default function WallpaperPresets({ value, onChange, disabled = false }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESETS.map(p => {
                const active = value === p.id;
                return (
                    <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(p.id)}
                        className="text-left p-2 rounded-xl border transition-all"
                        style={{
                            borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                            background: active ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                            boxShadow: active ? 'var(--shadow-md)' : 'none',
                            opacity: disabled ? 0.6 : 1,
                            cursor: disabled ? 'wait' : 'pointer',
                        }}
                    >
                        <div
                            className="h-16 rounded-lg overflow-hidden border"
                            style={{
                                borderColor: 'var(--border-subtle)',
                                backgroundImage: p.bg,
                                backgroundSize: '140% 140%, 130% 130%, 150% 150%, 120% 120%, 100% 100%',
                                backgroundPosition: '0% 0%, 100% 0%, 0% 100%, 100% 100%, 0 0',
                            }}
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.label}</span>
                            {active && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--accent-primary)' }} />}
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.hint}</p>
                    </button>
                );
            })}
        </div>
    );
}

export const WALLPAPER_PRESET_IDS = PRESETS.map(p => p.id);
