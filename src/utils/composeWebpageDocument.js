/**
 * Compose a complete HTML document from the three webpage slots, inlining
 * the CSS into a <style> block and the JS into an inline <script>. This is
 * the form used by the in-app preview iframe (sandboxed without
 * `allow-same-origin`, so external file references would resolve against a
 * `null` origin and fail).
 *
 * The downloaded zip uses a different composition — see downloadWebpageZip.js
 * for the zip flow.
 */
export function composeWebpageDocument({ html, css, js }) {
    const safeHtml = html && html.trim()
        ? html
        : '<!DOCTYPE html><html><head></head><body></body></html>';
    const styleTag = css ? `<style>\n${css}\n</style>` : '';
    // The closing `</script>` is split so the surrounding script the iframe
    // is rendered inside can't be mistaken for a closing tag by some parsers.
    const scriptTag = js ? `<script>\n${js}\n<\/script>` : '';

    if (/<head[^>]*>/i.test(safeHtml)) {
        let out = safeHtml.replace(/<head([^>]*)>/i, `<head$1>\n${styleTag}`);
        if (/<\/body>/i.test(out)) {
            out = out.replace(/<\/body>/i, `${scriptTag}\n</body>`);
        } else {
            out += scriptTag;
        }
        return out;
    }
    return `<!DOCTYPE html><html><head>${styleTag}</head><body>${safeHtml}${scriptTag}</body></html>`;
}

export default composeWebpageDocument;
