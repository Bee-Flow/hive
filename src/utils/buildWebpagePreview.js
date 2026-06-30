/**
 * React + Material UI light-tier preview build.
 *
 * Bundles a react-mui project's source files (src/*.jsx, *.css, …) into ONE ES
 * module string with esbuild-wasm IN THE BROWSER, leaving bare specifiers
 * (react, @mui/material, …) external so they resolve at runtime through an
 * import map pointing at https://esm.sh. The single inline module + import map
 * are injected into the sandboxed srcdoc by composeReactPreview().
 *
 * Why this exact shape — the preview iframe's CSP (set in
 * agent-hub/nginx.conf.template) is:
 *     script-src 'self' 'unsafe-inline' 'unsafe-eval' https:
 * That permits an inline <script type="module"> and https: imports/fetches, but
 * NOT blob:/data: module URLs. So a single inline bundle whose only external
 * imports are https://esm.sh URLs (via an import map) is the ONLY
 * CSP-compatible way to run React + MUI inside the no-same-origin sandbox.
 *
 * esbuild-wasm runs in the HOST app (origin 'self', where 'unsafe-eval' + WASM
 * are already allowed for Monaco/vega/mermaid), never inside the iframe. This
 * module is dynamically imported only when a react-mui page is previewed, so
 * the ~3MB wasm never loads for vanilla projects or the rest of the app.
 */

import {
    defangScriptClose,
    buildBridgeHeadScripts,
    buildSelectionBridgeScript,
} from './composeWebpageDocument';

// Pinned runtime versions. Bump together. The '*' external prefix on a package
// (below) tells esm.sh to leave that package's deps as bare imports, which
// resolve back through THIS import map — guaranteeing a single shared
// react / react-dom / emotion instance (the #1 MUI-over-CDN failure mode).
const REACT_VERSION = '18.3.1';
const MUI_VERSION = '5.16.7';
const MUI_ICONS_VERSION = '5.16.7';
const EMOTION_REACT_VERSION = '11.13.5';
const EMOTION_STYLED_VERSION = '11.13.5';
const ESM_BASE = 'https://esm.sh';

const REACT_ENTRY = 'src/main.jsx';

// ── esbuild-wasm lazy singleton ────────────────────────────────────────────

let _esbuild = null;
let _initPromise = null;

async function getEsbuild() {
    if (_esbuild) return _esbuild;
    if (!_initPromise) {
        _initPromise = (async () => {
            const esbuild = await import('esbuild-wasm');
            // Serve the wasm from the app origin ('self') via Vite's ?url asset
            // import — keeps the bundler itself working without any CDN (only
            // react/@mui come from esm.sh), which matters for self-hosted installs.
            const wasmURL = (await import('esbuild-wasm/esbuild.wasm?url')).default;
            await esbuild.initialize({ wasmURL, worker: false });
            _esbuild = esbuild;
            return esbuild;
        })().catch((err) => { _initPromise = null; throw err; });
    }
    return _initPromise;
}

/**
 * The import map injected into the preview document. Maps the importable
 * packages to pinned esm.sh URLs; the leading '*' externalises each package's
 * deps so they share the single react/emotion above.
 */
// react, react-dom and emotion are the SINGLETONS that every module must share
// (hooks + the emotion cache break with duplicates). They stay bare imports
// resolved by the import map below. Everything else (@mui/*, and their
// transitive deps clsx / @babel/runtime / react-is / @popperjs/core …) is
// rewritten to a pinned esm.sh URL with ?external=<singletons>, so esm.sh
// bundles those transitive deps itself (as absolute esm.sh URLs) and only the
// singletons leak out as bare imports. (The previous `*`-prefix externalised
// ALL deps, including clsx — which the import map didn't cover, so the whole
// graph failed to load and the page rendered blank.)
const EXTERNAL_SINGLETONS = 'react,react-dom,@emotion/react,@emotion/styled';

