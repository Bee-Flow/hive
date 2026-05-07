/**
 * Pure helpers for the flexible Content block.
 *
 * The Content block used to be a flat shape (heading, body, image, cta,
 * imagePosition…). It's now a column + elements system:
 *
 *   {
 *     columnLayout, columns: [{ id, elements: [...] }],
 *     background, verticalAlign
 *   }
 *
 *   element kinds: text | image | video | iframe | cta
 *
 * Existing blocks in the DB are still in the legacy shape. Rather than
 * shipping a one-shot DB migration, we normalise on read in both the
 * editor and the renderer — that way the conversion logic lives in one
 * place and an old block edited once gets persisted in the new shape.
 */

let _idSeq = 0;
function newId(prefix) {
    // Crypto would be nicer; for editor-only ids the time-based seq is
    // enough and avoids needing window.crypto in non-browser tests.
    _idSeq += 1;
    return `${prefix}_${Date.now().toString(36)}${_idSeq.toString(36)}`;
}

/** True when the content blob already follows the new column/elements shape. */
export function isNewContentShape(content) {
    return !!content
        && typeof content === 'object'
        && Array.isArray(content.columns);
}

/** Build an empty element of the given kind with sensible defaults. */
export function makeElement(kind) {
    const base = { id: newId('el'), kind };
    switch (kind) {
        case 'text':   return { ...base,
            heading: '', subheading: '', body: '', align: 'left',
        };
        case 'image':  return { ...base,
            src: '', alt: '', aspectRatio: 'auto', rounded: false, caption: '',
        };
        case 'video':  return { ...base,
            url: '', aspectRatio: '16/9', caption: '',
        };
        case 'iframe': return { ...base,
            src: '', height: 480, label: 'Embedded content', scrolling: false,
        };
        case 'cta':    return { ...base,
            label: 'Get started',
            link: { kind: 'anchor', anchor: '' },
            style: 'primary',
            align: 'left',
        };
        default: return base;
    }
}

/** Build a fresh empty column. */
export function makeColumn() {
    return { id: newId('col'), elements: [] };
}

/** Default content for a brand-new Content block. */
export function makeDefaultContent() {
    return {
        columnLayout: '1',
        columns: [
            {
                id: newId('col'),
                elements: [
                    {
                        ...makeElement('text'),
                        heading: 'Your heading here',
                        body: 'Add your content here.',
                    },
                ],
            },
        ],
        background: 'none',
        verticalAlign: 'top',
    };
}

/**
 * Normalise any Content block content (old or new shape) to the new shape.
 * Idempotent: re-running on already-migrated content returns it unchanged
 * (same object identity when possible to keep React happy).
 *
 * Legacy mapping:
 *   imagePosition 'left'   → 2 columns, 1-2 layout, image | text
 *   imagePosition 'right'  → 2 columns, 2-1 layout, text | image
 *   imagePosition 'above'  → 1 column, [image, text]
 *   imagePosition 'below'  → 1 column, [text, image] (the previous default)
 *   no image               → 1 column, [text]
 *
 * Old `cta` (single optional CTA below the text) appends a kind:'cta'
 * element to the text column. Old `backgroundVariant` ('default' /
 * 'surface' / 'primary' / 'dark') maps onto the new `background`.
 */
