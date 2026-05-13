import React from 'react';
import { useIntegrationIcon, resolveIntegrationFromTool } from '../../../../../../utils/integrationIcons';
import { getIntegrationLogo } from '../../../../../../utils/integrationLogos';

/**
 * IntegrationLogo
 *
 * Renders a small brand mark for an integration. Resolution order:
 *   1. icon-pack override (user-uploaded image OR custom emoji) — wins
 *      so admins can swap brand visuals per deployment.
 *   2. official brand SVG from INTEGRATION_LOGOS — Nextcloud rings, the
 *      Gmail envelope, etc. Mirrors what the chat sidebar's Apps panel
 *      renders so palette and chat panel match pixel-for-pixel.
 *   3. bundled brand-coloured letter mark from INTEGRATION_META — fallback
 *      for ids that have no SVG yet.
 *   4. caller-provided `fallback` (typically a lucide icon).
 *
 * Pass either an integration id (`gmail`, `nextcloud_deck`, …) or a tool
 * name (`gmail_send`, `nextcloud_deck_create_card`, …) — the latter is
 * resolved via the same prefix logic as the server.
 */
export default function IntegrationLogo({ integrationId, tool, size = 16, fallback = null, title }) {
    const id = integrationId || resolveIntegrationFromTool(tool);
    const icon = useIntegrationIcon(id);
    const altText = title || icon?.meta?.label || id || 'integration';

    // Icon-pack override (image / emoji) wins over the bundled brand SVG
    // — admins use this to rebrand for white-label deployments.
    if (!(icon && (icon.kind === 'image' || icon.kind === 'emoji'))) {
        const BrandLogo = getIntegrationLogo(id);
        if (BrandLogo) return <BrandLogo size={size} />;
    }

    if (!icon) return fallback;

    if (icon.kind === 'image') {
        return (
            <img
                src={icon.value}
                alt={altText}
                width={size}
                height={size}
                className="object-contain inline-block rounded-sm"
                style={{ width: size, height: size }}
            />
        );
    }

    if (icon.kind === 'emoji') {
        return (
            <span
                role="img"
                aria-label={altText}
                className="inline-flex items-center justify-center leading-none"
                style={{ width: size, height: size, fontSize: Math.round(size * 0.9) }}
            >
                {icon.value}
            </span>
        );
    }

    // Letter-mark on a brand-coloured rounded square.
    const fontSize = icon.value.length > 1 ? Math.round(size * 0.45) : Math.round(size * 0.62);
    return (
        <span
            aria-label={altText}
            title={altText}
            className="inline-flex items-center justify-center font-semibold text-white select-none"
            style={{
                width: size,
                height: size,
                background: icon.meta.color,
                borderRadius: Math.max(2, Math.round(size * 0.18)),
                fontSize,
                lineHeight: 1,
                letterSpacing: '-0.02em',
            }}
        >
            {icon.value}
        </span>
    );
}
