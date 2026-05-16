// Inline-embed <img> sources as base64 data URLs for offline export
// targets (PDF/Word/HTML download). Extracted from pages/NotebooksPage.jsx
// where it lived inline. The function preserves any width hints encoded
// on the original tag so the export renders at the same size as the
// editor preview.
//
// Failures (CORS, 404, timeout) are best-effort: the original <img> tag
// is left in place so the export still references the original URL.

interface ImageReplacement {
    fullMatch: string;
    newTag: string;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function buildWidthStyle(beforeAttrs: string, afterAttrs: string): string {
    // data-width="123" wins over style="width:..."; mirrors the original
    // editor behaviour where the data attribute is the source of truth.
    const widthMatch = (beforeAttrs + afterAttrs).match(/data-width=["'](\d+)["']/);
    if (widthMatch) {
        return ` style="width:${widthMatch[1]}px;height:auto;max-width:100%"`;
    }
    const styleMatch = (beforeAttrs + afterAttrs).match(/style=["']([^"']*?width[^"']*?)["']/);
    if (styleMatch) {
        return ` style="${styleMatch[1]}"`;
    }
    return '';
}

/**
 * Walks the given HTML string and replaces every `<img>` with one whose
 * src is a base64 data URL. Resolves relative URLs against the current
 * window origin.
 */
export async function embedImagesAsBase64(html: string): Promise<string> {
    const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
    const matches = [...html.matchAll(imgRegex)];

    const replacements = await Promise.allSettled(
        matches.map(async (match): Promise<ImageReplacement> => {
            const [fullMatch, before, src, after] = match;
            if (src.startsWith('data:')) return { fullMatch, newTag: fullMatch };

            try {
                const resolvedUrl = src.startsWith('http') ? src : `${window.location.origin}${src}`;
                const res = await fetch(resolvedUrl, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const dataUrl = await blobToDataUrl(blob);
                const widthStyle = buildWidthStyle(before, after);
                return { fullMatch, newTag: `<img src="${dataUrl}"${widthStyle} alt="" />` };
            } catch (err) {
                // Console-warn here matches the original inline behaviour: export
                // is best-effort and the caller doesn't need to know.
                console.warn('[imageEmbedding] failed to embed', src, (err as Error)?.message);
                return { fullMatch, newTag: fullMatch };
            }
        }),
    );

    let result = html;
    for (const r of replacements) {
        if (r.status === 'fulfilled') {
            result = result.replace(r.value.fullMatch, r.value.newTag);
        }
    }
    return result;
}
