/**
 * Which keyboard is the user actually looking at?
 *
 * Shortcut handlers accept metaKey || ctrlKey everywhere, so only the LABELS
 * need to differ: a Windows/Linux user has no ⌘ key and must read "Ctrl".
 * SSR-safe — with no navigator we assume the non-Mac label, which is the
 * majority case and never claims a key that does not exist.
 */

export function isMac() {
    if (typeof navigator === 'undefined' || !navigator) return false;
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
    return /mac/i.test(platform);
}

/** The modifier to print in a shortcut hint: '⌘' on macOS, 'Ctrl' elsewhere. */
export function modKeyLabel() {
    return isMac() ? '⌘' : 'Ctrl';
}
