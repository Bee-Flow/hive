import { Loader2, AlertTriangle, RotateCw, LogIn } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewUrl } from './previewSurfaces';

const READY_TIMEOUT_MS = 8000;
const BROADCAST_DEBOUNCE_MS = 50;

/**
 * Same-origin iframe wrapper for one preview surface. Owns the initial URL
 * (theme encoded as ?t=), the ready handshake, the debounced postMessage
 * broadcaster, session-expired detection, and the loading/error overlays.
 *
 * Re-keyed on surface change so each surface gets a fresh mount — we don't
 * navigate within a single iframe to avoid leaking React state.
 */
export default function LookPreviewIframe({ surface, draftPayload, onReload }) {
    const iframeRef = useRef(null);
    const versionRef = useRef(0);
    const debounceRef = useRef(null);
    const readyTimerRef = useRef(null);
    const [status, setStatus] = useState('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const initialUrl = useMemo(
        () => buildPreviewUrl(surface, draftPayload),
        // Don't navigate the iframe on every slider drag — postMessage takes care
        // of live updates. Only rebuild the URL when surface or reload key change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [surface.id, reloadKey],
    );

    // Broadcaster: pipe every draft change into the iframe (debounced 50ms).
    useEffect(() => {
        if (status !== 'ready') return undefined;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const iframe = iframeRef.current;
            if (!iframe || !iframe.contentWindow) return;
            versionRef.current += 1;
            try {
                iframe.contentWindow.postMessage(
                    { type: 'beeflow:theme:apply', version: versionRef.current, theme: draftPayload },
                    window.location.origin,
                );
            } catch (e) {
                console.warn('[Look] postMessage failed:', e);
            }
        }, BROADCAST_DEBOUNCE_MS);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [draftPayload, status]);

    // Handshake + error listener.
    useEffect(() => {
        const onMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (data.type === 'beeflow:theme:ready') {
                setStatus('ready');
                if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
            } else if (data.type === 'beeflow:theme:error') {
                setErrorMsg(data.message || 'Preview reported an error');
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
         
    }, [reloadKey, surface.id]);

    useEffect(() => {
        setStatus('loading');
        setErrorMsg('');
        versionRef.current = 0;
        if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        readyTimerRef.current = setTimeout(
            () => setStatus((s) => (s === 'loading' ? 'timeout' : s)),
            READY_TIMEOUT_MS,
        );
        return () => { if (readyTimerRef.current) clearTimeout(readyTimerRef.current); };
    }, [reloadKey, surface.id]);

    // Same-origin: detect session expiry by reading the iframe's pathname.
    const handleLoad = () => {
        try {
            const path = iframeRef.current?.contentWindow?.location?.pathname || '';
            if (path.startsWith('/login')) setStatus('session-expired');
        } catch (_) { /* cross-origin — ignore */ }
    };

    const retry = () => {
        setReloadKey((k) => k + 1);
        onReload?.();
    };

    return (
        <div className="relative w-full h-full" style={{ background: 'var(--bg-secondary)' }}>
            <iframe
                key={`${surface.id}:${reloadKey}`}
                ref={iframeRef}
                src={initialUrl}
                title={`Preview: ${surface.label}`}
                onLoad={handleLoad}
                className="w-full h-full border-0"
                style={{ background: 'var(--bg-primary)' }}
            />

            {status === 'loading' && (
                <Overlay>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
                        Loading {surface.label.toLowerCase()} preview…
                    </p>
                </Overlay>
            )}

            {status === 'timeout' && (
                <Overlay>
                    <AlertTriangle className="w-7 h-7" style={{ color: 'var(--warning, #f59e0b)' }} />
                    <p className="text-sm mt-3 max-w-xs text-center" style={{ color: 'var(--text-primary)' }}>
                        Preview took longer than 8 seconds to load.
                    </p>
                    <RetryButton onClick={retry} />
                </Overlay>
            )}

            {status === 'session-expired' && (
                <Overlay>
                    <LogIn className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm mt-3 max-w-xs text-center" style={{ color: 'var(--text-primary)' }}>
                        Sign-in expired inside the preview. Sign back in and reload.
                    </p>
                    <RetryButton onClick={retry} />
                </Overlay>
            )}

            {errorMsg && status === 'ready' && (
                <div
                    className="absolute top-2 left-2 right-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger, #ef4444)' }}
                >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
        </div>
    );
}

function Overlay({ children }) {
    return (
        <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'var(--bg-primary)' }}
        >
            {children}
        </div>
    );
}

function RetryButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border inline-flex items-center gap-2"
            style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
            }}
        >
            <RotateCw className="w-4 h-4" /> Reload preview
        </button>
    );
}
