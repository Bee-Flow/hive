import React from 'react';
import { SPEAKER_COLORS } from '../../../config/meetingNotesConfig';
import { formatSpeakerLabel, getSpeakerColor } from '../lib/format';

export default function SpeakerLegend({ speakers = [], activeId, onSelect }) {
    if (!speakers.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {speakers.map((s) => {
                const color = getSpeakerColor(s.id, SPEAKER_COLORS);
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
        </div>
    );
}
