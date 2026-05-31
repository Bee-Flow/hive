import React, { useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

// Cache of icon names we've already warned about so an unknown name doesn't
// fire a warning on every render of the same template.
const _warnedIconNames = new Set();
function pickIcon(name) {
    if (!name) return Lucide.Sparkles;
    const found = Lucide[name];
    if (found) return found;
    if (typeof console !== 'undefined' && !_warnedIconNames.has(name)) {
        _warnedIconNames.add(name);
        console.warn(`[TemplateGallery] Unknown lucide icon "${name}" — falling back to Sparkles. Fix the template's icon field.`);
    }
    return Lucide.Sparkles;
}

/**
 * Curated automation gallery shown in the empty state. Lists templates
 * the server returned at /api/automation/templates with category chips
 * for filtering. Picking a card calls `onPick(templateId)` so the
 * parent (EmptyState → AITasksDesigner) can fetch the full definition
 * and create a pre-filled draft.
 *
 * Icon names come straight from lucide-react; we render the matching
 * component or fall back to the Sparkles icon if the name isn't known
 * (keeps the gallery resilient to typos in templates.js).
 */
export default function TemplateGallery({ onPick }) {
    const api = useAutomationApi();
    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        api.listTemplates()
            .then(d => {
                if (!alive) return;
                setTemplates(d?.templates || []);
                setCategories(d?.categories || []);
            })
            .catch(e => { if (alive) setErrorMsg(e.message); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [api]);

    const visible = useMemo(
        () => activeCategory ? templates.filter(t => t.category === activeCategory) : templates,
        [templates, activeCategory],
    );

    if (loading) {
        return <div className="text-[12px] text-[var(--text-tertiary)] text-center py-4">Loading templates…</div>;
    }
    if (errorMsg) {
        return <div className="text-[12px] text-red-600 text-center py-4">{errorMsg}</div>;
    }
    if (templates.length === 0) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                <button
                    onClick={() => setActiveCategory(null)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                        activeCategory === null
                            ? 'bg-[var(--accent-primary)] text-white border-transparent'
                            : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                >
                    All
                </button>
                {categories.map((c) => (
                    <button
                        key={c}
                        // Pick the category; users clear with "All", which is symmetric
                        // with how the "All" chip behaves (clicking it while active is
                        // a no-op, not a toggle to undefined).
                        onClick={() => { if (c !== activeCategory) setActiveCategory(c); }}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                            activeCategory === c
                                ? 'bg-[var(--accent-primary)] text-white border-transparent'
                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                        {c}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visible.map((tmpl) => {
                    const Icon = pickIcon(tmpl.icon);
                    return (
                        <button
                            key={tmpl.id}
                            onClick={() => onPick?.(tmpl.id)}
                            className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition p-4"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} className="text-[var(--text-secondary)]" />
                                <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                                    {tmpl.category}
                                </span>
                            </div>
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                {tmpl.title}
                            </div>
                            <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed line-clamp-3">
                                {tmpl.description}
                            </div>
                            {(Array.isArray(tmpl.requiredIntegrations) && tmpl.requiredIntegrations.length > 0 || tmpl.triggerReadiness === 'push-pending') && (
                                <div className="flex flex-wrap items-center gap-1 mt-2">
                                    {(tmpl.requiredIntegrations || []).map((ig) => (
                                        <span key={ig} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-default)]">
                                            {ig}
                                        </span>
                                    ))}
                                    {tmpl.triggerReadiness === 'push-pending' && (
                                        <span
                                            title="This trigger needs the Bee Flow ExApp connector — pending live validation."
                                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                        >
                                            connector
                                        </span>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
