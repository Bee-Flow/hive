import React from 'react';
import { useIconPack } from '../hooks/useIconPack';
import { defaultEmojiFor, labelFor } from '../utils/emojiCatalog';

/**
 * AppEmoji
 * Render a themable emoji that the active icon pack can override.
 *
 *   <AppEmoji id="tools.search" />               // resolves default from catalog
 *   <AppEmoji id="tools.search" default="🔍" />  // explicit fallback wins over catalog
 *   <AppEmoji id="tools.search" className="text-lg" />
 *
 * Resolution order:
 *   1. Active icon pack override for `id` (emoji span or <img>)
 *   2. Explicit `default` prop
 *   3. Catalog default for `id`
 *   4. Empty string (component renders nothing)
 */
export const AppEmoji = React.forwardRef(({ id, default: explicitDefault, className = '', style = {}, title, ...rest }, ref) => {
    const { getCustomIcon } = useIconPack();
    const custom = id ? getCustomIcon(id) : null;

    if (custom?.type === 'image') {
        return (
            <img
                ref={ref}
                src={custom.value}
                alt={title || labelFor(id)}
                className={`object-contain inline-block ${className}`}
                style={style}
                {...rest}
            />
        );
    }

    const value = (custom?.type === 'emoji' && custom.value)
        || explicitDefault
        || defaultEmojiFor(id)
        || '';

    if (!value) return null;

    return (
        <span
            ref={ref}
            role="img"
            aria-label={title || labelFor(id)}
            className={`inline-flex items-center justify-center leading-none ${className}`}
            style={style}
            {...rest}
        >
            {value}
        </span>
    );
});

AppEmoji.displayName = 'AppEmoji';

export default AppEmoji;
