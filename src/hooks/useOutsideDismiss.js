// Dismiss-on-outside-interaction hook — replaces the recurring
//   useEffect(() => { const onDown = (e) => {...}; const onKey = (e) => {...};
//   document.addEventListener('mousedown', onDown); ... }, [open])
// pattern that's open-coded across the chat settings popovers
// (ElevenLabs/VideoGen/NanoBanana/MusicGen), the sitemap editor's
// EdgePopover/SettingsFlyout, and several admin dropdowns.
//
// Usage:
//   const ref = useRef(null);
//   useOutsideDismiss(ref, () => setOpen(false), { enabled: open });
//   {open && <div ref={ref}>…</div>}
//
// The mousedown listener is attached on a deferred tick so the click that
// opened the panel never immediately dismisses it. Escape is handled too
// (disable with `escape: false`).

import { useEffect } from 'react';

export default function useOutsideDismiss(ref, onDismiss, { enabled = true, escape = true } = {}) {
    useEffect(() => {
        if (!enabled) return undefined;

        const onMouseDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onDismiss();
        };
        const onKeyDown = (e) => {
            if (escape && e.key === 'Escape') onDismiss();
        };

        // Defer so the opening click doesn't instantly close the panel.
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('keydown', onKeyDown);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
        // onDismiss is intentionally not a dep: callers pass inline closures;
        // re-subscribing per render would defeat the deferred attach.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, escape, ref]);
}
