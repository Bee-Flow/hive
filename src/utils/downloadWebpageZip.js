import JSZip from 'jszip';

/**
 * Build a zip with `index.html`, `style.css`, `script.js`, and any extra
 * files in the project (preserving their relative paths and folders), then
 * trigger a browser download. The HTML is rewritten to reference the
 * sibling CSS/JS files via <link> and <script> tags (idempotent — already-
 * present references aren't double-added) so the extracted folder Just Works
 * when the user opens index.html directly from disk.
 *
 * extraFiles: array of metadata { path, isText, mimeType, ... }
 * extraContents: map of path → { content?, dataUrl?, isText, mimeType }
 *   Text files come as a string; binary files come as a base64 data URL we
 *   decode back to bytes for the zip.
 */
/** Add every extra file to the zip at its declared path (text or decoded binary). */
function addExtras(zip, extraFiles, extraContents) {
    for (const meta of extraFiles) {
        const c = extraContents[meta.path];
        if (!c) continue;
        if (c.isText && typeof c.content === 'string') {
            zip.file(meta.path, c.content);
        } else if (c.dataUrl && typeof c.dataUrl === 'string') {
            const commaIdx = c.dataUrl.indexOf(',');
            if (commaIdx > 0) zip.file(meta.path, c.dataUrl.slice(commaIdx + 1), { base64: true });
        }
    }
}

function triggerDownload(blob, name) {
    const safeName = (name || 'webpage').replace(/[^a-zA-Z0-9.\-_ ]/g, '_').trim() || 'webpage';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function downloadWebpageZip({ name, html, css, js, extraFiles = [], extraContents = {}, framework = 'vanilla' }) {
    // React + Material UI: ship a self-contained built index.html (the same
    // esbuild-bundled module + esm.sh import map the preview uses) plus the
    // original src/ files. The build needs no local toolchain; the index.html
    // loads React/MUI from esm.sh, so serve it over http(s) with a connection.
    if (framework === 'react-mui') {
        const zip = new JSZip();
        const { composeReactPreview } = await import('./buildWebpagePreview');
        const extras = extraFiles.map(meta => {
            const c = extraContents[meta.path];
            return c
                ? { path: meta.path, isText: c.isText, mimeType: c.mimeType, content: c.content, dataUrl: c.dataUrl }
                : { path: meta.path };
        });
        let indexHtml;
        try {
            indexHtml = await composeReactPreview({}, { extraFiles: extras });
        } catch (err) {
            indexHtml = `<!DOCTYPE html><html><body><pre>Build failed: ${String(err?.message || err)}</pre></body></html>`;
        }
        zip.file('index.html', indexHtml);
        addExtras(zip, extraFiles, extraContents);
        zip.file('README.txt',
            'React + Material UI app exported from Bee Flow.\n\n' +
            'index.html is a self-contained build that loads React and Material UI from the\n' +
            'esm.sh CDN — open it via a static server with internet access (e.g. `npx serve`),\n' +
            'not directly from file://. The src/ folder holds the original source files.\n');
        const blob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(blob, name);
        return;
    }

    const zip = new JSZip();

    let outHtml = html && html.trim()
        ? html
        : '<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="utf-8">\n    <title>Webpage</title>\n</head>\n<body>\n</body>\n</html>';

    // Make sure the HTML can find style.css and script.js when extracted.
    if (css && !/href=["']style\.css["']/i.test(outHtml)) {
        if (/<\/head>/i.test(outHtml)) {
            outHtml = outHtml.replace(/<\/head>/i, '    <link rel="stylesheet" href="style.css">\n</head>');
        } else if (/<head[^>]*>/i.test(outHtml)) {
            outHtml = outHtml.replace(/(<head[^>]*>)/i, '$1\n    <link rel="stylesheet" href="style.css">');
        } else {
            outHtml = `<!DOCTYPE html>\n<html>\n<head>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n${outHtml}\n</body>\n</html>`;
        }
    }
    if (js && !/src=["']script\.js["']/i.test(outHtml)) {
        if (/<\/body>/i.test(outHtml)) {
            outHtml = outHtml.replace(/<\/body>/i, '    <script src="script.js"></script>\n</body>');
        } else {
            outHtml += '\n<script src="script.js"></script>';
        }
    }

    zip.file('index.html', outHtml);
    if (css) zip.file('style.css', css);
    if (js) zip.file('script.js', js);

    // Add every extra file at its declared path. JSZip auto-creates folders.
    addExtras(zip, extraFiles, extraContents);

    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, name);
}

export default downloadWebpageZip;