export function buildImportMap() {
    return {
        imports: {
            'react': `${ESM_BASE}/react@${REACT_VERSION}`,
            'react/': `${ESM_BASE}/react@${REACT_VERSION}/`,
            'react-dom': `${ESM_BASE}/react-dom@${REACT_VERSION}?external=react`,
            'react-dom/client': `${ESM_BASE}/react-dom@${REACT_VERSION}/client?external=react`,
            '@emotion/react': `${ESM_BASE}/@emotion/react@${EMOTION_REACT_VERSION}?external=react`,
            '@emotion/react/jsx-runtime': `${ESM_BASE}/@emotion/react@${EMOTION_REACT_VERSION}/jsx-runtime?external=react`,
            '@emotion/styled': `${ESM_BASE}/@emotion/styled@${EMOTION_STYLED_VERSION}?external=react,@emotion/react`,
        },
    };
}

// A specifier is a shared singleton (kept bare → import map) vs. anything else
// (rewritten to a pinned esm.sh URL).
function isSharedSingleton(spec) {
    return spec === 'react' || spec.startsWith('react/')
        || spec === 'react-dom' || spec.startsWith('react-dom/')
        || spec === '@emotion/react' || spec.startsWith('@emotion/react/')
        || spec === '@emotion/styled' || spec.startsWith('@emotion/styled/');
}

const MUI_PINS = {
    '@mui/material': `@mui/material@${MUI_VERSION}`,
    '@mui/icons-material': `@mui/icons-material@${MUI_ICONS_VERSION}`,
    '@mui/system': `@mui/system@${MUI_VERSION}`,
    '@mui/lab': '@mui/lab@5.0.0-alpha.173',
    '@mui/base': '@mui/base@5.0.0-beta.40',
    '@mui/utils': '@mui/utils@5.16.6',
};
function pinnedSpec(spec) {
    for (const k of Object.keys(MUI_PINS)) {
        if (spec === k) return MUI_PINS[k];
        if (spec.startsWith(k + '/')) return MUI_PINS[k] + spec.slice(k.length);
    }
    return spec; // unknown package → esm.sh resolves latest (light tier supports the MUI core set)
}
function esmExternalUrl(spec) {
    return `${ESM_BASE}/${pinnedSpec(spec)}?external=${EXTERNAL_SINGLETONS}`;
}

// ── Virtual filesystem resolution ──────────────────────────────────────────

const LOADER_BY_EXT = {
    jsx: 'jsx', tsx: 'tsx', ts: 'ts', mjs: 'js', cjs: 'js', js: 'jsx', json: 'json',
};
function loaderForPath(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    return LOADER_BY_EXT[ext] || 'text';
}

function dirname(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function normalize(p) {
    const parts = [];
    for (const seg of p.split('/')) {
        if (seg === '' || seg === '.') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
    }
    return parts.join('/');
}

/**
 * Resolve a relative/absolute import against the in-memory file map, trying the
 * exact path then common extensions and index files. Returns the matched key or
 * null. Bare (npm) specifiers are handled separately (externalised).
 */
function resolveImport(importer, spec, files) {
    const base = spec.startsWith('/')
        ? normalize(spec.slice(1))
        : normalize((importer ? dirname(importer) + '/' : '') + spec);
    const candidates = [
        base,
        base + '.jsx', base + '.js', base + '.tsx', base + '.ts', base + '.mjs', base + '.json', base + '.css',
        base + '/index.jsx', base + '/index.js', base + '/index.tsx', base + '/index.ts',
    ];
    for (const c of candidates) {
        if (Object.prototype.hasOwnProperty.call(files, c)) return c;
    }
    return null;
}

function cssInjectModule(css) {
    return `const __c=${JSON.stringify(css)};const __s=document.createElement('style');__s.setAttribute('data-beeflow','imported-css');__s.textContent=__c;document.head.appendChild(__s);`;
}

/**
 * esbuild plugin backing the in-browser bundle with the project's file map.
 * files: { [path]: { isText, content?, dataUrl? } }
 */
function virtualFsPlugin(files) {
    return {
        name: 'beeflow-virtual-fs',
        setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
                if (args.kind === 'entry-point') {
                    const resolved = resolveImport('', args.path, files);
                    if (!resolved) return { errors: [{ text: `Entry point not found: ${args.path}` }] };
                    return { path: resolved, namespace: 'vfs' };
                }
                // Bare specifier (npm package) → external. Singletons stay bare
                // (resolved by the import map); everything else is rewritten to a
                // pinned esm.sh URL so its transitive deps resolve via esm.sh.
                if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
                    if (isSharedSingleton(args.path)) return { path: args.path, external: true };
                    return { path: esmExternalUrl(args.path), external: true };
                }
                const resolved = resolveImport(args.importer, args.path, files);
                if (!resolved) {
                    return { errors: [{ text: `Cannot resolve "${args.path}" from "${args.importer || 'entry'}". Create that file (imports must include the extension, e.g. './App.jsx').` }] };
                }
                return { path: resolved, namespace: 'vfs' };
            });

            build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
                const entry = files[args.path];
                if (!entry) return { errors: [{ text: `File not found: ${args.path}` }] };
                if (/\.css$/i.test(args.path)) {
                    return { contents: cssInjectModule(entry.content || ''), loader: 'js' };
                }
                if (entry.isText) {
                    return { contents: entry.content || '', loader: loaderForPath(args.path) };
                }
                // Binary asset imported as a module → resolve to its data: URL so
                // `import logoUrl from './assets/logo.png'` yields a usable string.
                return { contents: `export default ${JSON.stringify(entry.dataUrl || '')};`, loader: 'js' };
            });
        },
    };
}

