import React from 'react';
import { useIconPack } from '../hooks/useIconPack';
import { ICON_REGISTRY, FALLBACK_ICON } from './iconRegistry';

/**
 * AppIcon
 * Wrapper around standard lucide-react icons.
 * If the user's active Icon Pack overrides the `name`, it renders the custom emoji or image.
 * Otherwise, it falls back to the default Lucide icon.
 *
 * Icon resolution is registry-first, deliberately. This component used to do
 * `import * as LucideIcons` with a dynamic `LucideIcons[name]` lookup — a
 * pattern Rollup cannot tree-shake, so the ENTIRE Lucide set (~170 KB gz)
 * shipped in the first-load bundle of every page, marketing site included.
 * Now:
 *
 *   1. `ICON_REGISTRY` (components/iconRegistry.js) resolves synchronously —
 *      it holds every name the seed content, block defaults and literal
 *      call sites use, so the common path is identical to before and costs
 *      ~15 KB instead of 170.
 *   2. A name outside the registry (an editor can type anything into CMS
 *      content) triggers ONE shared `import('lucide-react')`. While it's in
 *      flight we render a size-reserving blank with the same className/style
 *      the icon would get, so the late icon changes pixels, not layout.
 *      The chunk is cached after the first miss.
 *
 * Props:
 * - name (string): The standard icon name in PascalCase (e.g. 'Home', 'Settings', 'Bot')
 * - className (string): Tailwind or other classes
 * - style (object): Inline styles
 * - fallback (function|Component): Optional fallback if not found in Lucide.
 */

// Module-scope loader for the full Lucide barrel — shared by every AppIcon
// instance so a page with ten unknown icons fetches the chunk once.
let fullSet = null;
let loadPromise = null;
const subscribers = new Set();
function loadFullSet() {
    if (!loadPromise) {
        loadPromise = import('lucide-react').then((m) => {
            fullSet = m;
            subscribers.forEach((fn) => fn());
            subscribers.clear();
        }).catch(() => { /* stays null — fallback icon renders */ });
    }
    return loadPromise;
}

/** Resolve a non-registry icon, re-rendering once the barrel arrives. */
function useLazyIcon(name, wanted) {
    const [, bump] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
        if (!wanted || fullSet) return undefined;
        subscribers.add(bump);
        loadFullSet();
        return () => { subscribers.delete(bump); };
    }, [wanted, bump]);
    if (!wanted) return null;
    return fullSet ? (fullSet[name] || null) : undefined; // undefined = loading
}

export const AppIcon = React.forwardRef(({ name, className = '', style = {}, fallback, ...rest }, ref) => {
    const { getCustomIcon } = useIconPack();

    // Registry hit — the synchronous fast path virtually every render takes.
    const registered = ICON_REGISTRY[name] || null;
    const lazy = useLazyIcon(name, !registered && !!name);

    // Check if there is an override in the current active icon pack
    const custom = getCustomIcon(name);

    if (custom) {
        if (custom.type === 'emoji') {
            return (
                <span
                    ref={ref}
                    role="img"
                    aria-label={name}
                    className={`inline-flex items-center justify-center ${className}`}
                    style={{ ...style, fontSize: '1.2em', lineHeight: 1 }}
                    {...rest}
                >
                    {custom.value}
                </span>
            );
        }
        if (custom.type === 'image') {
            return (
                <img
                    ref={ref}
                    src={custom.value}
                    alt={name}
                    className={`object-contain ${className}`}
                    style={{ ...style }}
                    {...rest}
                />
            );
        }
    }

    const Comp = registered || (lazy === undefined ? null : lazy);
    if (Comp) {
        return <Comp ref={ref} className={className} style={style} {...rest} />;
    }

    // Barrel still loading: reserve the icon's box so its arrival shifts
    // nothing. Lucide icons default to a 24px square and honour a `size`
    // prop; sized-by-class call sites get the same box from className.
    if (lazy === undefined) {
        const size = rest.size || 24;
        return (
            <span
                ref={ref}
                aria-hidden="true"
                className={`inline-block ${className}`}
                style={{ width: size, height: size, ...style }}
            />
        );
    }

    // Fallback if missing
    if (fallback) {
        const FallbackComp = fallback;
        return <FallbackComp ref={ref} className={className} style={style} {...rest} />;
    }

    // Ultimate fallback if the supplied name is bad and no fallback component provided
    const Help = FALLBACK_ICON;
    return <Help ref={ref} className={className} style={style} {...rest} />;
});

AppIcon.displayName = 'AppIcon';

export default AppIcon;
