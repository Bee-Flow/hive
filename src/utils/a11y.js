// Tiny accessibility helpers.
//
// Most of our role="button" elements are <div>s for layout reasons but
// still need keyboard activation. `keyboardClick` returns an onKeyDown
// handler that calls the given callback on Enter / Space (and prevents
// the space-scroll default).

/**
 * Build an onKeyDown handler that triggers `onActivate` on Enter or Space.
 * Returns null when `onActivate` is missing so the prop can be spread
 * unconditionally without binding a no-op listener.
 */
export function keyboardClick(onActivate) {
    if (typeof onActivate !== 'function') return undefined;
    return (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate(e);
        }
    };
}