/**
 * Bundle the react-mui project into a single ESM string. Throws an Error whose
 * `.formatted` carries readable esbuild diagnostics on failure.
 */
export async function buildReactBundle({ entry = REACT_ENTRY, files }) {
    const esbuild = await getEsbuild();
    let result;
    try {
        result = await esbuild.build({
            entryPoints: [entry],
            bundle: true,
            format: 'esm',
            jsx: 'automatic',
            write: false,
            logLevel: 'silent',
            target: 'es2020',
            plugins: [virtualFsPlugin(files)],
        });
    } catch (e) {
        const msgs = Array.isArray(e?.errors) && e.errors.length
            ? e.errors.map((x) => x.text).join('\n')
            : (e?.message || String(e));
        const err = new Error('esbuild bundle failed');
        err.formatted = msgs;
        throw err;
    }
    const out = result.outputFiles && result.outputFiles[0];
    return { code: out ? out.text : '', warnings: result.warnings || [] };
}

// ── Document assembly ──────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Classic inline script injected BEFORE the module so a failed esm.sh import /
 * React runtime throw / app exception becomes a readable panel in #root instead
 * of a silent blank page. Registers global error + unhandledrejection handlers
 * (so it catches module-eval failures), and a fallback that fires if nothing
 * rendered and no error surfaced. Only overrides #root when it's still empty —
 * a successful render is never clobbered.
 */
function runtimeGuardScript() {
    return `<script>(function(){
  var shown = false;
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function rootEmpty(){ var r=document.getElementById('root'); return r && (!r.children || r.children.length===0); }
  function show(title, detail){
    if (shown || !rootEmpty()) return; shown = true;
    var r = document.getElementById('root');
    r.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:#fef2f2;color:#b91c1c;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto">'
      + '<div style="max-width:680px;width:100%"><div style="font-weight:600;margin-bottom:8px">'+esc(title)+'</div>'
      + (detail ? '<pre style="white-space:pre-wrap;word-break:break-word;margin:0">'+esc(detail)+'</pre>' : '')
      + '</div></div>';
  }
  window.addEventListener('error', function(e){
    var where = e && e.filename ? ' ('+e.filename+(e.lineno?':'+e.lineno:'')+')' : '';
    show('The app crashed while loading', ((e && e.message) || 'Script error') + where);
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    var reason = e && e.reason; show('Unhandled error', (reason && (reason.stack || reason.message)) || String(reason));
  });
  setTimeout(function(){
    show('The app loaded but rendered nothing',
      'No React output appeared in #root. This usually means a failed import (React/MUI from the CDN) or a component returned nothing. Open the browser console for the exact error.');
  }, 4000);
})();<\/script>`;
}

