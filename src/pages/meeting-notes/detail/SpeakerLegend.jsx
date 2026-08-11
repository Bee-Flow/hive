import React from 'react';
import { Pencil } from 'lucide-react';
import { formatSpeakerLabel } from '../lib/format';
import { speakerColor } from '../lib/playerData';

export default function SpeakerLegend({ speakers = [], colorMap = {}, activeId, onSelect, onEdit }) {
    if (!speakers.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {speakers.map((s) => {
                const color = speakerColor(colorMap, s.id);
                const active = activeId === s.id;
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelect?.(active ? null : s.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors"
                        style={{
                            background: active ? `color-mix(in srgb, ${color} 18%, transparent)` : 'transparent',
                            borderColor: active ? color : 'var(--border-default)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        {formatSpeakerLabel(s.id)}
                        {s.speakingTime && (
                            <span className="opacity-60">· {s.speakingTime}</span>
                        )}
                    </button>
                );
            })}
            {/* Diarization guesses who is who and gets it wrong often enough that
                correcting it has to be one click from the names themselves. The
                rename/merge editor already existed, buried in an overflow menu —
                nobody found it. */}
            {onEdit && (
                <button
                    type="button"
                    onClick={() => onEdit()}
                    title="Rename or merge speakers"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-dashed transition-colors"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                >
                    <Pencil className="w-3 h-3" />
                    Fix names
                </button>
            )}
        </div>
    );
}
