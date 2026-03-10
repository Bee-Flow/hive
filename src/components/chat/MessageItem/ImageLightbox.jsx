import React from 'react';
import ReactDOM from 'react-dom';

export default function ImageLightbox({ lightboxImage, setLightboxImage }) {
    if (!lightboxImage) return null;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setLightboxImage(null)}
        >
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <img
                    src={lightboxImage}
                    alt="Generated image"
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                    <a
                        href={lightboxImage}
                        download={`ai-image-${Date.now()}.png`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors"
                        onClick={e => e.stopPropagation()}
                    >
                        ⬇ Download
                    </a>
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors text-lg"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
