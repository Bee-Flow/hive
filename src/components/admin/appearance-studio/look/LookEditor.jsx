import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import LookSectionNav from './LookSectionNav';
import LookPreview from './preview/LookPreview';
import SaveBar from './SaveBar';
import AccentSection from './sections/AccentSection';
import AccessSection from './sections/AccessSection';
import AdvancedGlassDisclosure from './sections/AdvancedGlassDisclosure';
import GlassSection from './sections/GlassSection';
import PresetSection from './sections/PresetSection';
import RadiusSection from './sections/RadiusSection';
import TypographySection from './sections/TypographySection';
import WallpaperSection from './sections/WallpaperSection';
import { useLookForm, SECTION_IDS } from './useLookForm';

const SPLIT_VIEWPORT_PX = 1100;

const NAV_SECTIONS = [
    { id: SECTION_IDS.preset,     label: 'Preset' },
    { id: SECTION_IDS.accent,     label: 'Accent' },
    { id: SECTION_IDS.wallpaper,  label: 'Wallpaper' },
    { id: SECTION_IDS.glass,      label: 'Glass' },
    { id: SECTION_IDS.typography, label: 'Typography' },
    { id: SECTION_IDS.radius,     label: 'Radius' },
    { id: SECTION_IDS.access,     label: 'Access' },
    { id: SECTION_IDS.advanced,   label: 'Advanced' },
];

/**
 * LookEditor — the single-page editor that absorbs Theme + Wallpaper. Owns no
 * state directly; `useLookForm` provides the draft + actions, and the section
 * components are stateless renderers driven by `form` / `setForm`.
 *
 * Layout:
 *   ≥1100px: [ left nav | scrollable sections | sticky preview rail ]
 *   <1100px: [ horizontal pill nav above scrollable sections, no preview rail ]
 *
 * Active section highlight uses an IntersectionObserver — the section whose
 * top is closest to the scroll container's top wins.
 */
export default function LookEditor() {
    const { form, setForm, dirty, saving, loading, error, save, discard, reload, draftPayload } = useLookForm();

    const wide = useViewportWide(SPLIT_VIEWPORT_PX);
    const scrollRef = useRef(null);
    const [activeSectionId, setActiveSectionId] = useState(NAV_SECTIONS[0].id);
    const sectionIds = useMemo(() => NAV_SECTIONS.map((s) => s.id), []);
    const isGlassPreset = form?.preset === 'glass' || form?.preset === 'glass-dark';

    // Active-section tracking via IntersectionObserver against the scroll
    // container. The root is the scroll container so anchored thresholds line
    // up with the actual viewport an admin sees.
    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return undefined;
        const observers = [];
        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const io = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) setActiveSectionId(id);
                    });
                },
                {
                    root,
                    // Wide top margin so the section "active" tag flips just before
                    // it scrolls past the top, matching where the eye lands.
                    rootMargin: '-25% 0px -65% 0px',
                    threshold: 0,
                },
            );
            io.observe(el);
            observers.push(io);
        });
        return () => observers.forEach((io) => io.disconnect());
    }, [sectionIds, isGlassPreset]);

    const jumpTo = (id) => {
        const el = document.getElementById(id);
        if (!el || !scrollRef.current) return;
        // scrollIntoView with `block: start` would scroll the page; we want only
        // the editor container to scroll. Compute the offset manually.
        const top = el.offsetTop - 16;
        scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    };

    if (loading || !form) {
        return (
            <div
                className="h-full flex items-center justify-center"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}
            >
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    const sectionPanel = (
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-10">
            <header>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Look
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Set the look that everyone in your organisation sees by default. Changes preview live in the pane on the right.
                </p>
            </header>

            <PresetSection form={form} setForm={setForm} saving={saving} />
            <AccentSection form={form} setForm={setForm} saving={saving} />
            <WallpaperSection form={form} setForm={setForm} saving={saving} />
            {isGlassPreset && <GlassSection form={form} setForm={setForm} saving={saving} />}
            <TypographySection form={form} setForm={setForm} saving={saving} />
            <RadiusSection form={form} setForm={setForm} saving={saving} />
            <AccessSection form={form} setForm={setForm} saving={saving} />
            {isGlassPreset && <AdvancedGlassDisclosure form={form} setForm={setForm} saving={saving} />}
        </div>
    );

    return (
        <div className="h-full flex" style={{ background: 'var(--bg-primary)' }}>
            {wide && (
                <LookSectionNav
                    sections={NAV_SECTIONS.filter(
                        (s) => isGlassPreset || (s.id !== SECTION_IDS.glass && s.id !== SECTION_IDS.advanced),
                    )}
                    activeId={activeSectionId}
                    onJump={jumpTo}
                    orientation="vertical"
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: 'var(--border-subtle)' }}>
                {!wide && (
                    <LookSectionNav
                        sections={NAV_SECTIONS.filter(
                            (s) => isGlassPreset || (s.id !== SECTION_IDS.glass && s.id !== SECTION_IDS.advanced),
                        )}
                        activeId={activeSectionId}
                        onJump={jumpTo}
                        orientation="horizontal"
                    />
                )}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto"
                    style={{ background: 'var(--bg-primary)' }}
                >
                    {sectionPanel}
                </div>
                <SaveBar
                    dirty={dirty}
                    saving={saving}
                    error={error}
                    onSave={save}
                    onDiscard={discard}
                    onReload={reload}
                />
            </div>

            {wide && (
                <div className="w-[480px] shrink-0 h-full">
                    <LookPreview draftPayload={draftPayload} />
                </div>
            )}
        </div>
    );
}

function useViewportWide(threshold) {
    const [wide, setWide] = useState(() =>
        typeof window === 'undefined' ? true : window.innerWidth >= threshold,
    );
    useEffect(() => {
        const onResize = () => setWide(window.innerWidth >= threshold);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [threshold]);
    return wide;
}
