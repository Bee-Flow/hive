import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';
import { Toggle, CreatePageContext } from './fields';
import { BLOCK_CATALOGUE, BLOCK_EDITORS, BLOCK_DEFAULTS, HeaderEditor, FooterEditor } from './editors';
import CookieBannerEditor from './CookieBannerEditor';
import PageList, { SaveTemplateDialog } from './PageList';
import { exportPage as exportPageToFile } from './pageIO';
import { ToastHost, showToast } from '../guardrails/Toast';
import BlockList from './BlockList';
import SitemapView from './SitemapView';
import AIPagePanel from './AIPagePanel';
import SiteSwitcher from './SiteSwitcher';
import VersionSwitcher from './VersionSwitcher';
import DesignEditor from './DesignEditor';
import BlockStyleEditor from './BlockStyleEditor';
import TranslationPanel from './TranslationPanel';
import { cmsApi } from './cmsApi';
import { setLocalePath, mergePreviewSite, mergePreviewPage } from './localeMerge';

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
 *   ← cms-edit            { path, value }
 *   → cms-preview         { content, design, previewMode }
 *                                                content = { header, footer, blocks };
 *                                                design = site.design (colors/fonts/radius/theme);
 *                                                previewMode = 'page' | 'chrome'
 */

const SITE_VIRTUAL_ID   = '__site__';
const DESIGN_VIRTUAL_ID = '__design__';

// ── helpers ─────────────────────────────────────────────────────────

