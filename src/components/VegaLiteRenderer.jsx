import React, { useEffect, useRef, useState, useCallback } from 'react';
import vegaEmbed from 'vega-embed';

/**
 * VegaLiteRenderer — renders a Vega-Lite JSON spec as an interactive chart.
 * Uses resolved CSS variable values for theming (SVG can't use CSS vars directly).
 * Features: responsive width via ResizeObserver, themed action menu, fade-in animation.
 */
const VegaLiteRenderer = ({ spec: specString }) => {
    const containerRef = useRef(null);
    const wrapperRef = useRef(null);
    const viewRef = useRef(null);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);

    // Resolve CSS vars once into real color values for SVG
    const resolveTheme = useCallback(() => {
        const cs = getComputedStyle(document.documentElement);
        const r = (v, fb) => cs.getPropertyValue(v).trim() || fb;

        return {
            textPrimary: r('--text-primary', '#e2e8f0'),
            textSecondary: r('--text-secondary', '#94a3b8'),
            bgTertiary: r('--bg-tertiary', '#1e1e2e'),
            borderSubtle: r('--border-subtle', '#2a2a3e'),
            borderPrimary: r('--border-primary', '#3a3a4e'),
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current || !specString) return;

        let parsedSpec;
        try {
            parsedSpec = typeof specString === 'string' ? JSON.parse(specString) : specString;
        } catch (e) {
            setError(`Invalid Vega-Lite JSON: ${e.message}`);
            return;
        }

        const theme = resolveTheme();
        const isMobile = window.innerWidth < 768;

        // Build themed spec — let padding breathe for axis labels/titles
        const themedSpec = {
            ...parsedSpec,
            width: 'container',
            height: parsedSpec.height || (isMobile ? 200 : 300),
            autosize: { type: 'fit', contains: 'padding' },
            background: 'transparent',
            padding: parsedSpec.padding || (isMobile
                ? { left: 30, right: 16, top: 10, bottom: 16 }
                : { left: 50, right: 20, top: 16, bottom: 16 }),
            config: deepMerge(
                {
                    font: 'Inter, system-ui, sans-serif',
                    axis: {
                        labelColor: theme.textSecondary,
                        titleColor: theme.textPrimary,
                        gridColor: theme.borderSubtle,
                        domainColor: theme.borderPrimary,
                        tickColor: theme.borderPrimary,
                        labelFontSize: isMobile ? 9 : 11,
                        titleFontSize: isMobile ? 10 : 12,
                        titlePadding: isMobile ? 6 : 10,
                        labelPadding: isMobile ? 3 : 6,
                        labelLimit: isMobile ? 80 : 180,
                        labelOverlap: true,
                    },
                    axisY: {
                        labelAngle: 0,
                        titleAngle: -90,
                        titleAlign: 'center',
                    },
                    axisX: {
                        labelAngle: isMobile ? -45 : -30,
                        labelAlign: 'right',
                        tickCount: isMobile ? 5 : undefined,
                        labelOverlap: 'parity',
                    },
                    legend: {
                        labelColor: theme.textSecondary,
                        titleColor: theme.textPrimary,
                        labelFontSize: isMobile ? 9 : 11,
                        titleFontSize: isMobile ? 10 : 12,
                        symbolSize: isMobile ? 50 : 80,
                        padding: isMobile ? 6 : 12,
                        orient: isMobile ? 'bottom' : undefined,
                    },
                    title: {
                        color: theme.textPrimary,
                        subtitleColor: theme.textSecondary,
                        fontSize: isMobile ? 12 : 14,
                        fontWeight: 600,
                        offset: isMobile ? 8 : 12,
                    },
                    view: {
                        stroke: 'transparent',
                    },
                    range: {
                        category: [
                            '#818cf8', '#a78bfa', '#c084fc', '#f472b6',
                            '#fb7185', '#fb923c', '#fbbf24', '#34d399',
                            '#22d3ee', '#60a5fa'
                        ],
                    },
                    bar: {
                        color: '#818cf8',
                        cornerRadiusEnd: isMobile ? 2 : 4,
                    },
                    line: {
                        color: '#818cf8',
                        strokeWidth: isMobile ? 2 : 2.5,
                    },
                    point: {
                        color: '#818cf8',
                        size: isMobile ? 30 : 50,
                        filled: true,
                    },
                    area: {
                        color: '#818cf8',
                        opacity: 0.3,
                    },
                    arc: {
                        stroke: theme.bgTertiary,
                        strokeWidth: 2,
                    },
                },
                parsedSpec.config || {}
            ),
        };

        const embedOptions = {
            actions: {
                export: true,
                source: false,
                compiled: false,
                editor: false,
            },
            renderer: 'svg',
        };

        setReady(false);

        vegaEmbed(containerRef.current, themedSpec, embedOptions)
            .then(result => {
                viewRef.current = result.view;
                setError(null);
                // Slight delay so the browser paints the SVG before we fade in
                requestAnimationFrame(() => setReady(true));
            })
            .catch(err => {
                setError(err.message);
                setReady(false);
            });

        // ResizeObserver for responsive width
        let resizeObserver;
        if (wrapperRef.current) {
            resizeObserver = new ResizeObserver(() => {
                if (viewRef.current) {
                    try {
                        viewRef.current.resize().runAsync();
                    } catch { /* ignore */ }
                }
            });
            resizeObserver.observe(wrapperRef.current);
        }

        return () => {
            resizeObserver?.disconnect();
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            viewRef.current = null;
        };
    }, [specString, resolveTheme]);

    if (error) {
        return (
            <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--bg-tertiary, #1e1e2e)',
                border: '1px solid var(--error-color, #f87171)',
                color: 'var(--error-color, #f87171)',
                fontSize: '13px',
                margin: '8px 0'
            }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Chart Error</div>
                <div style={{ opacity: 0.8 }}>{error}</div>
            </div>
        );
    }

    return (
        <div
            ref={wrapperRef}
            className="vega-chart-wrapper"
            style={{
                margin: '12px 0',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #2a2a3e)',
                background: 'var(--bg-tertiary, #1e1e2e)',
                overflow: 'hidden',
                whiteSpace: 'normal',
                fontFamily: 'var(--font-family, sans-serif)',
                position: 'relative',
                opacity: ready ? 1 : 0,
                transition: 'opacity 0.35s ease',
            }}
        >
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    minHeight: '200px',
                }}
            />
        </div>
    );
};

/**
 * Deep-merge two plain objects (source wins on conflicts).
 * Used to merge user config on top of our defaults.
 */
function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
        ) {
            out[key] = deepMerge(target[key], source[key]);
        } else {
            out[key] = source[key];
        }
    }
    return out;
}

export default React.memo(VegaLiteRenderer);
