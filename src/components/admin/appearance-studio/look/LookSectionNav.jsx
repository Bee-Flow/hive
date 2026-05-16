import React from 'react';

/**
 * LookSectionNav — left-rail table of contents for the Look editor. Highlights
 * the section currently in view (set by parent via IntersectionObserver) and
 * smooth-scrolls to a section when clicked.
 *
 * Below 1100px the parent renders this horizontally; CSS handles the orientation
 * via the `orientation` prop.
 */
export default function LookSectionNav({
    sections,
    activeId,
    onJump,
    orientation = 'vertical',
}) {
    const isVertical = orientation === 'vertical';
    return (
        <nav
            aria-label="Look editor sections"
            className={
                'shrink-0 ' +
                (isVertical
                    ? 'w-44 sticky top-0 self-start max-h-screen overflow-y-auto p-4 border-r'
                    : 'w-full overflow-x-auto p-2 border-b flex')
            }
            style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-primary)',
            }}
        >
            <ul
                className={
                    isVertical
                        ? 'space-y-0.5'
                        : 'flex items-center gap-1 whitespace-nowrap'
                }
            >
                {sections.map((s) => {
                    const active = activeId === s.id;
                    return (
                        <li key={s.id}>
                            <button
                                type="button"
                                onClick={() => onJump(s.id)}
                                aria-current={active ? 'true' : undefined}
                                className={
                                    'block w-full text-left rounded-md transition-colors ' +
                                    (isVertical
                                        ? 'px-2.5 py-1.5 text-[13px]'
                                        : 'px-2.5 py-1 text-[12px] font-medium')
                                }
                                style={{
                                    background: active ? 'var(--bg-card-hover)' : 'transparent',
                                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    fontWeight: active ? 600 : 400,
                                    borderLeft: isVertical
                                        ? `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`
                                        : 'none',
                                }}
                            >
                                {s.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
