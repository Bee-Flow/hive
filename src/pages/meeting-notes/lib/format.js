export function formatDuration(seconds) {
    // `Infinity` reaches here from `<audio>.duration` on containers with no
    // duration in the header (MediaRecorder WebM), and rendered literally as
    // "Infinity:NaN:NaN" in the player's time row.
    if (!Number.isFinite(seconds) || !seconds || seconds < 1) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatRelativeDate(input) {
    if (!input) return '';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 45) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

export function parseTimestampToSeconds(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const parts = String(str).split(':').map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

export function formatSpeakerLabel(id) {
    if (!id) return 'Speaker';
    const cleaned = String(id).replace(/^speaker[_\s-]?/i, '');
    if (/^\d+$/.test(cleaned)) return `Speaker ${cleaned}`;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function generateAutoTitle() {
    const now = new Date();
    const date = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `Meeting ${date} ${time}`;
}

// Speaker colors moved to buildSpeakerColorMap in lib/playerData.js: the old
// string-hash assignment here collided from 11 speakers on and repainted a
// speaker on rename.
