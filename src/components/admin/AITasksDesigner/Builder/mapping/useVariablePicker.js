import { useCallback, useState } from 'react';

/**
 * Lightweight controller for opening a portal-anchored VariablePicker
 * against a specific DOM element (typically the {} button on a binding
 * field). The anchor is captured at click-time, not tracked via ref, so
 * there's no stale-handle window when fields unmount.
 *
 * Returns:
 *   open          — boolean
 *   openPicker(el) — show the picker anchored to `el`
 *   closePicker() — hide it
 *   pickerProps   — spread onto <VariablePicker {...pickerProps} ... />
 */
export default function useVariablePicker() {
    const [anchor, setAnchor] = useState(null);
    const [open, setOpen] = useState(false);

    const openPicker = useCallback((el) => {
        setAnchor(el || null);
        setOpen(true);
    }, []);

    const closePicker = useCallback(() => {
        setOpen(false);
    }, []);

    return {
        open,
        openPicker,
        closePicker,
        pickerProps: { open, anchorEl: anchor, onClose: closePicker },
    };
}
