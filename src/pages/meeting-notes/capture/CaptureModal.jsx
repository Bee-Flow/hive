import React, { useEffect, useState } from 'react';
import { Mic, Upload, Video, ArrowLeft, X } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import IconButton from '../../../components/shared/IconButton';
import CaptureTile from './CaptureTile';
import RecordPanel from './RecordPanel';
import UploadPanel from './UploadPanel';
import BotPanel from './BotPanel';
import { useCapture } from './CaptureContext';
import { useRecorder } from '../hooks/RecorderContext';
import useMediaQuery from '../hooks/useMediaQuery';
import * as api from '../lib/transcriptionsApi';

const MODES = {
    record: { title: 'Record audio', description: 'Capture from your microphone.', Panel: RecordPanel },
    upload: { title: 'Upload a recording', description: 'Drop a file from your computer or Nextcloud.', Panel: UploadPanel },
    bot: { title: 'Send the Meeting Bot', description: 'Paste a meeting link and the bot will join, transcribe and summarize.', Panel: BotPanel },
};

export default function CaptureModal() {
    const { open, mode, setMode, closeCapture } = useCapture();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [serverDefault, setServerDefault] = useState('voxtral');
    const [localEnabled, setLocalEnabled] = useState(true);
    const { recorder } = useRecorder();

    useEffect(() => {
        if (!open) return;
        api.getAiConfig()
            .then((cfg) => {
                if (cfg.transcriptionProvider) setServerDefault(cfg.transcriptionProvider);
                setLocalEnabled(cfg.localWhisperEnabled !== false);
            })
            .catch(() => {});
    }, [open]);

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
    const ModePanel = mode && MODES[mode]?.Panel;

    const body = (
        <div className="flex flex-col gap-5">
            {!mode && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <CaptureTile icon={Mic} title="Record audio" description="Capture live from your microphone." onClick={() => setMode('record')} accent="#ffd400" />
                    <CaptureTile icon={Upload} title="Upload a file" description="Drop a .mp3, .wav, .m4a or .mp4." onClick={() => setMode('upload')} accent="var(--accent-primary)" />
                    <CaptureTile icon={Video} title="Send Meeting Bot" description="Bot joins Meet / Teams / Zoom for you." onClick={() => setMode('bot')} accent="#10b981" />
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
                    <ModePanel serverDefault={serverDefault} localEnabled={localEnabled} onComplete={onComplete} />
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
            description="Record, upload, or send a bot to a meeting."
            size="lg"
        >
            {body}
        </Modal>
    );
}
