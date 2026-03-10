import React, { useState } from 'react';

/**
 * MapEmbedRenderer — Renders a Google Maps Embed iframe in chat messages.
 * Used when AI tools return an embedUrl (directions or places search).
 */
const MapEmbedRenderer = ({ embedUrl, title, mapsLink, height = 300 }) => {
    const [loaded, setLoaded] = useState(false);
    const isMobile = window.innerWidth < 768;
    const mapHeight = isMobile ? 220 : height;

    if (!embedUrl) return null;

    return (
        <div
            className="map-embed-wrapper"
            style={{
                margin: '12px 0',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #2a2a3e)',
                background: 'var(--bg-tertiary, #1e1e2e)',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Title bar */}
            {title && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary, #94a3b8)',
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍</span>
                        <span>{title}</span>
                    </span>
                    {mapsLink && (
                        <a
                            href={mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'var(--accent-primary, #818cf8)',
                                textDecoration: 'none',
                                fontSize: '11px',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            Open in Maps ↗
                        </a>
                    )}
                </div>
            )}

            {/* Loading state */}
            {!loaded && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: `${mapHeight}px`,
                        color: 'var(--text-muted, #64748b)',
                        fontSize: '13px',
                        gap: '8px',
                    }}
                >
                    <div
                        className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                        style={{
                            borderColor: 'var(--accent-primary, #818cf8)',
                            borderTopColor: 'transparent',
                        }}
                    />
                    Loading map...
                </div>
            )}

            {/* Map iframe — use visibility instead of display:none so browser actually loads it */}
            <iframe
                src={embedUrl}
                width="100%"
                height={mapHeight}
                style={{
                    border: 0,
                    display: 'block',
                    visibility: loaded ? 'visible' : 'hidden',
                    height: loaded ? `${mapHeight}px` : '0px',
                    overflow: 'hidden',
                }}
                frameBorder="0"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};

export default React.memo(MapEmbedRenderer);
