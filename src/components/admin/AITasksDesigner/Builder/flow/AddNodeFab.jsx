import React from 'react';
import { Plus } from 'lucide-react';

/**
 * Floating "+" button anchored bottom-right of the diagram column.
 * Opens the slide-in NodePalette in step-mode. Hidden while the panel
 * is open (it would just sit underneath the slide).
 */
export default function AddNodeFab({ onClick, disabled = false }) {
    return (
        <button
            type="button"
            data-node-fab
            onClick={onClick}
            disabled={disabled}
            title="Add step"
            aria-label="Add step"
            className={`absolute bottom-4 right-4 z-20 h-10 w-10 rounded-full
                bg-[var(--accent)] text-white shadow-lg flex items-center justify-center
                hover:opacity-90 transition-opacity
                ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
        >
            <Plus size={18} />
        </button>
    );
}
