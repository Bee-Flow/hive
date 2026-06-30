/**
 * ShareLinksMenu — read-only popover for non-owners to see and copy a
 * webpage's external share links (BFSF-188).
 *
 * The owner manages links via PublishMenu's extraSection; this is the
 * counterpart surface for org/group readers, mounting ExternalShareSection
 * with `readOnly` so no mutating controls render. Content mounts only while
 * open, keeping the API fetch lazy.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import ExternalShareSection from './ExternalShareSection';

export default function ShareLinksMenu({ webpageId, webpageName }) {
    const [open, setOpen] = useState(false);
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                title="Share links"
            >
                <Link2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 right-8 top-full mt-1 w-[380px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-xl overflow-hidden"
                >
                    <div className="px-4 py-3">
                        <div className="text-sm font-medium text-[var(--text-primary)]">Share links</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            External links the owner created for this page.
                        </div>
                    </div>
                    <ExternalShareSection webpageId={webpageId} webpageName={webpageName} readOnly />
                </div>
            )}
        </>
    );
}
