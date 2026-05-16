// Client-side image downscale for chat uploads.
// Sweet spot: 1568px longest edge (~1.15 MP) at JPEG q=0.92 — Claude's "no further
// downscale" tier and a sane upper bound for GPT-4o / Gemini token budgets. PNG is
// preserved when the source has transparency so logos and screenshots stay crisp.

const MAX_LONGEST_EDGE = 1568;
const JPEG_QUALITY = 0.92;
const SKIP_IF_BYTES_UNDER = 1024 * 1024; // 1 MB — already small, don't recompress
const PASSTHROUGH_TYPES = new Set(['image/gif', 'image/svg+xml']);

export function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

async function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file);
        } catch {
            // Fall through to <img> path
        }
    }
    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image decode failed'));
            img.src = url;
        });
    } finally {
        // Revoke after the bitmap is drawn; we revoke later to be safe
        // by handing url back. Simpler: revoke on a microtask — the image is
        // already decoded into memory.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

function hasAlphaPixels(ctx, width, height) {
    const stride = Math.max(1, Math.floor(Math.min(width, height) / 32));
    try {
        const sample = ctx.getImageData(0, 0, width, height);
        const data = sample.data;
        const rowBytes = width * 4;
        for (let y = 0; y < height; y += stride) {
            for (let x = 0; x < width; x += stride) {
                if (data[y * rowBytes + x * 4 + 3] < 255) return true;
            }
        }
    } catch {
        return false;
    }
    return false;
}

function canvasToBlob(canvas, type, quality) {
    if (typeof canvas.convertToBlob === 'function') {
        return canvas.convertToBlob({ type, quality });
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
            type,
            quality
        );
    });
}

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas === 'function') {
        try {
            return new OffscreenCanvas(width, height);
        } catch {
            // Fall through to DOM canvas
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function passthrough(file) {
    const dataUrl = await readAsDataUrl(file);
    return {
        blob: file,
        dataUrl,
        mimeType: file.type || 'application/octet-stream',
        width: null,
        height: null,
        originalSize: file.size,
        resizedSize: file.size,
        resized: false,
    };
}

export async function resizeImageForUpload(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        return passthrough(file);
    }
    if (PASSTHROUGH_TYPES.has(file.type)) {
        return passthrough(file);
    }

    let bitmap;
    try {
        bitmap = await loadBitmap(file);
    } catch {
        return passthrough(file);
    }

    const srcWidth = bitmap.width;
    const srcHeight = bitmap.height;
    const longest = Math.max(srcWidth, srcHeight);

    if (longest <= MAX_LONGEST_EDGE && file.size <= SKIP_IF_BYTES_UNDER) {
        if (bitmap.close) bitmap.close();
        return passthrough(file);
    }

    const scale = longest > MAX_LONGEST_EDGE ? MAX_LONGEST_EDGE / longest : 1;
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = makeCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        if (bitmap.close) bitmap.close();
        return passthrough(file);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    if (bitmap.close) bitmap.close();

    const sourceLikelyHasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const keepAlpha = sourceLikelyHasAlpha && hasAlphaPixels(ctx, targetWidth, targetHeight);
    const outType = keepAlpha ? 'image/png' : 'image/jpeg';
    const outQuality = keepAlpha ? undefined : JPEG_QUALITY;

    let blob;
    try {
        blob = await canvasToBlob(canvas, outType, outQuality);
    } catch {
        return passthrough(file);
    }

    if (blob.size >= file.size) {
        return passthrough(file);
    }

    const dataUrl = await readAsDataUrl(blob);
    return {
        blob,
        dataUrl,
        mimeType: outType,
        width: targetWidth,
        height: targetHeight,
        originalSize: file.size,
        resizedSize: blob.size,
        resized: true,
    };
}
