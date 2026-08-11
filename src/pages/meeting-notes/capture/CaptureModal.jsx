import React from 'react';
import { Mic, Upload, MessageSquare, Video, ArrowLeft, X } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import IconButton from '../../../components/shared/IconButton';
import CaptureTile from './CaptureTile';
import RecordPanel from './RecordPanel';
import UploadPanel from './UploadPanel';
import TalkImportPanel from './TalkImportPanel';
import GoogleMeetImportPanel from './GoogleMeetImportPanel';
import { useCapture } from './CaptureContext';
import { useRecorder } from '../hooks/RecorderContext';
import useMediaQuery from '../hooks/useMediaQuery';
import useNextcloudConnected from '../hooks/useNextcloudConnected';
import useGoogleMeetConnected from '../hooks/useGoogleMeetConnected';

const MODES = {
    record: { title: 'Record audio', description: 'Capture from your microphone.', Panel: RecordPanel },
    upload: { title: 'Upload a recording', description: 'Drop a file from your computer.', Panel: UploadPanel },
    talk: { title: 'Import from Nextcloud Talk', description: 'Transcribe a Talk call recording.', Panel: TalkImportPanel },
    gmeet: { title: 'Import from Google Meet', description: 'Import a recorded Meet call.', Panel: GoogleMeetImportPanel },
};

// Source-picker tiles. `talk` only appears when the user has Nextcloud
// connected; `gmeet` when Google is connected (also when it still misses the
// Meet scopes — the panel then offers re-consent).
const SOURCE_TILES = [
    { key: 'record', icon: Mic, title: 'Record audio', description: 'Capture live from your microphone.', accent: '#ffd400' },
    { key: 'upload', icon: Upload, title: 'Upload a file', description: 'Drop a .mp3, .wav, .m4a or .mp4.', accent: 'var(--accent-primary)' },
    { key: 'talk', icon: MessageSquare, title: 'Nextcloud Talk', description: 'Transcribe a Talk call recording.', accent: '#0082C9', requiresNextcloud: true },
    { key: 'gmeet', icon: Video, title: 'Google Meet', description: 'Import a recorded Meet call.', accent: '#00832D', requiresGoogleMeet: true },
];

export default function CaptureModal() {
    const { open, mode, setMode, closeCapture } = useCapture();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const { recorder } = useRecorder();
    // Only offer the Nextcloud Talk source when the user actually has Nextcloud
    // connected. Probed lazily once the modal opens.
    const { connected: nextcloudConnected } = useNextcloudConnected(open);
    // Same lazy probe for Google Meet. The tile also shows for connections
    // missing the Meet scopes — the panel then renders the re-consent CTA.
    const { connected: gmeetConnected, needsReconsent: gmeetNeedsReconsent } = useGoogleMeetConnected(open);
    const gmeetAvailable = gmeetConnected || gmeetNeedsReconsent;

    const recording = recorder.state === 'recording' || recorder.state === 'paused';
    const close = () => {
        // Don't tear down the modal mid-recording without warning.
        if (recording) {
            const ok = window.confirm('A recording is in progress. Close this panel and keep recording in the background?');
            if (!ok) return;
        }
        closeCapture();
    };

    const onComplete = () => closeCapture();
    // 'talk'/'gmeet' are only reachable when the matching integration is
    // connected (the tile is hidden otherwise) — guard the panel too so a
    // stale mode can't render it.
    const ModePanel = mode
        && (mode !== 'talk' || nextcloudConnected)
        && (mode !== 'gmeet' || gmeetAvailable)
        && MODES[mode]?.Panel;

    const tiles = SOURCE_TILES.filter((t) => (!t.requiresNextcloud || nextcloudConnected) && (!t.requiresGoogleMeet || gmeetAvailable));
    const tileGridClass = tiles.length >= 3
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
        : 'grid grid-cols-1 sm:grid-cols-2 gap-3';

    const body = (
        <div className="flex flex-col gap-5">
            {!mode && (
                <div className={tileGridClass}>
                    {tiles.map((t) => (
                        <CaptureTile key={t.key} icon={t.icon} title={t.title} description={t.description} onClick={() => setMode(t.key)} accent={t.accent} />
                    ))}
                </div>
            )}
            {mode && ModePanel && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <IconButton ariaLabel="Back" onClick={() => setMode(null)} size="md">
                            <ArrowLeft />
                        </IconButton>
                        <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{MODES[mode].title}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{MODES[mode].description}</div>
                        </div>
                    </div>
                    <ModePanel onComplete={onComplete} />
                </div>
            )}
        </div>
    );

    // Mobile: bottom sheet
    if (isMobile) {
        if (!open) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-end" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative w-full rounded-t-2xl shadow-2xl border-t flex flex-col max-h-[92vh]"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-default)' }} />
                        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="px-4 pb-5 pt-2 overflow-y-auto">{body}</div>
                </div>
            </div>
        );
    }

    return (
        <Modal
            open={open}
            onClose={close}
            title="New transcription"
            description="Record or upload audio to a meeting."
            size="lg"
        >
            {body}
        </Modal>
    );
}
