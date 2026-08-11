// Per-page export / import helpers.
//
// Wire format: { meta: { title, slug, exportedAt }, blocks: [...] }.
// `meta.slug` is informational; the caller decides what slug to actually
// use when creating the page (the server resolves collisions).
//
// Import validates + normalizes blocks against the known block schema so
// foreign/AI JSON either renders (near-misses are normalized) or fails loudly
// with a message naming the unrecognized types — never a silent empty page.

import { validateBlocks, describeDropped } from './blockSchema';

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
                    throw new Error('Invalid page file: missing "blocks" array.');
                }
                const result = validateBlocks(parsed.blocks);
                // Hard-fail only when nothing usable survives — so we never
                // create a page that renders empty. Partial imports go through
                // with a warning (dropped/warnings surfaced by the caller).
                if (result.normalizedBlocks.length === 0) {
                    throw new Error('Import failed: ' + describeDropped(result.dropped));
                }
                resolve({
                    meta: parsed.meta || {},
                    blocks: result.normalizedBlocks,
                    dropped: result.dropped,
                    warnings: result.warnings,
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
