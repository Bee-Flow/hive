import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CaptureContext = createContext(null);

export function CaptureProvider({ children }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState(null); // null = choose tile screen; 'record' | 'upload' | 'bot'

    const openCapture = useCallback((initialMode = null) => {
        setMode(initialMode);
        setOpen(true);
    }, []);

    const closeCapture = useCallback(() => {
        setOpen(false);
    }, []);

    const value = useMemo(() => ({
        open,
        mode,
        setMode,
        openCapture,
        closeCapture,
    }), [open, mode, openCapture, closeCapture]);

    return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
    const ctx = useContext(CaptureContext);
    if (!ctx) {
        return {
            open: false,
            mode: null,
            setMode: () => {},
            openCapture: () => {},
            closeCapture: () => {},
        };
    }
    return ctx;
}
