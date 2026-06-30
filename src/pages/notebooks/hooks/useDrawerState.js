/**
 * useDrawerState — open/closed state for the workspace's left + right drawers,
 * persisted per surface variant in localStorage so the layout sticks across
 * reloads. Defaults: both open on first use.
 */
import { useState, useCallback } from 'react';

const key = (variant, k) => `bf.workspace.${variant}.${k}`;

function readBool(k, fallback) {
    try {
        const v = localStorage.getItem(k);
        return v == null ? fallback : v === '1';
    } catch { return fallback; }
}

function persist(k, v) {
    try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* ignore */ }
}

export default function useDrawerState(variant = 'notebook', { leftDefault = true, rightDefault = true } = {}) {
    const [leftOpen, setLeftState] = useState(() => readBool(key(variant, 'leftOpen'), leftDefault));
    const [rightOpen, setRightState] = useState(() => readBool(key(variant, 'rightOpen'), rightDefault));

    const setLeftOpen = useCallback((v) => setLeftState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        persist(key(variant, 'leftOpen'), next);
        return next;
    }), [variant]);

    const setRightOpen = useCallback((v) => setRightState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        persist(key(variant, 'rightOpen'), next);
        return next;
    }), [variant]);

    const toggleLeft = useCallback(() => setLeftOpen((p) => !p), [setLeftOpen]);
    const toggleRight = useCallback(() => setRightOpen((p) => !p), [setRightOpen]);

    return { leftOpen, rightOpen, setLeftOpen, setRightOpen, toggleLeft, toggleRight };
}
