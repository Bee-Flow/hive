import React, { useEffect, useState } from 'react';
import scopedStorage from '../../../../utils/scopedStorage';
import PanelResizer from '../../../shared/PanelResizer';

const WIDE_QUERY = '(min-width: 1024px)';

// Local matchMedia hook — self-contained so the CMS doesn't import
// cross-feature hooks for one media query.
function useIsWide() {
    const get = () => (typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(WIDE_QUERY).matches
        : true);
    const [wide, setWide] = useState(get);
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia(WIDE_QUERY);
        const onChange = () => setWide(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return wide;
}

// Viewport width — feeds the stage min-width guarantee (see below).
function useViewportWidth() {
    const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1920));
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onResize = () => setW(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return w;
}

// Panel sizing (WS3-P5): navigator + inspector are user-resizable via
// PanelResizer; widths persist per-user through scopedStorage — same
// mechanism as the panel open/closed flags in ProductWebsitePanel.
const NAV_MIN = 220;
const NAV_MAX = 360;
const NAV_DEFAULT = 280;
const INSPECTOR_MIN = 300;
const INSPECTOR_MAX = 480;
const INSPECTOR_DEFAULT = 340;
const AI_WIDTH = 340;
// The stage never gets narrower than this while panels are static
// columns; below it the panels auto-demote to the overlay-drawer mode.
const MIN_STAGE_WIDTH = 480;

const NAV_WIDTH_KEY = 'cmsNavWidth';
const INSPECTOR_WIDTH_KEY = 'cmsInspectorWidth';

function clampWidth(w, min, max) {
    return Math.max(min, Math.min(max, Math.round(w)));
}

function initWidth(key, fallback, min, max) {
    const raw = parseInt(scopedStorage.getItem(key) || '', 10);
    return Number.isFinite(raw) ? clampWidth(raw, min, max) : fallback;
}

// Blocks pointer input over a panel while the AI assistant is editing.
function LockScrim() {
    return (
        <div className="absolute inset-0 z-20 bg-[var(--bg-primary)]/50 flex items-start justify-center pt-10 cursor-not-allowed">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] shadow">
                AI is editing — Stop to take over
            </span>
        </div>
    );
}

/**
 * Full-screen builder chassis:
 *
 *   [ TopBar                                                    ]
 *   [ aiDock | navigator |        stage         | inspector     ]
 *
 * ≥1024px: aiDock/navigator/inspector are static columns (collapsible);
 * navigator/inspector are RESIZABLE via 5px drag strips (widths persist
 * per user, clamped 220–360 / 300–480).
 * <1024px — or whenever the open panels would squeeze the stage under
 * 480px — they become overlay drawers with a backdrop; the STAGE always
 * stays center-stage and never collapses to a sliver (the old panel hid
 * the whole preview column below lg; later the 64px-stage bug did the
 * same in spirit).
 *
 * `locked` scrims the navigator + inspector while an AI turn runs (the
 * container also blocks every write path — the scrim is the visible half
 * of the stream lock).
 */
export default function CmsBuilderShell({
    topBar,
    navigator: navigatorPanel,
    stage,
    inspector,
    aiDock = null,
    navOpen,
    inspectorOpen,
    onCloseNav,
    onCloseInspector,
    onCloseAiDock,
    locked = false,
    dialogs = null,     // shared ConfirmDialog host etc.
}) {
    const rawWide = useIsWide();
    const viewportWidth = useViewportWidth();

    const [navWidth, setNavWidth] = useState(
        () => initWidth(NAV_WIDTH_KEY, NAV_DEFAULT, NAV_MIN, NAV_MAX));
    const [inspectorWidth, setInspectorWidth] = useState(
        () => initWidth(INSPECTOR_WIDTH_KEY, INSPECTOR_DEFAULT, INSPECTOR_MIN, INSPECTOR_MAX));

    // Stage min-width guarantee: when the static columns would leave the
    // stage under MIN_STAGE_WIDTH, fall back to the overlay-drawer markup
    // (same as <1024px) instead of letting the preview collapse.
    const chromeWidth =
        (aiDock ? AI_WIDTH : 0)
        + (navOpen ? navWidth : 0)
        + (inspectorOpen ? inspectorWidth : 0);
    const isWide = rawWide && (viewportWidth - chromeWidth >= MIN_STAGE_WIDTH);

    const showBackdrop = !isWide && (navOpen || inspectorOpen || !!aiDock);

    return (
        <div className="h-full flex flex-col min-h-0" style={{ background: 'var(--bg-primary)' }}>
            {topBar}
            <div className="flex-1 min-h-0 flex flex-row relative">
                {/* AI dock */}
                {aiDock && isWide && (
                    <div
                        className="shrink-0 h-full border-r border-[var(--border-subtle)] min-h-0"
                        style={{ width: AI_WIDTH }}
                    >
                        {aiDock}
                    </div>
                )}

                {/* Navigator */}
                {navOpen && isWide && (
                    <>
                        <div
                            className="relative shrink-0 h-full border-r border-[var(--border-subtle)] min-h-0"
                            style={{ width: navWidth }}
                        >
                            {navigatorPanel}
                            {locked && <LockScrim />}
                        </div>
                        <PanelResizer
                            width={navWidth}
                            min={NAV_MIN}
                            max={NAV_MAX}
                            defaultWidth={NAV_DEFAULT}
                            edge="start"
                            label="Resize pages & blocks panel"
                            onResize={setNavWidth}
                            onResizeEnd={(w) => scopedStorage.setItem(NAV_WIDTH_KEY, String(w))}
                        />
                    </>
                )}

                {/* Stage — always visible */}
                {stage}

                {/* Inspector */}
                {inspectorOpen && isWide && (
                    <>
                        <PanelResizer
                            width={inspectorWidth}
                            min={INSPECTOR_MIN}
                            max={INSPECTOR_MAX}
                            defaultWidth={INSPECTOR_DEFAULT}
                            edge="end"
                            label="Resize inspector panel"
                            onResize={setInspectorWidth}
                            onResizeEnd={(w) => scopedStorage.setItem(INSPECTOR_WIDTH_KEY, String(w))}
                        />
                        <div
                            className="relative shrink-0 h-full border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] min-h-0"
                            style={{ width: inspectorWidth }}
                        >
                            {inspector}
                            {locked && <LockScrim />}
                        </div>
                    </>
                )}

                {/* <lg (or cramped): drawers over the stage */}
                {showBackdrop && (
                    <div
                        className="absolute inset-0 z-30 bg-black/40"
                        onClick={() => { onCloseNav?.(); onCloseInspector?.(); onCloseAiDock?.(); }}
                    />
                )}
                {aiDock && !isWide && (
                    <div
                        className="absolute inset-y-0 left-0 z-40 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl min-h-0"
                        style={{ width: AI_WIDTH, maxWidth: '85vw' }}
                    >
                        {aiDock}
                    </div>
                )}
                {navOpen && !isWide && (
                    <div
                        className="absolute inset-y-0 left-0 z-40 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl min-h-0"
                        style={{ width: navWidth, maxWidth: '85vw' }}
                    >
                        {navigatorPanel}
                        {locked && <LockScrim />}
                    </div>
                )}
                {inspectorOpen && !isWide && (
                    <div
                        className="absolute inset-y-0 right-0 z-40 border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl min-h-0 overflow-hidden"
                        style={{ width: inspectorWidth, maxWidth: '85vw' }}
                    >
                        {inspector}
                        {locked && <LockScrim />}
                    </div>
                )}
            </div>
            {dialogs}
        </div>
    );
}