function newBlockId() {
    return `blk_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneBlock(block) {
    return { ...JSON.parse(JSON.stringify(block)), id: newBlockId() };
}

function formatRelative(iso) {
    if (!iso) return null;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return null;
    const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (diffSec < 45)    return 'just now';
    if (diffSec < 3600)  return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
}

function SaveBadge({ status, onRetry }) {
    const map = {
        idle:   { label: '',                  color: 'var(--text-muted)' },
        dirty:  { label: '● Unsaved',         color: '#fbbf24' },
        saving: { label: 'Saving…',           color: 'var(--text-secondary)' },
        saved:  { label: '✓ Saved',           color: '#34d399' },
        error:  { label: '⚠ Save failed',     color: '#f87171' },
    };
    const s = map[status] || map.idle;
    if (!s.label) return <span />;
    return (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: s.color }}>
            {s.label}
            {status === 'error' && onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className="ml-1 px-1.5 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                    Retry
                </button>
            ) : null}
        </span>
    );
}

function TabBtn({ icon, label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors
                ${active
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
        >
            <AppIcon name={icon} className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

// Compact text-only tab button used inside the block editor (Content / Style).
function SubTabBtn({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors
                ${active
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
        >
            {label}
        </button>
    );
}

// ── main component ───────────────────────────────────────────────────

export default function ProductWebsitePanel() {
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
    // Page templates — global list, summary shape (no blocks payload).
    // Loaded once on mount and refreshed after save/delete. `pendingTemplatePage`
    // holds the page whose context-menu opened the Save dialog (null = no
    // dialog open). The blocks for that page are read out of `pages` state
    // when the user confirms the save.
    const [templates, setTemplates]                       = useState([]);
    const [pendingTemplatePage, setPendingTemplatePage]   = useState(null);

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
    // Holds the batch from the most recent failed flushSaves() so the user
    // can retry without losing their edits. Cleared when a flush succeeds.
    const failedSavesRef    = useRef(null);
    // Live mirror of localeOverrides so the override mutators can read the
    // latest value synchronously between rapid edits (typing in the list)
    // without stale-closure races.
    const localeOverridesRef = useRef({ siteByLocale: {}, pagesByLocale: {} });

    // ── derived ─────────────────────────────────────────────────────

    // Merge the PageDoc with its matching site.pages[i] index entry so the
    // PageMetaStrip can read isHomepage/hideHeader/hideFooter/isNotFound
    // (which live on the index, not the PageDoc).
    const activePage = useMemo(() => {
        if (activePageId === SITE_VIRTUAL_ID || activePageId === DESIGN_VIRTUAL_ID) return null;
        const doc = pages.find(p => p.id === activePageId);
        if (!doc) return null;
        const idx = (site?.pages || []).find(p => p.id === activePageId);
        return idx
            ? { ...doc, isHomepage: !!idx.isHomepage,
                hideHeader: !!idx.hideHeader,
                hideFooter: !!idx.hideFooter,
                isNotFound: !!idx.isNotFound }
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
        setActivePageId(SITE_VIRTUAL_ID);
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
                setActiveLocale(data.defaultLocale || 'en');
                const firstPageId = data.site?.pages?.[0]?.id;
                setActivePageId(firstPageId || SITE_VIRTUAL_ID);
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
            return;
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
            for (const r of results) {
                if (!r.ok) {
                    const d = await r.json().catch(() => ({}));
                    throw new Error(d.error || `Save failed (${r.status})`);
                }
            }
            setSaveStatus('saved');
            if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
            saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 1800);
        } catch (err) {
            // Keep the batch so the user can retry without retyping.
            failedSavesRef.current = batch;
            setError(err.message);
            setSaveStatus('error');
            showToast('error', `Save failed: ${err.message}`);
        } finally {
            inFlightSaveRef.current = null;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    }, []);

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

    // ── page mutations ───────────────────────────────────────────────

    const updatePage = useCallback((pageId, updater) => {
        setPages(prev => {
            const next = prev.map(p => p.id === pageId ? updater(p) : p);
            const updated = next.find(p => p.id === pageId);
            if (updated) scheduleSave(pageId, updated);
            return next;
        });
    }, [scheduleSave]);

    // Block content updated via panel editor
    const updateBlockContent = useCallback((pageId, blockId, nextContent) => {
        updatePage(pageId, p => ({
            ...p,
            blocks: p.blocks.map(b => b.id === blockId ? { ...b, content: nextContent } : b),
        }));
    }, [updatePage]);

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
    const handleAiTranslate = useCallback(async (scope) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId || aiStatus?.state === 'running') return;
        if (scope === 'page' && !activePage) return;
        // Flush any pending manual edits first so the server reads them and
        // doesn't translate over text the user just typed.
        await drainPendingSaves();
        setAiStatus({ state: 'running', scope });
        try {
            const url = scope === 'site'
                ? cmsApi.siteAiTranslate(siteId, activeLocale)
                : cmsApi.pageAiTranslate(siteId, activePage.id, activeLocale);
            const res = await authFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelTier: 'fast' }),
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
        }
    }, [activeLocale, activePage, aiStatus, drainPendingSaves, replacePageOverride, replaceSiteOverride]);

    // Reset AI status when switching page/locale so stale "done" badges clear.
    useEffect(() => { setAiStatus(null); }, [activePageId, activeLocale]);

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
                setSiteDoc(next);
                scheduleSave('site', next);
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
    }, [activePage, updatePage, site, scheduleSave, translationMode, activeLocale, updateSiteOverride, updatePageOverride]);

    // ── block CRUD ───────────────────────────────────────────────────

    const addBlock = useCallback((type) => {
        if (!activePage) return;
        const block = {
            id: newBlockId(),
            type,
            enabled: true,
            content: JSON.parse(JSON.stringify(BLOCK_DEFAULTS[type] || {})),
            style: {},
        };
        updatePage(activePage.id, p => ({ ...p, blocks: [...p.blocks, block] }));
        setActiveBlockId(block.id);
    }, [activePage, updatePage]);

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
        updatePage(activePage.id, p => {
            const blocks = p.blocks.filter(b => b.id !== blockId);
            if (activeBlockId === blockId) setActiveBlockId(blocks[0]?.id || null);
            return { ...p, blocks };
        });
    }, [activePage, activeBlockId, updatePage]);

    const reorderBlocks = useCallback((nextBlocks) => {
        if (!activePage) return;
        updatePage(activePage.id, p => ({ ...p, blocks: nextBlocks }));
    }, [activePage, updatePage]);

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
            setError(err.message);
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
        } catch (err) { setError(err.message); }
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
    }, [handleAddPage, updatePage]);

    // AI page generator — saves a generated PageDoc as a NEW page. Mirrors
    // handleImportPage: routes through handleAddPage (server resolves slug
    // collisions) and patches blocks via updatePage. Errors propagate so
    // AIPagePanel can surface them inline; handleAddPage also sets the
    // panel-level error state.
    const handleSaveGeneratedPage = useCallback(async (page) => {
        const incomingSlug  = (page?.slug  || '').trim() || 'page';
        const incomingTitle = (page?.title || '').trim() || incomingSlug;
        const created = await handleAddPage({ title: incomingTitle, slug: incomingSlug });
        if (!created?.id) throw new Error('Failed to create page');
        updatePage(created.id, p => ({ ...p, blocks: Array.isArray(page?.blocks) ? page.blocks : [] }));
        setRightView('preview');
    }, [handleAddPage, updatePage]);

    const handleDeletePage = useCallback(async (pageId) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        if (!window.confirm('Delete this page? This cannot be undone.')) return;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.page(siteId, pageId), { method: 'DELETE' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            await reloadPayload();
            setActivePageId(SITE_VIRTUAL_ID);
        } catch (err) { setError(err.message); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSetHomepage = useCallback(async (pageId) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        await drainPendingSaves();
        try {
            const res = await authFetch(cmsApi.pageHomepage(siteId, pageId), { method: 'PUT' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            await reloadPayload();
        } catch (err) { setError(err.message); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReorderPages = useCallback(async (orderedIds) => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
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
        } catch (err) { setError(err.message); }
    }, []);

    const reloadPayload = useCallback(async () => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        const res = await authFetch(cmsApi.site(siteId));
        if (!res.ok) return;
        const data = await res.json();
        setSiteDoc(data.site || null);
        setPages(data.pages || []);
        setLocales(data.locales || locales);
        setLocaleOverrides(data.localeOverrides || { siteByLocale: {}, pagesByLocale: {} });
        if (data.publishedAt !== undefined) setPublishedAt(data.publishedAt || null);
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
        setSiteDoc(nextSite);
        scheduleSave('site', nextSite);
    }, [scheduleSave]);

    // Design changes route through the SAME pendingSaves['site'] slot as
    // chrome changes, so a design edit followed by a header edit (or vice
    // versa) coalesces into ONE PUT carrying the latest snapshot of both.
    // Last-write-wins on the entire SiteDoc — no separate /design endpoint,
    // no race window.
    const updateDesign = useCallback((nextDesign) => {
        setSiteDoc(prev => {
            if (!prev) return prev;
            const merged = { ...prev, design: nextDesign };
            scheduleSave('site', merged);
            return merged;
        });
    }, [scheduleSave]);

    // ── top-level toggles ────────────────────────────────────────────

    // Toggle whether *this* site (activeSiteId) is the live one. Only one
    // project can be live at a time; when another site is currently live
    // the user must confirm taking it offline before this one goes live.
    const persistLive = async (next) => {
        if (!activeSiteId) return;
        if (next) {
            const otherLive = liveSiteId && liveSiteId !== activeSiteId
                ? sites.find(s => s.id === liveSiteId)
                : null;
            if (otherLive) {
                const ok = window.confirm(
                    `"${otherLive.name}" is currently live. Setting this site live will take "${otherLive.name}" offline. Continue?`
                );
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
                setError(err.message);
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
                setError(err.message);
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
        await flushSaves();
        setPublishing(true);
        try {
            const res = await authFetch(cmsApi.sitePublish(siteId), { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Publish failed (${res.status})`);
            setPublishedAt(data.publishedAt || new Date().toISOString());
        } catch (err) {
            setError(err.message);
        } finally {
            setPublishing(false);
        }
    }, [flushSaves]);

    const persistDefaultLocale = async (next) => {
        setDefaultLocale(next);
        try {
            await authFetch(cmsApi.defaultLocale(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: next }),
            });
        } catch (err) { setError(err.message); }
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
        const isChromeView = activePageId === SITE_VIRTUAL_ID;
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
        win.postMessage({ type: 'cms-preview', content, design, previewMode }, '*');
    }, [site, previewPage, activePageId, translationMode, activeLocale, localeOverrides]);

    // Select a block AND scroll the preview to it — bound to translation-row
    // clicks so the admin sees which block a string belongs to.
    const selectAndScrollToBlock = useCallback((blockId) => {
        setActiveBlockId(prev => (prev === blockId ? prev : blockId));
        const win = iframeRef.current?.contentWindow;
        if (win && previewReadyRef.current) win.postMessage({ type: 'cms-scroll', blockId }, '*');
    }, []);

    useEffect(() => {
        const onMessage = (e) => {
            const msg = e.data;
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'cms-preview-ready') {
                previewReadyRef.current = true;
                postPreview();
                return;
            }
            if (msg.type === 'cms-edit' && typeof msg.path === 'string') {
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
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [postPreview, applyIframeEdit]);

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
            setError(err.message);
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
        } catch (err) { setError(err.message); }
    }, [refreshSites, reloadPayload]);

    // ── Site export / import ────────────────────────────────────────
    // Export streams the server's JSON response into a Blob and uses
    // a temporary <a download> to trigger a file save dialog. We rely
    // on the Content-Disposition filename the server sets — falling
    // back to a generic name if the browser strips it.
    const [siteIoStatus, setSiteIoStatus] = useState(null);   // { kind: 'success'|'error'|'busy', text }
    const importInputRef = useRef(null);

    const handleExportSite = useCallback(async () => {
        const siteId = activeSiteIdRef.current;
        if (!siteId) return;
        setSiteIoStatus({ kind: 'busy', text: 'Exporting…' });
        try {
            const res = await authFetch(cmsApi.siteExport(siteId));
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Export failed (${res.status})`);
            }
            const blob = await res.blob();
            // Prefer the server-provided filename from Content-Disposition.
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || `site-export-${Date.now()}.json`;
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

    const handleImportFileChosen = useCallback(async (file) => {
        if (!file) return;
        setSiteIoStatus({ kind: 'busy', text: 'Importing…' });
        let payload;
        try {
            const text = await file.text();
            payload = JSON.parse(text);
        } catch {
            setSiteIoStatus({ kind: 'error', text: 'Selected file is not valid JSON' });
            return;
        }
        if (!payload || payload._beeflow_export !== true) {
            setSiteIoStatus({ kind: 'error', text: 'Not a Bee Flow site export file' });
            return;
        }
        try {
            const res = await authFetch(cmsApi.importSite(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
            // Refresh the sidebar list and switch to the newly-created site.
            await refreshSites();
            if (data.siteId) await handleSwitchSite(data.siteId);
            setSiteIoStatus({ kind: 'success', text: `Imported "${data.name || 'site'}"` });
            setTimeout(() => setSiteIoStatus(null), 2400);
        } catch (err) {
            setSiteIoStatus({ kind: 'error', text: err.message || 'Import failed' });
        }
    }, [handleSwitchSite, refreshSites]);

    const handleDeleteSite = useCallback(async (siteId) => {
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
        } catch (err) { setError(err.message); }
    }, [handleSwitchSite, refreshSites]);

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
        } catch (err) { setError(err.message); }
    }, [flushSaves, refreshSites, handleSwitchSite]);

    // Make a specific version live. Only one site is live at a time
    // (cms_live_site_id), so this takes the previously-live one — sibling
    // or otherwise — offline. Optimistic with rollback on failure.
    const handleSetLiveVersion = useCallback(async (siteId) => {
        if (!siteId || siteId === liveSiteId) return;
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
            setError(err.message);
            setLiveSiteId(prevLive);
        }
    }, [liveSiteId]);

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

    const isSiteView   = activePageId === SITE_VIRTUAL_ID;
    const isDesignView = activePageId === DESIGN_VIRTUAL_ID;
    const BlockEditor = activeBlock ? BLOCK_EDITORS[activeBlock.type]?.component : null;

    // Dedicated CMS preview route — isolated from the public site / auth /
    // redirect logic. Page switches do NOT reload the iframe; they're pushed
    // via postMessage in postPreview() below.
    const iframeSrc = `/__cms_preview__?preview=1&locale=${encodeURIComponent(activeLocale)}`;

    // Pages shown in the page list (site chrome as virtual top entry).
    const virtualPages = [
        { id: SITE_VIRTUAL_ID, slug: '', title: 'Site (Header & Footer)', isHomepage: false, _virtual: true },
        ...(site?.pages || []),
    ];

    // Versions of the active site = every site sharing its versionGroupId.
    // listSites() carries versionGroupId/versionName on each entry; the
    // `|| s.id` fallback covers entries that pre-date versioning.
    const activeGroupId =
        sites.find(s => s.id === activeSiteId)?.versionGroupId
        || site?.versionGroupId
        || activeSiteId;
    const versions = sites.filter(s => (s.versionGroupId || s.id) === activeGroupId);

    return (
      <CreatePageContext.Provider value={createPageFromPicker}>
        <div className="h-full flex flex-row" style={{ background: 'var(--bg-primary)' }}>

            {/* ── PANE A: page list (160px) ── */}
            <div className="w-[240px] shrink-0 flex flex-col border-r border-[var(--border-subtle)] h-full">
                {/* site switcher */}
                <div className="p-3 border-b border-[var(--border-subtle)] shrink-0">
                    <SiteSwitcher
                        sites={sites}
                        activeSiteId={activeSiteId}
                        liveSiteId={liveSiteId}
                        onSelect={handleSwitchSite}
                        onCreate={handleCreateSite}
                        onRename={handleRenameSite}
                        onDelete={handleDeleteSite}
                    />
                    {/* Version switcher — lists every version of the
                        active site, set-live per version, duplicate. */}
                    <VersionSwitcher
                        versions={versions}
                        activeSiteId={activeSiteId}
                        liveSiteId={liveSiteId}
                        onSelect={handleSwitchSite}
                        onSetLive={handleSetLiveVersion}
                        onDuplicate={handleDuplicateSite}
                    />
                    {/* Site export / import — secondary visual weight so
                        the main "Create / Delete site" affordance in the
                        switcher above stays primary. */}
                    <div className="flex items-center gap-1.5 mt-2">
                        <button
                            type="button"
                            onClick={handleExportSite}
                            disabled={!activeSiteId || siteIoStatus?.kind === 'busy'}
                            className="flex-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Download this site as a JSON file"
                        >
                            <AppIcon name="Download" className="w-3 h-3" />
                            Export site
                        </button>
                        <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            disabled={siteIoStatus?.kind === 'busy'}
                            className="flex-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Restore a site from a previously-exported JSON file"
                        >
                            <AppIcon name="Upload" className="w-3 h-3" />
                            Import site
                        </button>
                        {/* Hidden input — opened programmatically by the
                            Import button. Reset value on every selection
                            so the same file can be re-picked back-to-back. */}
                        <input
                            ref={importInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) handleImportFileChosen(file);
                            }}
                        />
                    </div>
                    {/* Inline status line — success / error / busy. */}
                    {siteIoStatus ? (
                        <p
                            className={`mt-1.5 text-[10px] leading-tight ${
                                siteIoStatus.kind === 'error'
                                    ? 'text-red-400'
                                    : siteIoStatus.kind === 'success'
                                        ? 'text-emerald-500'
                                        : 'text-[var(--text-muted)]'
                            }`}
                        >
                            {siteIoStatus.kind === 'busy' ? '… ' : ''}{siteIoStatus.text}
                        </p>
                    ) : null}
                </div>
                {/* global controls */}
                <div className="p-3 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Website</span>
                        <SaveBadge status={saveStatus} onRetry={retrySave} />
                    </div>
                    <Toggle label="Live" value={liveSiteId === activeSiteId} onChange={persistLive} />
                    <button
                        type="button"
                        onClick={handlePublish}
                        disabled={publishing || saveStatus === 'saving'}
                        className="mt-2 w-full px-2 py-1.5 rounded-md text-xs font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 text-center">
                        {publishedAt
                            ? `Last published ${formatRelative(publishedAt)}`
                            : 'Not published yet — drafts only visible in editor'}
                    </p>
                    <select
                        className="w-full mt-1 px-2 py-1.5 rounded-md text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]"
                        value={activeLocale}
                        onChange={e => setActiveLocale(e.target.value)}
                    >
                        {locales.map(l => (
                            <option key={l.code} value={l.code}>
                                {l.name} ({l.code}){l.code === defaultLocale ? ' ★' : ''}
                            </option>
                        ))}
                    </select>
                    {activeLocale !== defaultLocale && (
                        <button
                            type="button"
                            onClick={() => persistDefaultLocale(activeLocale)}
                            className="mt-1 w-full text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] text-center"
                        >
                            Set as default locale
                        </button>
                    )}
                </div>

                {/* virtual site entry */}
                <button
                    type="button"
                    onClick={() => setActivePageId(SITE_VIRTUAL_ID)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm shrink-0 w-full text-left
                        ${activePageId === SITE_VIRTUAL_ID
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                >
                    <AppIcon name="LayoutTemplate" className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Site chrome</span>
                </button>

                {/* virtual design entry */}
                <button
                    type="button"
                    onClick={() => setActivePageId(DESIGN_VIRTUAL_ID)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border-b border-[var(--border-subtle)] shrink-0 w-full text-left
                        ${activePageId === DESIGN_VIRTUAL_ID
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                >
                    <AppIcon name="Palette" className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Design</span>
                </button>

                {/* page list */}
                <div className="flex-1 overflow-hidden">
                    <PageList
                        pages={site?.pages || []}
                        activePageId={activePageId}
                        onSelect={setActivePageId}
                        onAdd={handleAddPage}
                        onDuplicate={handleDuplicatePage}
                        onDelete={handleDeletePage}
                        onSetHomepage={handleSetHomepage}
                        onRename={(pageId, title) => savePageMeta(pageId, { title })}
                        onEditSlug={(pageId, slug) => savePageMeta(pageId, { slug })}
                        onReorder={handleReorderPages}
                        templates={templates}
                        onSaveAsTemplate={handleSaveAsTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        onExportPage={handleExportPage}
                        onImportPage={handleImportPage}
                    />
                </div>

                {/* bottom: error + open live */}
                <div className="p-2 border-t border-[var(--border-subtle)] shrink-0">
                    {error
                        ? <p className="text-xs text-red-400 truncate" title={error}>{error}</p>
                        : (liveSiteId === activeSiteId
                            ? <a href="/" target="_blank" rel="noreferrer"
                                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)]">
                                  Open live site ↗
                              </a>
                            : <span className="text-xs text-[var(--text-muted)] italic">
                                  Toggle Live to bring this site online
                              </span>
                        )
                    }
                </div>
            </div>

            {/* ── PANE B: block list + editor (280px) ── */}
            <div className="w-[300px] shrink-0 flex flex-col border-r border-[var(--border-subtle)] h-full">
                {translationMode ? (
                    isDesignView ? (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs p-4 text-center">
                            Design is shared across all languages. Switch to the
                            default language to edit it.
                        </div>
                    ) : (isSiteView || activePage) ? (
                        <TranslationPanel
                            scope={isSiteView ? 'site' : 'page'}
                            site={site}
                            page={activePage}
                            localeName={locales.find(l => l.code === activeLocale)?.name || activeLocale}
                            defaultLocaleName={locales.find(l => l.code === defaultLocale)?.name || defaultLocale}
                            pageOverride={activePageOverride}
                            siteOverride={activeSiteOverride}
                            aiStatus={aiStatus}
                            onPageLeaf={(blockId, fieldPath, value) =>
                                activePage && updatePageOverride(activePage.id, activeLocale, ['blocks', blockId, 'content', ...fieldPath], value)}
                            onPageSeo={(field, value) =>
                                activePage && updatePageOverride(activePage.id, activeLocale, ['seo', field], value)}
                            onChromeLeaf={(storagePath, value) =>
                                updateSiteOverride(activeLocale, storagePath, value)}
                            onSelectBlock={selectAndScrollToBlock}
                            onAiTranslate={() => handleAiTranslate(isSiteView ? 'site' : 'page')}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm p-4 text-center">
                            Select a page to translate.
                        </div>
                    )
                ) : isSiteView ? (
                    <SiteChromeEditor site={site} onChange={updateSiteChrome} pages={pageIndex} />
                ) : isDesignView ? (
                    <DesignEditor design={site?.design} onChange={updateDesign} />
                ) : activePage ? (
                    <>
                        {/* page meta strip */}
                        <PageMetaStrip
                            page={activePage}
                            onMetaChange={updatePageMeta}
                            onSeoChange={updatePageSeo}
                        />

                        {/* block list */}
                        <div className="border-b border-[var(--border-subtle)]" style={{ maxHeight: '35%', minHeight: '120px', overflowY: 'auto' }}>
                            <BlockList
                                blocks={activePage.blocks || []}
                                activeBlockId={activeBlockId}
                                onSelect={setActiveBlockId}
                                onAdd={addBlock}
                                onToggle={toggleBlock}
                                onDuplicate={duplicateBlock}
                                onDelete={deleteBlock}
                                onReorder={reorderBlocks}
                            />
                        </div>

                        {/* block editor */}
                        <div className="flex-1 overflow-y-auto">
                            {activeBlock && BlockEditor ? (
                                <>
                                    <div className="px-4 pt-4 flex items-center gap-2">
                                        <AppIcon name={BLOCK_EDITORS[activeBlock.type]?.icon || 'Square'} className="w-4 h-4 text-[var(--accent-primary)]" />
                                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                                            {BLOCK_EDITORS[activeBlock.type]?.label}
                                        </span>
                                        <div className="ml-auto">
                                            <Toggle
                                                label=""
                                                value={!!activeBlock.enabled}
                                                onChange={() => toggleBlock(activeBlock.id)}
                                            />
                                        </div>
                                    </div>

                                    {/* Content / Style sub-tabs */}
                                    <div className="px-4 mt-3 flex items-center border-b border-[var(--border-subtle)]">
                                        <SubTabBtn
                                            label="Content"
                                            active={blockEditorTab === 'content'}
                                            onClick={() => setBlockEditorTab('content')}
                                        />
                                        <SubTabBtn
                                            label="Style"
                                            active={blockEditorTab === 'style'}
                                            onClick={() => setBlockEditorTab('style')}
                                        />
                                    </div>

                                    {blockEditorTab === 'content' ? (
                                        <div className="px-4 pt-4 pb-6">
                                            <BlockEditor
                                                data={activeBlock.content}
                                                pages={pageIndex}
                                                onChange={next => updateBlockContent(activePage.id, activeBlock.id, next)}
                                            />
                                        </div>
                                    ) : (
                                        <BlockStyleEditor
                                            style={activeBlock.style}
                                            enabled={activeBlock.enabled !== false}
                                            design={site?.design}
                                            onChange={next => updateBlockStyle(activePage.id, activeBlock.id, next)}
                                            onToggleEnabled={() => toggleBlock(activeBlock.id)}
                                        />
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-[var(--text-muted)] text-center py-8 px-4">
                                    {activePage.blocks?.length
                                        ? 'Select a block to edit its settings, or click text in the preview.'
                                        : 'Add a block to get started.'}
                                </p>
                            )}
                        </div>

                        {/* hint */}
                        <div className="px-4 py-2 border-t border-[var(--border-subtle)] shrink-0">
                            <p className="text-xs text-[var(--text-muted)]">
                                Click any text in the preview to edit inline.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm p-4 text-center">
                        Select a page from the list.
                    </div>
                )}
            </div>

            {/* ── PANE C: preview / sitemap (flex-1) ── */}
            <div className="flex-1 hidden lg:flex flex-col min-w-0">
                {/* tab bar */}
                <div className="flex items-center border-b border-[var(--border-subtle)] shrink-0">
                    <TabBtn
                        icon="Monitor"
                        label="Preview"
                        active={rightView === 'preview'}
                        onClick={() => setRightView('preview')}
                    />
                    <TabBtn
                        icon="GitFork"
                        label="Sitemap"
                        active={rightView === 'sitemap'}
                        onClick={() => setRightView('sitemap')}
                    />
                    <TabBtn
                        icon="Sparkles"
                        label="AI"
                        active={rightView === 'ai'}
                        onClick={() => setRightView('ai')}
                    />
                    <div className="flex-1" />
                    {rightView === 'preview' && (
                        <span className="text-[10px] text-[var(--text-muted)] pr-4">
                            {isSiteView ? 'site chrome' : isDesignView ? 'design' : (activePage?.slug || 'home')} · {activeLocale}
                            {liveSiteId !== activeSiteId ? ' · editor only' : ''}
                            {' · '}Click text to edit
                        </span>
                    )}
                </div>

                {/* preview pane — kept mounted so iframe state survives tab switch */}
                <div className={`flex-1 flex flex-col min-h-0 ${rightView === 'preview' ? '' : 'hidden'}`}>
                    <iframe
                        ref={iframeRef}
                        title="Product website preview"
                        src={iframeSrc}
                        className="flex-1 w-full bg-white"
                        key={activeLocale}
                    />
                </div>

                {/* sitemap pane */}
                {rightView === 'sitemap' && (
                    <SitemapView
                        siteId={activeSiteId}
                        activePageId={activePageId === SITE_VIRTUAL_ID ? null : activePageId}
                        onSelectPage={(id) => {
                            setActivePageId(id);
                            setRightView('preview');
                        }}
                    />
                )}

                {/* AI pane */}
                {rightView === 'ai' && (
                    <AIPagePanel
                        activeSiteId={activeSiteId}
                        activeLocale={activeLocale}
                        onSaveAsNewPage={handleSaveGeneratedPage}
                    />
                )}
            </div>
            {pendingTemplatePage ? (
                <SaveTemplateDialog
                    page={pendingTemplatePage}
                    onCancel={() => setPendingTemplatePage(null)}
                    onConfirm={submitTemplate}
                />
            ) : null}
            <ToastHost />
        </div>
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
        // eslint-disable-next-line no-console
        console.log('[EmptyState] Create website clicked — value =', JSON.stringify(value));
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

// ── Site chrome editor (header + footer in pane B when site is selected) ─

function SiteChromeEditor({ site, onChange, pages }) {
    if (!site) return null;
    const setHeader = (h) => onChange({ ...site, header: h });
    const setFooter = (f) => onChange({ ...site, footer: f });
    const setCookieBanner = (c) => onChange({ ...site, cookieBanner: c });

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-1">
                    <AppIcon name="LayoutTemplate" className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Site chrome</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                    Header, footer, and cookie banner are shared across all pages.
                </p>
                <SectionDivider label="Header" />
                <HeaderEditor data={site.header} pages={pages} onChange={setHeader} />
                <SectionDivider label="Footer" />
                <FooterEditor data={site.footer} pages={pages} onChange={setFooter} />
                <SectionDivider label="Cookie banner" />
                <CookieBannerEditor data={site.cookieBanner} onChange={setCookieBanner} />
            </div>
        </div>
    );
}

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
    );
}

// ── Page meta strip (slug, title, SEO, hideHeader/Footer toggles) ────

function PageMetaStrip({ page, onMetaChange, onSeoChange }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-[var(--border-subtle)] shrink-0">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            >
                <span className="flex items-center gap-2">
                    <AppIcon name={page.isHomepage ? 'Home' : 'FileText'} className="w-3.5 h-3.5" />
                    <span className="font-medium">{page.title || '(untitled)'}</span>
                    <span className="text-[var(--text-muted)]">/{page.slug}</span>
                </span>
                <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div className="px-4 pb-3 space-y-2">
                    <MetaInput label="Page title" value={page.title} onChange={v => onMetaChange('title', v)} />
                    <MetaInput label="URL slug" value={page.slug} onChange={v => onMetaChange('slug', v)} mono />
                    <MetaInput label="Meta title" value={page.seo?.metaTitle} onChange={v => onSeoChange('metaTitle', v)} />
                    <MetaInput label="Meta description" value={page.seo?.metaDescription} onChange={v => onSeoChange('metaDescription', v)} />
                    <div className="flex gap-4 pt-1">
                        <MetaToggle label="Hide header" value={page.hideHeader} onChange={v => onMetaChange('hideHeader', v)} />
                        <MetaToggle label="Hide footer" value={page.hideFooter} onChange={v => onMetaChange('hideFooter', v)} />
                    </div>
                </div>
            )}
        </div>
    );
}

function MetaInput({ label, value, onChange, mono }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
            <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className={`w-full px-2 py-1 rounded text-xs border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] ${mono ? 'font-mono' : ''}`}
            />
        </div>
    );
}

function MetaToggle({ label, value, onChange }) {
    return (
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="accent-[var(--accent-primary)]" />
            {label}
        </label>
    );
}

// ── Preview content builder ──────────────────────────────────────────
//
// Converts the new doc shape into the content object the existing
// marketing site sections expect (they read content.header, content.hero, etc.)

function buildPreviewContent(site, activePage) {
    const out = {};

    // Header from site chrome. The header carries:
    //   navLinks  — user-customized nav from site.header.nav (the ONLY
    //               source of nav items now; pages no longer auto-merge)
    //   activeSlug — the page being previewed, so Header.jsx can mark
    //                its matching nav entry active. Empty string = home.
    if (site?.header) {
        out.header = {
            enabled: site.header.enabled !== false,
            // Logo & brand — `logo` is the new shape; `logoText` is kept
            // alongside as a fallback for the public renderer's legacy
            // path (Header.jsx prefers logo.text when present).
            logoText: site.header.logoText,
            logo: site.header.logo || undefined,
            loginLabel: site.header.loginLabel,
            // Header buttons (multi-CTA). Each entry carries label, href
            // (resolved), style, and per-button label typography (font /
            // size / color) for the renderer to apply via inline style.
            ctas: (site.header.ctas || []).map(cta => ({
                id: cta.id,
                label: cta.label,
                href: resolvePreviewHref(cta.link, site?.pages),
                style: cta.style || 'primary',
                labelFont:  cta.labelFont  || '',
                labelSize:  Number.isFinite(cta.labelSize) ? cta.labelSize : 0,
                labelColor: cta.labelColor || '',
            })),
            // Master nav-link style (font / size / color) — applied to
            // every nav link + dropdown child by Header.jsx. Sits as a
            // sibling to navLinks because the items array can't carry
            // string keys.
            navStyle: site.header.navStyle || undefined,
            navLinks: (site.header.nav || []).map(n => {
                const out = {
                    label: n.label,
                    href: resolvePreviewHref(n.link, site?.pages),
                    // Flat children (legacy list-mode dropdown). Always
                    // emitted so the existing renderer path still works.
                    children: (n.children || []).map(c => ({
                        label: c.label,
                        href: resolvePreviewHref(c.link, site?.pages),
                    })),
                };
                // Mega-menu (columns) shape — additive. Only emitted when
                // the user explicitly switched the dropdown to "columns".
                if (n.dropdown?.layout === 'columns') {
                    out.dropdown = {
                        layout: 'columns',
                        columns: (n.dropdown.columns || []).map(col => ({
                            heading: col.heading || '',
                            items: (col.items || []).map(mi => ({
                                label:       mi.label || '',
                                href:        resolvePreviewHref(mi.link, site?.pages),
                                description: mi.description || '',
                                icon:        mi.icon || '',
                                target:      mi.openInNewTab ? '_blank' : undefined,
                                rel:         mi.openInNewTab ? 'noopener noreferrer' : undefined,
                            })),
                        })),
                    };
                }
                return out;
            }),
            activeSlug: activePage?.isHomepage ? '' : (activePage?.slug || ''),
        };
    }
    if (site?.footer) {
        out.footer = {
            enabled: site.footer.enabled !== false,
            // Opt-in 3-button (system / light / dark) switcher rendered
            // by the public Footer. Off by default — only emitted when
            // the user toggles it on in the Site chrome editor.
            themeSwitcher: site.footer.themeSwitcher?.enabled
                ? { enabled: true }
                : undefined,
            brand: { logoText: site.footer.brandText, blurb: site.footer.blurb },
            // Master footer-link style (font + color), applied to every
            // column link AND every social link by Footer.jsx.
            linkStyle: site.footer.linkStyle || undefined,
            columns: (site.footer.columns || []).map(c => ({
                heading: c.heading,
                links: (c.links || []).map(l => ({
                    label: l.label,
                    href: resolvePreviewHref(l.link, site?.pages),
                })),
            })),
            socials: (site.footer.socials || []).map(s => ({
                platform: s.platform,
                href: resolvePreviewHref(s.link, site?.pages),
            })),
            copyright: site.footer.copyright,
        };
    }
    // Cookie banner — site-wide chrome, passed through verbatim so the
    // preview iframe renders/edits it the same way the published site will.
    if (site?.cookieBanner) out.cookieBanner = site.cookieBanner;

    // Blocks for the active page. We emit BOTH:
    //   - the legacy keyed shape (out.hero, out.features, …) so the public
    //     site renderer at "/" keeps working until it migrates,
    //   - blocks[] in panel order so the preview can render them in the
    //     order the editor sees (multi-page WordPress-style).
    // Per-page chrome visibility — sourced from the site-index entry
    // (kept in sync with the page doc by savePageMeta). The renderer
    // hides Header/Footer when these are true; preview shows the editor
    // the same outcome the published site will produce.
    out.hideHeader = !!activePage?.hideHeader;
    out.hideFooter = !!activePage?.hideFooter;

    if (activePage?.blocks) {
        const blocksOut = [];
        for (const block of activePage.blocks) {
            // legacyifyLinks mutates `node.link` → `node.href` in place,
            // so we MUST deep-clone before calling it. A shallow spread
            // would share nested objects (block.content.cta, every nav
            // item, every Content-block element) with panel state — and
            // the next preview push would silently delete `link` off the
            // user's source-of-truth shape, snapping LinkField back to
            // its default kind on the next render and persisting the
            // corruption on the next auto-save.
            const legacy = JSON.parse(JSON.stringify({
                enabled: block.enabled !== false,
                ...(block.content || {}),
            }));
            legacyifyLinks(legacy, site?.pages);
            out[block.type] = legacy;
            blocksOut.push({
                id: block.id,
                type: block.type,
                enabled: block.enabled !== false,
                content: legacy,
                // style is opaque to the preview content builder — pass it
                // through verbatim so the iframe wrapper can apply it.
                style: block.style || {},
            });
        }
        out.blocks = blocksOut;
    }

    return out;
}

function resolvePreviewHref(link, pages) {
    if (!link) return '#';
    if (link.kind === 'anchor')   return `#${link.anchor || ''}`;
    if (link.kind === 'app')      return link.path || '/';
    if (link.kind === 'external') return link.url || '#';
    if (link.kind === 'page') {
        const page = (pages || []).find(p => p.id === link.pageId);
        if (!page) return '#';                          // broken — page deleted
        // Public site is served at `/` (RootPathGate). Non-homepage pages
        // route via `/?slug=<slug>` so the browser keeps pathname='/' and
        // the BeeFlow app router doesn't intercept.
        const base = page.isHomepage ? '/' : `/?slug=${encodeURIComponent(page.slug)}`;
        return link.anchor ? `${base}#${link.anchor}` : base;
    }
    return '#';
}

// Link union: only these four kinds describe a Link object. Other blocks
// (e.g. Media + Text) use `kind` for unrelated discriminators (image vs
// video), so we MUST whitelist before treating an object as a Link.
const LINK_KINDS = ['page', 'external', 'anchor', 'app'];

function legacyifyLinks(node, pages) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => legacyifyLinks(n, pages)); return; }
    for (const [k, v] of Object.entries(node)) {
        if (v && typeof v === 'object' && !Array.isArray(v)
            && typeof v.kind === 'string' && LINK_KINDS.includes(v.kind)) {
            if (k === 'link') {
                node.href = resolvePreviewHref(v, pages);
                delete node.link;
            } else if (k === 'ctaLink') {
                node.ctaHref = resolvePreviewHref(v, pages);
                delete node.ctaLink;
            } else {
                node[k] = resolvePreviewHref(v, pages);
            }
        } else {
            legacyifyLinks(v, pages);
        }
    }
}

