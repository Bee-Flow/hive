import { MessageSquare, Video, Cloud } from 'lucide-react';

const SOURCE_META = {
    talk: { label: 'Talk', color: '#0082C9', Icon: MessageSquare },
    'talk-auto': { label: 'Talk', color: '#0082C9', Icon: MessageSquare, title: 'Imported automatically' },
    gmeet: { label: 'Meet', color: '#00832D', Icon: Video },
    nextcloud: { label: 'Nextcloud', color: '#0082C9', Icon: Cloud },
};

/**
 * Badge metadata for a transcription's `source`. Returns null for plain
 * uploads / live recordings (and unknown values) — those get no chip.
 */
export function getSourceMeta(source) {
    return SOURCE_META[source] || null;
}
