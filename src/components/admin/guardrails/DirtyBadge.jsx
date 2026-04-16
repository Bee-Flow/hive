/**
 * Small "Unsaved" pill used next to card titles to make dirty state obvious.
 */

import React from 'react';

export default function DirtyBadge({ show, label = 'Unsaved' }) {
    if (!show) return null;
    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
            style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04' }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ca8a04' }} />
            {label}
        </span>
    );
}
