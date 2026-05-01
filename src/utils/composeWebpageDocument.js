/**
 * Compose a complete HTML document from the three webpage slots, inlining
 * the CSS into a <style> block and the JS into an inline <script>. This is
 * the form used by the in-app preview iframe (sandboxed without
 * `allow-same-origin`, so external file references would resolve against a
 * `null` origin and fail).
 *
 * Options:
 *   selectionBridge — append a small relay script that posts the user's
 *     text selection up to the parent window via postMessage.
 *   extraFiles — array of { path, isText, mimeType, content?, dataUrl? } for
 *     additional files in the project. Text files are inlined when their
 *     path matches a <link href="..."> or <script src="..."> in the HTML;
 *     binary files (data URLs) replace src/href references inline.
 *
 * The downloaded zip uses a different composition — see downloadWebpageZip.js.
 */

const HTML_TAG_RE_CACHE = new Map();
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Replace every <link rel="stylesheet" href="path"> in `html` whose href
 * matches `targetPath` with an inline <style> block. Idempotent — won't
 * replace tags that have already been substituted because we look for the
 * literal href= pattern.
 */
function inlineStylesheet(html, targetPath, css) {
    const re = new RegExp(`<link\\b[^>]*\\bhref\\s*=\\s*["']${escapeRegExp(targetPath)}["'][^>]*>`, 'gi');
    return html.replace(re, `<style>\n${css}\n</style>`);
}

/**
 * Replace every <script src="path"></script> in `html` whose src matches
 * `targetPath` with an inline <script> block.
 */
function inlineScript(html, targetPath, js) {
    const re = new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["']${escapeRegExp(targetPath)}["'][^>]*>\\s*<\\/script>`, 'gi');
    return html.replace(re, `<script>\n${js}\n<\/script>`);
}

/**
 * Replace every src="path" / href="path" attribute (on any tag) with a
 * data: URL. Used for binary assets so <img src="logo.png"> renders inside
 * the sandbox-without-same-origin iframe where relative URLs would otherwise
 * fail to resolve.
 */
function inlineDataUrl(html, targetPath, dataUrl) {
    const reHref = new RegExp(`(\\bhref\\s*=\\s*["'])${escapeRegExp(targetPath)}(["'])`, 'gi');
    const reSrc = new RegExp(`(\\bsrc\\s*=\\s*["'])${escapeRegExp(targetPath)}(["'])`, 'gi');
    return html.replace(reHref, `$1${dataUrl}$2`).replace(reSrc, `$1${dataUrl}$2`);
}

export function composeWebpageDocument({ html, css, js }, options = {}) {
    const { selectionBridge = false, extraFiles = [] } = options;
    const safeHtml = html && html.trim()
        ? html
        : '<!DOCTYPE html><html><head></head><body></body></html>';
    const styleTag = css ? `<style>\n${css}\n</style>` : '';
    // The closing `</script>` is split so the surrounding script the iframe
    // is rendered inside can't be mistaken for a closing tag by some parsers.
    const scriptTag = js ? `<script>\n${js}\n<\/script>` : '';
    const bridgeScript = selectionBridge ? `<script>(function(){
  function relay(){
    try {
      var sel = window.getSelection && window.getSelection();
      var text = sel && sel.toString ? sel.toString() : '';
      if (!text || !text.trim()) return;
      var anchor = sel && sel.anchorNode;
      var el = anchor && anchor.nodeType === 3 ? anchor.parentElement : (anchor || null);
      var tagName = el && el.tagName ? el.tagName.toLowerCase() : null;
      var className = el && el.className && typeof el.className === 'string' ? el.className.slice(0, 120) : null;
      var id = el && el.id ? String(el.id).slice(0, 120) : null;
      parent.postMessage({
        __beeflowWebpageSelection: true,
        text: text.slice(0, 4000),
        tagName: tagName,
        className: className,
        elementId: id
      }, '*');
    } catch(_){}
  }
  document.addEventListener('mouseup', relay, true);
  document.addEventListener('keyup', function(e){
    if (e.shiftKey || e.ctrlKey || e.metaKey) relay();
  }, true);
})();<\/script>` : '';

    let working = safeHtml;

    // Inline extra files. Walk in two passes so that earlier text inlining
    // doesn't accidentally swallow other references.
    if (Array.isArray(extraFiles) && extraFiles.length > 0) {
        // Pass 1: text files referenced by <link>/<script> tags.
        for (const f of extraFiles) {
            if (!f || !f.path) continue;
            if (f.isText && typeof f.content === 'string') {
                if (/\.css$/i.test(f.path)) {
                    working = inlineStylesheet(working, f.path, f.content);
                } else if (/\.m?js$/i.test(f.path)) {
                    working = inlineScript(working, f.path, f.content);
                }
            }
        }
        // Pass 2: data URLs for everything that's left referenced (binaries +
        // any text file referenced as src/href that wasn't a stylesheet/script).
        for (const f of extraFiles) {
            if (!f || !f.path) continue;
            if (f.dataUrl) {
                working = inlineDataUrl(working, f.path, f.dataUrl);
            } else if (f.isText && typeof f.content === 'string') {
                // Build a data URL from text content for any remaining src/href references
                // (e.g. <img src="icon.svg"> when the file is an SVG).
                const mime = f.mimeType || 'text/plain';
                const url = `data:${mime};base64,${typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(f.content))) : Buffer.from(f.content, 'utf8').toString('base64')}`;
                working = inlineDataUrl(working, f.path, url);
            }
        }
    }

    if (/<head[^>]*>/i.test(working)) {
        let out = working.replace(/<head([^>]*)>/i, `<head$1>\n${styleTag}`);
        if (/<\/body>/i.test(out)) {
            out = out.replace(/<\/body>/i, `${scriptTag}\n${bridgeScript}\n</body>`);
        } else {
            out += scriptTag + bridgeScript;
        }
        return out;
    }
    return `<!DOCTYPE html><html><head>${styleTag}</head><body>${working}${scriptTag}${bridgeScript}</body></html>`;
}

export default composeWebpageDocument;
