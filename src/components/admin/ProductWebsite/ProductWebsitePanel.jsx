import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';
import scopedStorage from '../../../utils/scopedStorage';
import { CreatePageContext } from './fields';
import { BLOCK_DEFAULTS, BLOCK_CATALOGUE } from './editors';
import { SaveTemplateDialog } from './PageList';
import { exportPage as exportPageToFile } from './pageIO';
import { ToastHost, showToast } from '../guardrails/Toast';
import SitemapView from './SitemapView';
import CmsAssistantPane from './assistant/CmsAssistantPane';
import { cmsApi } from './cmsApi';
import { setLocalePath, mergePreviewSite, mergePreviewPage } from './localeMerge';
import { buildPreviewContent, chromeStoragePath, applyChromeEdit } from './preview/previewContent';
import { coverageForLocale, detectArrayReorder, blockHasArrayOverrides } from './translatable';
import {
    SITE_VIRTUAL_ID, DESIGN_VIRTUAL_ID, HEADER_VIRTUAL_ID,
    COOKIE_VIRTUAL_ID, ANALYTICS_VIRTUAL_ID,
    isVirtualPageId, isChromeEntryId, normalizeVirtualId,
} from './sentinels';
import useDraftHistory from '../../../hooks/useDraftHistory';
import CmsBuilderShell from './shell/CmsBuilderShell';
import TopBar from './shell/TopBar';
import NavigatorPanel from './navigator/NavigatorPanel';
import InspectorHost from './inspector/InspectorHost';
import PreviewStage from './preview/PreviewStage';
import useConfirm from './dialogs/useConfirm';
import AddBlockDialog from './dialogs/AddBlockDialog';

const ACTIVE_SITE_LS_KEY = 'cms.activeSiteId';

/**
 * Product Website CMS — multi-site admin panel.
 *
 * Layout (three panes):
 *   LEFT-A  (180px)  Site switcher + page list — sorted, add/duplicate/
 *                    delete/set-homepage. Switching sites reloads the panel.
 *   LEFT-B  (300px)  Block list for active page + section settings below
 *   RIGHT            Live preview iframe (CMS preview route)
 *
 * Multi-site model:
 *   - GET /api/cms/sites lists every project on mount.
 *   - The active siteId is persisted to localStorage as cms.activeSiteId.
 *   - All editor traffic uses /api/cms/sites/:siteId/* (built via cmsApi.js).
 *   - Org-wide flags (enabled, default-locale, upload) stay at /api/cms/admin/*.
 *
 * Editing model:
 *   - Structural changes (page/block CRUD, reorder, content edits) flow through
 *     a debounced auto-save (~800ms) that PUTs the affected SiteDoc/PageDoc.
 *   - Inline text edits arrive as postMessages from the iframe
 *     (cms-edit { path, value }) and merge into block content.
 *   - Page meta changes (title, slug, hideHeader, hideFooter) round-trip
 *     immediately through PUT /pages/:id/meta so the site index stays in sync.
 *   - Site chrome (header/footer) is edited via a "Site" virtual page that
 *     appears at the top of the page list.
 *
 * postMessage protocol:
 *   ← cms-preview-ready
 *   ← cms-edit            { path, value, blockId? }
 *   ← cms-select          { blockId }
 *   ← cms-hotkey          { action: 'undo' | 'redo' }
 *   ← cms-block-action    { blockId, action: 'move-up' | 'move-down' |
 *                                       'duplicate' | 'delete' | 'settings' }
 *   ← cms-insert-at       { index }
 *   → cms-preview         { content, design, previewMode }
 *                                                content = { header, footer, blocks };
 *                                                design = site.design (colors/fonts/radius/theme);
 *                                                previewMode = 'page' | 'chrome'
 *   → cms-active          { blockId, locked, labels }   selection + AI stream
 *                                                lock mirror for the canvas
 *                                                chrome (posted separately from
 *                                                cms-preview so content re-posts
 *                                                never disturb inline-edit focus)
 *   → cms-scroll          { blockId }
 */

// Virtual page-list ids live in ./sentinels.js (legacy '__site__' aliases
// to the header entry; navigator shows Design/Header/Footer/Cookie banner).

// ── helpers ─────────────────────────────────────────────────────────

