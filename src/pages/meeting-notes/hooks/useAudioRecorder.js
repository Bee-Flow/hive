import { useCallback, useEffect, useRef, useState } from 'react';

function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    return 'audio/mp4';
}

/**
 * MediaRecorder wrapper. Exposes state, elapsed time, mic level (0..1) and
 * resolves to a File when stopped. Safe to use in a component that may unmount
 * mid-recording — pass `onStopped` if you want the file regardless of unmount.
 */
export default function useAudioRecorder({ onStopped } = {}) {
    const [state, setState] = useState('idle'); // idle | recording | paused | stopping
    const [elapsed, setElapsed] = useState(0);
    const [level, setLevel] = useState(0);
    const [error, setError] = useState(null);

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    // Synchronous re-entrancy guard for start(); see the note there.
    const startingRef = useRef(false);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const mimeRef = useRef('');
    const audioCtxRef = useRef(null);
    const rafRef = useRef(0);
    const onStoppedRef = useRef(onStopped);

    useEffect(() => { onStoppedRef.current = onStopped; }, [onStopped]);

    const cleanupAudio = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close(); } catch (_) { /* ignore */ }
            audioCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    useEffect(() => () => cleanupAudio(), [cleanupAudio]);

    const start = useCallback(async () => {
        // `state` is React state and is not set to 'recording' until AFTER the
        // getUserMedia await below, so on a double-click both calls passed this
        // check. The second overwrote streamRef, leaving the first stream's
        // tracks running — the microphone and its browser indicator stayed on
        // for the rest of the session — and both recorders pushed into the same
        // chunk array, producing an unplayable interleaved file. A ref flips
        // synchronously, so it actually blocks the second click.
        if (state === 'recording' || state === 'paused' || startingRef.current) return;
        startingRef.current = true;
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Belt and braces: never abandon a live stream.
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = stream;
            chunksRef.current = [];
            const mimeType = pickMimeType();
            mimeRef.current = mimeType;
            const recorder = new MediaRecorder(stream, { mimeType });
            recorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const ext = mimeRef.current.includes('webm') ? 'webm' : 'mp4';
                const blob = new Blob(chunksRef.current, { type: mimeRef.current });
                const file = new File([blob], `recording.${ext}`, { type: mimeRef.current });
                cleanupAudio();
                setState('idle');
                setElapsed(0);
                setLevel(0);
                if (onStoppedRef.current) onStoppedRef.current(file);
            };

            recorder.start(1000);

            // Live level meter via Web Audio
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioCtx();
                audioCtxRef.current = ctx;
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                src.connect(analyser);
                const buf = new Uint8Array(analyser.fftSize);
                const tick = () => {
                    analyser.getByteTimeDomainData(buf);
                    let peak = 0;
                    for (let i = 0; i < buf.length; i++) {
                        const v = Math.abs(buf[i] - 128) / 128;
                        if (v > peak) peak = v;
                    }
                    setLevel(peak);
                    rafRef.current = requestAnimationFrame(tick);
                };
                rafRef.current = requestAnimationFrame(tick);
            } catch (_) { /* level meter optional */ }

            setState('recording');
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
        } catch (err) {
            setError(err);
            cleanupAudio();
            setState('idle');
        } finally {
            // Cleared on BOTH paths: a denied permission prompt must not leave
            // the recorder permanently unable to start.
            startingRef.current = false;
        }
    }, [state, cleanupAudio]);

    const stop = useCallback(() => {
        const recorder = recorderRef.current;
        if (!recorder) return;
        setState('stopping');
        if (recorder.state !== 'inactive') {
            try { recorder.stop(); } catch (_) { /* ignore */ }
        }
    }, []);

    const pause = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state === 'recording') {
            try { recorder.pause(); setState('paused'); } catch (_) { /* ignore */ }
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const resume = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state === 'paused') {
            try { recorder.resume(); setState('recording'); } catch (_) { /* ignore */ }
            timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
        }
    }, []);

    const cancel = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null;
            try { recorder.stop(); } catch (_) { /* ignore */ }
        }
        cleanupAudio();
        setState('idle');
        setElapsed(0);
        setLevel(0);
        chunksRef.current = [];
    }, [cleanupAudio]);

    return { state, elapsed, level, error, start, stop, pause, resume, cancel };
}
