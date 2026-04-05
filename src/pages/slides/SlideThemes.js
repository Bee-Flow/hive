/**
 * Slide Themes — Defines visual themes for slide decks.
 *
 * Each theme provides:
 * - fonts: heading + body font families
 * - colors: primary, secondary, accent, text, background, surface
 * - accentColor: brand/label color (for category labels, badges, highlights)
 * - splitImageBackground: default gradient for the image zone of split layouts
 * - backgrounds: per-layout background CSS values
 * - titleColor: text color for title/section slides
 */

export const THEMES = {
    corporate: {
        name: 'Corporate',
        icon: '🏢',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#1e3a5f', secondary: '#4a90d9', accent: '#f59e0b',
            text: '#1a1a2e', textLight: '#64748b', background: '#ffffff', surface: '#f8fafc',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
            content: '#ffffff',
            section: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
        },
        accentColor: '#4a90d9',
        splitImageBackground: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 60%, #4a90d9 100%)',
        titleColor: '#ffffff',
        sectionColor: '#1e293b',
    },
    dark: {
        name: 'Dark',
        icon: '🌙',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#6366f1', secondary: '#a78bfa', accent: '#f59e0b',
            text: '#e2e8f0', textLight: '#94a3b8', background: '#0f172a', surface: '#1e293b',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            content: '#0f172a',
            section: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
        },
        accentColor: '#6366f1',
        splitImageBackground: 'linear-gradient(135deg, #1e1b4b 0%, #6366f1 60%, #a78bfa 100%)',
        titleColor: '#ffffff',
        sectionColor: '#e2e8f0',
    },
    pitch: {
        name: 'Pitch',
        icon: '💰',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#f5c418', secondary: '#e8a012', accent: '#f5c418',
            text: '#ffffff', textLight: 'rgba(255,255,255,0.55)', background: '#111111', surface: '#1e1e1e',
        },
        backgrounds: {
            title: '#111111',
            content: '#111111',
            section: 'linear-gradient(135deg, #1e1e1e 0%, #111111 100%)',
        },
        accentColor: '#f5c418',
        splitImageBackground: 'linear-gradient(135deg, #f5c418 0%, #e8832a 60%, #c85d1a 100%)',
        titleColor: '#ffffff',
        sectionColor: '#f5c418',
    },
    creative: {
        name: 'Creative',
        icon: '🎨',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#ec4899', secondary: '#8b5cf6', accent: '#f59e0b',
            text: '#1a1a2e', textLight: '#6b7280', background: '#ffffff', surface: '#fdf2f8',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            content: '#ffffff',
            section: 'linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 100%)',
        },
        accentColor: '#ec4899',
        splitImageBackground: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
        titleColor: '#ffffff',
        sectionColor: '#1a1a2e',
    },
    minimal: {
        name: 'Minimal',
        icon: '◻️',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#374151', secondary: '#6b7280', accent: '#3b82f6',
            text: '#111827', textLight: '#9ca3af', background: '#ffffff', surface: '#f9fafb',
        },
        backgrounds: {
            title: '#f9fafb',
            content: '#ffffff',
            section: '#f3f4f6',
        },
        accentColor: '#3b82f6',
        splitImageBackground: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
        titleColor: '#111827',
        sectionColor: '#374151',
    },
    gradient: {
        name: 'Gradient',
        icon: '🌈',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#6366f1', secondary: '#ec4899', accent: '#f59e0b',
            text: '#ffffff', textLight: '#e0e0e0', background: '#1a1a2e', surface: '#2d2d44',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)',
            content: 'linear-gradient(160deg, #1a1a2e 0%, #2d2d44 100%)',
            section: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        },
        accentColor: '#f59e0b',
        splitImageBackground: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
        titleColor: '#ffffff',
        sectionColor: '#ffffff',
    },
    aurora: {
        name: 'Aurora',
        icon: '🌌',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#22d3ee', secondary: '#818cf8', accent: '#34d399',
            text: '#f0f9ff', textLight: 'rgba(240,249,255,0.6)', background: '#0a0a1a', surface: '#111132',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #0a0a1a 0%, #111132 40%, #1a0a2e 100%)',
            content: 'radial-gradient(ellipse at 30% 20%, #111132 0%, #0a0a1a 70%)',
            section: 'linear-gradient(135deg, #111132 0%, #1a0a2e 100%)',
        },
        accentColor: '#22d3ee',
        splitImageBackground: 'linear-gradient(135deg, #0f4c75 0%, #22d3ee 60%, #34d399 100%)',
        titleColor: '#f0f9ff',
        sectionColor: '#22d3ee',
    },
    academic: {
        name: 'Academic',
        icon: '🎓',
        fonts: { heading: "'Georgia', serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#92400e', secondary: '#b45309', accent: '#059669',
            text: '#1e293b', textLight: '#64748b', background: '#fffbeb', surface: '#fef3c7',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
            content: '#fffbeb',
            section: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        },
        accentColor: '#b45309',
        splitImageBackground: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
        titleColor: '#ffffff',
        sectionColor: '#92400e',
    },
    tech: {
        name: 'Tech',
        icon: '💻',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#22d3ee', secondary: '#10b981', accent: '#f59e0b',
            text: '#e2e8f0', textLight: '#94a3b8', background: '#0a0a0a', surface: '#171717',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            content: '#0a0a0a',
            section: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
        },
        accentColor: '#22d3ee',
        splitImageBackground: 'linear-gradient(135deg, #22d3ee 0%, #10b981 60%, #065f46 100%)',
        titleColor: '#22d3ee',
        sectionColor: '#10b981',
    },
    nature: {
        name: 'Nature',
        icon: '🌿',
        fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
        colors: {
            primary: '#15803d', secondary: '#65a30d', accent: '#f59e0b',
            text: '#1a1a2e', textLight: '#6b7280', background: '#f0fdf4', surface: '#dcfce7',
        },
        backgrounds: {
            title: 'linear-gradient(135deg, #15803d 0%, #65a30d 100%)',
            content: '#f0fdf4',
            section: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
        },
        accentColor: '#15803d',
        splitImageBackground: 'linear-gradient(135deg, #15803d 0%, #65a30d 100%)',
        titleColor: '#ffffff',
        sectionColor: '#15803d',
    },
};

