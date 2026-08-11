import React from 'react';
import { resolveAssetUrl } from '../assetUrl';

/**
 * FramedMedia — the one way media renders on the marketing site.
 *
 * Accepts the shared media-slot shape used across section content:
 *   { src, srcDark, alt, frame: 'hairline'|'browser'|'none', kind: 'image'|'video' }
 *
 * - Hairline frame + radius + optional faint brand glow: a raw unframed
 *   screenshot is the single biggest "cheap site" tell, so sections never
 *   place a bare <img> for product shots.
 * - Light/dark pair: when srcDark is set, BOTH images render and CSS
 *   (.cms-theme-dark) toggles visibility — theme flips need no JS.
 * - Empty src renders an intentional skeleton panel (never a broken image;
 *   also what the AI builder produces, since it must not invent asset keys).
 */
export default function FramedMedia({ media, glow = true, fadeMask = false, className = '', priority = false }) {
    const m = media || {};
    const frame = ['hairline', 'browser', 'none'].includes(m.frame) ? m.frame : 'hairline';
    const kind = m.kind === 'video' ? 'video' : 'image';
    const src = typeof m.src === 'string' ? m.src.trim() : '';
    const srcDark = typeof m.srcDark === 'string' ? m.srcDark.trim() : '';

    // Intrinsic dimensions, when publish-time enrichment stored them
    // (server/core/cms/mediaDims.js). As ATTRIBUTES they give the browser the
    // aspect ratio to reserve before a single image byte arrives — CSS keeps
    // the rendered size responsive (width:100%; height:auto), so these never
    // fix the display size, only the shape of the reserved box.
    const dims = m.width > 0 && m.height > 0
        ? { width: Math.round(m.width), height: Math.round(m.height) }
        : {};

    // `priority` marks the LCP candidate (the hero's visual). Everything
    // else stays lazy: an unconditional loading="lazy" meant even the hero
    // image was not queued until layout settled, which is backwards for the
    // one image the page is scored on.
    const loadingProps = priority
        ? { loading: 'eager', fetchPriority: 'high' }
        : { loading: 'lazy' };

    const cls = [
        'cms-frame',
        `cms-frame--${frame}`,
        glow && frame !== 'none' ? 'cms-frame--glow' : '',
        fadeMask ? 'cms-frame--fade' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <figure className={cls}>
            {frame === 'browser' ? (
                <div className="cms-frame-chrome" aria-hidden="true">
                    <span className="cms-frame-dot" />
                    <span className="cms-frame-dot" />
                    <span className="cms-frame-dot" />
                </div>
            ) : null}
            <div className="cms-frame-body">
                {src ? (
                    kind === 'video' ? (
                        <video
                            className="cms-frame-media"
                            src={resolveAssetUrl(src)}
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    ) : (
                        <>
                            <img
                                className={`cms-frame-media${srcDark ? ' cms-frame-media--light' : ''}`}
                                src={resolveAssetUrl(src)}
                                alt={m.alt || ''}
                                {...dims}
                                {...loadingProps}
                            />
                            {srcDark ? (
                                <img
                                    className="cms-frame-media cms-frame-media--dark"
                                    src={resolveAssetUrl(srcDark)}
                                    alt={m.alt || ''}
                                    {...dims}
                                    loading="lazy"
                                />
                            ) : null}
                        </>
                    )
                ) : (
                    <div className="cms-frame-placeholder" aria-hidden="true">
                        <div className="cms-frame-ph-line" style={{ width: '38%' }} />
                        <div className="cms-frame-ph-line" style={{ width: '72%' }} />
                        <div className="cms-frame-ph-line" style={{ width: '55%' }} />
                    </div>
                )}
            </div>
        </figure>
    );
}