function newBlockId() {
    return `blk_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneBlock(block) {
    return { ...JSON.parse(JSON.stringify(block)), id: newBlockId() };
}

// Block-type → human label map for the canvas chrome. Built once from
// BLOCK_CATALOGUE and shipped inside the cms-active message, so the
// preview iframe (marketing bundle) never imports admin code for labels.
const BLOCK_LABELS = Object.fromEntries(
    Object.values(BLOCK_CATALOGUE).map(m => [m.type, m.label]));

// SaveBadge lives in ./shell/SaveBadge.jsx; the Content/Style sub-tabs in
// ./inspector/PageInspector.jsx.

// ── main component ───────────────────────────────────────────────────

// Props (both provided by AdminDashboard's full-bleed branch):
//   onExit()          — leave the builder, back to the admin dashboard
//   onNavigate(path)  — app-level navigation for cross-links
//                       (e.g. 'admin/languages', 'admin/website-analytics')
export default function ProductWebsitePanel({ onExit, onNavigate } = {}) {
    // ── multi-site state ─────────────────────────────────────────────
    const [sites, setSites]                   = useState([]);
    const [sitesLoaded, setSitesLoaded]       = useState(false);
    const [activeSiteId, setActiveSiteId]     = useState(null);

    // Mirror of activeSiteId for use inside callbacks that have stable
    // (empty) deps — keeps debounced saves pointing at the correct site
    // even mid-switch (the switcher's flush runs BEFORE we update the ref).
    const activeSiteIdRef = useRef(null);

    // ── server state ────────────────────────────────────────────────
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);
    // liveSiteId is the *globally* live project id (or null). The Live
    // toggle in the panel reflects whether this site === liveSiteId,
    // since at most one project can be live at a time.
    const [liveSiteId, setLiveSiteId]         = useState(null);
    const [defaultLocale, setDefaultLocale]   = useState('en');
    const [locales, setLocales]               = useState([{ code: 'en', name: 'English', isDefault: true }]);
    // Per-locale translation overrides, mirroring getAdminPayload's
    // `localeOverrides`. siteByLocale: { [locale]: siteOverride };
    // pagesByLocale: { [pageId]: { [locale]: pageOverride } }. Only populated
    // for non-default locales — the default locale lives in the base docs.
    const [localeOverrides, setLocaleOverrides] = useState({ siteByLocale: {}, pagesByLocale: {} });
    // AI auto-translate progress for the active page/site. null = idle.
    const [aiStatus, setAiStatus]             = useState(null);
    const [site, setSiteDoc]                  = useState(null);   // SiteDoc
    const [pages, setPages]                   = useState([]);     // [PageDoc]
    const [saveStatus, setSaveStatus]         = useState('idle');
    // ISO string of the last successful publish for the active site, or
    // null if it has never been published. Drives the "Publish" button
    // hint and the disabled state when there's nothing new to ship.
    const [publishedAt, setPublishedAt]       = useState(null);
    const [publishing, setPublishing]         = useState(false);

    // ── editor state ────────────────────────────────────────────────
    const [activeLocale, setActiveLocale]     = useState('en');
    const [activePageId, setActivePageId]     = useState(SITE_VIRTUAL_ID);
    const [activeBlockId, setActiveBlockId]   = useState(null);
    const [blockEditorTab, setBlockEditorTab] = useState('content'); // 'content' | 'style'
    const [rightView, setRightView]           = useState('preview'); // 'preview' | 'sitemap'
    // Add-block dialog request — null = closed. { index: null } comes from
    // the BlockList "+" (default insert-after-active); { index: n } comes
    // from a canvas insert-between "+" zone (cms-insert-at) and splices at
    // that explicit position.
    const [addBlockRequest, setAddBlockRequest] = useState(null);
    // Page templates — global list, summary shape (no blocks payload).
    // Loaded once on mount and refreshed after save/delete. `pendingTemplatePage`
    // holds the page whose context-menu opened the Save dialog (null = no
    // dialog open). The blocks for that page are read out of `pages` state
    // when the user confirms the save.
    const [templates, setTemplates]                       = useState([]);
    const [pendingTemplatePage, setPendingTemplatePage]   = useState(null);

    // ── shell state ─────────────────────────────────────────────────
    // One promise-based ConfirmDialog for every destructive action.
    const { confirm, confirmDialog } = useConfirm();
    // While focus mode is active the individual panel flags stay persisted
    // untouched — they double as the restore state after a reload — so the
    // initializers force the panels closed when the focus flag is set.
    const [navOpen, setNavOpen]             = useState(() =>
        scopedStorage.getItem('cmsFocusMode') !== '1' && scopedStorage.getItem('cmsNavOpen') !== '0');
    const [inspectorOpen, setInspectorOpen] = useState(() =>
        scopedStorage.getItem('cmsFocusMode') !== '1' && scopedStorage.getItem('cmsInspectorOpen') !== '0');
    const toggleNav = useCallback(() => setNavOpen(v => {
        scopedStorage.setItem('cmsNavOpen', v ? '0' : '1');
        return !v;
    }), []);
    const toggleInspector = useCallback(() => setInspectorOpen(v => {
        scopedStorage.setItem('cmsInspectorOpen', v ? '0' : '1');
        return !v;
    }), []);
    // Soft "draft differs from the published snapshot" heuristic — drives the
    // PublishMenu status pill. True after any successful draft write since the
    // last publish; seeded on load from updatedAt vs publishedAt. Copy in the
    // UI stays soft (no false precision).
    const [dirtySincePublish, setDirtySincePublish] = useState(false);
    // Preview device preset ('desktop' | 'tablet' | 'mobile') — a pure
    // max-width on the stage's iframe wrapper.
    const [device, setDevice] = useState(() => scopedStorage.getItem('cmsPreviewDevice') || 'desktop');
    const changeDevice = useCallback((key) => {
        scopedStorage.setItem('cmsPreviewDevice', key);
        setDevice(key);
    }, []);
    // AI-translate model tier (AiTranslateControl vocabulary: fast/thinking/
    // writer/pro — the same picker the Languages tab uses). Persisted per user.
    const [translateTier, setTranslateTier] = useState(() => scopedStorage.getItem('cmsTranslateTier') || 'fast');
    const changeTranslateTier = useCallback((t) => {
        scopedStorage.setItem('cmsTranslateTier', t);
        setTranslateTier(t);
    }, []);
    // D4 guard bookkeeping — warn once per block per session when a list is
    // reordered in the default locale while translations exist for it.
    const reorderWarnedRef = useRef(new Set());
    // ── AI assistant (builder) state ────────────────────────────────
    const [assistantOpen, setAssistantOpen] = useState(() =>
        scopedStorage.getItem('cmsFocusMode') !== '1' && scopedStorage.getItem('cmsAssistantOpen') === '1');
    const toggleAssistant = useCallback(() => setAssistantOpen(v => {
        scopedStorage.setItem('cmsAssistantOpen', v ? '0' : '1');
        return !v;
    }), []);
    // ── focus mode ──────────────────────────────────────────────────
    // One switch that collapses nav + inspector + AI dock at once and
    // restores the prior open-state on exit. Persisted via the same
    // scopedStorage mechanism as the individual panel flags (which are
    // left untouched while focused — see the initializers above).
    const [focusMode, setFocusMode] = useState(() => scopedStorage.getItem('cmsFocusMode') === '1');
    const focusRestoreRef = useRef(null);
    const toggleFocusMode = useCallback(() => {
        const entering = !focusMode;
        scopedStorage.setItem('cmsFocusMode', entering ? '1' : '0');
        if (entering) {
            focusRestoreRef.current = { nav: navOpen, inspector: inspectorOpen, assistant: assistantOpen };
            setNavOpen(false);
            setInspectorOpen(false);
            setAssistantOpen(false);
        } else {
            // Restore the pre-focus open-state; after a reload (ref empty)
            // fall back to the individually persisted panel flags.
            const r = focusRestoreRef.current || {
                nav: scopedStorage.getItem('cmsNavOpen') !== '0',
                inspector: scopedStorage.getItem('cmsInspectorOpen') !== '0',
                assistant: scopedStorage.getItem('cmsAssistantOpen') === '1',
            };
            focusRestoreRef.current = null;
            setNavOpen(r.nav);
            setInspectorOpen(r.inspector);
            setAssistantOpen(r.assistant);
        }
        setFocusMode(entering);
    }, [focusMode, navOpen, inspectorOpen, assistantOpen]);
    // Focus-mode hotkey '\' — skipped while typing (inputs, textareas,
    // selects, contentEditable) so backslashes can still be typed.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '\\' || e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            e.preventDefault();
            toggleFocusMode();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleFocusMode]);
    // Stream lock: while an AI turn runs, human writes are blocked so the
    // server-persisted drafts can't be clobbered (cmsStore has no CAS).
    const [builderRunning, setBuilderRunning] = useState(false);
    const builderRunningRef = useRef(false);
    // Per-turn bookkeeping for What-changed / Undo turn: pre-turn snapshot +
    // what the drafts touched. Armed until the next turn or human edit.
    const builderTurnRef = useRef(null); // { preSite, prePages, created:[], touched:Set, draftsSeen }
    const [builderUndoAvailable, setBuilderUndoAvailable] = useState(false);
    const builderUndoAvailableRef = useRef(false);
    const disarmBuilderUndo = useCallback(() => {
        if (builderUndoAvailableRef.current) {
            builderUndoAvailableRef.current = false;
            setBuilderUndoAvailable(false);
        }
    }, []);
    const AI_LOCK_MSG = 'The AI assistant is editing — press Stop in the assistant to take over.';

    // refs for debounced saves
    const iframeRef         = useRef(null);
    const previewReadyRef   = useRef(false);
    const saveTimerRef      = useRef(null);
    const saveStatusTimer   = useRef(null);
    const pendingSaves      = useRef({});   // { [pageId]: PageDoc | 'site' }
    // Tracks the most recent flushSaves() Promise so handlePublish can await
    // an in-flight save that was kicked off by the debounce timer firing
    // (the timer callback otherwise drops the Promise on the floor, which
    // lets a Publish click race the network round-trip).
    const inFlightSaveRef   = useRef(null);
    // True while an AI translate POST is in flight — gates manual translation
    // writes so they can't be clobbered by the returned whole-override.
    const aiRunningRef      = useRef(false);
    // Holds the batch from the most recent failed flushSaves() so the user
    // can retry without losing their edits. Cleared when a flush succeeds.
    const failedSavesRef    = useRef(null);
    // Live mirror of localeOverrides so the override mutators can read the
    // latest value synchronously between rapid edits (typing in the list)
    // without stale-closure races.
    const localeOverridesRef = useRef({ siteByLocale: {}, pagesByLocale: {} });

    // ── derived ─────────────────────────────────────────────────────

    // Merge the PageDoc with its matching site.pages[i] index entry so the
    // PageMetaStrip can read isHomepage/hideHeader/hideFooter/isNotFound/
    // noAnalytics (which live on the index, not the PageDoc). Every
    // index-only field MUST be listed here — the PageDoc sanitizer strips
    // them, so an omitted field reads as undefined forever and its toggle
    // can never be switched back off.
    const activePage = useMemo(() => {
        if (isVirtualPageId(activePageId)) return null;
        const doc = pages.find(p => p.id === activePageId);
        if (!doc) return null;
        const idx = (site?.pages || []).find(p => p.id === activePageId);
        return idx
            ? { ...doc, isHomepage: !!idx.isHomepage,
                hideHeader: !!idx.hideHeader,
                hideFooter: !!idx.hideFooter,
                isNotFound: !!idx.isNotFound,
                noAnalytics: !!idx.noAnalytics }
            : doc;
    }, [pages, activePageId, site]);

    const activeBlock = useMemo(() => {
        if (!activePage || !activeBlockId) return null;
        return activePage.blocks?.find(b => b.id === activeBlockId) || null;
    }, [activePage, activeBlockId]);

    // ── translation mode ────────────────────────────────────────────
    // Editing any non-default locale switches the panel into "translation
    // mode": structure is authored in the default locale, so here we edit
    // TEXT ONLY and write into sparse per-locale overrides.
    const translationMode = activeLocale !== defaultLocale;
    const activeSiteOverride = useMemo(
        () => localeOverrides.siteByLocale?.[activeLocale] || null,
        [localeOverrides, activeLocale]);
    const activePageOverride = useMemo(
        () => (activePage ? localeOverrides.pagesByLocale?.[activePage.id]?.[activeLocale] : null) || null,
        [localeOverrides, activePage, activeLocale]);

    // Public page index — passed to LinkField pickers
    const pageIndex = useMemo(() =>
        (site?.pages || []).map(p => ({ id: p.id, slug: p.slug, title: p.title, isHomepage: p.isHomepage })),
        [site]
    );

    // What page does the iframe preview render?
    //   - editing a real page → that page
    //   - editing a virtual entry (Design / Site chrome) → fall back to the
    //     homepage so the user can see chrome and design changes against
    //     real block content (otherwise the preview is just header+footer).
    const previewPage = useMemo(() => {
        if (activePage) return activePage;
        const homePageId = site?.homepageId || (site?.pages || [])[0]?.id;
        if (!homePageId) return null;
        return pages.find(p => p.id === homePageId) || null;
    }, [activePage, pages, site]);

    // ── load sites list + pick the active site ────────────────────────
    //
    // On mount: GET /api/cms/sites → state list. Pick last-used (from
    // localStorage) if it still exists, else the first site, else null.
    // Effect B below then loads that site's full editor payload.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(cmsApi.listSites());
                if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
                const data = await res.json();
                if (cancelled) return;
                const list = Array.isArray(data.sites) ? data.sites : [];
                setSites(list);
                setLiveSiteId(data.liveSiteId || null);
                const remembered = (() => {
                    try { return localStorage.getItem(ACTIVE_SITE_LS_KEY); } catch { return null; }
                })();
                const initial = (remembered && list.find(s => s.id === remembered))
                    ? remembered
                    : (list[0]?.id || null);
                activeSiteIdRef.current = initial;
                setActiveSiteId(initial);
                if (!initial) setLoading(false);  // empty state — no payload to fetch
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            } finally {
                if (!cancelled) setSitesLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── load the active site's editor payload ─────────────────────────
    //
    // Fires whenever activeSiteId changes (initial pick or site switch).
    // Resets all per-site state, then fetches GET /api/cms/sites/:siteId.
    useEffect(() => {
        if (!activeSiteId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        // Clean local state so the editor never shows stale content from
        // the previous site mid-fetch.
        setSiteDoc(null);
        setPages([]);
        setActivePageId(HEADER_VIRTUAL_ID);
        setActiveBlockId(null);
        setSaveStatus('idle');
        setPublishedAt(null);
        pendingSaves.current = {};
        (async () => {
            try {
                const res = await authFetch(cmsApi.site(activeSiteId));
                if (!res.ok) throw new Error(`Failed to load site (${res.status})`);
                const data = await res.json();
                if (cancelled) return;
                // Server includes liveSiteId on the site payload — refresh
                // it here in case another tab toggled live in the meantime.
                if (data.liveSiteId !== undefined) setLiveSiteId(data.liveSiteId || null);
                setDefaultLocale(data.defaultLocale || 'en');
                setLocales(data.locales || [{ code: 'en', name: 'English', isDefault: true }]);
                setSiteDoc(data.site || null);
                setPages(data.pages || []);
                setLocaleOverrides(data.localeOverrides || { siteByLocale: {}, pagesByLocale: {} });
                setPublishedAt(data.publishedAt || null);
                // Seed the soft dirty-since-publish heuristic from the site
                // list's updatedAt (best effort — sites was set just before
                // activeSiteId, so the closure list is current).
                const listEntry = sites.find(s => s.id === activeSiteId);
                setDirtySincePublish(!!(
                    data.publishedAt
                    && listEntry?.updatedAt
                    && Date.parse(listEntry.updatedAt) > Date.parse(data.publishedAt)
                ));
                setActiveLocale(data.defaultLocale || 'en');
                historyResetRef.current();
                const firstPageId = data.site?.pages?.[0]?.id;
                setActivePageId(firstPageId || HEADER_VIRTUAL_ID);
                if (firstPageId && data.pages?.length) {
                    setActiveBlockId(data.pages[0]?.blocks?.[0]?.id || null);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [activeSiteId]);

    // ── auto-save (debounced) ────────────────────────────────────────

    const scheduleSave = useCallback((key, payload) => {
        if (builderRunningRef.current) {
            // Stream lock: a human write raced the AI turn past the UI locks.
            // Dropping it is deliberate — the next draft event would overwrite
            // it anyway; the toast tells the user why nothing stuck.
            console.warn('[cms] edit dropped — AI turn in progress', key);
            showToast('error', 'The AI assistant is editing — press Stop in the assistant to take over.');
            return;
        }
        pendingSaves.current[key] = payload;
        setSaveStatus('dirty');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            // Track the Promise so handlePublish can await it. Without this
            // ref, an in-flight save races the publish POST: the publish
            // reads the DB before the PUT lands, and the snapshot misses
            // the latest edits.
            inFlightSaveRef.current = flushSaves();
        }, 800);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const flushSaves = useCallback(async () => {
        // Read from the ref so debounced timers always target whichever
        // site was active when scheduleSave queued the work — switching
        // sites flushes pending saves BEFORE updating the ref, so the
        // edits land on the correct site even mid-switch.
        const siteId = activeSiteIdRef.current;
        // Merge any prior failed batch back in so a retry includes
        // everything the user thought they saved. Newer edits in
        // pendingSaves win on key collisions.
        const batch = { ...(failedSavesRef.current || {}), ...pendingSaves.current };
        if (!siteId || Object.keys(batch).length === 0) {
            inFlightSaveRef.current = null;
            return true; // nothing to save == success (callers gate publish on this)
        }
        pendingSaves.current = {};
        failedSavesRef.current = null;
        setSaveStatus('saving');
        try {
            const tasks = Object.entries(batch).map(([key, payload]) => {
                // Per-locale translation overrides — namespaced keys so they
                // ride the same debounce/retry machinery as base saves without
                // colliding (real keys are 'site' or a pg_… id, never 'locale:').
                if (key.startsWith('locale:site:')) {
                    const locale = key.slice('locale:site:'.length);
                    return authFetch(cmsApi.siteLocaleOverride(siteId, locale), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ override: payload }),
                    });
                }
                if (key.startsWith('locale:page:')) {
                    const rest = key.slice('locale:page:'.length);
                    const at = rest.lastIndexOf(':');       // pageId may contain no ':'
                    const pageId = rest.slice(0, at);
                    const locale = rest.slice(at + 1);
                    return authFetch(cmsApi.pageLocaleOverride(siteId, pageId, locale), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ override: payload }),
                    });
                }
                if (key === 'site') {
                    return authFetch(cmsApi.site(siteId), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site: payload }),
                    });
                }
                return authFetch(cmsApi.page(siteId, key), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ page: payload }),
                });
            });
            const results = await Promise.all(tasks);
            let droppedTotal = 0;
            for (const r of results) {
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.error || `Save failed (${r.status})`);
                // The server strips unknown-type blocks on save; surface it so
                // an edited/AI block silently vanishing doesn't look like a
                // "my change didn't stick" bug.
                if (Array.isArray(d?.dropped)) droppedTotal += d.dropped.length;
            }
            if (droppedTotal > 0) {
                showToast('error', `${droppedTotal} block(s) weren't saved — unrecognized block type. Use a supported block or the "Download example" template.`);
            }
            setSaveStatus('saved');
            setDirtySincePublish(true); // the draft now differs from the last publish
            if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
            saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 1800);
            return true;
        } catch (err) {
            // Keep the batch so the user can retry without retyping.
            failedSavesRef.current = batch;
            setError(err.message);
            setSaveStatus('error');
            showToast('error', `Save failed: ${err.message}`);
            return false; // let callers (publish) know the drain didn't land
        } finally {
            inFlightSaveRef.current = null;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
        // Flush any queued edit on unmount (e.g. SPA-navigating away from the
        // CMS within the 800ms debounce) so it isn't lost with the component.
        if (Object.keys(pendingSaves.current).length > 0 || failedSavesRef.current) {
            flushSaves();
        }
    }, [flushSaves]);

    // Warn + best-effort flush when leaving the page with unsaved edits. The
    // debounced PUT can be up to 800ms behind the last keystroke, so closing
    // the tab / hard-reloading mid-debounce would otherwise lose it silently.
    // This panel was the only autosave surface in the app without the guard.
    useEffect(() => {
        const hasUnsaved = () =>
            Object.keys(pendingSaves.current).length > 0
            || !!failedSavesRef.current
            || !!inFlightSaveRef.current
            || !!saveTimerRef.current;
        const onBeforeUnload = (e) => {
            if (!hasUnsaved()) return undefined;
            try { flushSaves(); } catch { /* browsers keep the request alive briefly on unload */ }
            e.preventDefault();
            e.returnValue = ''; // triggers the native "unsaved changes" prompt
            return '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [flushSaves]);

    // Re-flush the failed batch held by flushSaves. Bound to the Retry
    // button in SaveBadge; no-op unless the most recent flush errored.
    const retrySave = useCallback(() => {
        if (!failedSavesRef.current) return;
        inFlightSaveRef.current = flushSaves();
    }, [flushSaves]);

    // Drain any pending debounced saves before an action that triggers a
    // reloadPayload — otherwise the reload overwrites local state with what
    // the DB has, and the user's in-flight edit blinks out of the UI while
    // the timer is still on its way to writing it. Called from savePageMeta
    // and the page CRUD handlers (add/duplicate/delete/setHomepage).
    const drainPendingSaves = useCallback(async () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        if (inFlightSaveRef.current) {
            await inFlightSaveRef.current.catch(() => {});
        }
        if (Object.keys(pendingSaves.current).length > 0) {
            inFlightSaveRef.current = flushSaves();
            await inFlightSaveRef.current;
        }
    }, [flushSaves]);

    // ── undo / redo ──────────────────────────────────────────────────
    //
    // History composite = { site, pages } ONLY. Locale overrides are
    // deliberately excluded (they interact with the aiRunningRef clobber
    // guard and the D1/D3/D4 deferred issues) — entering translate mode is
    // a reset barrier instead. Undoing a block delete therefore restores
    // the block but NOT its pruned translations (they fall back to source).
    //
    // Every content mutator routes through history.commit(next), whose
    // `apply` performs the setState + the SAME per-key scheduleSave the
    // mutators used to call directly — so undo/redo ride the normal 800ms
    // autosave pipeline (drain discipline, failedSaves retry, activeSiteIdRef
    // all unchanged). Barriers (history.reset): site load/switch, page CRUD
    // round-trips, reloadPayload, locale switch, import.

    // Synchronous mirrors so consecutive commits in one tick never read a
    // stale snapshot (state refs update in effects, AFTER render).
    const siteStateRef  = useRef(null);
    const pagesStateRef = useRef([]);
    useEffect(() => { siteStateRef.current = site; }, [site]);
    useEffect(() => { pagesStateRef.current = pages; }, [pages]);

    const docChanged = (a, b) => {
        if (a === b) return false;
        try { return JSON.stringify(a) !== JSON.stringify(b); } catch { return true; }
    };

    const applyHistoryDraft = useCallback((next) => {
        if (!next) return;
        // Never write while an AI translate folds results in — same rule as
        // the manual override mutators. Same for AI builder turns (the UI is
        // scrimmed; this is the belt-and-braces backstop).
        if (aiRunningRef.current || builderRunningRef.current) return;
        // Any human edit (or undo/redo) after an AI turn disarms "Undo turn" —
        // the server-side revert would clobber the newer human work.
        disarmBuilderUndo();
        const prevPages = pagesStateRef.current || [];
        if (next.site && docChanged(siteStateRef.current, next.site)) {
            siteStateRef.current = next.site;
            setSiteDoc(next.site);
            scheduleSave('site', next.site);
        }
        if (Array.isArray(next.pages)) {
            const prevById = new Map(prevPages.map(p => [p.id, p]));
            for (const p of next.pages) {
                const old = prevById.get(p.id);
                if (docChanged(old, p)) scheduleSave(p.id, p);
            }
            pagesStateRef.current = next.pages;
            setPages(next.pages);
        }
    }, [scheduleSave, disarmBuilderUndo]); // eslint-disable-line react-hooks/exhaustive-deps

    const historyDraft = useMemo(() => ({ site, pages }), [site, pages]);
    const history = useDraftHistory({ currentDraft: historyDraft, apply: applyHistoryDraft });
    // Stable ref for reset-barrier callsites with empty dep arrays.
    const historyResetRef = useRef(history.reset);
    useEffect(() => { historyResetRef.current = history.reset; }, [history.reset]);

    // Locale switch = barrier (translate-mode edits live outside the composite).
    useEffect(() => { historyResetRef.current(); }, [activeLocale]);

    // Guarded undo/redo executor — shared by the window hotkey listener
    // below and the iframe-forwarded 'cms-hotkey' messages (the preview
    // iframe posts them because key events never bubble cross-document).
    // Skipped in translate mode (history only tracks the default-locale
    // composite) and during an AI translate. Returns whether it ran so the
    // window listener only preventDefaults when the hotkey was consumed.
    const runHistoryHotkey = useCallback((action) => {
        if (translationMode || aiRunningRef.current) return false;
        if (action === 'redo') history.redo();
        else history.undo();
        return true;
    }, [history.undo, history.redo, translationMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Undo/redo hotkeys — skipped inside text inputs (native field undo
    // wins; the iframe side does its own equivalent target check before
    // forwarding).
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const k = (e.key || '').toLowerCase();
            if (k !== 'z' && k !== 'y') return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            if (runHistoryHotkey((k === 'y' || (k === 'z' && e.shiftKey)) ? 'redo' : 'undo')) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [runHistoryHotkey]);

    // ── page mutations ───────────────────────────────────────────────

    const updatePage = useCallback((pageId, updater) => {
        const prevPages = pagesStateRef.current || [];
        let found = false;
        const nextPages = prevPages.map(p => {
            if (p.id !== pageId) return p;
            found = true;
            return updater(p);
        });
        if (!found) return;
        history.commit({ site: siteStateRef.current, pages: nextPages });
    }, [history.commit]); // eslint-disable-line react-hooks/exhaustive-deps

    // Block content updated via panel editor
    const updateBlockContent = useCallback((pageId, blockId, nextContent) => {
        // D4 guard: overrides address array items by INDEX, so reordering a
        // list in the default locale silently shifts translations onto the
        // wrong items in every other locale (schema fix deferred). Detect the
        // reorder and warn — once per block per session, only when that block
        // actually has array translations.
        const prevContent = pages.find(p => p.id === pageId)?.blocks?.find(b => b.id === blockId)?.content;
        if (prevContent
            && !reorderWarnedRef.current.has(blockId)
            && detectArrayReorder(prevContent, nextContent)
            && blockHasArrayOverrides(localeOverridesRef.current, pageId, blockId)) {
            reorderWarnedRef.current.add(blockId);
            showToast('error', 'Reordering list items can shift their translations in other languages — review them in translate mode.');
        }
        updatePage(pageId, p => ({
            ...p,
            blocks: p.blocks.map(b => b.id === blockId ? { ...b, content: nextContent } : b),
        }));
    }, [updatePage, pages]);

    // Block style overrides — same flow as content, just lands on block.style.
    // Both run through updatePage → scheduleSave(pageId, …) → debounced PUT,
    // so a content edit and a style edit in the same window coalesce into
    // one PageDoc save.
    const updateBlockStyle = useCallback((pageId, blockId, nextStyle) => {
        updatePage(pageId, p => ({
            ...p,
            blocks: p.blocks.map(b => b.id === blockId ? { ...b, style: nextStyle } : b),
        }));
    }, [updatePage]);

    // ── locale-override mutators (translation mode) ─────────────────
    // Keep a synchronous mirror so rapid edits read the latest override.
    useEffect(() => { localeOverridesRef.current = localeOverrides; }, [localeOverrides]);

    // Write a single sparse text leaf into the active page's locale override
    // (segs are into the override root, e.g. ['blocks', id, 'content', …] or
    // ['seo','metaTitle']). Empty string prunes the leaf so it re-inherits the
    // source. Saves via the namespaced 'locale:page:…' debounce key.
    const updatePageOverride = useCallback((pageId, locale, segs, value) => {
        // Block manual translation writes while an AI translate is in flight.
        // The AI call reads a snapshot at request start and returns the whole
        // override; letting a manual edit land in between would be silently
        // overwritten when that result folds into local state.
        if (aiRunningRef.current) return;
        const prev = localeOverridesRef.current;
        const cur = prev.pagesByLocale?.[pageId]?.[locale] || { version: 1, blocks: {} };
        const next = setLocalePath(cur, segs, value);
        const updated = {
            ...prev,
            pagesByLocale: {
                ...prev.pagesByLocale,
                [pageId]: { ...(prev.pagesByLocale?.[pageId] || {}), [locale]: next },
            },
        };
        localeOverridesRef.current = updated;
        setLocaleOverrides(updated);
        scheduleSave(`locale:page:${pageId}:${locale}`, next);
    }, [scheduleSave]);

    // Write a single sparse text leaf into the site (chrome) locale override —
    // header/footer text by storage path, or ['pageTitles', pageId].
    const updateSiteOverride = useCallback((locale, segs, value) => {
        if (aiRunningRef.current) return; // see updatePageOverride
        const prev = localeOverridesRef.current;
        const cur = prev.siteByLocale?.[locale] || { version: 1 };
        const next = setLocalePath(cur, segs, value);
        const updated = { ...prev, siteByLocale: { ...prev.siteByLocale, [locale]: next } };
        localeOverridesRef.current = updated;
        setLocaleOverrides(updated);
        scheduleSave(`locale:site:${locale}`, next);
    }, [scheduleSave]);

    // Replace a whole override in local state WITHOUT scheduling a save — used
    // after AI translate, which has already persisted server-side.
    const replacePageOverride = useCallback((pageId, locale, full) => {
        const prev = localeOverridesRef.current;
        const updated = {
            ...prev,
            pagesByLocale: {
                ...prev.pagesByLocale,
                [pageId]: { ...(prev.pagesByLocale?.[pageId] || {}), [locale]: full },
            },
        };
        localeOverridesRef.current = updated;
        setLocaleOverrides(updated);
    }, []);
    const replaceSiteOverride = useCallback((locale, full) => {
        const prev = localeOverridesRef.current;
        const updated = { ...prev, siteByLocale: { ...prev.siteByLocale, [locale]: full } };
        localeOverridesRef.current = updated;
        setLocaleOverrides(updated);
    }, []);

    // AI pre-fill: translate the active page ('page') or site chrome ('site')
    // to the active locale. The server preserves existing manual translations
    // and returns the merged override, which we fold into local state.
    const handleAiTranslate = useCallback(async (scope, tier = 'fast') => {
        const siteId = activeSiteIdRef.current;
        if (!siteId || aiStatus?.state === 'running') return;
        if (scope === 'page' && !activePage) return;
        // Flush any pending manual edits first so the server reads them and
        // doesn't translate over text the user just typed.
        await drainPendingSaves();
        aiRunningRef.current = true;
        setAiStatus({ state: 'running', scope });
        try {
            const url = scope === 'site'
                ? cmsApi.siteAiTranslate(siteId, activeLocale)
                : cmsApi.pageAiTranslate(siteId, activePage.id, activeLocale);
            const res = await authFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelTier: tier || 'fast' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Translate failed (${res.status})`);
            if (scope === 'site') replaceSiteOverride(activeLocale, data.override);
            else replacePageOverride(activePage.id, activeLocale, data.override);
            setAiStatus({ state: 'done', scope, translated: data.translated, total: data.total });
            showToast('success', data.message || `Translated ${data.translated || 0} fields`);
        } catch (err) {
            setAiStatus({ state: 'error', scope });
            showToast('error', `AI translate failed: ${err.message}`);
        } finally {
            aiRunningRef.current = false;
        }
    }, [activeLocale, activePage, aiStatus, drainPendingSaves, replacePageOverride, replaceSiteOverride]);

    // Reset AI status when switching page/locale so stale "done" badges clear.
    useEffect(() => { setAiStatus(null); }, [activePageId, activeLocale]);

    // D3 recovery — clear ONE block's translations for the active locale,
    // then run the normal AI translate (the server only fills missing leaves,
    // so manual work on other blocks is never re-sent or overwritten).
    const handleClearAndRetranslateBlock = useCallback(async (blockId) => {
        if (!activePage || aiRunningRef.current) return;
        const pageId = activePage.id;
        const prev = localeOverridesRef.current;
        const ov = prev.pagesByLocale?.[pageId]?.[activeLocale];
        if (ov?.blocks && Object.prototype.hasOwnProperty.call(ov.blocks, blockId)) {
            const nextBlocks = { ...ov.blocks };
            delete nextBlocks[blockId];
            const nextOv = { ...ov, blocks: nextBlocks };
            const updated = {
                ...prev,
                pagesByLocale: {
                    ...prev.pagesByLocale,
                    [pageId]: { ...(prev.pagesByLocale?.[pageId] || {}), [activeLocale]: nextOv },
                },
            };
            localeOverridesRef.current = updated;
            setLocaleOverrides(updated);
            scheduleSave(`locale:page:${pageId}:${activeLocale}`, nextOv);
        }
        await handleAiTranslate('page', translateTier);
    }, [activePage, activeLocale, scheduleSave, handleAiTranslate, translateTier]);

    // Remove EVERY override of the active locale for the current scope —
    // rides the (previously unused) DELETE locale-override endpoints. Drain
    // first so a queued locale:* save can't resurrect the override after
    // the DELETE lands.
    const handleResetTranslations = useCallback(async (scope) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId || aiRunningRef.current) return;
        if (scope === 'page' && !activePage) return;
        const localeLabel = locales.find(l => l.code === activeLocale)?.name || activeLocale;
        const ok = await confirm({
            title: `Reset ${localeLabel} translations?`,
            description: scope === 'site'
                ? `Removes every ${localeLabel} translation for the header, footer and page titles. Fields fall back to the source language.`
                : `Removes every ${localeLabel} translation for this page. Fields fall back to the source language.`,
            confirmLabel: 'Reset translations',
            destructive: true,
        });
        if (!ok) return;
        await drainPendingSaves();
        try {
            const url = scope === 'site'
                ? cmsApi.siteLocaleOverride(siteId, activeLocale)
                : cmsApi.pageLocaleOverride(siteId, activePage.id, activeLocale);
            const res = await authFetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Reset failed (${res.status})`);
            }
            if (scope === 'site') replaceSiteOverride(activeLocale, null);
            else replacePageOverride(activePage.id, activeLocale, null);
            setAiStatus(null);
            showToast('success', `${localeLabel} translations reset`);
        } catch (err) {
            showToast('error', `Reset failed: ${err.message}`);
        }
    }, [activePage, activeLocale, locales, confirm, drainPendingSaves, replacePageOverride, replaceSiteOverride]);

    // ── AI builder bridge (assistant/CmsAssistantPane) ───────────────
    //
    // Contract (resolves the AI-vs-autosave race): drafts the assistant
    // streams are ALREADY server-persisted — applyExternalDraft folds them
    // into state WITHOUT touching pendingSaves/scheduleSave. While a turn
    // runs, the stream lock blocks every human write path; Undo turn is a
    // server-side revert of the pre-turn snapshot (AI turns are never
    // client-history entries).

    const beginBuilderTurn = useCallback(async () => {
        await drainPendingSaves();
        builderTurnRef.current = {
            preSite: JSON.parse(JSON.stringify(siteStateRef.current || null)),
            prePages: JSON.parse(JSON.stringify(pagesStateRef.current || [])),
            created: [],
            touched: new Set(),
            draftsSeen: 0,
        };
        historyResetRef.current();
        disarmBuilderUndo();
        builderRunningRef.current = true;
        setBuilderRunning(true);
    }, [drainPendingSaves, disarmBuilderUndo]);

    const applyExternalDraft = useCallback((evt) => {
        if (!evt || evt.siteId !== activeSiteIdRef.current) return; // stale site
        const turn = builderTurnRef.current;
        if (turn) turn.draftsSeen += 1;
        if (evt.kind === 'site' && evt.site) {
            siteStateRef.current = evt.site;
            setSiteDoc(evt.site);
            return;
        }
        if (evt.kind !== 'page' || !evt.pageId || !evt.page) return;
        const prevPages = pagesStateRef.current || [];
        const prev = prevPages.find(p => p.id === evt.pageId);
        if (turn) {
            if (!prev && !turn.created.includes(evt.pageId)) turn.created.push(evt.pageId);
            turn.touched.add(evt.pageId);
        }
        // Mirror the server-side override prune for blocks the AI removed —
        // the server already pruned its copy (pruneBlockLocaleOverrides);
        // without this local mirror, a later manual translation edit would
        // PUT the whole stale override and resurrect the orphans.
        if (prev?.blocks && Array.isArray(evt.page.blocks)) {
            const nextIds = new Set(evt.page.blocks.map(b => b.id));
            for (const b of prev.blocks) {
                if (nextIds.has(b.id)) continue;
                const ovPrev = localeOverridesRef.current;
                const perLocale = ovPrev.pagesByLocale?.[evt.pageId];
                if (!perLocale) continue;
                let changed = false;
                const nextPerLocale = {};
                for (const [loc, ov] of Object.entries(perLocale)) {
                    if (ov?.blocks && Object.prototype.hasOwnProperty.call(ov.blocks, b.id)) {
                        const nb = { ...ov.blocks };
                        delete nb[b.id];
                        nextPerLocale[loc] = { ...ov, blocks: nb };
                        changed = true;
                    } else {
                        nextPerLocale[loc] = ov;
                    }
                }
                if (changed) {
                    const updated = { ...ovPrev, pagesByLocale: { ...ovPrev.pagesByLocale, [evt.pageId]: nextPerLocale } };
                    localeOverridesRef.current = updated;
                    setLocaleOverrides(updated);   // no save — server already pruned
                }
            }
        }
        const nextPages = prev
            ? prevPages.map(p => (p.id === evt.pageId ? evt.page : p))
            : [...prevPages, evt.page];
        pagesStateRef.current = nextPages;
        setPages(nextPages);
    }, []);

    const endBuilderTurn = useCallback((info = {}) => {
        builderRunningRef.current = false;
        setBuilderRunning(false);
        const turn = builderTurnRef.current;
        if (!turn) return;
        if (turn.draftsSeen > 0) {
            // Server-persisted changes → the draft differs from the snapshot.
            setDirtySincePublish(true);
            builderUndoAvailableRef.current = true;
            setBuilderUndoAvailable(true);
        }
        const focus = (info.createdPageIds || [])[0] || (info.touchedPageIds || [])[0] || null;
        if (focus && !info.failed) setActivePageId(focus);
        // The pre-turn snapshot stays armed for Undo turn until the next
        // turn or the next human edit (disarmBuilderUndo in applyHistoryDraft).
    }, []);

    const undoBuilderTurn = useCallback(async () => {
        const turn = builderTurnRef.current;
        const siteId = activeSiteIdRef.current;
        if (!turn || !siteId || builderRunningRef.current) return;
        const ok = await confirm({
            title: 'Undo this AI turn?',
            description: 'Reverts every change from the last assistant turn. Pages it created are deleted.',
            confirmLabel: 'Undo turn',
            destructive: true,
        });
        if (!ok) return;
        try {
            // 1. DELETE created pages FIRST — removePage rewrites the site
            //    index, so restoring the pre-turn site doc afterwards leaves
            //    the index canonical.
            for (const id of turn.created) {
                const res = await authFetch(cmsApi.page(siteId, id), { method: 'DELETE' });
                if (!res.ok && res.status !== 404) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || `Failed to delete page (${res.status})`);
                }
            }
            // 2. Restore the pre-turn site doc (index + chrome + design).
            if (turn.preSite) {
                const res = await authFetch(cmsApi.site(siteId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ site: turn.preSite }),
                });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || 'Failed to restore site');
                }
            }
            // 3. Restore each touched pre-existing page.
            for (const id of turn.touched) {
                if (turn.created.includes(id)) continue;
                const pre = turn.prePages.find(p => p.id === id);
                if (!pre) continue;
                const res = await authFetch(cmsApi.page(siteId, id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ page: pre }),
                });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || 'Failed to restore page');
                }
            }
            // Fold the snapshot back locally WITHOUT scheduling saves.
            siteStateRef.current = turn.preSite;
            pagesStateRef.current = turn.prePages;
            setSiteDoc(turn.preSite);
            setPages(turn.prePages);
            if (turn.created.includes(activePageId)) setActivePageId(HEADER_VIRTUAL_ID);
            builderTurnRef.current = null;
            disarmBuilderUndo();
            showToast('success', 'AI turn undone');
        } catch (err) {
            showToast('error', `Undo failed: ${err.message}`);
        }
    }, [confirm, activePageId, disarmBuilderUndo]);

    // Locale switches remount the preview iframe and flip translate mode —
    // blocked while an AI turn runs (the turn's drafts target the default
    // locale docs).
    const changeLocaleSafe = useCallback((code) => {
        if (builderRunningRef.current) {
            showToast('error', 'The AI assistant is editing — press Stop in the assistant to take over.');
            return;
        }
        setActiveLocale(code);
    }, []);

    const builderContext = useCallback(() => ({
        activePageId: isVirtualPageId(activePageId) ? null : activePageId,
        activeBlockId,
        activeLocale,
    }), [activePageId, activeBlockId, activeLocale]);

    const builderBridge = useMemo(() => ({
        beginTurn: beginBuilderTurn,
        applyExternalDraft,
        endTurn: endBuilderTurn,
        undoTurn: undoBuilderTurn,
        context: builderContext,
        selectPage: (id) => { setActivePageId(id); setRightView('preview'); },
    }), [beginBuilderTurn, applyExternalDraft, endBuilderTurn, undoBuilderTurn, builderContext]);

    // Inline text edit from iframe postMessage (path = "blockType.field.subfield").
    //
    // The section components in agent-hub/src/marketing/sections/ hard-code
    // the block type as the path root (e.g. EditableText path="hero.lead"),
    // which is only block-*type*-relative. To write to the right block when a
    // page has several of the same type, EditableText also stamps the block's
    // unique id (threaded via BlockIdContext from ProductWebsite.jsx) onto the
    // cms-edit message — we resolve the target by that id here. `blockId` is
    // absent only for site chrome (header/footer), handled by the prefix
    // branch below, and for legacy messages, where we fall back to first-of-type.
    const applyIframeEdit = useCallback((path, value, blockId = null) => {
        // Announcement bar — checked BEFORE the translation branch on
        // purpose. Its `text` blob carries every locale inside the BASE
        // SiteDoc (same model as cookieBanner: no locale-override layer),
        // and the path already names the locale it belongs to
        // (announcement.text.<lang>.message), so an inline edit always
        // writes straight through — including while translation mode is on.
        if (path.startsWith('announcement.') && site) {
            const next = applyChromeEdit(site, path, value);
            if (next) history.commit({ site: next, pages: pagesStateRef.current });
            return;
        }

        // Translation mode: the edit is a TEXT translation, not a structural
        // change — write a sparse leaf into the active locale's override
        // instead of mutating the default-locale base doc.
        if (translationMode) {
            if (path.startsWith('header.') || path.startsWith('footer.')) {
                const storagePath = chromeStoragePath(path);
                if (storagePath) updateSiteOverride(activeLocale, storagePath, value);
                return;
            }
            if (!activePage) return;
            const parts = path.split('.');
            const fieldPath = parts.slice(1).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);
            const targetId = blockId
                || activePage.blocks?.find(b => b.type === parts[0])?.id;
            if (!targetId) return;
            updatePageOverride(activePage.id, activeLocale, ['blocks', targetId, 'content', ...fieldPath], value);
            return;
        }

        // Site-chrome paths (header.* / footer.*) target the SiteDoc, not a
        // page block. The iframe receives chrome in a re-shaped form
        // (buildPreviewContent below) — e.g. footer.brand.blurb is the
        // display path while the SiteDoc stores it at footer.blurb. We
        // resolve the iframe path back to the SiteDoc path here and write
        // straight through setSiteDoc + scheduleSave('site', …) (mirrors
        // updateSiteChrome — inlined to avoid a TDZ on its declaration,
        // which lives further down).
        if ((path.startsWith('header.') || path.startsWith('footer.')) && site) {
            const next = applyChromeEdit(site, path, value);
            if (next) {
                // Same write path as updateSiteChrome — one history entry
                // per inline chrome edit (EditableText commits on blur).
                history.commit({ site: next, pages: pagesStateRef.current });
            }
            return;
        }

        if (!activePage) return;
        const parts = path.split('.');
        const blockType = parts[0];
        // Convert numeric segments to actual numbers so paths into arrays
        // (e.g. content.columns.0.elements.1.body) recognise the array
        // indices when we walk + clone. With strings, the recursive
        // `Array.isArray(cur[k]) ? [...] : {...}` decision still works for
        // SETTING the leaf, but only if the array has been pre-allocated
        // by the editor — which it will be once the new Content shape
        // lands. Numeric coercion keeps things consistent either way.
        const fieldPath = parts.slice(1).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);

        updatePage(activePage.id, p => {
            let matched = false;
            return {
                ...p,
                blocks: p.blocks.map(b => {
                    // Prefer the exact block by id (unique, so no ambiguity
                    // between blocks of the same type). Only when no id was
                    // supplied (legacy message) do we fall back to the old
                    // first-block-of-type behaviour.
                    const isTarget = blockId
                        ? b.id === blockId
                        : (!matched && b.type === blockType);
                    if (!isTarget) return b;
                    matched = true;
                    const content = JSON.parse(JSON.stringify(b.content));
                    let cur = content;
                    for (let i = 0; i < fieldPath.length - 1; i++) {
                        const k = fieldPath[i];
                        // Pick the right shape for the next level: numeric
                        // *next* segment → array; string → object.
                        const nextIsArrayIndex = typeof fieldPath[i + 1] === 'number';
                        if (nextIsArrayIndex) {
                            cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : [];
                        } else {
                            cur[k] = (cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k]))
                                ? { ...cur[k] }
                                : (Array.isArray(cur[k]) ? [...cur[k]] : {});
                        }
                        cur = cur[k];
                    }
                    cur[fieldPath[fieldPath.length - 1]] = value;
                    return { ...b, content };
                }),
            };
        });
    }, [activePage, updatePage, site, history.commit, translationMode, activeLocale, updateSiteOverride, updatePageOverride]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── block CRUD ───────────────────────────────────────────────────

    // `atIndex` (optional) = explicit splice position from the canvas
    // insert-between "+" zones; when omitted/null the block lands AFTER the
    // active block (fall back to append) — adding a section next to what
    // you're looking at instead of at the page end.
    // `contentOverrides` (optional) is spread over the type's defaults —
    // used by the AddBlockDialog's variant strip to add a block with a
    // specific layout variant pre-selected ({ variant: 'bento' } etc.).
    const addBlock = useCallback((type, atIndex = null, contentOverrides = null) => {
        if (!activePage) return;
        const block = {
            id: newBlockId(),
            type,
            enabled: true,
            content: {
                ...JSON.parse(JSON.stringify(BLOCK_DEFAULTS[type] || {})),
                ...(contentOverrides || {}),
            },
            style: {},
        };
        updatePage(activePage.id, p => {
            const blocks = [...p.blocks];
            const idx = Number.isInteger(atIndex)
                ? Math.max(0, Math.min(atIndex, blocks.length))
                : (() => {
                    const activeIdx = activeBlockId ? p.blocks.findIndex(b => b.id === activeBlockId) : -1;
                    return activeIdx >= 0 ? activeIdx + 1 : blocks.length;
                })();
            blocks.splice(idx, 0, block);
            return { ...p, blocks };
        });
        setActiveBlockId(block.id);
    }, [activePage, activeBlockId, updatePage]);

    const toggleBlock = useCallback((blockId) => {
        if (!activePage) return;
        updatePage(activePage.id, p => ({
            ...p,
            blocks: p.blocks.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b),
        }));
    }, [activePage, updatePage]);

    const duplicateBlock = useCallback((blockId) => {
        if (!activePage) return;
        updatePage(activePage.id, p => {
            const idx = p.blocks.findIndex(b => b.id === blockId);
            if (idx < 0) return p;
            const copy = cloneBlock(p.blocks[idx]);
            const blocks = [...p.blocks];
            blocks.splice(idx + 1, 0, copy);
            setActiveBlockId(copy.id);
            return { ...p, blocks };
        });
    }, [activePage, updatePage]);

    const deleteBlock = useCallback((blockId) => {
        if (!activePage) return;
        const pageId = activePage.id;
        updatePage(pageId, p => {
            const blocks = p.blocks.filter(b => b.id !== blockId);
            if (activeBlockId === blockId) setActiveBlockId(blocks[0]?.id || null);
            return { ...p, blocks };
        });
        // Prune this block's per-locale translation overrides too — they're
        // keyed by block id, so without this they linger as orphaned cruft
        // (and resurface in exports) after the block is gone.
        const prev = localeOverridesRef.current;
        const perLocale = prev.pagesByLocale?.[pageId];
        if (perLocale) {
            let changed = false;
            const nextPerLocale = {};
            for (const [locale, ov] of Object.entries(perLocale)) {
                if (ov?.blocks && Object.prototype.hasOwnProperty.call(ov.blocks, blockId)) {
                    const nextBlocks = { ...ov.blocks };
                    delete nextBlocks[blockId];
                    const nextOv = { ...ov, blocks: nextBlocks };
                    nextPerLocale[locale] = nextOv;
                    scheduleSave(`locale:page:${pageId}:${locale}`, nextOv);
                    changed = true;
                } else {
                    nextPerLocale[locale] = ov;
                }
            }
            if (changed) {
                const updated = { ...prev, pagesByLocale: { ...prev.pagesByLocale, [pageId]: nextPerLocale } };
                localeOverridesRef.current = updated;
                setLocaleOverrides(updated);
            }
        }
    }, [activePage, activeBlockId, updatePage, scheduleSave]);

    const reorderBlocks = useCallback((nextBlocks) => {
        if (!activePage) return;
        updatePage(activePage.id, p => ({ ...p, blocks: nextBlocks }));
    }, [activePage, updatePage]);

    // Canvas block-toolbar actions (iframe → cms-block-action). Every
    // mutation REUSES the existing block mutators above, so history +
    // debounced autosave semantics are byte-identical to the sidebar
    // buttons — zero new save paths. The builderRunning stream-lock gate
    // lives at the single onMessage choke point below, not here.
    const handleBlockAction = useCallback((blockId, action) => {
        if (!activePage) return;
        const blocks = activePage.blocks || [];
        const idx = blocks.findIndex(b => b.id === blockId);
        if (idx < 0) return;
        if (action === 'move-up' || action === 'move-down') {
            const to = action === 'move-up' ? idx - 1 : idx + 1;
            if (to < 0 || to >= blocks.length) return;
            const next = [...blocks];
            const [moved] = next.splice(idx, 1);
            next.splice(to, 0, moved);
            reorderBlocks(next);
            return;
        }
        if (action === 'duplicate') { duplicateBlock(blockId); return; }
        // Delete matches BlockList's row button: no confirm (undo covers it).
        if (action === 'delete') { deleteBlock(blockId); return; }
        if (action === 'settings') {
            setActiveBlockId(blockId);
            // Open the inspector if it's collapsed — same persistence
            // convention as toggleInspector.
            scopedStorage.setItem('cmsInspectorOpen', '1');
            setInspectorOpen(true);
        }
    }, [activePage, reorderBlocks, duplicateBlock, deleteBlock]);

    // Canvas insert-between "+" (iframe → cms-insert-at): open the
    // Add-block dialog with a pending explicit insertion index.
    const handleInsertAt = useCallback((index) => {
        if (!activePage) return;
        setAddBlockRequest({ index });
    }, [activePage]);

    // ── page CRUD (round-trips — no optimistic debounce needed here) ─

    // Creates a page on the active site. Returns { id, slug, title } so
    // callers (e.g. the LinkField "Create new page…" picker) can immediately
    // point a link at the freshly-created page without round-tripping
    // through the page list. Callers that initiated from PageList (the
    // default) get the new page focused in the side panel; callers from
    // inside a picker pass `{ keepActive: true }` to stay where they were.
    const handleAddPage = useCallback(async ({ title, slug, templateId } = {}, options = {}) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return null;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.pages(siteId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, slug, templateId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create page');
            // Reload full payload so site index + page doc are consistent.
            await reloadPayload();
            if (!options.keepActive) setActivePageId(data.id);
            return { id: data.id, slug: data.slug, title: title || data.slug };
        } catch (err) {
            showToast('error', `Failed to create page: ${err.message}`);
            // Rethrow so picker callers can surface the error inline
            // instead of silently swallowing it.
            throw err;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDuplicatePage = useCallback(async (pageId) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.pages(siteId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ copyFromId: pageId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to duplicate page');
            await reloadPayload();
            setActivePageId(data.id);
            setDirtySincePublish(true);
        } catch (err) { showToast('error', `Failed to duplicate page: ${err.message}`); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Per-page export — bundles { meta, blocks } as a JSON download. Looks
    // up blocks from the full pages state (the site index in site.pages is
    // meta-only). Triggered from the row's actions menu.
    const handleExportPage = useCallback((pageId) => {
        const page = pages.find(p => p.id === pageId);
        if (!page) return;
        exportPageToFile(page);
    }, [pages]);

    // Per-page import — always creates a NEW page (never overwrites). Goes
    // through the existing create flow (so the server resolves slug
    // collisions by suffixing) and then patches the imported blocks in via
    // updatePage, which schedules the debounced PUT to persist them.
    const handleImportPage = useCallback(async (payload) => {
        const incomingSlug  = (payload?.meta?.slug  || '').trim() || 'page';
        const incomingTitle = (payload?.meta?.title || '').trim() || incomingSlug;
        let created;
        try {
            created = await handleAddPage({ title: incomingTitle, slug: incomingSlug });
        } catch {
            return;
        }
        if (!created?.id) return;
        updatePage(created.id, p => ({ ...p, blocks: Array.isArray(payload?.blocks) ? payload.blocks : [] }));
        // Surface what the importer had to normalize or drop — otherwise a
        // partial import looks like a silent success with missing sections.
        const droppedCount = Array.isArray(payload?.dropped) ? payload.dropped.length : 0;
        const warnCount = Array.isArray(payload?.warnings) ? payload.warnings.length : 0;
        if (droppedCount > 0) {
            const types = [...new Set(payload.dropped.map(d => (d.type == null ? '(no type)' : d.type)))];
            showToast('error', `Imported "${incomingTitle}" — ${droppedCount} block(s) skipped (unrecognized type: ${types.join(', ')}).`);
        } else if (warnCount > 0) {
            showToast('success', `Imported "${incomingTitle}" — ${warnCount} block(s) adjusted to the expected format.`);
        } else {
            showToast('success', `Imported "${incomingTitle}".`);
        }
    }, [handleAddPage, updatePage]);

    const handleDeletePage = useCallback(async (pageId) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        const page = pages.find(p => p.id === pageId);
        const ok = await confirm({
            title: `Delete "${page?.title || 'this page'}"?`,
            description: 'The page and all of its blocks are permanently removed. This cannot be undone.',
            confirmLabel: 'Delete page',
            destructive: true,
        });
        if (!ok) return;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.page(siteId, pageId), { method: 'DELETE' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            await reloadPayload();
            setActivePageId(HEADER_VIRTUAL_ID);
            setDirtySincePublish(true);
        } catch (err) {
            showToast('error', `Failed to delete page: ${err.message}`);
        }
    }, [pages, confirm]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSetHomepage = useCallback(async (pageId) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.pageHomepage(siteId, pageId), { method: 'PUT' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            await reloadPayload();
            setDirtySincePublish(true);
        } catch (err) { showToast('error', `Failed to set homepage: ${err.message}`); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReorderPages = useCallback(async (orderedIds) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        historyResetRef.current();
        try {
            // Optimistic: update site.pages order locally.
            setSiteDoc(prev => {
                if (!prev) return prev;
                const byId = new Map(prev.pages.map(p => [p.id, p]));
                return { ...prev, pages: orderedIds.map(id => byId.get(id)).filter(Boolean) };
            });
            const res = await authFetch(cmsApi.pagesOrder(siteId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setDirtySincePublish(true);
        } catch (err) { showToast('error', `Failed to reorder pages: ${err.message}`); }
    }, []);

    const reloadPayload = useCallback(async () => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        const res = await authFetch(cmsApi.site(siteId));
        if (!res.ok) return;
        const data = await res.json();
        // Re-check guards AFTER the round-trip: the user may have switched
        // sites or started a new edit while this GET was in flight. Applying a
        // now-stale server payload here would yank state out from under a live
        // edit (the classic "my change reverted"). The call-site guards run
        // before the fetch, so this is the only race-free place to bail.
        if (activeSiteIdRef.current !== siteId) return;            // site switched mid-fetch
        if (Object.keys(pendingSaves.current).length > 0) return;   // new local edits queued
        if (inFlightSaveRef.current) return;                        // a save is racing
        if (builderRunningRef.current) return;                      // AI turn owns the state
        setSiteDoc(data.site || null);
        setPages(data.pages || []);
        setLocales(data.locales || locales);
        setLocaleOverrides(data.localeOverrides || { siteByLocale: {}, pagesByLocale: {} });
        if (data.publishedAt !== undefined) setPublishedAt(data.publishedAt || null);
        historyResetRef.current(); // server-confirmed load — undo across it would clobber
    }, [locales]); // eslint-disable-line react-hooks/exhaustive-deps

    // Refetch latest payload when the tab regains focus, so opening the CMS
    // after a break (or after editing in another tab) shows current content
    // instead of the cached snapshot from initial mount. Guarded against any
    // dirty/in-flight state so we never yank state out from under an edit.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (saveStatus !== 'idle' && saveStatus !== 'saved') return;
            if (Object.keys(pendingSaves.current).length > 0) return;
            if (inFlightSaveRef.current) return;
            if (builderRunningRef.current) return;
            if (!activeSiteIdRef.current) return;
            reloadPayload();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [saveStatus, reloadPayload]);

    // ── page templates (global, shared across sites) ──────────────────
    const refreshTemplates = useCallback(async () => {
        try {
            const res = await authFetch(cmsApi.templates());
            if (!res.ok) return;
            const data = await res.json();
            setTemplates(Array.isArray(data.templates) ? data.templates : []);
        } catch { /* non-fatal — manager + picker just stay empty */ }
    }, []);

    // Initial load — runs once when the panel mounts. Templates are
    // org-wide so they don't need to re-fetch on site switches.
    useEffect(() => { refreshTemplates(); }, [refreshTemplates]);

    // Resolve the page's blocks BEFORE opening the dialog. The panel's
    // `pages` state caches every PageDoc for the active site, so the
    // currently active page is always there. Pages from another site
    // (or freshly imported sites that haven't been touched yet) get a
    // fallback fetch so the dialog never opens with `undefined` blocks.
    // Empty arrays are refused too — the saved template would otherwise
    // be an unusable starter that the user can't tell apart from a real
    // save until they try to apply it.
    const handleSaveAsTemplate = useCallback(async (page) => {
        if (!page?.id) return;
        const siteId = activeSiteIdRef.current;

        let blocks = pages.find(p => p.id === page.id)?.blocks;

        if (!Array.isArray(blocks) && siteId) {
            // Fallback — not in the local cache. Round-trip to fetch the
            // PageDoc so we never open the dialog without blocks.
            try {
                const res = await authFetch(cmsApi.page(siteId, page.id));
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to load page');
                }
                const doc = await res.json();
                blocks = Array.isArray(doc?.blocks) ? doc.blocks : null;
            } catch (err) {
                console.error('[templates] failed to load page blocks', err);
                showToast('error', `Couldn't load page blocks — ${err.message}`);
                return;
            }
        }

        if (!Array.isArray(blocks) || blocks.length === 0) {
            showToast('error', 'This page has no blocks to save as a template.');
            return;
        }

        // Stash blocks alongside the page so submitTemplate doesn't have
        // to resolve them a second time (and can't drift if `pages`
        // re-renders between the dialog opening and the user confirming).
        setPendingTemplatePage({ ...page, blocks });
    }, [pages]);

    const submitTemplate = useCallback(async ({ name, description }) => {
        const page = pendingTemplatePage;
        if (!page?.id) return;
        const blocks = Array.isArray(page.blocks) ? page.blocks : [];
        if (blocks.length === 0) {
            showToast('error', 'No blocks resolved — can\'t save an empty template.');
            return;
        }
        try {
            const res = await authFetch(cmsApi.templates(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, blocks }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            await refreshTemplates();
            setPendingTemplatePage(null);
            showToast('success', 'Template saved');
        } catch (err) {
            console.error('[templates] save failed', err);
            showToast('error', 'Failed to save template — check console');
            // No rethrow — the dialog's inner try/finally always resets
            // `saving` and the parent keeps `pendingTemplatePage` set so
            // the modal stays open for retry. Rethrowing would just
            // produce a duplicate unhandled-rejection log.
        }
    }, [pendingTemplatePage, refreshTemplates]);


    const handleDeleteTemplate = useCallback(async (id) => {
        try {
            const res = await authFetch(cmsApi.template(id), { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            await refreshTemplates();
            showToast('success', 'Template deleted');
        } catch (err) {
            console.error('[templates] delete failed', err);
            showToast('error', 'Failed to delete template — check console');
        }
    }, [refreshTemplates]);

    // ── site chrome mutations ────────────────────────────────────────

    const updateSiteChrome = useCallback((nextSite) => {
        history.commit({ site: nextSite, pages: pagesStateRef.current });
    }, [history.commit]); // eslint-disable-line react-hooks/exhaustive-deps

    // Design changes route through the SAME pendingSaves['site'] slot as
    // chrome changes (via the history apply path), so a design edit followed
    // by a header edit (or vice versa) coalesces into ONE PUT carrying the
    // latest snapshot of both. Last-write-wins on the entire SiteDoc — no
    // separate /design endpoint, no race window.
    const updateDesign = useCallback((nextDesign) => {
        const prev = siteStateRef.current;
        if (!prev) return;
        history.commit({ site: { ...prev, design: nextDesign }, pages: pagesStateRef.current });
    }, [history.commit]); // eslint-disable-line react-hooks/exhaustive-deps

    // Analytics settings live on the site doc too — same coalesced
    // pendingSaves['site'] slot, same undo/redo history as chrome/design.
    const updateSiteAnalytics = useCallback((nextAnalytics) => {
        const prev = siteStateRef.current;
        if (!prev) return;
        history.commit({ site: { ...prev, analytics: nextAnalytics }, pages: pagesStateRef.current });
    }, [history.commit]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── top-level toggles ────────────────────────────────────────────

    // Toggle whether *this* site (activeSiteId) is the live one. Only one
    // project can be live at a time; when another site is currently live
    // the user must confirm taking it offline before this one goes live.
    const persistLive = async (next) => {
        if (!activeSiteId) return;
        if (builderRunningRef.current) { showToast('error', AI_LOCK_MSG); return; }
        if (next) {
            const otherLive = liveSiteId && liveSiteId !== activeSiteId
                ? sites.find(s => s.id === liveSiteId)
                : null;
            if (otherLive) {
                const ok = await confirm({
                    title: 'Move the live site?',
                    description: `"${otherLive.name}" is currently live. Setting this site live will take "${otherLive.name}" offline.`,
                    confirmLabel: 'Set live',
                });
                if (!ok) return;
            }
            setLiveSiteId(activeSiteId);
            try {
                const res = await authFetch(cmsApi.siteLive(activeSiteId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ live: true }),
                });
                if (!res.ok) throw new Error(`Failed to set live (${res.status})`);
            } catch (err) {
                showToast('error', err.message);
                setLiveSiteId(liveSiteId);   // roll back optimistic update
            }
        } else {
            setLiveSiteId(null);
            try {
                const res = await authFetch(cmsApi.siteLive(activeSiteId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ live: false }),
                });
                if (!res.ok) throw new Error(`Failed to take site offline (${res.status})`);
            } catch (err) {
                showToast('error', err.message);
                setLiveSiteId(liveSiteId);
            }
        }
    };

    // Publish — snapshot the current draft on the server. Drains pending
    // debounced saves first so in-flight edits land in the snapshot rather
    // than being captured by the next publish click. The public site
    // (/api/cms/site) reads from this snapshot.
    const handlePublish = useCallback(async () => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        if (builderRunningRef.current) { showToast('error', AI_LOCK_MSG); return; }
        // Drain any pending save in three steps:
        //   1. Cancel an unfired debounce timer (would re-queue work).
        //   2. Await any save the timer already started (in-flight PUTs).
        //   3. Run flushSaves once more to push anything queued since.
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        if (inFlightSaveRef.current) {
            try { await inFlightSaveRef.current; } catch { /* error already surfaced */ }
            inFlightSaveRef.current = null;
        }
        const drainedOk = await flushSaves();
        // Never snapshot a site that still has unsaved edits — publishing here
        // would push stale content live while the UI shows "just published".
        // flushSaves already surfaced the save error and kept the retry batch.
        if (!drainedOk || failedSavesRef.current) {
            showToast('error', 'Not published — some changes failed to save. Fix the error and retry.');
            return;
        }
        setPublishing(true);
        try {
            const res = await authFetch(cmsApi.sitePublish(siteId), { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Publish failed (${res.status})`);
            setPublishedAt(data.publishedAt || new Date().toISOString());
            setDirtySincePublish(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setPublishing(false);
        }
    }, [flushSaves]);

    // "Set as default locale" — an org-wide switch of the site's source
    // language; consequential enough to confirm (it flips translate mode).
    const handleSetDefaultLocale = async (code) => {
        const name = locales.find(l => l.code === code)?.name || code;
        const ok = await confirm({
            title: `Make ${name} the default locale?`,
            description: 'The default locale is the source language: pages are authored in it, and other languages translate from it.',
            confirmLabel: 'Set default',
        });
        if (!ok) return;
        await persistDefaultLocale(code);
    };

    const persistDefaultLocale = async (next) => {
        setDefaultLocale(next);
        try {
            await authFetch(cmsApi.defaultLocale(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: next }),
            });
        } catch (err) { showToast('error', `Failed to set default locale: ${err.message}`); }
    };

    // ── iframe postMessage ───────────────────────────────────────────

    const postPreview = useCallback(() => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !previewReadyRef.current) return;
        // Site-chrome view: render header + a neutral placeholder body +
        // footer so the user can see the chrome in isolation. Pass a
        // blocks-less page so buildPreviewContent doesn't carry homepage
        // blocks through, and tag the message with previewMode='chrome'
        // so the iframe shows the explainer instead of an empty body.
        // Any chrome entry (header / footer / cookie banner) previews the
        // chrome in isolation — blockless page + previewMode='chrome'.
        const isChromeView = isChromeEntryId(activePageId);
        const pageForPreview = isChromeView ? { blocks: [] } : previewPage;
        // In translation mode, pre-merge the active locale's overrides so the
        // preview renders translated text (with source fallback), matching
        // exactly what the published site will serve at ?locale=…
        let previewSite = site;
        let previewPageMerged = pageForPreview;
        if (translationMode) {
            const siteOv = localeOverrides.siteByLocale?.[activeLocale] || null;
            const pageOv = pageForPreview?.id
                ? (localeOverrides.pagesByLocale?.[pageForPreview.id]?.[activeLocale] || null)
                : null;
            previewSite = mergePreviewSite(site, siteOv);
            previewPageMerged = mergePreviewPage(pageForPreview, pageOv, siteOv);
        }
        const content = buildPreviewContent(previewSite, previewPageMerged);
        // Design flows alongside content (not nested) so the iframe can
        // apply CSS variables independently of content updates.
        const design = site?.design || null;
        const previewMode = isChromeView ? 'chrome' : 'page';
        // Target our own origin (the preview route is same-origin) so draft
        // content/design can't leak to a cross-origin frame in the preview slot.
        win.postMessage({ type: 'cms-preview', content, design, previewMode }, window.location.origin);
    }, [site, previewPage, activePageId, translationMode, activeLocale, localeOverrides]);

    // Selection + AI-stream-lock mirror → iframe (cms-active). Deliberately
    // a dedicated message posted from its own effect, NOT folded into
    // postPreview: content re-posts disturb inline-edit focus (see the
    // cms-select comment in onMessage below), and selection changes must
    // never re-send content. `labels` rides along so the iframe can title
    // its block chrome without importing admin code.
    const postActiveToPreview = useCallback(() => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !previewReadyRef.current) return;
        win.postMessage({
            type: 'cms-active',
            blockId: activeBlockId || null,
            locked: builderRunning,
            labels: BLOCK_LABELS,
        }, window.location.origin);
    }, [activeBlockId, builderRunning]);

    // Re-post whenever the selection or the lock changes (the callback
    // identity tracks exactly those two). The cms-preview-ready branch
    // below covers the initial post after an iframe (re)mount.
    useEffect(() => { postActiveToPreview(); }, [postActiveToPreview]);

    // Select a block AND scroll the preview to it — bound to translation-row
    // clicks so the admin sees which block a string belongs to.
    const selectAndScrollToBlock = useCallback((blockId) => {
        setActiveBlockId(prev => (prev === blockId ? prev : blockId));
        const win = iframeRef.current?.contentWindow;
        if (win && previewReadyRef.current) win.postMessage({ type: 'cms-scroll', blockId }, window.location.origin);
    }, []);

    useEffect(() => {
        const onMessage = (e) => {
            // Only trust our own same-origin preview iframe. Without this, any
            // page framing the admin (or another window) could post a
            // `cms-edit` and corrupt content, or read what we post back. The
            // renderer side already guards its inbound messages symmetrically.
            if (e.origin !== window.location.origin) return;
            if (e.source !== iframeRef.current?.contentWindow) return;
            const msg = e.data;
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'cms-preview-ready') {
                previewReadyRef.current = true;
                postPreview();
                postActiveToPreview();
                return;
            }
            if (msg.type === 'cms-edit' && typeof msg.path === 'string') {
                if (builderRunningRef.current) {
                    // Stream lock: an inline preview edit mid-AI-turn would be
                    // silently overwritten by the next draft — refuse loudly.
                    showToast('error', AI_LOCK_MSG);
                    return;
                }
                applyIframeEdit(msg.path, msg.value, msg.blockId);
                return;
            }
            // Inline focus in the preview → highlight that block in the left
            // panel, keeping selection in sync with the block being edited.
            // Functional update skips a redundant render when it's already
            // selected; the iframe isn't re-posted (postPreview ignores
            // activeBlockId), so the user's caret/focus isn't disturbed.
            if (msg.type === 'cms-select' && typeof msg.blockId === 'string') {
                setActiveBlockId(prev => (prev === msg.blockId ? prev : msg.blockId));
                return;
            }
            // Canvas block-toolbar action. A mutation — gated on the AI
            // stream lock at this single choke point, mirroring the
            // cms-edit refusal above (same toast).
            if (msg.type === 'cms-block-action'
                && typeof msg.blockId === 'string' && typeof msg.action === 'string') {
                if (builderRunningRef.current) {
                    showToast('error', AI_LOCK_MSG);
                    return;
                }
                handleBlockAction(msg.blockId, msg.action);
                return;
            }
            // Canvas insert-between "+" → Add-block dialog with an explicit
            // index. Gated too: the add it leads to would mutate the page
            // mid-AI-turn.
            if (msg.type === 'cms-insert-at' && Number.isInteger(msg.index) && msg.index >= 0) {
                if (builderRunningRef.current) {
                    showToast('error', AI_LOCK_MSG);
                    return;
                }
                handleInsertAt(msg.index);
                return;
            }
            // Undo/redo forwarded from the preview iframe (Ctrl/Cmd+Z is
            // otherwise dead while focus sits in the canvas). Same guards
            // as the window hotkey listener via runHistoryHotkey.
            if (msg.type === 'cms-hotkey' && (msg.action === 'undo' || msg.action === 'redo')) {
                runHistoryHotkey(msg.action);
                return;
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [postPreview, postActiveToPreview, applyIframeEdit, runHistoryHotkey, handleBlockAction, handleInsertAt]);

    // Push to iframe when active page or site chrome changes.
    useEffect(() => {
        const t = setTimeout(postPreview, 200);
        return () => clearTimeout(t);
    }, [postPreview]);

    // When switching pages, focus the first block. The iframe stays mounted —
    // the postPreview() push below carries the new page's content via
    // postMessage, no reload needed.
    useEffect(() => {
        if (activePage) setActiveBlockId(activePage.blocks?.[0]?.id || null);
    }, [activePageId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Always land on the Content sub-tab when the user picks a different block.
    useEffect(() => { setBlockEditorTab('content'); }, [activeBlockId]);

    // ── page SEO / meta editor (inline in panel, not via iframe) ────

    // SEO fields live on the PageDoc, so they flow through the regular
    // PUT /admin/pages/:id auto-save path.
    const updatePageSeo = useCallback((field, value) => {
        if (!activePage) return;
        updatePage(activePage.id, p => ({ ...p, seo: { ...(p.seo || {}), [field]: value } }));
    }, [activePage, updatePage]);

    // Meta fields (title, slug, hideHeader, hideFooter, isNotFound) live on
    // the site index entry — NOT on the PageDoc — so they need the dedicated
    // /meta endpoint, which updates both the index and the PageDoc title/slug
    // atomically. PUT /admin/pages/:id (setPage) would silently drop
    // hideHeader/hideFooter and leave the site index out of sync.
    const savePageMeta = useCallback(async (pageId, patch) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        if (builderRunningRef.current) { showToast('error', 'The AI assistant is editing — press Stop in the assistant to take over.'); return; }
        // Drain debounced edits first — otherwise the reloadPayload() below
        // would overwrite local state with stale DB content while the
        // user's pending block edit is still on its way out.
        await drainPendingSaves();
        setSaveStatus('saving');
        try {
            const res = await authFetch(cmsApi.pageMeta(siteId, pageId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Save failed (${res.status})`);
            }
            setSaveStatus('saved');
            setDirtySincePublish(true);
            if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
            saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 1800);
            await reloadPayload();
        } catch (err) {
            setError(err.message);
            setSaveStatus('error');
            showToast('error', `Save failed: ${err.message}`);
        }
    }, [drainPendingSaves]); // eslint-disable-line react-hooks/exhaustive-deps

    const updatePageMeta = useCallback((field, value) => {
        if (!activePage) return;
        savePageMeta(activePage.id, { [field]: value });
    }, [activePage, savePageMeta]);

    // ── site/project CRUD (multi-site switcher) ──────────────────────

    const handleSwitchSite = useCallback(async (newSiteId) => {
        if (!newSiteId || newSiteId === activeSiteIdRef.current) return;
        if (builderRunningRef.current) { showToast('error', 'The AI assistant is editing — press Stop in the assistant to take over.'); return; }
        // Drain any pending debounced saves so the edits land on the
        // CURRENT site before we point future saves at the new one.
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
            await flushSaves();
        }
        activeSiteIdRef.current = newSiteId;
        setActiveSiteId(newSiteId);
        try { localStorage.setItem(ACTIVE_SITE_LS_KEY, newSiteId); } catch { /* ignore */ }
    }, [flushSaves]);

    const refreshSites = useCallback(async () => {
        const res = await authFetch(cmsApi.listSites());
        if (!res.ok) return [];
        const data = await res.json();
        const list = Array.isArray(data.sites) ? data.sites : [];
        setSites(list);
        // Server clears cms_live_site_id when the live project is deleted —
        // mirror that here so the toggle/indicator stay in sync without a
        // second round-trip.
        setLiveSiteId(data.liveSiteId || null);
        return list;
    }, []);

    const handleCreateSite = useCallback(async (name) => {
        try {
            const res = await authFetch(cmsApi.createSite(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create site');
            await refreshSites();
            await handleSwitchSite(data.id);
            return data;
        } catch (err) {
            showToast('error', `Failed to create site: ${err.message}`);
            return null;
        }
    }, [handleSwitchSite, refreshSites]);

    const handleRenameSite = useCallback(async (siteId, name) => {
        try {
            const res = await authFetch(cmsApi.site(siteId), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Rename failed (${res.status})`);
            }
            await refreshSites();
            // If we renamed the active site, refresh its payload so the
            // header/displays pick up the new name.
            if (siteId === activeSiteIdRef.current) await reloadPayload();
        } catch (err) { showToast('error', `Rename failed: ${err.message}`); }
    }, [refreshSites, reloadPayload]);

    // ── Site export / import ────────────────────────────────────────
    // Export streams the server's JSON response into a Blob and uses
    // a temporary <a download> to trigger a file save dialog. We rely
    // on the Content-Disposition filename the server sets — falling
    // back to a generic name if the browser strips it.
    const [siteIoStatus, setSiteIoStatus] = useState(null);   // { kind: 'success'|'error'|'busy', text }

    const handleExportSite = useCallback(async (format = 'zip') => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        setSiteIoStatus({ kind: 'busy', text: 'Exporting…' });
        try {
            const res = await authFetch(cmsApi.siteExport(siteId, format));
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Export failed (${res.status})`);
            }
            const blob = await res.blob();
            // Prefer the server-provided filename from Content-Disposition.
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || `site-export-${Date.now()}.${format === 'json' ? 'json' : 'zip'}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoke the blob URL after a tick — Chrome occasionally
            // discards the download if revoked synchronously.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setSiteIoStatus({ kind: 'success', text: 'Exported' });
            setTimeout(() => setSiteIoStatus(null), 2400);
        } catch (err) {
            setSiteIoStatus({ kind: 'error', text: err.message || 'Export failed' });
        }
    }, []);

    // Two wire formats share one picker:
    //   .zip   the complete backup — bundle + image bytes. Posted as
    //          multipart; the server unpacks and validates it (we can't
    //          usefully pre-check a zip in the browser, and doing so would
    //          just duplicate the server's guards).
    //   .json  the bundle alone. Kept because every export downloaded
    //          before the zip existed is one of these — and the cheap
    //          client-side marker check gives a far better error than a
    //          round-trip for the common "wrong file" mistake.
    const handleImportFileChosen = useCallback(async (file) => {
        if (!file) return;
        if (builderRunningRef.current) { showToast('error', 'The AI assistant is editing — press Stop in the assistant to take over.'); return; }
        const isZip = /\.zip$/i.test(file.name || '') || file.type === 'application/zip';
        setSiteIoStatus({ kind: 'busy', text: 'Importing…' });

        let request;
        if (isZip) {
            const form = new FormData();
            form.append('file', file, file.name || 'site.zip');
            request = { method: 'POST', body: form };   // no Content-Type — the browser sets the boundary
        } else {
            let payload;
            try {
                payload = JSON.parse(await file.text());
            } catch {
                setSiteIoStatus({ kind: 'error', text: 'Selected file is not a .zip or valid JSON' });
                return;
            }
            if (!payload || payload._beeflow_export !== true) {
                setSiteIoStatus({ kind: 'error', text: 'Not a Bee Flow site export file' });
                return;
            }
            request = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            };
        }

        try {
            const res = await authFetch(cmsApi.importSite(), request);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
            // Refresh the sidebar list and switch to the newly-created site.
            await refreshSites();
            if (data.siteId) await handleSwitchSite(data.siteId);

            // Report what actually came across. A silent "Imported" hides the
            // two things an operator most needs to know: which languages
            // arrived, and whether any images did not.
            const parts = [];
            if (data.locales?.length) parts.push(`${data.locales.length + 1} language(s)`);
            if (data.assetsWritten) parts.push(`${data.assetsWritten} file(s)`);
            if (data.dropped > 0) parts.push(`${data.dropped} block(s) skipped (unrecognized type)`);
            const warnings = Array.isArray(data.warnings) ? data.warnings : [];
            const detail = parts.length ? ` — ${parts.join(', ')}` : '';
            const bad = data.dropped > 0 || warnings.length > 0;
            setSiteIoStatus({
                kind: bad ? 'error' : 'success',
                text: `Imported "${data.name || 'site'}"${detail}`,
            });
            for (const w of warnings.slice(0, 3)) showToast('error', w);
            setTimeout(() => setSiteIoStatus(null), bad ? 6000 : 2400);
        } catch (err) {
            setSiteIoStatus({ kind: 'error', text: err.message || 'Import failed' });
        }
    }, [handleSwitchSite, refreshSites]);

    // Receives the full site object from SiteSwitcher (which no longer
    // confirms itself) — the shared ConfirmDialog names what's deleted.
    const handleDeleteSite = useCallback(async (siteOrId) => {
        const siteId = typeof siteOrId === 'string' ? siteOrId : siteOrId?.id;
        if (!siteId) return;
        const name = typeof siteOrId === 'object' ? siteOrId?.name : sites.find(s => s.id === siteId)?.name;
        const ok = await confirm({
            title: `Delete site "${name || 'this site'}"?`,
            description: 'This permanently removes all of its pages, blocks, and content.',
            confirmLabel: 'Delete site',
            destructive: true,
        });
        if (!ok) return;
        try {
            const res = await authFetch(cmsApi.site(siteId), { method: 'DELETE' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Delete failed (${res.status})`);
            }
            const list = await refreshSites();
            if (siteId === activeSiteIdRef.current) {
                // Active site was just removed — switch to the first
                // remaining site, or clear if none are left.
                const next = list[0]?.id || null;
                if (next) {
                    await handleSwitchSite(next);
                } else {
                    activeSiteIdRef.current = null;
                    setActiveSiteId(null);
                    try { localStorage.removeItem(ACTIVE_SITE_LS_KEY); } catch { /* ignore */ }
                }
            }
        } catch (err) { showToast('error', `Failed to delete site: ${err.message}`); }
    }, [handleSwitchSite, refreshSites, sites, confirm]);

    // ── version management (multi-version per site) ──────────────────
    //
    // A "version" is a full site that shares a versionGroupId with its
    // siblings. Duplicating deep-copies the active site into a new
    // version of the same group; switching versions is just a site
    // switch under the hood.

    // Duplicate the active site into a new version. Pending edits are
    // flushed first so the copy captures the latest content, then the
    // editor switches to the freshly-created version.
    const handleDuplicateSite = useCallback(async () => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        if (inFlightSaveRef.current) {
            try { await inFlightSaveRef.current; } catch { /* surfaced already */ }
            inFlightSaveRef.current = null;
        }
        await flushSaves();
        try {
            const res = await authFetch(cmsApi.siteDuplicate(siteId), { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Duplicate failed (${res.status})`);
            await refreshSites();
            if (data.id) await handleSwitchSite(data.id);
        } catch (err) { showToast('error', `Failed to duplicate version: ${err.message}`); }
    }, [flushSaves, refreshSites, handleSwitchSite]);

    // Make a specific version live. Only one site is live at a time
    // (cms_live_site_id), so this takes the previously-live one — sibling
    // or otherwise — offline. Optimistic with rollback on failure.
    const handleSetLiveVersion = useCallback(async (siteId) => {
        if (!siteId || siteId === liveSiteId) return;
        // Same consequence as the Live toggle: making a version live takes
        // the currently-live site/version offline — confirm when one exists.
        if (liveSiteId) {
            const current = sites.find(s => s.id === liveSiteId);
            const next = sites.find(s => s.id === siteId);
            const ok = await confirm({
                title: 'Switch the live version?',
                description: `"${current?.versionName || current?.name || 'The current version'}" is live right now. Visitors will see "${next?.versionName || next?.name || 'the selected version'}" instead.`,
                confirmLabel: 'Set live',
            });
            if (!ok) return;
        }
        const prevLive = liveSiteId;
        setLiveSiteId(siteId);
        try {
            const res = await authFetch(cmsApi.siteLive(siteId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ live: true }),
            });
            if (!res.ok) throw new Error(`Failed to set version live (${res.status})`);
        } catch (err) {
            showToast('error', err.message);
            setLiveSiteId(prevLive);
        }
    }, [liveSiteId, sites, confirm]);

    // Context value for the LinkField "+ Create new page…" picker. Wraps
    // handleAddPage with keepActive=true so the user stays on whatever
    // they were configuring (Site chrome / current block) instead of
    // being yanked onto the freshly-created page editor. Memoized so the
    // Provider value reference is stable — without it every render of
    // ProductWebsitePanel would re-trigger every consuming LinkField.
    //
    // MUST be declared above the early-return guards below: hooks have
    // to run unconditionally on every render (otherwise React throws
    // "Rendered more hooks than during the previous render" once the
    // guards stop firing).
    const createPageFromPicker = useCallback(
        (input) => handleAddPage(input, { keepActive: true }),
        [handleAddPage],
    );

    // ── render ───────────────────────────────────────────────────────

    if (!sitesLoaded || (loading && !site)) {
        return (
            <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                {sitesLoaded ? 'Loading site…' : 'Loading CMS…'}
            </div>
        );
    }

    if (sitesLoaded && sites.length === 0) {
        return <EmptyState onCreate={handleCreateSite} />;
    }

    const entryId = normalizeVirtualId(activePageId);
    const isChromeView = isChromeEntryId(activePageId);
    const isDesignView = entryId === DESIGN_VIRTUAL_ID;
    const isAnalyticsView = entryId === ANALYTICS_VIRTUAL_ID;

    // Dedicated CMS preview route — isolated from the public site / auth /
    // redirect logic. Page switches do NOT reload the iframe; they're pushed
    // via postMessage in postPreview(). Locale switches remount (key).
    const iframeSrc = `/__cms_preview__?preview=1&locale=${encodeURIComponent(activeLocale)}`;

    // Versions of the active site = every site sharing its versionGroupId.
    // listSites() carries versionGroupId/versionName on each entry; the
    // `|| s.id` fallback covers entries that pre-date versioning.
    const activeGroupId =
        sites.find(s => s.id === activeSiteId)?.versionGroupId
        || site?.versionGroupId
        || activeSiteId;
    const versions = sites.filter(s => (s.versionGroupId || s.id) === activeGroupId);

    const activeLocaleName = locales.find(l => l.code === activeLocale)?.name || activeLocale;
    const isLive = liveSiteId === activeSiteId;

    // Per-locale translation coverage for the locale menu ("n/m fields").
    // Cheap walk over client-side state; soft numbers by design (D3).
    const coverageByLocale = {};
    for (const l of locales) {
        if (l.code === defaultLocale || !site) continue;
        coverageByLocale[l.code] = coverageForLocale(site, pages, localeOverrides, l.code);
    }
    const otherLiveSite = liveSiteId && liveSiteId !== activeSiteId
        ? sites.find(s => s.id === liveSiteId)
        : null;

    const statusText = rightView === 'preview'
        ? `${isChromeView ? 'site chrome' : isDesignView ? 'design' : isAnalyticsView ? 'analytics' : (activePage?.slug || 'home')} · ${activeLocale}${!isLive ? ' · editor only' : ''} · Click text to edit`
        : null;

    // Stage empty-state overlays — the preview always stays center-stage, so
    // "nothing here yet" guidance lives ON the stage instead of a bare pane.
    const noPages = (site?.pages || []).length === 0;
    const activePageEmpty = !!activePage && (activePage.blocks || []).length === 0 && !translationMode;
    const stageOverlay = rightView === 'preview' && (noPages || activePageEmpty) ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto max-w-xs w-full mx-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/95 shadow-xl p-5 text-center">
                <AppIcon
                    name={noPages ? 'FileText' : 'LayoutGrid'}
                    className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]"
                />
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    {noPages ? 'This site has no pages yet' : 'Empty page'}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                    {noPages
                        ? 'Every website starts with a page.'
                        : 'Add your first block from the Blocks list on the left (+).'}
                </p>
                {noPages && (
                    <button
                        type="button"
                        onClick={() => handleAddPage({ title: 'Home' })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white text-xs font-medium hover:bg-[var(--accent-primary)]/90"
                    >
                        <AppIcon name="Plus" className="w-3.5 h-3.5" />
                        Create your first page
                    </button>
                )}
            </div>
        </div>
    ) : null;

    // The iframe node is built HERE so the container keeps owning iframeRef
    // and the key={activeLocale} remount semantics (cms-preview-ready
    // re-handshake); PreviewStage only decides visibility.
    const iframe = (
        <iframe
            ref={iframeRef}
            title="Product website preview"
            src={iframeSrc}
            className="flex-1 w-full bg-white"
            key={activeLocale}
        />
    );

    return (
      <CreatePageContext.Provider value={createPageFromPicker}>
        <CmsBuilderShell
            navOpen={navOpen}
            inspectorOpen={inspectorOpen}
            onCloseNav={() => setNavOpen(false)}
            onCloseInspector={() => setInspectorOpen(false)}
            onCloseAiDock={() => setAssistantOpen(false)}
            locked={builderRunning}
            aiDock={assistantOpen ? (
                <CmsAssistantPane
                    siteId={activeSiteId}
                    bridge={builderBridge}
                    pages={pageIndex}
                    translationMode={translationMode}
                    defaultLocaleName={locales.find(l => l.code === defaultLocale)?.name || defaultLocale}
                    canUndoTurn={builderUndoAvailable}
                    onClose={toggleAssistant}
                />
            ) : null}
            dialogs={
                <>
                    {pendingTemplatePage ? (
                        <SaveTemplateDialog
                            page={pendingTemplatePage}
                            onCancel={() => setPendingTemplatePage(null)}
                            onConfirm={submitTemplate}
                        />
                    ) : null}
                    {addBlockRequest ? (
                        <AddBlockDialog
                            design={site?.design || null}
                            onAdd={(type, variant) => {
                                addBlock(type, addBlockRequest.index, variant ? { variant } : null);
                                setAddBlockRequest(null);
                            }}
                            onCancel={() => setAddBlockRequest(null)}
                        />
                    ) : null}
                    {confirmDialog}
                    <ToastHost />
                </>
            }
            topBar={
                <TopBar
                    onExit={onExit}
                    siteMenuProps={{
                        sites,
                        versions,
                        activeSiteId,
                        liveSiteId,
                        onSelectSite: handleSwitchSite,
                        onCreateSite: handleCreateSite,
                        onRenameSite: handleRenameSite,
                        onDeleteSite: handleDeleteSite,
                        onSetLiveVersion: handleSetLiveVersion,
                        onDuplicateVersion: handleDuplicateSite,
                        onExportSite: handleExportSite,
                        onImportFile: handleImportFileChosen,
                        ioStatus: siteIoStatus,
                    }}
                    localeMenuProps={{
                        locales,
                        activeLocale,
                        defaultLocale,
                        coverageByLocale,
                        onSelect: changeLocaleSafe,
                        onSetDefault: handleSetDefaultLocale,
                        onManageLanguages: onNavigate ? () => onNavigate('admin/languages') : undefined,
                    }}
                    publishProps={{
                        publishing,
                        publishedAt,
                        dirtySincePublish,
                        isLive,
                        liveSiteName: otherLiveSite?.name || null,
                        onPublish: handlePublish,
                        onSetLive: persistLive,
                    }}
                    saveStatus={saveStatus}
                    onRetrySave={retrySave}
                    view={rightView}
                    onViewChange={setRightView}
                    device={device}
                    onDeviceChange={changeDevice}
                    assistantOpen={assistantOpen}
                    onToggleAssistant={toggleAssistant}
                    assistantRunning={builderRunning}
                    history={{
                        canUndo: history.canUndo,
                        canRedo: history.canRedo,
                        onUndo: history.undo,
                        onRedo: history.redo,
                    }}
                    translationMode={translationMode}
                    translatingLocaleName={activeLocaleName}
                    onExitTranslationMode={() => changeLocaleSafe(defaultLocale)}
                    navOpen={navOpen}
                    onToggleNav={toggleNav}
                    inspectorOpen={inspectorOpen}
                    onToggleInspector={toggleInspector}
                    focusMode={focusMode}
                    onToggleFocusMode={toggleFocusMode}
                    onOpenAnalytics={onNavigate ? () => onNavigate('admin/website-analytics') : undefined}
                    onManageLanguages={onNavigate ? () => onNavigate('admin/languages') : undefined}
                    isLive={isLive}
                />
            }
            navigator={
                <NavigatorPanel
                    activeEntryId={entryId}
                    onSelectEntry={setActivePageId}
                    pageListProps={{
                        pages: site?.pages || [],
                        activePageId,
                        onSelect: setActivePageId,
                        onAdd: handleAddPage,
                        onDuplicate: handleDuplicatePage,
                        onDelete: handleDeletePage,
                        onSetHomepage: handleSetHomepage,
                        onRename: (pageId, title) => savePageMeta(pageId, { title }),
                        onEditSlug: (pageId, slug) => savePageMeta(pageId, { slug }),
                        onReorder: handleReorderPages,
                        templates,
                        onSaveAsTemplate: handleSaveAsTemplate,
                        onDeleteTemplate: handleDeleteTemplate,
                        onExportPage: handleExportPage,
                        onImportPage: handleImportPage,
                    }}
                    blockListProps={(activePage && !translationMode) ? {
                        blocks: activePage.blocks || [],
                        activeBlockId,
                        onSelect: setActiveBlockId,
                        // index:null = default insert-after-active behaviour
                        // (the canvas "+" zones request an explicit index).
                        onRequestAdd: () => setAddBlockRequest({ index: null }),
                        onToggle: toggleBlock,
                        onDuplicate: duplicateBlock,
                        onDelete: deleteBlock,
                        onReorder: reorderBlocks,
                    } : null}
                />
            }
            stage={
                <PreviewStage
                    view={rightView}
                    statusText={statusText}
                    errorText={error}
                    onDismissError={() => setError(null)}
                    deviceWidth={device === 'tablet' ? 768 : device === 'mobile' ? 390 : null}
                    overlay={stageOverlay}
                    iframe={iframe}
                    sitemap={rightView === 'sitemap' ? (
                        <SitemapView
                            siteId={activeSiteId}
                            activePageId={isVirtualPageId(activePageId) ? null : activePageId}
                            onSelectPage={(id) => {
                                setActivePageId(id);
                                setRightView('preview');
                            }}
                            onMutated={async () => {
                                // Pull the flyout's server-side changes into panel
                                // state before a stale 'site' save can clobber them.
                                await drainPendingSaves();
                                await reloadPayload();
                            }}
                        />
                    ) : null}
                />
            }
            inspector={
                <InspectorHost
                    activePageId={activePageId}
                    activePage={activePage}
                    translationMode={translationMode}
                    translateProps={{
                        site,
                        page: activePage,
                        localeName: activeLocaleName,
                        defaultLocaleName: locales.find(l => l.code === defaultLocale)?.name || defaultLocale,
                        pageOverride: activePageOverride,
                        siteOverride: activeSiteOverride,
                        aiStatus,
                        onPageLeaf: (blockId, fieldPath, value) =>
                            activePage && updatePageOverride(activePage.id, activeLocale, ['blocks', blockId, 'content', ...fieldPath], value),
                        onPageSeo: (field, value) =>
                            activePage && updatePageOverride(activePage.id, activeLocale, ['seo', field], value),
                        onChromeLeaf: (storagePath, value) =>
                            updateSiteOverride(activeLocale, storagePath, value),
                        onSelectBlock: selectAndScrollToBlock,
                        tier: translateTier,
                        onTierChange: changeTranslateTier,
                        onAiTranslate: () => handleAiTranslate(isChromeView ? 'site' : 'page', translateTier),
                        onClearAndRetranslateBlock: isChromeView ? undefined : handleClearAndRetranslateBlock,
                        onResetTranslations: () => handleResetTranslations(isChromeView ? 'site' : 'page'),
                    }}
                    chromeProps={{
                        site,
                        pages: pageIndex,
                        locales,
                        defaultLocale,
                        onChangeSite: updateSiteChrome,
                    }}
                    designProps={{
                        design: site?.design,
                        onChange: updateDesign,
                    }}
                    analyticsProps={{
                        site,
                        onChange: updateSiteAnalytics,
                        onOpenCookieSettings: () => setActivePageId(COOKIE_VIRTUAL_ID),
                        onOpenAnalytics: onNavigate ? () => onNavigate('admin/website-analytics') : undefined,
                    }}
                    pageProps={{
                        pageIndex,
                        activeBlock,
                        blockEditorTab,
                        onBlockEditorTab: setBlockEditorTab,
                        siteDesign: site?.design,
                        onMetaChange: updatePageMeta,
                        onSeoChange: updatePageSeo,
                        onBlockContentChange: (next) => activePage && activeBlock && updateBlockContent(activePage.id, activeBlock.id, next),
                        onBlockStyleChange: (next) => activePage && activeBlock && updateBlockStyle(activePage.id, activeBlock.id, next),
                        onToggleBlock: toggleBlock,
                    }}
                />
            }
        />
      </CreatePageContext.Provider>
    );
}

// ── Empty state — shown when the org has no sites yet ──────────────

function EmptyState({ onCreate }) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (creating) inputRef.current?.focus();
    }, [creating]);

    // Read the input value via the ref so we never read stale React state
    // (browser autofill and some IME composition events can update the DOM
    // value without firing onChange, which left the previous version of
    // this button permanently disabled even when the field looked filled).
    const submit = async () => {
        const fromRef = inputRef.current?.value ?? '';
        const value = (fromRef || name).trim();
        if (!value) return;
        await onCreate(value);
    };

    return (
        <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-sm w-full text-center">
                <AppIcon name="Globe" className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    No websites yet
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                    Create your first website to start adding pages and blocks.
                </p>
                {creating ? (
                    <div className="text-left">
                        <label className="block text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                            Site name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Acme Bakery"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submit();
                                if (e.key === 'Escape') { setCreating(false); setName(''); }
                            }}
                            className="w-full px-3 py-2 rounded text-sm border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                        <div className="flex justify-end gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => { setCreating(false); setName(''); }}
                                className="text-sm px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                className="text-sm px-3 py-1.5 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90"
                            >
                                Create website
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-primary)]/90"
                    >
                        <AppIcon name="Plus" className="w-4 h-4" />
                        Create your first website
                    </button>
                )}
            </div>
        </div>
    );
}

// Preview content shaping (buildPreviewContent / chromeStoragePath /
// applyChromeEdit / setIn) lives in ./preview/previewContent.js — a pure,
// unit-tested module. Imported at the top of this file.