/**
 * Classic inline script that resolves RUNTIME string asset references — e.g.
 * `<img src="assets/logo.jpg">` written directly in JSX — to the project's
 * binary data: URLs. The esbuild bundler only rewrites assets imported as ES
 * modules (`import logo from './assets/logo.png'`); a plain string `src` is
 * invisible to it and would 404 in the sandboxed (no-origin) iframe. This
 * patches existing nodes, watches React's renders via MutationObserver, and
 * catches a failed <img> load in the capture phase (before the app's own
 * onError can hide it). Mirrors the vanilla preview's compose-time
 * inlineDataUrl(), but at runtime because React builds the DOM itself.
 */
function assetResolverScript(assetMap) {
    if (!assetMap || Object.keys(assetMap).length === 0) return '';
    return `<script>(function(){
  var M = ${JSON.stringify(assetMap)};
  function lookup(u){
    if(!u) return null;
    u = String(u);
    var low = u.toLowerCase();
    if(low.indexOf('data:')===0 || low.indexOf('blob:')===0 || low.indexOf('http')===0 || low.indexOf('//')===0) return null;
    var key = u.split('?')[0].split('#')[0];
    if(key.indexOf('./')===0) key = key.slice(2);
    while(key.indexOf('/')===0) key = key.slice(1);
    if(M[key]) return M[key];
    if(M['assets/'+key]) return M['assets/'+key];
    var seg = key.split('/').pop();
    if(seg && M['assets/'+seg]) return M['assets/'+seg];
    return null;
  }
  function fixEl(el){
    if(!el || el.nodeType!==1 || !el.getAttribute) return;
    var s = el.getAttribute('src');
    if(s){ var d=lookup(s); if(d && d!==s) el.setAttribute('src', d); }
    if(el.tagName==='LINK'){ var h=el.getAttribute('href'); if(h){ var dh=lookup(h); if(dh) el.setAttribute('href', dh); } }
    var st = el.getAttribute('style');
    if(st && st.indexOf('url(')>-1){
      var ns = st.replace(/url\\(([^)]*)\\)/g, function(m,p){ var c=p.replace(/['"]/g,'').trim(); var du=lookup(c); return du?('url('+du+')'):m; });
      if(ns!==st) el.setAttribute('style', ns);
    }
  }
  function scan(root){ try{ fixEl(root); if(root.querySelectorAll){ var all=root.querySelectorAll('[src],link[href],[style]'); for(var i=0;i<all.length;i++) fixEl(all[i]); } }catch(e){} }
  try{
    var mo = new MutationObserver(function(muts){ for(var i=0;i<muts.length;i++){ var m=muts[i]; if(m.type==='attributes') fixEl(m.target); var an=m.addedNodes; if(an) for(var j=0;j<an.length;j++) scan(an[j]); } });
    function start(){ scan(document); try{ mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href','style']}); }catch(e){} }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  }catch(e){}
  // Backup: rewrite a failed <img> in the capture phase, before the app's onError.
  document.addEventListener('error', function(e){
    var t = e.target;
    if(t && t.tagName==='IMG'){ var d=lookup(t.getAttribute('src')); if(d && t.getAttribute('src')!==d){ t.setAttribute('src', d); } }
  }, true);
})();<\/script>`;
}

function shellDoc({ headBridges, importMap, bodyHtml }) {
    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headBridges}
<script type="importmap">${JSON.stringify(importMap)}<\/script>
<style>html,body{height:100%;margin:0}#root{min-height:100%}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}</style>
</head><body>
${bodyHtml}
</body></html>`;
}

function overlayDoc({ headBridges, importMap, message, isInfo }) {
    const bg = isInfo ? '#f8fafc' : '#fef2f2';
    const fg = isInfo ? '#334155' : '#b91c1c';
    const title = isInfo ? 'React preview' : 'Build error';
    const bodyHtml = `<div id="root"></div>
<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:${bg};color:${fg};font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace">
  <div style="max-width:680px;width:100%">
    <div style="font-weight:600;margin-bottom:8px">${title}</div>
    <pre style="white-space:pre-wrap;word-break:break-word;margin:0">${escapeHtml(message)}</pre>
  </div>
