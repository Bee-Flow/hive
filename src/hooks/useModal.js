// Small open/close hook to replace the recurring
//   const [showXModal, setShowXModal] = useState(false);
// pattern that's open-coded ~12 times across the admin panels and chat
// pickers. Usage:
//
//   const modal = useModal();
//   <button onClick={modal.open}>Edit</button>
//   {modal.isOpen && <Dialog onClose={modal.close}>…</Dialog>}
//
// `toggle()` is provided for menus / drawers. Initial state can be set
// to keep parity with `useState(true)` call sites if needed.

import { useCallback, useState } from 'react';

export default function useModal(initial = false) {
    const [isOpen, setIsOpen] = useState(initial);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(v => !v), []);
    return { isOpen, open, close, toggle };
}
