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
export async function downloadWebpageZip({ name, html, css, js, extraFiles = [], extraContents = {} }) {
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
    for (const meta of extraFiles) {
        const c = extraContents[meta.path];
        if (!c) continue;
        if (c.isText && typeof c.content === 'string') {
            zip.file(meta.path, c.content);
        } else if (c.dataUrl && typeof c.dataUrl === 'string') {
            // Strip the "data:<mime>;base64," prefix and decode.
            const commaIdx = c.dataUrl.indexOf(',');
            if (commaIdx > 0) {
                const base64 = c.dataUrl.slice(commaIdx + 1);
                zip.file(meta.path, base64, { base64: true });
            }
        }
    }

    const blob = await zip.generateAsync({ type: 'blob' });

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

export default downloadWebpageZip;
