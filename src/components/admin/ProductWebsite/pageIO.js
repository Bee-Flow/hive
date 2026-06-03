// Per-page export / import helpers. Self-contained — no React, no store
// access — so they can be called from anywhere in the panel.
//
// Wire format: { meta: { title, slug, exportedAt }, blocks: [...] }.
// `meta.slug` is informational; the caller decides what slug to actually
// use when creating the page (the server resolves collisions).

export function exportPage(page) {
    const payload = {
        meta: {
            title: page?.title || '',
            slug: page?.slug || '',
            exportedAt: new Date().toISOString(),
        },
        blocks: Array.isArray(page?.blocks) ? page.blocks : [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-${payload.meta.slug || 'untitled'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importPage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
                    throw new Error('Invalid page file: missing blocks array');
                }
                resolve(parsed);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
