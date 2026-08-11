import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import SectionFrame from '../components/SectionFrame';
import SectionHeader from '../components/SectionHeader';
import { sectionBgClass } from './sectionBg';
import { DEMO_FEATURE_IDS } from '../../demo/registry';

/**
 * Live feature demo — the real product UI, framed inside a marketing page.
 *
 * The iframe points at /__demo__/<feature>, which mounts the actual Studio
 * component against an in-memory fixture backend. Same components, same CSS,
 * so what a visitor plays with looks exactly like what they would get.
 *
 * WHY THE SRC IS BUILT HERE AND NOT AUTHORED
 * `content.feature` is an ID validated against the demo registry. An editor —
 * or an AI builder turn — therefore cannot turn this block into an embed of
 * an arbitrary origin, which is the failure mode a free-text `src` field
 * would have. An unknown id renders a placeholder, never an iframe.
 *
 * SANDBOX
 * `allow-scripts allow-same-origin` is the minimum the SPA needs to boot (an
 * opaque origin makes localStorage throw, and the app components use it).
 * Everything else is withheld on purpose: no allow-forms, no allow-popups,
 * no allow-modals, no allow-top-navigation, and an empty `allow` so the frame
 * gets no camera, microphone, geolocation or payment permission. The real
 * containment is that the framed page cannot reach the network at all
 * (agent-hub/src/demo/demoTransport.js).
 *
 * LOADING
 * The demo loads on its own — a visitor should not have to press play to see
 * what the product looks like. `loading="lazy"` still defers the boot until
 * the frame is near the viewport, so a demo below the fold costs nothing on
 * first paint. The one exception is the CMS editor's own preview iframe,
 * where booting a second copy of the application inside the page being edited
 * is heavy and confusing; there it renders a labelled placeholder instead.
 *
 * MOBILE (≤768px — the same boundary this block's stylesheet rules flip at)
 * The Studio components are desktop layouts; the product itself refuses to
 * show them on a phone, and a phone-width iframe clipped them to a useless
 * sliver. So on a phone the frame shows the demo at a desktop viewport
 * (1280 logical px) scaled down to fit — the transform sandwich the CMS
 * editor's PreviewStage uses. At ~0.26 scale a tap on a 14px button is a
 * lottery, so the thumbnail is non-interactive and the whole frame is one
 * tap target: it navigates — same tab, so leaving and returning is ordinary
 * browser history — to /__demo__/<feature>?vw=1280, where DemoHost widens
 * the viewport meta and the phone renders the desktop layout natively
 * pinch-zoomable, with a floating close button that comes back here. Both
 * links live out here on purpose — the sandbox has no allow-top-navigation,
 * so nothing inside the frame could navigate this page anywhere.
 */

// Past the app's 1279 isCompact boundary, so lg: styles apply and the demo
// lays out exactly as it would on a laptop.
const DEMO_LOGICAL_WIDTH = 1280;
// Displayed floor for the scaled preview. Met by giving the framed document
// a TALLER viewport (the thumbnail shows more of the demo), never by
// stretching anything.
const MIN_PREVIEW_HEIGHT = 240;
// Must match the block's rules in marketing.css exactly — at 768 wide, JS
// and CSS have to agree on which branch owns the frame. (hooks/useViewport
// flips at 767, which is why it is not used here.)
const PHONE_QUERY = '(max-width: 768px)';

