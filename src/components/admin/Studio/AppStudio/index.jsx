import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppList from './AppList';
import BuilderChatPane from './chat/BuilderChatPane';
import AppEditorShell from './editor/AppEditorShell';
import { studioAppsApi } from './studioAppsApi';
import toast from '../../../shared/Toast';

/**
 * App Studio — Studio section entry ("Apps" tab).
 *
 * No app open → the AppList gallery; an app open (deep link via initialAppId,
 * or a card click) → the fullscreen AppEditorShell. The section reports
 * fullscreen editing to the Studio shell through onEditingChange(bool) so the
 * tab bar hides while the editor is up (same contract as Agents/Routines),
 * and mirrors the webpages URL pattern via onNavigate('studio/apps/<id>' |
 * 'studio/apps').
 *
 * Opening always refetches the full row (getApp) so the editor receives one
 * consistent shape — the gallery rows are meta-only (no definition).
 */
export default function AppStudioSection({
    initialAppId = null,
    onNavigate = () => {},
    onEditingChange = () => {},
}) {
    const [openApp, setOpenApp] = useState(null);
    const [opening, setOpening] = useState(false);
    // A "Remix with AI" open carries a prompt to prefill the builder composer.
    const [initialPrompt, setInitialPrompt] = useState('');
    const didAutoOpen = useRef(false);

    // Refs for the callbacks so an unstable identity from the parent never
    // re-fires the reporting effect — same stabilisation as Studio/index.jsx
    // (the React #185 editing-loop fix).
    const onNavigateRef = useRef(onNavigate);
    useEffect(() => { onNavigateRef.current = onNavigate; });
    const onEditingChangeRef = useRef(onEditingChange);
    useEffect(() => { onEditingChangeRef.current = onEditingChange; });

    // Report fullscreen editing only when the boolean actually flips; reset
    // on unmount so a closed Studio never sticks in "editing".
    const editing = !!openApp;
    useEffect(() => {
        onEditingChangeRef.current?.(editing);
        return () => { if (editing) onEditingChangeRef.current?.(false); };
    }, [editing]);

    const openById = useCallback(async (id, { prompt = '' } = {}) => {
        setOpening(true);
        try {
            const res = await studioAppsApi.getApp(id);
            const app = res?.app;
            if (!app?.id) throw new Error('App not found');
            setInitialPrompt(prompt || '');
            setOpenApp(app);
            onNavigateRef.current?.(`studio/apps/${app.id}`);
        } catch (err) {
            toast.error(err?.status === 404
                ? 'This app is not available to you.'
                : (err?.message || 'Could not open the app.'));
        } finally {
            setOpening(false);
        }
    }, []);

    // Deep link: auto-open the app in the URL exactly once (mirrors the
    // didAutoSelect pattern in WebpagesPage).
    useEffect(() => {
        if (!initialAppId || didAutoOpen.current) return;
        didAutoOpen.current = true;
        openById(initialAppId);
    }, [initialAppId, openById]);

    const handleOpenFromList = useCallback((app, openOptions = {}) => {
        if (app?.id) openById(app.id, { prompt: openOptions?.remix ? openOptions.prompt : '' });
    }, [openById]);

    const handleClose = useCallback(() => {
        setOpenApp(null);
        onNavigateRef.current?.('studio/apps');
    }, []);

    // The editor reports metadata/publish changes (rename, publish state…);
    // keep the open row in sync so the shell chrome stays fresh.
    const handleAppUpdated = useCallback((app) => {
        if (!app?.id) return;
        setOpenApp((prev) => (prev && prev.id === app.id ? { ...prev, ...app } : prev));
    }, []);

    if (openApp) {
        return (
            <AppEditorShell
                app={openApp}
                onClose={handleClose}
                onAppUpdated={handleAppUpdated}
                chatSlot={<BuilderChatPane appId={openApp.id} initialPrompt={initialPrompt} />}
            />
        );
    }

    return (
        <div className="relative h-full">
            <AppList onOpen={handleOpenFromList} />
            {opening && (
                <div
                    className="absolute inset-0 z-10 flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--bg-primary) 70%, transparent)' }}
                    role="status"
                    aria-live="polite"
                >
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span className="sr-only">Opening…</span>
                </div>
            )}
        </div>
    );
}
