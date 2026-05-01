import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { Toggle } from './fields';
import { SECTION_EDITORS, SECTION_ORDER } from './editors';

/**
 * Product Website CMS — admin panel.
 *
 * Layout:
 *   ┌─ Left column ─────────────┐ ┌─ Right column ──────────┐
 *   │ enable toggle + locale     │ │  iframe live preview     │
 *   │ section accordion          │ │  posts content draft on  │
 *   │ save / discard             │ │  every keystroke         │
 *   └────────────────────────────┘ └──────────────────────────┘
 */
export default function ProductWebsitePanel() {
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);
    const [enabled, setEnabled]               = useState(false);
    const [defaultLocale, setDefaultLocale]   = useState('en');
    const [locales, setLocales]               = useState([{ code: 'en', name: 'English', isDefault: true }]);
    const [contentByLocale, setContentByLocale] = useState({});
    const [defaults, setDefaults]             = useState({});
    const [activeLocale, setActiveLocale]     = useState('en');
    const [openSection, setOpenSection]       = useState('hero');
    const [dirty, setDirty]                   = useState(false);
    const [saving, setSaving]                 = useState(false);
    const [savedAt, setSavedAt]               = useState(null);

    const iframeRef = useRef(null);
    const previewReadyRef = useRef(false);

    // ── Initial load ───────────────────────────────────────────
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
    // locale's stored content. Keys the admin hasn't touched still show the
    // default value, so the form is never empty.
    const activeContent = useMemo(() => {
        const localeData = contentByLocale[activeLocale] || {};
        const merged = {};
        for (const id of SECTION_ORDER) {
            merged[id] = { ...(defaults[id] || {}), ...(localeData[id] || {}) };
        }
        return merged;
    }, [contentByLocale, activeLocale, defaults]);

    // ── Edit one section's data ────────────────────────────────
    const updateSection = (sectionId, nextSectionData) => {
        const localeData = { ...(contentByLocale[activeLocale] || {}) };
        localeData[sectionId] = nextSectionData;
        setContentByLocale({ ...contentByLocale, [activeLocale]: localeData });
        setDirty(true);
    };

    // ── Live preview postMessage ───────────────────────────────
    // The iframe posts {type: 'cms-preview-ready'} when ProductWebsite
    // mounts in preview mode. After that we push every edit (debounced)
    // so the live page updates without a server round-trip.
    useEffect(() => {
        const onMessage = (e) => {
            if (e.data?.type === 'cms-preview-ready') {
                previewReadyRef.current = true;
                postPreview();
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const postPreview = () => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !previewReadyRef.current) return;
        win.postMessage({ type: 'cms-preview', content: activeContent }, '*');
    };

    // Debounced post on every edit / locale switch.
    useEffect(() => {
        const t = setTimeout(postPreview, 300);
        return () => clearTimeout(t);
    }, [activeContent]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Persistence actions ────────────────────────────────────
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

    const saveContent = async () => {
        setSaving(true);
        setError(null);
        try {
            // Save only the keys that differ from defaults — keeps the stored
            // payload tight and lets defaults evolve without overwriting saves.
            const localeData = contentByLocale[activeLocale] || {};
            const res = await authFetch(`${API_BASE}/api/cms/admin/content/${activeLocale}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: localeData }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Save failed (${res.status})`);
            }
            setDirty(false);
            setSavedAt(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const discardChanges = async () => {
        // Easiest: reload from server.
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/cms/admin`);
            const data = await res.json();
            setContentByLocale(data.contentByLocale || {});
            setDirty(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                Loading CMS…
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Left column: editor ─────────────────────────── */}
            <div className="lg:w-[45%] lg:max-w-[640px] h-full flex flex-col border-r border-[var(--border-subtle)]">
                <div className="p-4 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Product Website</h2>
                        <a
                            href="/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                        >
                            Open live site ↗
                        </a>
                    </div>
                    <Toggle
                        label="Enable public marketing site at /"
                        value={enabled}
                        onChange={persistEnabled}
                    />
                    <div className="flex gap-2 mt-3">
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
                                className="px-3 py-2 text-xs rounded-md border border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)]"
                            >
                                Set as default
                            </button>
                        ) : null}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                        Editing <strong>{activeLocale}</strong>. Untranslated fields fall back to {defaultLocale}, then to built-in defaults.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {SECTION_ORDER.map((id) => {
                        const meta = SECTION_EDITORS[id];
                        const Editor = meta.component;
                        const open = openSection === id;
                        const sectionData = activeContent[id] || {};
                        return (
                            <div key={id} className="mb-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                                <button
                                    type="button"
                                    onClick={() => setOpenSection(open ? null : id)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${sectionData.enabled ? 'bg-emerald-400' : 'bg-[var(--border-default)]'}`} />
                                        {meta.label}
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)]">{open ? '−' : '+'}</span>
                                </button>
                                {open ? (
                                    <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)]">
                                        <Toggle
                                            label="Show this section"
                                            value={!!sectionData.enabled}
                                            onChange={(v) => updateSection(id, { ...sectionData, enabled: v })}
                                        />
                                        <Editor data={sectionData} onChange={(next) => updateSection(id, next)} />
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-[var(--border-subtle)] shrink-0 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={saveContent}
                        disabled={!dirty || saving}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={discardChanges}
                        disabled={!dirty || saving}
                        className="px-4 py-2 rounded-md text-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                        Discard
                    </button>
                    <span className="text-xs text-[var(--text-muted)] flex-1 text-right">
                        {error ? <span className="text-red-400">{error}</span>
                            : dirty ? 'Unsaved changes'
                                : savedAt ? `Saved ${savedAt.toLocaleTimeString()}`
                                    : ''}
                    </span>
                </div>
            </div>

            {/* ── Right column: iframe preview ────────────────── */}
            <div className="flex-1 hidden lg:flex flex-col">
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center justify-between">
                    <span>Live preview ({activeLocale})</span>
                    <span>Updates as you type</span>
                </div>
                <iframe
                    ref={iframeRef}
                    title="Product website preview"
                    src={`/?preview=1&locale=${encodeURIComponent(activeLocale)}`}
                    className="flex-1 w-full bg-white"
                />
            </div>
        </div>
    );
}
