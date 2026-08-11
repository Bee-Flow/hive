import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// The waveform hook does an authenticated fetch + Web Audio decode; neither
// exists in jsdom, and neither is what this test is about.
vi.mock('../hooks/useWaveform', () => ({
    default: () => ({ peaks: null, duration: 0, loading: false, objectUrl: null, error: null }),
}));

import WaveformPlayer from './WaveformPlayer';

/**
 * MediaRecorder writes no duration into the WebM container, so `<audio>.duration`
 * is `Infinity` for every in-browser recording until the element has scanned to
 * the last cluster.
 *
 * `audio.duration || peakDuration || durationSeconds` accepted that — Infinity
 * is truthy — so the player's time row rendered the literal string
 * "Infinity:NaN:NaN" and every timeline offset became `x / Infinity === 0`.
 */
describe('WaveformPlayer with an Infinity-duration recording', () => {
    let originalDuration;

    beforeAll(() => {
        // jsdom has no layout engine, so no ResizeObserver; the canvas redraw
        // it drives is irrelevant here.
        if (!window.ResizeObserver) {
            window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
            globalThis.ResizeObserver = window.ResizeObserver;
        }
        originalDuration = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'duration');
        Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
            configurable: true,
            get() { return Infinity; },
        });
    });

    afterAll(() => {
        if (originalDuration) Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', originalDuration);
        else delete window.HTMLMediaElement.prototype.duration;
    });

    it('falls back to the stored duration instead of rendering Infinity', () => {
        const { container } = render(
            <WaveformPlayer audioSrc="/api/transcriptions/abc/audio" durationSeconds={2397} />
        );

        const audio = container.querySelector('audio');
        act(() => { audio.dispatchEvent(new Event('loadedmetadata')); });

        expect(screen.queryByText(/Infinity/)).toBeNull();
        expect(screen.queryByText(/NaN/)).toBeNull();
        // 2397s = 39:57 — the duration the backend computed, shown in the header.
        expect(screen.getByText('39:57')).toBeTruthy();
    });
});
