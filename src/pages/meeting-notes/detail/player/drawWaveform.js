/**
 * Canvas paint for the waveform scrubber. Split out of the component so the
 * player stays within the function-size lint budget and the drawing can evolve
 * without touching playback logic.
 *
 * Bars only: the playhead and hover ghost are DOM overlays in TimelineStack
 * (they span the speaker rows too, and a mousemove shouldn't repaint 600 bars).
 */

export function drawWaveform(canvas, { peaks, progress }) {
    if (!canvas || !peaks) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const accent = getCssVar('--accent-primary') || '#3b82f6';
    drawBars(ctx, { peaks, progress, accent, w, h, dpr });
}

function drawBars(ctx, { peaks, progress, accent, w, h, dpr }) {
    const barCount = peaks.length;
    const barWidth = w / barCount;
    const gap = Math.max(1, Math.floor(barWidth * 0.35));
    const drawnBar = Math.max(1, Math.floor(barWidth - gap));
    const radius = Math.min(drawnBar / 2, 2 * dpr);
    const mid = h / 2;

    for (let i = 0; i < barCount; i++) {
        const peak = peaks[i] ?? 0;
        const barH = Math.max(2 * dpr, peak * (h - 8 * dpr));
        const played = (i / barCount) < progress;
        // Unplayed bars stay soft so the played portion + colored layers carry
        // the eye; the old flat grey slabs made everything equally loud.
        ctx.fillStyle = played ? accent : 'rgba(148, 163, 184, 0.35)';
        ctx.globalAlpha = played ? 0.95 : 1;
        roundedBar(ctx, { x: i * barWidth, y: mid - barH / 2, w: drawnBar, h: barH, r: radius });
    }
    ctx.globalAlpha = 1;
}

function roundedBar(ctx, { x, y, w, h, r }) {
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
    } else {
        // Ancient canvas without roundRect — square bars beat no bars.
        ctx.fillRect(x, y, w, h);
    }
}

function getCssVar(name) {
    if (typeof window === 'undefined') return null;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
