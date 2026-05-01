import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';
import { Toggle } from './fields';
import { SECTION_EDITORS, SECTION_ORDER } from './editors';

/**
 * Product Website CMS — admin panel.
 *
 * Editing model (WordPress-like):
 *   - Live preview iframe is the canvas. Click any text to edit it inline.
 *   - Hover a section to get a toolbar (Settings, Hide).
 *   - This left panel is for STRUCTURAL controls only:
 *       master toggle, locale, section list, image uploads, icons, links,
 *       add/remove/reorder list items.
 *   - All saves are automatic (debounced ~1s after last change).
 *
 * Cross-iframe protocol:
 *   ← cms-preview-ready    when the iframe has mounted in preview mode
 *   ← cms-edit             { path, value }       inline text edit committed
 *   ← cms-section-action   { section, action }   hover-toolbar action
 *   → cms-preview          { content }           push merged content
 *   → cms-active-section   { section }           highlight a section
 */
export default function ProductWebsitePanel() {
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState(null);
    const [enabled, setEnabled]             = useState(false);
    const [defaultLocale, setDefaultLocale] = useState('en');
    const [locales, setLocales]             = useState([{ code: 'en', name: 'English', isDefault: true }]);
    const [contentByLocale, setContentByLocale] = useState({});
    const [defaults, setDefaults]           = useState({});
    const [activeLocale, setActiveLocale]   = useState('en');
    const [activeSection, setActiveSection] = useState('hero');
    const [saveStatus, setSaveStatus]       = useState('idle'); // idle | dirty | saving | saved | error

    const iframeRef           = useRef(null);
    const previewReadyRef     = useRef(false);
    const saveTimerRef        = useRef(null);
    const saveStatusTimerRef  = useRef(null);
    // Latest snapshot — used by the debounced save fn so it never picks up
    // a stale closure value when the timer fires.
    const contentRef          = useRef({});
    const localeRef           = useRef('en');

    // ── Initial load ──────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/cms/admin`);
                if (!res.ok) throw new Error(`Failed to load CMS (${res.status})`);
                const data = await res.json();
                if (cancelled) return;
                setEnabled(!!data.enabled);
                setDefaultLocale(data.defaultLocale || 'en');
                setLocales(data.locales || [{ code: 'en', name: 'English', isDefault: true }]);
                setDefaults(data.defaults || {});
                setContentByLocale(data.contentByLocale || {});
                setActiveLocale(data.defaultLocale || 'en');
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // The "effective" content the editor edits = defaults merged with this
    // locale's stored content — so untouched fields still show defaults.
    const activeContent = useMemo(() => {
        const localeData = contentByLocale[activeLocale] || {};
        const merged = {};
        for (const id of SECTION_ORDER) {
            merged[id] = { ...(defaults[id] || {}), ...(localeData[id] || {}) };
        }
        return merged;
    }, [contentByLocale, activeLocale, defaults]);

    // ── Mutation primitives ───────────────────────────────────────────────
    const updateSection = (sectionId, nextSectionData) => {
        setContentByLocale((prev) => {
            const localeData = { ...(prev[activeLocale] || {}) };
            localeData[sectionId] = nextSectionData;
            return { ...prev, [activeLocale]: localeData };
        });
        scheduleAutoSave();
    };

    const setByPath = (path, value) => {
        // path: "hero.lead" or "features.items.0.title"
        setContentByLocale((prev) => {
            const localeData = prev[activeLocale] || {};
            // Start from the merged content so previously-default fields get
            // committed correctly when the admin first edits them.
            const merged = {};
            for (const id of SECTION_ORDER) {
                merged[id] = { ...(defaults[id] || {}), ...(localeData[id] || {}) };
            }

            const parts = path.split('.');
            const root = { ...merged };
            let cur = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const k = parts[i];
                const child = cur[k];
                cur[k] = Array.isArray(child) ? [...child] : { ...(child || {}) };
                cur = cur[k];
            }
            cur[parts[parts.length - 1]] = value;

            // Persist only the section the path touched.
            const sectionId = parts[0];
            return {
                ...prev,
                [activeLocale]: { ...(prev[activeLocale] || {}), [sectionId]: root[sectionId] },
            };
        });
        scheduleAutoSave();
    };

    // ── Auto-save (debounced) ─────────────────────────────────────────────
    const scheduleAutoSave = () => {
        setSaveStatus('dirty');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => doSave(), 800);
    };

    // Keep the ref pointed at the latest state so the debounced save fn
    // always flushes the most recent edit, not a stale closure value.
    useEffect(() => { contentRef.current = contentByLocale; }, [contentByLocale]);
    useEffect(() => { localeRef.current = activeLocale; },     [activeLocale]);

    const doSave = async () => {
        // Always save the latest snapshot at flush time.
        const locale = localeRef.current;
        const snapshot = { locale, data: contentRef.current[locale] || {} };
        setSaveStatus('saving');
        try {
            const res = await authFetch(`${API_BASE}/api/cms/admin/content/${snapshot.locale}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: snapshot.data }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Save failed (${res.status})`);
            }
            setSaveStatus('saved');
            // Auto-fade the "Saved" badge after a moment.
            if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
            saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1800);
        } catch (err) {
            setError(err.message);
            setSaveStatus('error');
        }
    };

    // Re-run save when content changes after a debounce kick. (We re-create
    // the timer on each change in scheduleAutoSave, so this effect just
    // catches the post-save snapshot.)
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        };
    }, []);

    // ── Iframe ↔ panel postMessage protocol ──────────────────────────────
    useEffect(() => {
        const onMessage = (e) => {
            const msg = e.data;
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'cms-preview-ready') {
                previewReadyRef.current = true;
                postPreview();
                postActiveSection(activeSection);
                return;
            }
            if (msg.type === 'cms-edit' && typeof msg.path === 'string') {
                setByPath(msg.path, msg.value);
                return;
            }
            if (msg.type === 'cms-section-action' && msg.section) {
                if (msg.action === 'focus') {
                    setActiveSection(msg.section);
                }
                if (msg.action === 'toggle') {
                    const cur = activeContent[msg.section] || {};
                    updateSection(msg.section, { ...cur, enabled: !cur.enabled });
                    setActiveSection(msg.section);
                }
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [activeSection, activeContent]); // eslint-disable-line react-hooks/exhaustive-deps

    const postPreview = () => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !previewReadyRef.current) return;
        win.postMessage({ type: 'cms-preview', content: activeContent }, '*');
    };
    const postActiveSection = (id) => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !previewReadyRef.current) return;
        win.postMessage({ type: 'cms-active-section', section: id }, '*');
    };

    // Push structural changes from the panel into the iframe (debounced).
    useEffect(() => {
        const t = setTimeout(postPreview, 250);
        return () => clearTimeout(t);
    }, [activeContent]); // eslint-disable-line react-hooks/exhaustive-deps

    // Push active-section highlight whenever it changes.
    useEffect(() => {
        postActiveSection(activeSection);
    }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Persistence for top-level toggles ─────────────────────────────────
    const persistEnabled = async (next) => {
        setEnabled(next);
        try {
            await authFetch(`${API_BASE}/api/cms/admin/enabled`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            });
        } catch (err) {
            setError(err.message);
        }
    };
    const persistDefaultLocale = async (next) => {
        setDefaultLocale(next);
        try {
            await authFetch(`${API_BASE}/api/cms/admin/default-locale`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: next }),
            });
        } catch (err) {
            setError(err.message);
        }
    };

    // ── Toggle a section's visibility from the section list ──────────────
    const toggleSectionVisibility = (id, e) => {
        e.stopPropagation();
        const cur = activeContent[id] || {};
        updateSection(id, { ...cur, enabled: !cur.enabled });
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                Loading CMS…
            </div>
        );
    }

    const ActiveEditor = SECTION_EDITORS[activeSection]?.component;
    const activeMeta   = SECTION_EDITORS[activeSection];
    const activeData   = activeContent[activeSection] || {};

    return (
        <div className="h-full flex flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
            {/* ─────────────── LEFT COLUMN ─────────────── */}
            <div className="lg:w-[420px] lg:max-w-[420px] h-full flex flex-col border-r border-[var(--border-subtle)]">

                {/* Top: master toggle + locale */}
                <div className="p-4 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">Product Website</h2>
                        <SaveBadge status={saveStatus} />
                    </div>
                    <Toggle
                        label="Live at /"
                        value={enabled}
                        onChange={persistEnabled}
                    />
                    <div className="flex gap-2 mt-2">
                        <select
                            className="flex-1 px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]"
                            value={activeLocale}
                            onChange={(e) => setActiveLocale(e.target.value)}
                        >
                            {locales.map(l => (
                                <option key={l.code} value={l.code}>
                                    {l.name} ({l.code}){l.code === defaultLocale ? ' — default' : ''}
                                </option>
                            ))}
                        </select>
                        {activeLocale !== defaultLocale ? (
                            <button
                                type="button"
                                onClick={() => persistDefaultLocale(activeLocale)}
                                className="px-2.5 py-2 text-xs rounded-md border border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)]"
                                title="Make this the fallback locale"
                            >
                                Set default
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Section list */}
                <div className="border-b border-[var(--border-subtle)] shrink-0">
                    <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        Sections
                    </div>
                    <div className="px-2 pb-2 max-h-[40vh] overflow-y-auto">
                        {SECTION_ORDER.map((id) => {
                            const meta = SECTION_EDITORS[id];
                            const sectionData = activeContent[id] || {};
                            const isActive = id === activeSection;
                            const visible = !!sectionData.enabled;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setActiveSection(id)}
                                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors ${
                                        isActive
                                            ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded flex items-center justify-center ${
                                        isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                                    }`}>
                                        <AppIcon name={meta.icon} className="w-4 h-4" />
                                    </span>
                                    <span className="flex-1 truncate">{meta.label}</span>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => toggleSectionVisibility(id, e)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSectionVisibility(id, e); }}
                                        className={`w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] ${
                                            visible ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                                        }`}
                                        title={visible ? 'Hide section' : 'Show section'}
                                    >
                                        <AppIcon name={visible ? 'Eye' : 'EyeOff'} className="w-4 h-4" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected section's structural settings */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AppIcon name={activeMeta?.icon || 'Settings'} className="w-4 h-4 text-[var(--accent-primary)]" />
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{activeMeta?.label}</h3>
                        </div>
                        <Toggle
                            label=""
                            value={!!activeData.enabled}
                            onChange={(v) => updateSection(activeSection, { ...activeData, enabled: v })}
                        />
                    </div>
                    <div className="px-4 pb-6">
                        {ActiveEditor ? (
                            <ActiveEditor
                                data={activeData}
                                onChange={(next) => updateSection(activeSection, next)}
                            />
                        ) : null}
                    </div>
                </div>

                {/* Bottom: error + view live link */}
                <div className="p-3 border-t border-[var(--border-subtle)] shrink-0 flex items-center justify-between text-xs">
                    {error ? (
                        <span className="text-red-400 truncate flex-1 mr-2" title={error}>{error}</span>
                    ) : (
                        <span className="text-[var(--text-muted)]">Click any text in the preview to edit it.</span>
                    )}
                    <a
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                    >
                        Open live site ↗
                    </a>
                </div>
            </div>

            {/* ─────────────── RIGHT COLUMN: live preview ─────────────── */}
            <div className="flex-1 hidden lg:flex flex-col">
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center justify-between">
                    <span>Live preview · {activeLocale}{!enabled ? ' · (site disabled)' : ''}</span>
                    <span>Click text to edit · Hover sections for actions</span>
                </div>
                <iframe
                    ref={iframeRef}
                    title="Product website preview"
                    src={`/?preview=1&locale=${encodeURIComponent(activeLocale)}`}
                    className="flex-1 w-full bg-white"
                    key={activeLocale /* reload on locale switch */}
                />
            </div>
        </div>
    );
}

// ── Save status badge ──────────────────────────────────────────────────────
function SaveBadge({ status }) {
    const styles = {
        idle:   { color: 'var(--text-muted)',     label: '' },
        dirty:  { color: '#fbbf24',               label: '● Unsaved' },
        saving: { color: 'var(--text-secondary)', label: 'Saving…' },
        saved:  { color: '#34d399',               label: '✓ Saved' },
        error:  { color: '#f87171',               label: '⚠ Save failed' },
    };
    const s = styles[status] || styles.idle;
    if (!s.label) return <span />;
    return (
        <span className="text-xs font-medium" style={{ color: s.color }}>
            {s.label}
        </span>
    );
}
