import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useIconPack } from '../hooks/useIconPack';

/**
 * AppIcon
 * Wrapper around standard lucide-react icons. 
 * If the user's active Icon Pack overrides the \`name\`, it renders the custom emoji or image.
 * Otherwise, it falls back to the default Lucide icon.
 * 
 * Props:
 * - name (string): The standard icon name in PascalCase (e.g. 'Home', 'Settings', 'Bot')
 * - className (string): Tailwind or other classes
 * - style (object): Inline styles
 * - fallback (function|Component): Optional fallback if not found in Lucide.
 */
export const AppIcon = React.forwardRef(({ name, className = '', style = {}, fallback, ...rest }, ref) => {
    const { getCustomIcon } = useIconPack();
    
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

    // Default to Lucide icon
    const Comp = LucideIcons[name];
    if (Comp) {
        return <Comp ref={ref} className={className} style={style} {...rest} />;
    }

    // Fallback if missing
    if (fallback) {
        const FallbackComp = fallback;
        return <FallbackComp ref={ref} className={className} style={style} {...rest} />;
    }

    // Ultimate fallback if the supplied name is bad and no fallback component provided
    const HelpCircle = LucideIcons.HelpCircle;
    return <HelpCircle ref={ref} className={className} style={style} {...rest} />;
});

AppIcon.displayName = 'AppIcon';

export default AppIcon;
