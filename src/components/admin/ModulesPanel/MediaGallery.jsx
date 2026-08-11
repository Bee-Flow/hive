import { X } from 'lucide-react';
import React, { useState } from 'react';
import { moduleMediaUrl } from '../../../api/queries/modules';

// Screenshot strip for the detail drawer. Media bytes come off the product
// server (marketplace/:id/media/:mediaId proxies the hub), so a plain <img>
// with the session cookie works; broken/unauthorised images are hidden.
export default function MediaGallery({ moduleId, media }) {
    const images = (media || []).filter((m) => m && m.media_id && String(m.content_type || '').startsWith('image/'));
    const [active, setActive] = useState(null);   // media_id of the enlarged image
    const [broken, setBroken] = useState(() => new Set());

    const visible = images.filter((m) => !broken.has(m.media_id));
    if (visible.length === 0) return null;

    return (
        <>
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="media-gallery">
                {visible.map((m) => (
                    <button key={m.media_id} onClick={() => setActive(m.media_id)} className="flex-shrink-0">
                        <img
                            src={moduleMediaUrl(moduleId, m.media_id)}
                            alt=""
                            loading="lazy"
                            className="h-24 rounded-lg border object-cover"
                            style={{ borderColor: 'var(--border-default)' }}
                            onError={() => setBroken((s) => new Set(s).add(m.media_id))}
                        />
                    </button>
                ))}
            </div>
            {active && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6" onClick={() => setActive(null)}>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-black/50" onClick={() => setActive(null)}>
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <img
                        src={moduleMediaUrl(moduleId, active)}
                        alt=""
                        className="max-w-full max-h-full rounded-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