export function migrateLegacyContent(content) {
    if (isNewContentShape(content)) return content;
    if (!content || typeof content !== 'object') return makeDefaultContent();

    const heading    = typeof content.heading === 'string' ? content.heading : '';
    const subheading = typeof content.subheading === 'string' ? content.subheading : '';
    const body       = typeof content.body === 'string' ? content.body : '';
    const align      = ['left', 'center', 'right'].includes(content.textAlign)
        ? content.textAlign : 'left';
    const image      = content.image && typeof content.image === 'object' ? content.image : null;
    const cta        = content.cta && typeof content.cta === 'object' ? content.cta : null;
    const position   = ['above', 'below', 'left', 'right'].includes(content.imagePosition)
        ? content.imagePosition : 'below';
    const bgRaw      = content.backgroundVariant || 'default';
    const background = bgRaw === 'default' ? 'none'
                     : bgRaw === 'surface' ? 'light'
                     : bgRaw === 'primary' ? 'primary'
                     : bgRaw === 'dark'    ? 'dark'
                     : 'none';

    const textEl = { ...makeElement('text'), heading, subheading, body, align };
    if (cta) {
        // Old CTA was always rendered below the body; append it inside the
        // text column so the visual order is preserved.
    }

    const elementsForTextColumn = [textEl];
    if (cta) {
        elementsForTextColumn.push({
            ...makeElement('cta'),
            label: typeof cta.label === 'string' ? cta.label : 'Get started',
            link: cta.link && typeof cta.link === 'object'
                ? cta.link
                : { kind: 'anchor', anchor: '' },
            style: ['primary', 'secondary', 'ghost', 'link'].includes(cta.style)
                ? cta.style : 'primary',
            align,
        });
    }

    let columnLayout, columns;
    if (image && (position === 'left' || position === 'right')) {
        const imgCol = {
            id: newId('col'),
            elements: [{
                ...makeElement('image'),
                src: typeof image.src === 'string' ? image.src : '',
                alt: typeof image.alt === 'string' ? image.alt : '',
            }],
        };
        const txtCol = { id: newId('col'), elements: elementsForTextColumn };
        if (position === 'left') {
            columnLayout = '1-2';
            columns = [imgCol, txtCol];
        } else {
            columnLayout = '2-1';
            columns = [txtCol, imgCol];
        }
    } else if (image) {
        // above / below — single column, two stacked elements.
        const imgEl = {
            ...makeElement('image'),
            src: typeof image.src === 'string' ? image.src : '',
            alt: typeof image.alt === 'string' ? image.alt : '',
        };
        const inner = position === 'above'
            ? [imgEl, ...elementsForTextColumn]
            : [...elementsForTextColumn, imgEl];
        columnLayout = '1';
        columns = [{ id: newId('col'), elements: inner }];
    } else {
        columnLayout = '1';
        columns = [{ id: newId('col'), elements: elementsForTextColumn }];
    }

    return {
        columnLayout,
        columns,
        background,
        verticalAlign: 'top',
    };
}

/**
 * YouTube / Vimeo URL → embed URL. Handles:
 *   - youtube.com/watch?v=ID            (with optional &t= timestamp)
 *   - youtu.be/ID                       (with optional ?t= timestamp)
 *   - youtube.com/embed/ID              (already-embed; returned as-is)
 *   - vimeo.com/ID
 *   - player.vimeo.com/video/ID         (already-embed; returned as-is)
 * Returns null when the URL doesn't look like a recognised provider so the
 * renderer can show a placeholder rather than embedding garbage.
 */
export function resolveVideoEmbed(url) {
    if (typeof url !== 'string' || !url.trim()) return null;
    const u = url.trim();
    try {
        const parsed = new URL(u);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

        // YouTube — long form ?v= or short youtu.be/ID
        if (host === 'youtu.be') {
            const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
            if (!id) return null;
            const t = parseTimestamp(parsed.searchParams.get('t'));
            return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${t ? `&start=${t}` : ''}`;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            // /watch?v=ID
            if (parsed.pathname === '/watch') {
                const id = parsed.searchParams.get('v');
                if (!id) return null;
                const t = parseTimestamp(parsed.searchParams.get('t'));
                return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${t ? `&start=${t}` : ''}`;
            }
            // /embed/ID — already an embed URL, pass through.
            if (parsed.pathname.startsWith('/embed/')) return u;
            // /shorts/ID
            const m = parsed.pathname.match(/^\/shorts\/([^/]+)/);
            if (m) return `https://www.youtube.com/embed/${encodeURIComponent(m[1])}?rel=0`;
        }

        // Vimeo
        if (host === 'vimeo.com') {
            const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
            if (!id || !/^\d+$/.test(id)) return null;
            return `https://player.vimeo.com/video/${id}`;
        }
        if (host === 'player.vimeo.com') {
            return u; // already-embed
        }
    } catch {
        return null;
    }
    return null;
}

// "1m30s" / "90" / "1:30" → seconds. Returns null for invalid input.
function parseTimestamp(raw) {
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return Number(raw);
    const m = String(raw).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (m) {
        const h = Number(m[1] || 0), mn = Number(m[2] || 0), s = Number(m[3] || 0);
        const total = h * 3600 + mn * 60 + s;
        return total || null;
    }
    return null;
}
