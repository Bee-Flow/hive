// Auto-sizing contract for the marketing card popup iframes — replaces
// the HEIGHT_SCRIPT constant + `reportHeight` postMessage listener that
// was open-coded in both Features.jsx and Security.jsx.
//
// The script below is prepended to every popup iframe's srcDoc. It
// reports the body's scroll height to the parent on load and on every
// resize, so the parent can grow the iframe to fit. Matches the
// documented contract used by the LiveComponent block, with a different
// message type so each block's listener only reacts to its own iframes.
//
// Usage:
//   const iframeRef = usePopupIframeHeight();
//   <iframe ref={iframeRef} srcDoc={HEIGHT_SCRIPT + userHtml} ... />

import { useEffect, useRef } from 'react';

export const HEIGHT_SCRIPT = `<script>
function reportHeight() {
  window.parent.postMessage(
    { type: "reportHeight", height: document.body.scrollHeight },
    "*"
  );
}
window.addEventListener("load", reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
</script>`;

// Listens for height reports from the popup iframe and grows it to
// match. Scoped to `type === 'reportHeight'` so unrelated postMessage
// chatter (cms-edit, lc-resize, etc.) is ignored. Returns the ref to
// attach to the iframe.
export default function usePopupIframeHeight() {
    const iframeRef = useRef(null);

    useEffect(() => {
        const handler = (event) => {
            if (event.data && event.data.type === 'reportHeight') {
                const iframe = iframeRef.current;
                if (iframe && typeof event.data.height === 'number') {
                    iframe.style.height = event.data.height + 'px';
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    return iframeRef;
}
