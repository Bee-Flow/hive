import React from 'react';

/**
 * RadiusChip — small visual preview of the global `--radius-scale` applied to
 * a base radius. The three chips next to the Radius slider give the admin an
 * at-a-glance idea of what their scale choice does at sm/md/lg sizes.
 */
export default function RadiusChip({ scale, base = 8, size = 28 }) {
    return (
        <div
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-default)',
                borderRadius: `${base * scale}px`,
            }}
        />
    );
}