</div>`;
    return shellDoc({ headBridges, importMap, bodyHtml });
}

/**
 * Friendly, non-technical placeholder shown when a react-mui project has no
 * entry yet (e.g. a brand-new project). NOT the developer code snippet — this
 * is the first thing a non-technical user sees, so it just points them at the
 * chat. (Build errors still get the developer overlay above.)
 */
function emptyStateDoc({ hasSource }) {
    const heading = hasSource ? 'Almost there…' : 'Your webpage will appear here';
    const sub = hasSource
        ? 'Ask the assistant in the chat to finish setting up your page.'
        : "Describe what you'd like to build in the chat on the right, and I'll create it for you.";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:#fff;color:#475569;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="width:52px;height:52px;border-radius:14px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:18px">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
  </div>
  <div style="font-size:16px;font-weight:600;color:#334155">${heading}</div>
  <div style="font-size:13.5px;margin-top:8px;max-width:380px;line-height:1.55">${sub}</div>
</body></html>`;
}

/** "Building…" placeholder shown while the AI is still streaming files in. */
function buildingDoc() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;color:#64748b;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="width:34px;height:34px;border:3px solid #e2e8f0;border-top-color:#94a3b8;border-radius:50%;animation:spin 0.8s linear infinite"></div>
  <div style="font-size:13.5px;margin-top:14px">Building your app…</div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</body></html>`;
}

/**
 * Compose the full sandboxed preview document for a react-mui project.
 * Returns an HTML string suitable for the iframe srcDoc / a blob: open-in-tab.
 *
 * options mirrors composeWebpageDocument's: { extraFiles, dbToken, dbApiBase,
 * dbWebpageId, selectionBridge, runtime }.
 */
export async function composeReactPreview(_slots, options = {}) {
    const {
        extraFiles = [],
        dbToken = null,
        dbApiBase = null,
        dbWebpageId = null,
        selectionBridge = false,
        isStreaming = false,
    } = options;

    const files = {};
    const assetMap = {};
    for (const f of extraFiles) {
        if (!f || !f.path) continue;
        if (f.isText && typeof f.content === 'string') files[f.path] = { isText: true, content: f.content };
        else if (f.dataUrl) {
            files[f.path] = { isText: false, dataUrl: f.dataUrl };
            // Runtime-resolvable map for string `src`/`url()` references the
            // bundler can't see (e.g. <img src="assets/logo.jpg">).
            assetMap[f.path] = f.dataUrl;
        }
    }

    const headBridges = buildBridgeHeadScripts({ dbToken, dbApiBase, dbWebpageId });
    const importMap = buildImportMap();

    if (!files[REACT_ENTRY]) {
        // No entry yet. While streaming, the entry may still be on its way →
        // show "Building…" rather than the empty/come-back-later placeholder.
        if (isStreaming) return buildingDoc();
        const hasSource = extraFiles.some(f =>
            f && f.isText && /\.(jsx?|tsx?|css)$/i.test(f.path || '') && !/^assets\//i.test(f.path || ''));
        return emptyStateDoc({ hasSource });
    }

    let bundle;
    try {
        const r = await buildReactBundle({ entry: REACT_ENTRY, files });
        bundle = r.code;
    } catch (e) {
        // Mid-stream a missing import is expected (files arrive incrementally) —
        // keep "Building…" instead of flashing a red error. Show the real error
        // only once the AI has finished.
        if (isStreaming) return buildingDoc();
        return overlayDoc({ headBridges, importMap, isInfo: false, message: e.formatted || e.message || String(e) });
    }

    const selBridge = selectionBridge ? buildSelectionBridgeScript() : '';
    const bodyHtml = `<div id="root"></div>
${runtimeGuardScript()}
${assetResolverScript(assetMap)}
${selBridge}
<script type="module">
${defangScriptClose(bundle)}
<\/script>`;
    return shellDoc({ headBridges, importMap, bodyHtml });
}

export default composeReactPreview;