export default function FeatureDemo({ data }) {
    const feature = typeof data?.feature === 'string' ? data.feature : '';
    const known = DEMO_FEATURE_IDS.includes(feature);
    const editing = isPreviewMode();
    const isPhone = useIsPhone();
    // The editor's poster outranks the phone branch, so the CMS builder's
    // mobile preview preset never boots a second copy of the app.
    const scaledPreview = isPhone && known && !editing;
    const clipRef = useRef(null);
    const clipW = useMeasuredWidth(clipRef, scaledPreview);

    if (!data?.enabled) return null;

    const height = Number.isFinite(data.height)
        ? Math.min(Math.max(data.height, 320), 1200)
        : 720;
    const theme = data.theme === 'dark' ? 'dark' : 'light';

    // The "open the real thing" link lives out here rather than inside the
    // frame, where a banner ate vertical space from the product itself.
    // resolveLinksInTree has already turned the stored Link union into
    // { href } by the time the public site renders; the editor preview still
    // sees the raw shape.
    const ctaLabel = data.cta?.label || '';
    const ctaHref = data.cta?.href || data.cta?.link?.href || data.cta?.link?.path || '/app';

    // Measuring the clip itself means clientWidth already accounts for the
    // container's 24px, the frame's mobile 4px and the border — before the
    // first measurement lands, a 320px viewport is assumed rather than
    // flashing an unscaled 1280px canvas. The 680–760 blocks would come out
    // 156–197px tall at phone widths; the floor extends the logical height
    // instead (capped at the block schema's own 1200).
    const scale = clipW > 0 ? Math.min(1, clipW / DEMO_LOGICAL_WIDTH) : 320 / DEMO_LOGICAL_WIDTH;
    const logicalHeight = Math.max(height, Math.min(1200, Math.round(MIN_PREVIEW_HEIGHT / scale)));
    const displayHeight = Math.round(logicalHeight * scale);
    const demoUrl = `/__demo__/${encodeURIComponent(feature)}?theme=${theme}&vw=${DEMO_LOGICAL_WIDTH}`;

    return (
        <SectionFrame id="feature-demo" name="Live feature demo" enabled={data.enabled}>
            <section id="feature-demo" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="feature-demo"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />

                    <div
                        className={`feature-demo-frame reveal${scaledPreview ? ' feature-demo-frame--scaled' : ''}`}
                        style={scaledPreview ? undefined : { height: `${height}px` }}
                    >
                        {!known ? (
                            <div className="feature-demo-placeholder">
                                <p>
                                    {feature
                                        ? `No demo is registered for “${feature}”.`
                                        : 'Pick a feature in the panel to embed its live demo.'}
                                </p>
                                <p className="feature-demo-hint">Available: {DEMO_FEATURE_IDS.join(', ')}</p>
                            </div>
                        ) : editing ? (
                            <div className="feature-demo-poster" aria-hidden="true">
                                <span className="feature-demo-poster-play">▶</span>
                                <span className="feature-demo-poster-label">
                                    Live demo — runs on the published site
                                </span>
                                <span className="feature-demo-hint">
                                    Not booted here so the builder stays responsive.
                                </span>
                            </div>
                        ) : scaledPreview ? (
                            <div className="feature-demo-scale-clip" ref={clipRef} style={{ height: `${displayHeight}px` }}>
                                {/* aria-hidden: the thumbnail is a picture of the
                                    product; the overlay link carries the semantics.
                                    tabIndex -1 keeps the framed document out of the
                                    tab order of a hidden subtree. */}
                                <div
                                    className="feature-demo-scale-canvas"
                                    aria-hidden="true"
                                    style={{
                                        width: DEMO_LOGICAL_WIDTH,
                                        height: logicalHeight,
                                        transform: `scale(${scale})`,
                                        transformOrigin: 'top left',
                                    }}
                                >
                                    <iframe
                                        src={`/__demo__/${encodeURIComponent(feature)}?theme=${theme}`}
                                        title={data.title || `${feature} demo`}
                                        className="feature-demo-iframe"
                                        loading="lazy"
                                        sandbox="allow-scripts allow-same-origin"
                                        allow=""
                                        referrerPolicy="no-referrer"
                                        tabIndex={-1}
                                    />
                                </div>
                                <a
                                    className="feature-demo-open-overlay"
                                    href={demoUrl}
                                    aria-label={`Open the ${data.title || feature} demo full screen`}
                                >
                                    <span className="feature-demo-open-pill">
                                        <Maximize2 aria-hidden="true" />
                                        Open full screen
                                    </span>
                                </a>
                            </div>
                        ) : (
                            <iframe
                                src={`/__demo__/${encodeURIComponent(feature)}?theme=${theme}`}
                                title={data.title || `${feature} demo`}
                                className="feature-demo-iframe"
                                loading="lazy"
                                sandbox="allow-scripts allow-same-origin"
                                allow=""
                                referrerPolicy="no-referrer"
                            />
                        )}
                    </div>

                    <div className="feature-demo-footer">
                        {scaledPreview ? (
                            <a className="btn btn-secondary feature-demo-open-btn" href={demoUrl}>
                                <Maximize2 aria-hidden="true" size={16} />
                                Open full screen
                            </a>
                        ) : null}
                        {data.note ? <p className="feature-demo-note">{data.note}</p> : null}
                        {ctaLabel ? (
                            <a className="btn btn-primary feature-demo-cta" href={ctaHref}>
                                {ctaLabel}
                            </a>
                        ) : null}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}

function isPreviewMode() {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('preview');
}

// Local rather than hooks/useViewport: that hook's boundary is 767px while
// this block's stylesheet rules flip at 768 — at exactly 768 wide, JS and
// CSS would disagree about which branch owns the frame. The change listener
// covers portrait/landscape rotation across the boundary.
function useIsPhone() {
    const [isPhone, setIsPhone] = useState(() => (
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia(PHONE_QUERY).matches
            : false
    ));
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mql = window.matchMedia(PHONE_QUERY);
        const update = () => setIsPhone(mql.matches);
        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, []);
    return isPhone;
}

// PreviewStage's measurer (ResizeObserver, resize fallback), with two
// deliberate differences: useLayoutEffect so the first paint already has the
// right scale — on a public page a one-frame 1280px flash is visible layout
// shift — and an `active` flag so the desktop branch observes nothing.
function useMeasuredWidth(ref, active) {
    const [w, setW] = useState(0);
    useLayoutEffect(() => {
        if (!active) return undefined;
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => setW(el.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref, active]);
    return w;
}
