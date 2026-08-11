import React from 'react';
import { APP_DESIGN_PRESETS } from '../runtime/appDesignPresets';
import { FONT_STACKS } from '../runtime/appDesign';

/**
 * The one-click path to a designed app.
 *
 * Six cards, each a COMPLETE look (colour, corners, density, typeface,
 * surfaces, motion and navigation style). Clicking one materializes its values
 * into theme + design + nav in a single commit — presets are never stored as a
 * reference, so editing a preset later can't silently restyle an app somebody
 * already shipped.
 *
 * Each card previews what it does rather than naming it: the accent colour, a
 * surface chip carrying that preset's corner radius and depth, 'Aa' in the
 * preset's actual typeface, and a glyph for tabs vs sidebar.
 */

const RADIUS_PX = { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px' };
const SURFACE_SHADOW = {
    hairline: 'none',
    flat: 'none',
    soft: '0 1px 2px rgba(15,20,30,0.10), 0 2px 6px rgba(15,20,30,0.08)',
    elevated: '0 2px 6px rgba(15,20,30,0.12), 0 8px 20px rgba(15,20,30,0.10)',
};

function NavGlyph({ style }) {
    // Tabs: a bar across the top. Sidebar: a rail down the left.
    return (
        <span
            className="inline-flex h-4 w-5 overflow-hidden"
            style={{ border: '1px solid var(--border-default)', borderRadius: '3px' }}
            aria-hidden="true"
        >
            {style === 'sidebar' ? (
                <span className="h-full w-1.5" style={{ background: 'var(--text-muted)' }} />
            ) : (
                <span className="w-full h-1.5" style={{ background: 'var(--text-muted)' }} />
            )}
        </span>
    );
}

export default function DesignPresetGallery({ activePreset, onApply, disabled = false }) {
    return (
        <div className="grid grid-cols-2 gap-2" data-testid="design-preset-gallery">
            {APP_DESIGN_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => onApply(preset)}
                        disabled={disabled}
                        aria-pressed={isActive}
                        title={preset.description}
                        className="flex flex-col gap-1.5 border px-2.5 py-2 text-left transition-colors disabled:opacity-50"
                        style={{
                            borderColor: isActive ? 'var(--app-primary, #0F766E)' : 'var(--border-default)',
                            background: isActive ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                            borderRadius: '8px',
                        }}
                    >
                        <span className="flex items-center gap-1.5">
                            <span
                                className="h-4 w-4 shrink-0"
                                style={{ background: preset.theme.primary, borderRadius: RADIUS_PX[preset.theme.radius] || '8px' }}
                                aria-hidden="true"
                            />
                            <span
                                className="h-4 w-6 shrink-0"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: RADIUS_PX[preset.theme.radius] || '8px',
                                    boxShadow: SURFACE_SHADOW[preset.design.surface] || 'none',
                                    border: preset.design.surface === 'hairline' ? '1px solid var(--border-default)' : 'none',
                                }}
                                aria-hidden="true"
                            />
                            <span
                                className="text-xs shrink-0"
                                style={{ fontFamily: FONT_STACKS[preset.design.font] || undefined, color: 'var(--text-secondary)' }}
                                aria-hidden="true"
                            >
                                Aa
                            </span>
                            <NavGlyph style={preset.navStyle} />
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{preset.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
