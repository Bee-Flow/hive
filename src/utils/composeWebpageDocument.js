/**
 * Compose a complete HTML document from the three webpage slots, inlining
 * the CSS into a <style> block and the JS into an inline <script>. This is
 * the form used by the in-app preview iframe (sandboxed without
 * `allow-same-origin`, so external file references would resolve against a
 * `null` origin and fail).
 *
 * The downloaded zip uses a different composition — see downloadWebpageZip.js
 * for the zip flow.
 *
 * Options:
 *   selectionBridge — when true, append a small relay script that posts the
 *   user's text selection (mouseup) up to the parent window via postMessage.
 *   Used by the in-app preview so users can highlight rendered content and
 *   attach it to their next chat message. The relay only fires when there's
 *   a non-empty selection. postMessage works inside `sandbox="allow-scripts"`
 *   without needing `allow-same-origin`.
 */
export function composeWebpageDocument({ html, css, js }, options = {}) {
    const { selectionBridge = false } = options;
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

    if (/<head[^>]*>/i.test(safeHtml)) {
        let out = safeHtml.replace(/<head([^>]*)>/i, `<head$1>\n${styleTag}`);
        if (/<\/body>/i.test(out)) {
            out = out.replace(/<\/body>/i, `${scriptTag}\n${bridgeScript}\n</body>`);
        } else {
            out += scriptTag + bridgeScript;
        }
        return out;
    }
    return `<!DOCTYPE html><html><head>${styleTag}</head><body>${safeHtml}${scriptTag}${bridgeScript}</body></html>`;
}

export default composeWebpageDocument;