// ── Chrome-path inverse mapper ───────────────────────────────────────
//
// buildPreviewContent re-shapes the SiteDoc for the iframe, so EditableText
// emits paths in display-shape (e.g. footer.brand.blurb), while the SiteDoc
// stores them in storage-shape (footer.blurb). applyChromeEdit walks the
// path, translates the few non-passthrough keys, and returns a new SiteDoc
// with the value applied. Returns null if the path doesn't map to anything
// the SiteDoc owns (so the caller can ignore the edit safely).
// Maps an iframe display-shape chrome path (e.g. footer.brand.blurb,
// header.navLinks.0.label) to the storage-shape path array the SiteDoc /
// site-locale override uses (footer.blurb, header.nav.0.label). Returns null
// if the path isn't a chrome path. Shared by applyChromeEdit (base doc) and
// the translation-mode override writer.
function chromeStoragePath(path) {
    const parts = path.split('.');
    const root = parts[0];
    if (root !== 'header' && root !== 'footer') return null;

    if (root === 'footer' && parts[1] === 'brand' && parts[2] === 'logoText' && parts.length === 3) {
        return ['footer', 'brandText'];
    } else if (root === 'footer' && parts[1] === 'brand' && parts[2] === 'blurb' && parts.length === 3) {
        return ['footer', 'blurb'];
    } else if (root === 'header' && parts[1] === 'navLinks') {
        // header.navLinks.{i}.label                       → header.nav[i].label
        // header.navLinks.{i}.children.{j}.label          → header.nav[i].children[j].label
        // Convert numeric segments in the tail to actual numbers so setIn
        // recognises array indices (otherwise children would silently be
        // converted to a plain object keyed by numeric strings).
        return [
            'header',
            'nav',
            Number(parts[2]),
            ...parts.slice(3).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg),
        ];
    } else if (root === 'header' && parts[1] === 'ctas') {
        // header.ctas.{i}.label → header.ctas[i].label (storage shape
        // matches display shape here, but we still need to convert the
        // index to a number for setIn).
        return [
            'header',
            'ctas',
            Number(parts[2]),
            ...parts.slice(3).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg),
        ];
    }
    // Pass-through: header.logoText / header.logo.text / header.loginLabel /
    // footer.copyright / footer.columns.{i}.heading /
    // footer.columns.{i}.links.{j}.label
    return parts.map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);
}

function applyChromeEdit(site, path, value) {
    const storagePath = chromeStoragePath(path);
    if (!storagePath) return null;
    return setIn(site, storagePath, value);
}

// Immutable nested setter. Numeric path segments produce arrays; string
// segments produce objects. Missing intermediate nodes are created so the
// edit can land even when the user is filling in a freshly-empty field.
function setIn(obj, path, value) {
    if (path.length === 0) return value;
    const [head, ...tail] = path;
    const childIsArray = tail.length > 0 && typeof tail[0] === 'number';
    const headIsArray = typeof head === 'number';
    const base = headIsArray ? (Array.isArray(obj) ? [...obj] : []) : { ...(obj || {}) };
    const childExisting = base[head];
    const childInit = childIsArray
        ? (Array.isArray(childExisting) ? childExisting : [])
        : (childExisting && typeof childExisting === 'object' ? childExisting : {});
    base[head] = setIn(tail.length ? childInit : undefined, tail, value);
    return base;
}
