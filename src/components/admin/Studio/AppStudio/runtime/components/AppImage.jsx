import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/** App Studio runtime — 'image'. Spec: server/appStudio/componentSpecs.js. */

function isHttps(url) {
    return typeof url === 'string' && url.trim().toLowerCase().startsWith('https://');
}

export default function AppImage({ node }) {
    const { src = null, alt = '', fit = 'cover' } = node.props || {};
    const [failed, setFailed] = useState(false);
    const hasHeight = node.style?.height && node.style.height !== 'auto';

    // Broken/missing sources render a neutral placeholder with the same
    // footprint as the image would have — no layout shift.
    if (!isHttps(src) || failed) {
        return (
            <div
                role="img"
                aria-label={alt || 'Image unavailable'}
                className="flex items-center justify-center w-full"
                style={{
                    height: hasHeight ? '100%' : undefined,
                    minHeight: '96px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                    borderRadius: 'inherit',
                }}
            >
                <ImageOff className="w-5 h-5" aria-hidden="true" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            className="block w-full"
            style={{
                height: hasHeight ? '100%' : 'auto',
                objectFit: fit === 'contain' ? 'contain' : 'cover',
                borderRadius: 'inherit',
            }}
        />
    );
}
