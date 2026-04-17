import { useState, useEffect } from 'react';

/**
 * Shared viewport hook. Returns reactive flags keyed off Tailwind's default
 * breakpoints so JS decisions and CSS classes stay in sync.
 *
 *   isMobile:  width <  768  (Tailwind: default → md)
 *   isCompact: width >= 768 && < 1280  (Tailwind: md → xl)   — small laptops
 *   isDesktop: width >= 1280 (Tailwind: xl+)
 *
 * The hook uses matchMedia listeners (not `resize`) so it reruns only when
 * actually crossing a breakpoint. SSR-safe: defaults to desktop when window is
 * undefined.
 */

const MOBILE_QUERY = '(max-width: 767px)';
const COMPACT_QUERY = '(min-width: 768px) and (max-width: 1279px)';

function readState() {
    if (typeof window === 'undefined') {
        return { width: 1920, isMobile: false, isCompact: false, isDesktop: true };
    }
    const width = window.innerWidth;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const isCompact = window.matchMedia(COMPACT_QUERY).matches;
    return { width, isMobile, isCompact, isDesktop: !isMobile && !isCompact };
}

export function useViewport() {
    const [state, setState] = useState(readState);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mqMobile = window.matchMedia(MOBILE_QUERY);
        const mqCompact = window.matchMedia(COMPACT_QUERY);
        const update = () => setState(readState());

        mqMobile.addEventListener('change', update);
        mqCompact.addEventListener('change', update);
        return () => {
            mqMobile.removeEventListener('change', update);
            mqCompact.removeEventListener('change', update);
        };
    }, []);

    return state;
}

export default useViewport;
