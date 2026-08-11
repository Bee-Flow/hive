import React from 'react';

/**
 * Two-pane admin "hub" shell: a fixed 56px left rail of icon+label buttons and
 * a main panel. Extracted from AgentConfigHub / SecurityHub / ComponentsHub,
 * which each re-declared byte-identical rail markup.
 *
 * The caller owns section visibility/filtering, active resolution, navigation,
 * and the main-panel content (passed as `children`, typically switched on the
 * active id). `sections` are the already-filtered visible sections, each:
 *   { id, icon: LucideIcon, color: string, ...(labelKey|label) }
 *
 * Props:
 *   sections       already-filtered sections to render as rail buttons
 *   activeId       currently-active section id
 *   onSelect(id)   called when a rail button is clicked
 *   labelFor(sec)  the rail button's visible label
 *   titleFor(sec)  the button's title/tooltip (defaults to labelFor)
 *   truncateLabel  ellipsis-clamp the label to one line (default false)
 */
export default function HubScaffold({
    sections,
    activeId,
    onSelect,
    labelFor,
    titleFor,
    truncateLabel = false,
    children,
}) {
    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* ── Left rail ── */}
            <div style={{
                width: '56px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 0',
                background: 'var(--bg-secondary, #111)',
                borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                overflowY: 'auto',
            }}>
                {sections.map(sec => {
                    const Icon = sec.icon;
                    const isActive = activeId === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => onSelect(sec.id)}
                            title={titleFor ? titleFor(sec) : labelFor(sec)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '10px 4px',
                                margin: '0 4px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}
                        >
                            <Icon style={{
                                width: 20,
                                height: 20,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                transition: 'color 0.15s ease',
                            }} />
                            <span style={{
                                fontSize: '9px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center',
                                lineHeight: 1.1,
                                transition: 'color 0.15s ease',
                                ...(truncateLabel
                                    ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48px' }
                                    : null),
                            }}>
                                {labelFor(sec)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Main panel ── */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {children}
            </div>
        </div>
    );
}
