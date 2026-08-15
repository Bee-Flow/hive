/**
 * A long meeting has to stay inside the reverse proxy's body limit.
 *
 * MediaRecorder's default audio bitrate (~128 kbps) put a 1.5-hour recording
 * at ~86 MB — over the 100 MB the proxy in front of the API allowed — so the
 * upload came back as a bare "HTTP 413" with the whole meeting already
 * recorded and nothing salvageable. These lock the explicit speech-grade
 * bitrate in place: it is the difference between the recording arriving and
 * being thrown away.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pickRecorderOptions, OPUS_BITS_PER_SECOND, AAC_BITS_PER_SECOND } from './useAudioRecorder';

const HOUR_AND_A_HALF_SECONDS = 90 * 60;
const PROXY_LIMIT_BYTES = 100 * 1024 * 1024;

/** Roughly what a recording of `seconds` weighs at `bitsPerSecond`. */
const encodedBytes = (bitsPerSecond, seconds) => (bitsPerSecond / 8) * seconds;

function stubMediaRecorder(supported) {
    globalThis.MediaRecorder = { isTypeSupported: (t) => supported.includes(t) };
}

afterEach(() => { delete globalThis.MediaRecorder; });

describe('pickRecorderOptions', () => {
    it('records Opus at a speech-grade bitrate, not the browser default', () => {
        stubMediaRecorder(['audio/webm;codecs=opus', 'audio/webm']);
        expect(pickRecorderOptions()).toEqual({
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: OPUS_BITS_PER_SECOND,
        });
    });

    it('gives the AAC fallback (Safari) more headroom — it is less efficient down there', () => {
        stubMediaRecorder([]);
        expect(pickRecorderOptions()).toEqual({
            mimeType: 'audio/mp4',
            audioBitsPerSecond: AAC_BITS_PER_SECOND,
        });
    });

    it('always names a bitrate, whichever container the browser supports', () => {
        for (const supported of [['audio/webm;codecs=opus', 'audio/webm'], ['audio/webm'], []]) {
            stubMediaRecorder(supported);
            expect(pickRecorderOptions().audioBitsPerSecond).toBeGreaterThan(0);
        }
    });

    it('keeps a 1.5-hour meeting inside the proxy body limit on every path', () => {
        for (const supported of [['audio/webm;codecs=opus', 'audio/webm'], ['audio/webm'], []]) {
            stubMediaRecorder(supported);
            const { audioBitsPerSecond } = pickRecorderOptions();
            expect(encodedBytes(audioBitsPerSecond, HOUR_AND_A_HALF_SECONDS)).toBeLessThan(PROXY_LIMIT_BYTES);
        }
    });
});
