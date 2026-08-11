import React, { useRef } from 'react';
import { X } from 'lucide-react';
import useOutsideDismiss from '../../../hooks/useOutsideDismiss';

/**
 * Popover shell for the chat-composer media-generation settings panels.
 * Owns the panel ref + outside-dismiss + the header (emoji + title + close);
 * the panel body is passed as children. Renders nothing when `isOpen` is false.
 *
 * Extracted from ElevenLabs/MusicGen/VideoGen/… which each re-declared the
 * identical `absolute bottom-full …` container + header markup.
 */
export default function MediaSettingsPopover({
    isOpen,
    onClose,
    icon,
    title,
    width = 'w-72',
    bodyClassName = 'p-4 space-y-3 max-h-[380px] overflow-y-auto',
    children,
}) {
    const panelRef = useRef(null);
    useOutsideDismiss(panelRef, onClose, { enabled: isOpen });
    if (!isOpen) return null;
    return (
        <div ref={panelRef}
            className={`absolute bottom-full mb-2 left-0 ${width} rounded-xl border shadow-2xl overflow-hidden z-50`}
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            {/* Body */}
            <div className={bodyClassName} style={{ scrollbarWidth: 'thin' }}>
                {children}
            </div>
        </div>
    );
}
