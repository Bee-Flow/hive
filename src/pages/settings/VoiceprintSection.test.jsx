import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Voice profile settings + enrollment.
 *
 * Two classes of behaviour are pinned here:
 *   - the section renders NOTHING unless the backend says the feature is
 *     genuinely usable (advertising a biometric feature on a deployment that
 *     cannot use it is worse than not shipping it);
 *   - the recorder cannot be armed without consent, cannot submit a clip too
 *     short to enrol, and stops itself before pyannote's 30-second ceiling.
 */

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
// Mirrors the real t(): key ▸ optional string fallback ▸ optional {var} map.
// The fallback is what renders, so these assertions read as the English UI.
// Requested keys are recorded so a dynamic key (the server's error code) can
// be asserted without depending on dictionary contents.
const tKeys = [];
vi.mock('../../hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key, fallback, vars) => {
            tKeys.push(key);
            const values = typeof fallback === 'object' && fallback !== null ? fallback : vars;
            const text = typeof fallback === 'string' ? fallback : key;
            return values
                ? text.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m))
                : text;
        },
        locale: 'en',
    }),
}));

const recorder = { current: null };
vi.mock('../meeting-notes/hooks/useAudioRecorder', () => ({
    default: (opts) => { recorder.onStopped = opts?.onStopped; return recorder.current; },
}));

import VoiceprintSection from './VoiceprintSection';
import { authFetch } from '../../utils/helpers';

const AVAILABLE = {
    available: true, reason: null, provider: 'pyannote',
    enrolled: false, voiceprint: null,
    coverage: { enrolled: 3, members: 12 },
    limits: { minSeconds: 12, targetSeconds: 25, maxSeconds: 28 },
    consentVersion: 1,
};

const makeRecorder = (over = {}) => ({
    state: 'idle', elapsed: 0, level: 0, error: null,
    start: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
    ...over,
});

function respond(payload, ok = true) {
    authFetch.mockResolvedValue({ ok, json: async () => payload });
}

describe('VoiceprintSection', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        recorder.current = makeRecorder();
    });

    it('renders nothing when the feature is unavailable', async () => {
        respond({ available: false, reason: 'provider_not_pyannote' });
        const { container } = render(<VoiceprintSection />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.textContent).toBe('');
    });

    it('renders nothing when the availability call fails (unlicensed account)', async () => {
        respond({}, false);
        const { container } = render(<VoiceprintSection />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.textContent).toBe('');
    });

    it('offers enrollment and shows org coverage when available', async () => {
        respond(AVAILABLE);
        render(<VoiceprintSection />);
        expect(await screen.findByText('No voice profile yet')).toBeTruthy();
        expect(screen.getByText(/3 of 12 colleagues/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Record voice profile' })).toBeTruthy();
    });

    it('shows the enrolled state with the recording date', async () => {
        respond({ ...AVAILABLE, enrolled: true, voiceprint: { status: 'ready', createdAt: '2026-07-20T10:00:00Z' } });
        render(<VoiceprintSection />);
        expect(await screen.findByText('Your voice profile is active')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Record again' })).toBeTruthy();
    });

    it('requires a confirmation before deleting', async () => {
        respond({ ...AVAILABLE, enrolled: true, voiceprint: { status: 'ready', createdAt: '2026-07-20T10:00:00Z' } });
        render(<VoiceprintSection />);
        fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
        expect(screen.getByText(/Delete your voice profile\?/)).toBeTruthy();
        // Nothing has been sent yet — only the availability probe ran.
        expect(authFetch.mock.calls.filter(c => c[1]?.method === 'DELETE')).toHaveLength(0);
    });
});

describe('VoiceprintEnrollModal timing + consent', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        recorder.current = makeRecorder();
    });

    async function openModal(recorderState = {}) {
        recorder.current = makeRecorder(recorderState);
        respond(AVAILABLE);
        render(<VoiceprintSection />);
        fireEvent.click(await screen.findByRole('button', { name: 'Record voice profile' }));
        return screen.findByText(/Read the text below aloud/);
    }

    it('shows a passage to read and keeps the mic disabled until consent is given', async () => {
        await openModal();
        expect(screen.getByText(/Good morning\./)).toBeTruthy();

        const mic = screen.getByRole('button', { name: 'Start recording' });
        expect(mic.disabled).toBe(true);

        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('button', { name: 'Start recording' }).disabled).toBe(false);
    });

    it('cannot stop before the minimum length — a too-short clip is unsubmittable', async () => {
        await openModal({ state: 'recording', elapsed: 8 });
        expect(screen.getByRole('button', { name: 'Stop recording' }).disabled).toBe(true);
        expect(screen.getByText('Keep reading…')).toBeTruthy();
    });

    it('allows stopping once the minimum is reached', async () => {
        await openModal({ state: 'recording', elapsed: 14 });
        expect(screen.getByRole('button', { name: 'Stop recording' }).disabled).toBe(false);
        expect(screen.getByText('You can stop now')).toBeTruthy();
    });

    it('HARD-STOPS at the ceiling so pyannote never sees more than 30s', async () => {
        const stop = vi.fn();
        await openModal({ state: 'recording', elapsed: 28, stop });
        await waitFor(() => expect(stop).toHaveBeenCalled());
    });

    it('uploads the clip with the consent flag once recording stops', async () => {
        await openModal({ state: 'recording', elapsed: 26 });
        authFetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ready', voiceprint: { status: 'ready' } }) });

        const file = new File(['x'], 'recording.webm', { type: 'audio/webm' });
        await recorder.onStopped(file);

        const post = authFetch.mock.calls.find(c => c[1]?.method === 'POST');
        expect(post).toBeTruthy();
        expect(post[0]).toContain('/api/voiceprints/me');
        expect(post[1].body.get('consent')).toBe('true');
        expect(post[1].body.get('audio')).toBe(file);
    });

    it('does not upload a clip that ended below the minimum', async () => {
        await openModal({ state: 'recording', elapsed: 4 });
        await recorder.onStopped(new File(['x'], 'recording.webm'));
        expect(authFetch.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(0);
    });

    it('turns the server\'s error code into its own localized message', async () => {
        await openModal({ state: 'recording', elapsed: 26 });
        tKeys.length = 0;
        authFetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'multiple_speakers' }) });
        await recorder.onStopped(new File(['x'], 'recording.webm'));
        // "record somewhere quiet with only you speaking" is actionable;
        // a generic failure is not — so the specific key must be the one asked for.
        await waitFor(() => expect(tKeys).toContain('voiceprint.error_multiple_speakers'));
    });
});
