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
 * Defang any `</script` sequence inside JS content so it can't terminate the
 * wrapping inline `<script>` block. The HTML parser ends the script element
 * at the literal `</script` (case-insensitive); `<\/script` is byte-different
 * to the parser but identical at runtime (the leading `\` before `/` is
 * meaningless inside a JS string literal). Without this, an AI-generated
 * markdown renderer that mentions `</script>` in a regex, string or comment
 * silently breaks the entire page with a SyntaxError around the truncation
 * point.
 */
function defangScriptClose(jsContent) {
    return String(jsContent || '').replace(/<\/script/gi, '<\\/script');
}

/**
 * Replace every <link rel="stylesheet" href="path"> in `html` whose href
 * matches `targetPath` with an inline <style> block. Idempotent — won't
 * replace tags that have already been substituted because we look for the
 * literal href= pattern.
 */
function inlineStylesheet(html, targetPath, css) {
    const re = new RegExp(`<link\\b[^>]*\\bhref\\s*=\\s*["']${escapeRegExp(targetPath)}["'][^>]*>`, 'gi');
    // Use the function-form replacer so `$` chars in `css` aren't interpreted
    // as String.replace backreferences ($&, $', $`, $1-$9).
    return html.replace(re, () => `<style>\n${css}\n</style>`);
}

/**
 * Replace every <script src="path"></script> in `html` whose src matches
 * `targetPath` with an inline <script> block. The user-supplied JS body
 * gets defanged so any embedded `</script` token can't escape the wrapper.
 */
function inlineScript(html, targetPath, js) {
    const re = new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["']${escapeRegExp(targetPath)}["'][^>]*>\\s*<\\/script>`, 'gi');
    const replacement = `<script>\n${defangScriptClose(js)}\n<\/script>`;
    // Function-form replacer — JS bodies routinely contain `$` (template
    // literals, KaTeX delimiters, regexes). The string form would interpret
    // those as backreferences and silently corrupt the inlined script.
    return html.replace(re, () => replacement);
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
    // dataUrl is base64 but the surrounding HTML segments could contain `$`;
    // use the function form for the same reason as inlineScript above.
    return html
        .replace(reHref, (_match, p1, p2) => `${p1}${dataUrl}${p2}`)
        .replace(reSrc, (_match, p1, p2) => `${p1}${dataUrl}${p2}`);
}

/**
 * Build the `window.beeflowAI`, `window.beeflowAutomations`, and
 * `window.beeflowIntegrations` shims — the runtime API a webpage's
 * script.js calls to use platform capabilities. Each goes through an
 * HMAC-bearer-token-authenticated proxy that runs acts-as-author.
 * Emitted only when (token, base, id) are present — same gating as the
 * DB shim. See server/routes/webpagesPreview.js for the route surface
 * and server/core/webpageBridgeAuth.js for the author-context resolver.
 */
function buildBeeflowBridgesScript({ dbToken, dbApiBase, dbWebpageId }) {
    if (!dbToken || !dbApiBase || !dbWebpageId) return '';
    const safeBase = String(dbApiBase || '').replace(/\/+$/, '');
    const safeId = encodeURIComponent(dbWebpageId);
    const tokenLiteral = JSON.stringify(dbToken);
    const baseLiteral = JSON.stringify(safeBase);
    const idLiteral = JSON.stringify(safeId);
    return `<script>(function(){
  var TOKEN = ${tokenLiteral};
  var BASE  = ${baseLiteral} + "/api/webpages-preview/" + ${idLiteral};
  function headers() {
    return { "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN };
  }
  // When the server rejects our token (signing secret rotated, expiry, etc.)
  // ask the parent for a fresh one via postMessage. The parent's session can
  // mint a new token; we swap it in and retry the original request once.
  var _refreshPending = null;
  function refreshToken() {
    if (_refreshPending) return _refreshPending;
    _refreshPending = new Promise(function(resolve, reject) {
      var reqId = "tok_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      function onMsg(e) {
        var d = e && e.data;
        if (!d || d.__beeflowTokenResponse !== true || d.requestId !== reqId) return;
        window.removeEventListener("message", onMsg);
        clearTimeout(timer);
        _refreshPending = null;
        if (d.token) { TOKEN = d.token; resolve(true); }
        else { reject(new Error(d.error || "token refresh failed")); }
      }
      var timer = setTimeout(function() {
        window.removeEventListener("message", onMsg);
        _refreshPending = null;
        reject(new Error("token refresh timed out"));
      }, 5000);
      window.addEventListener("message", onMsg);
      try { parent.postMessage({ __beeflowTokenRefresh: true, requestId: reqId }, "*"); }
      catch (err) { _refreshPending = null; reject(err); }
    });
    return _refreshPending;
  }
  async function fetchWithAuth(url, init, retried) {
    var res = await fetch(url, init);
    if (res.status === 401 && !retried) {
      try { await refreshToken(); } catch (_) { return res; }
      // Re-build the request with the fresh TOKEN before the retry.
      var nextInit = Object.assign({}, init);
      if (init && init.headers) {
        nextInit.headers = Object.assign({}, init.headers);
        if (nextInit.headers.Authorization || nextInit.headers.authorization) {
          nextInit.headers.Authorization = "Bearer " + TOKEN;
        }
      }
      return fetchWithAuth(url, nextInit, true);
    }
    return res;
  }
  async function postJson(path, body) {
    var res = await fetchWithAuth(BASE + path, {
      method: "POST",
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    var json = null;
    try { json = await res.json(); } catch(_) {}
    if (!res.ok) {
      var err = new Error((json && json.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return json;
  }
  async function getJson(path) {
    var res = await fetchWithAuth(BASE + path, { headers: { "Authorization": "Bearer " + TOKEN } });
    var json = null;
    try { json = await res.json(); } catch(_) {}
    if (!res.ok) {
      var err = new Error((json && json.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return json;
  }
  // Parse a fetch ReadableStream of SSE chunks (event: <name>\\ndata: <json>\\n\\n)
  // and dispatch them to a callback. Used by beeflowAI.stream.
  async function streamSSE(path, body, onEvent) {
    var res = await fetchWithAuth(BASE + path, { method: "POST", headers: headers(), body: JSON.stringify(body || {}) });
    if (!res.ok) {
      var errJson = null;
      try { errJson = await res.json(); } catch(_) {}
      var err = new Error((errJson && errJson.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var parts = buf.split("\\n\\n");
      buf = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var block = parts[i];
        var ev = "message", data = "";
        var lines = block.split("\\n");
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j];
          if (line.indexOf("event:") === 0) ev = line.slice(6).trim();
          else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
        }
        var parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch(_) {}
        try { onEvent(ev, parsed); } catch(_) {}
      }
    }
  }

  window.beeflowAI = {
    chat: function(prompt, opts) {
      var body = Object.assign({ prompt: prompt }, opts || {});
      return postJson("/ai/chat", body).then(function(r){ return r.text; });
    },
    chatJSON: function(prompt, schema, opts) {
      var body = Object.assign({ prompt: prompt, schema: schema }, opts || {});
      return postJson("/ai/chat", body).then(function(r){ return r.json; });
    },
    stream: function(prompt, onToken, opts) {
      var body = Object.assign({ prompt: prompt }, opts || {});
      var full = "";
      return streamSSE("/ai/stream", body, function(ev, data) {
        if (ev === "content" && data && typeof data.text === "string") {
          full += data.text;
          try { onToken && onToken(data.text); } catch(_) {}
        }
      }).then(function(){ return full; });
    },
    // Agentic. The server-side LLM gets the page's full granted surface
    // (integrations, automations, KB) and runs a multi-round tool loop.
    // The page awaits a single promise; the AI does the orchestration.
    //
    // opts = {
    //   messages?, tier?, maxTokens?, maxRounds?,
    //   onToken?(text)    // every text chunk
    //   onEvent?(name, data)  // every SSE event — use for status pills
    //                         // ('tool_call', 'tool_result', 'done', 'error')
    // }
    // → Promise<{ text, rounds, truncated, toolCalls: [{ id, name, args, result }] }>
    ask: function(prompt, opts) {
      var options = opts || {};
      var body = Object.assign({ prompt: prompt }, options);
      delete body.onToken; delete body.onEvent;
      var full = "";
      var rounds = 0;
      var truncated = false;
      var calls = {};
      return streamSSE("/ai/ask", body, function(ev, data) {
        try { options.onEvent && options.onEvent(ev, data); } catch(_) {}
        if (ev === "text" && data && typeof data.text === "string") {
          full += data.text;
          try { options.onToken && options.onToken(data.text); } catch(_) {}
        } else if (ev === "tool_call" && data && data.id) {
          calls[data.id] = { id: data.id, name: data.name, args: data.args, result: null };
        } else if (ev === "tool_result" && data && data.id) {
          if (!calls[data.id]) calls[data.id] = { id: data.id, name: data.name };
          calls[data.id].result = data.summary;
          calls[data.id].ok = !!data.ok;
        } else if (ev === "done" && data) {
          rounds = data.rounds || 0;
          truncated = !!data.truncated;
        } else if (ev === "error" && data && data.error) {
          throw new Error(data.error);
        }
      }).then(function(){
        var toolCalls = Object.keys(calls).map(function(k){ return calls[k]; });
        return { text: full, rounds: rounds, truncated: truncated, toolCalls: toolCalls };
      });
    }
  };

  window.beeflowAutomations = {
    list: function(){ return getJson("/automations").then(function(r){ return r.automations || []; }); },
    run: function(automationId, inputs, opts) {
      var body = { inputs: inputs || {}, wait: !opts || opts.wait !== false };
      return postJson("/automations/" + encodeURIComponent(automationId) + "/run", body);
    },
    getRun: function(runId){ return getJson("/automations/runs/" + encodeURIComponent(runId)); },
    getSteps: function(runId){ return getJson("/automations/runs/" + encodeURIComponent(runId) + "/steps").then(function(r){ return r.steps || []; }); },
    cancel: function(runId){ return postJson("/automations/runs/" + encodeURIComponent(runId) + "/cancel", {}); }
  };

  window.beeflowIntegrations = {
    list: function(){ return getJson("/integrations").then(function(r){ return r.integrations || []; }); },
    run: function(tool, args){ return postJson("/integrations/run", { tool: tool, args: args || {} }); }
  };
})();<\/script>`;
}

/**
 * Build the `window.beeflowDB` shim that the user's script.js can call to
 * talk to the per-webpage SQLite database. Lives in <head> so it's defined
 * before script.js runs. Only emitted when all three of (token, base, id)
 * are present — otherwise the page renders without DB support and any
 * `beeflowDB.*` call surfaces as a clear ReferenceError.
 */
function buildBeeflowDbScript({ dbToken, dbApiBase, dbWebpageId }) {
    const safeBase = String(dbApiBase || '').replace(/\/+$/, '');
    const safeId = encodeURIComponent(dbWebpageId);
    // JSON-stringify the token so it survives any quote characters and lands
    // in the iframe as a plain string literal.
    const tokenLiteral = JSON.stringify(dbToken);
    const baseLiteral = JSON.stringify(safeBase);
    return `<script>(function(){
  var TOKEN = ${tokenLiteral};
  var BASE  = ${baseLiteral} + "/api/webpages-preview/${safeId}/db";
  async function call(path, body, method){
    var res = await fetch(BASE + path, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + TOKEN
      },
      body: body ? JSON.stringify(body) : undefined
    });
    var json = null;
    try { json = await res.json(); } catch(_) {}
    if (!res.ok) {
      var err = new Error((json && json.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return json;
  }
  window.beeflowDB = {
    query:  function(sql, params){ return call("/query", { sql: sql, params: params || [] }); },
    exec:   function(sql, params){ return call("/exec",  { sql: sql, params: params || [] }); },
    batch:  function(statements){  return call("/batch", { statements: statements }); },
    schema: function(){            return call("/schema", null, "GET"); }
  };
})();<\/script>`;
}

export function composeWebpageDocument({ html, css, js }, options = {}) {
    const { selectionBridge = false, extraFiles = [], dbToken = null, dbApiBase = null, dbWebpageId = null } = options;
    const safeHtml = html && html.trim()
        ? html
        : '<!DOCTYPE html><html><head></head><body></body></html>';
    const styleTag = css ? `<style>\n${css}\n</style>` : '';
    // The closing `</script>` is split so the surrounding script the iframe
    // is rendered inside can't be mistaken for a closing tag by some parsers.
    // The user's JS body is additionally defanged in case it embeds a literal
    // `</script` sequence (regex, KaTeX delimiters, marked source, etc.).
    const scriptTag = js ? `<script>\n${defangScriptClose(js)}\n<\/script>` : '';
    const beeflowDbScript = (dbToken && dbApiBase && dbWebpageId)
        ? buildBeeflowDbScript({ dbToken, dbApiBase, dbWebpageId })
        : '';
    // Bridges (AI / Automations / Integrations) live alongside the DB shim.
    // Same token + base, different route surface — see webpagesPreview.js.
    const beeflowBridgesScript = (dbToken && dbApiBase && dbWebpageId)
        ? buildBeeflowBridgesScript({ dbToken, dbApiBase, dbWebpageId })
        : '';
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

    // Inline PRIMARY slots if the user's HTML references them. Without this
    // pass, AI-generated index.html that contains `<link rel="stylesheet"
    // href="style.css">` or `<script src="script.js"></script>` produces 404
    // errors in the iframe (it has an opaque origin; relative URLs resolve to
    // the parent app's path). When the reference is present we replace it
    // in-place; when it's absent we fall back to appending styleTag/scriptTag
    // at the default head/body positions below.
    let cssInlined = false;
    let jsInlined = false;
    if (css) {
        const replaced = inlineStylesheet(working, 'style.css', css);
        if (replaced !== working) { working = replaced; cssInlined = true; }
    }
    if (js) {
        const replaced = inlineScript(working, 'script.js', js);
        if (replaced !== working) { working = replaced; jsInlined = true; }
    }

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
                const url = `data:${mime};base64,${btoa(unescape(encodeURIComponent(f.content)))}`;
                working = inlineDataUrl(working, f.path, url);
            }
        }
    }

    // Skip the head/body fallback inserts when the user's HTML already
    // referenced the primary slot (the inliner pass above substituted the
    // real content in-place; re-inserting would double-evaluate the script
    // and double-apply the styles).
    const headStyleTag = cssInlined ? '' : styleTag;
    const bodyScriptTag = jsInlined ? '' : scriptTag;

    if (/<head[^>]*>/i.test(working)) {
        // beeflowDbScript + beeflowBridgesScript go immediately after <head>
        // so the globals are defined before any user CSS/JS that might reach
        // for them.
        let out = working.replace(/<head([^>]*)>/i, `<head$1>\n${beeflowDbScript}\n${beeflowBridgesScript}\n${headStyleTag}`);
        if (/<\/body>/i.test(out)) {
            out = out.replace(/<\/body>/i, `${bodyScriptTag}\n${bridgeScript}\n</body>`);
        } else {
            out += bodyScriptTag + bridgeScript;
        }
        return out;
    }
    return `<!DOCTYPE html><html><head>${beeflowDbScript}${beeflowBridgesScript}${headStyleTag}</head><body>${working}${bodyScriptTag}${bridgeScript}</body></html>`;
}

export default composeWebpageDocument;