/** Get a theme by name, with fallback to corporate. */
export function getTheme(name) {
    return THEMES[name] || THEMES.corporate;
}

/** Get the background CSS for a slide based on its layout and theme. */
export function getSlideBackground(theme, layout, slideBackground) {
    if (slideBackground) return slideBackground;
    const t = typeof theme === 'string' ? getTheme(theme) : theme;
    if (layout === 'title') return t.backgrounds.title;
    if (layout === 'section') return t.backgrounds.section;
    return t.backgrounds.content;
}

/** Get the text color for a slide based on layout and theme. */
export function getSlideTextColor(theme, layout) {
    const t = typeof theme === 'string' ? getTheme(theme) : theme;
    if (layout === 'title') return t.titleColor;
    if (layout === 'section') return t.sectionColor;
    return t.colors.text;
}

/** Available slide layouts with display names and descriptions. */
export const LAYOUTS = {
    title: { name: 'Title Slide', icon: '📑', description: 'Large heading with subtitle' },
    content: { name: 'Content', icon: '📝', description: 'Heading with body content' },
    'two-column': { name: 'Two Column', icon: '📊', description: 'Side-by-side content' },
    'split-left': { name: 'Split Left', icon: '◧', description: 'Image left, text right' },
    'split-right': { name: 'Split Right', icon: '◨', description: 'Text left, image right' },
    hero: { name: 'Hero', icon: '🖼️', description: 'Full-bleed image with overlay' },
    section: { name: 'Section Divider', icon: '📋', description: 'Topic separator' },
    blank: { name: 'Blank', icon: '⬜', description: 'Free-form layout' },
};

/** Generate default elements for a given layout. */
export function getDefaultElements(layout, theme) {
    const t = typeof theme === 'string' ? getTheme(theme) : theme;
    const id = () => crypto.randomUUID?.() || `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    switch (layout) {
        case 'title':
            return [
                { id: id(), type: 'heading', content: 'Presentation Title', position: { x: 10, y: 25, width: 80, height: 25 }, style: { fontSize: '44px', fontWeight: 'bold', textAlign: 'center', color: t.titleColor } },
                { id: id(), type: 'text', content: 'Subtitle or description', position: { x: 20, y: 58, width: 60, height: 10 }, style: { fontSize: '22px', textAlign: 'center', color: t.titleColor, opacity: '0.8' } },
            ];
        case 'content':
            return [
                { id: id(), type: 'heading', content: 'Slide Title', position: { x: 6, y: 6, width: 88, height: 12 }, style: { fontSize: '32px', fontWeight: 'bold', color: t.colors.primary } },
                { id: id(), type: 'text', content: 'Add your content here', position: { x: 6, y: 22, width: 88, height: 68 }, style: { fontSize: '20px', color: t.colors.text } },
            ];
        case 'two-column':
            return [
                { id: id(), type: 'heading', content: 'Slide Title', position: { x: 6, y: 6, width: 88, height: 12 }, style: { fontSize: '32px', fontWeight: 'bold', color: t.colors.primary } },
                { id: id(), type: 'text', content: 'Left column content', position: { x: 5, y: 22, width: 42, height: 68 }, style: { fontSize: '18px', color: t.colors.text } },
                { id: id(), type: 'text', content: 'Right column content', position: { x: 52, y: 22, width: 42, height: 68 }, style: { fontSize: '18px', color: t.colors.text } },
            ];
        case 'split-left':
        case 'split-right':
            return [
                { id: id(), type: 'label', content: 'CATEGORY', zone: 'content', style: {} },
                { id: id(), type: 'heading', content: 'Section Title', zone: 'content', style: { fontSize: '38px', fontWeight: '800' } },
                { id: id(), type: 'text', content: 'Supporting description text', zone: 'content', style: { fontSize: '16px' } },
            ];
        case 'section':
            return [
                { id: id(), type: 'heading', content: 'Section Title', position: { x: 10, y: 35, width: 80, height: 20 }, style: { fontSize: '40px', fontWeight: 'bold', textAlign: 'center', color: t.sectionColor } },
            ];
        case 'blank':
        default:
            return [
                { id: id(), type: 'text', content: 'Click to add content', position: { x: 10, y: 10, width: 80, height: 80 }, style: { fontSize: '20px', color: t.colors.text } },
            ];
    }
}
