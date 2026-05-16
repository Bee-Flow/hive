import React from 'react';
import { Mic, Upload, Video, FileAudio } from 'lucide-react';
import { useCapture } from '../capture/CaptureContext';

export default function DetailEmptyState() {
    const { openCapture } = useCapture();
    return (
        <div className="h-full flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)' }}>
                <FileAudio className="w-8 h-8" />
            </div>
            <div className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Select a meeting
            </div>
            <div className="text-sm max-w-md mb-6" style={{ color: 'var(--text-muted)' }}>
                Pick a meeting from the library to see its summary, action items and full transcript — or start a new one below.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                    [Mic, 'Record', 'record', '#ffd400'],
                    [Upload, 'Upload', 'upload', 'var(--accent-primary)'],
                    [Video, 'Send bot', 'bot', '#10b981'],
                ].map(([Icon, label, mode, accent]) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => openCapture(mode)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                        style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <Icon className="w-4 h-4" style={{ color: accent }} />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}
