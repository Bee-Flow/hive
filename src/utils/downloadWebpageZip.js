import JSZip from 'jszip';

/**
 * Build a zip with `index.html`, `style.css`, and (optionally) `script.js`,
 * then trigger a browser download. The HTML is rewritten to reference the
 * sibling CSS/JS files via <link> and <script> tags (idempotent — already-
 * present references aren't double-added) so the extracted folder Just Works
 * when the user opens index.html directly from disk.
 */
export async function downloadWebpageZip({ name, html, css, js }) {
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
