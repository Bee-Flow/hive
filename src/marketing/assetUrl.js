// cms/<key> → /api/cms/asset/<key> resolver. Lives in its own module so
// section components (and FramedMedia) can import it without creating a
// cycle through ProductWebsite.jsx, which imports every section.
export function resolveAssetUrl(urlOrKey) {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://') || urlOrKey.startsWith('/')) return urlOrKey;
    if (urlOrKey.startsWith('cms/')) {
        return `/api/cms/asset/${urlOrKey.split('/').map(encodeURIComponent).join('/')}`;
    }
    return urlOrKey;
}
